'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ReportingItem } from '@/lib/types'

interface ReportingItemFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: ReportingItem | null
  nextDisplayOrder: number
  onSaved: (item: ReportingItem) => void
}

interface FormState {
  jenis_laporan: string
  dari_pic: string
  kepada: string
  frekuensi: string
  isi_konten: string
  format_media: string
}

function emptyForm(): FormState {
  return {
    jenis_laporan: '',
    dari_pic: '',
    kepada: '',
    frekuensi: '',
    isi_konten: '',
    format_media: '',
  }
}

function formFromItem(item: ReportingItem): FormState {
  return {
    jenis_laporan: item.jenis_laporan,
    dari_pic: item.dari_pic,
    kepada: item.kepada,
    frekuensi: item.frekuensi,
    isi_konten: item.isi_konten,
    format_media: item.format_media,
  }
}

export function ReportingItemFormModal({
  open,
  onOpenChange,
  item,
  nextDisplayOrder,
  onSaved,
}: ReportingItemFormModalProps) {
  const isEdit = item !== null
  const [form, setForm] = useState<FormState>(() => (item ? formFromItem(item) : emptyForm()))
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setForm(item ? formFromItem(item) : emptyForm())
  }, [open, item])

  async function handleSubmit() {
    if (Object.values(form).some((v) => v.trim().length === 0)) {
      toast.error('Semua kolom wajib diisi')
      return
    }

    setSubmitting(true)
    try {
      const res =
        isEdit && item
          ? await fetch(`/api/reporting-items/${item.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(form),
            })
          : await fetch('/api/reporting-items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...form, display_order: nextDisplayOrder }),
            })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menyimpan item pelaporan')
      }
      onSaved(json.data as ReportingItem)
      toast.success(isEdit ? 'Item pelaporan diperbarui' : 'Item pelaporan ditambahkan')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan item pelaporan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Item Pelaporan' : 'Tambah Item Pelaporan'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Jenis Laporan</Label>
            <Input
              value={form.jenis_laporan}
              onChange={(e) => setForm((f) => ({ ...f, jenis_laporan: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Dari (PIC)</Label>
              <Input
                value={form.dari_pic}
                onChange={(e) => setForm((f) => ({ ...f, dari_pic: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Kepada</Label>
              <Input
                value={form.kepada}
                onChange={(e) => setForm((f) => ({ ...f, kepada: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Frekuensi</Label>
              <Input
                value={form.frekuensi}
                onChange={(e) => setForm((f) => ({ ...f, frekuensi: e.target.value }))}
                placeholder="mis. Mingguan"
              />
            </div>
            <div className="space-y-1">
              <Label>Format/Media</Label>
              <Input
                value={form.format_media}
                onChange={(e) => setForm((f) => ({ ...f, format_media: e.target.value }))}
                placeholder="mis. WhatsApp"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Isi Konten</Label>
            <Textarea
              value={form.isi_konten}
              onChange={(e) => setForm((f) => ({ ...f, isi_konten: e.target.value }))}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
