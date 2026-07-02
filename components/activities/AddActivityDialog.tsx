'use client'

import { useState } from 'react'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { validateRencanaDates } from '@/lib/activity-helpers'
import type { Activity } from '@/lib/types'

interface AddActivityDialogProps {
  phaseId: string
  onCreated: (activity: Activity) => void
}

const EMPTY_FORM = {
  kegiatan: '',
  pic: '',
  tanggal_mulai_rencana: '',
  tanggal_selesai_rencana: '',
  is_milestone: false,
  catatan: '',
}

export function AddActivityDialog({ phaseId, onCreated }: AddActivityDialogProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!form.kegiatan.trim() || !form.pic.trim() || !form.tanggal_mulai_rencana || !form.tanggal_selesai_rencana) {
      toast.error('Kegiatan, PIC, dan tanggal rencana wajib diisi')
      return
    }
    const validationError = validateRencanaDates(form.tanggal_mulai_rencana, form.tanggal_selesai_rencana)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/phases/${phaseId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kegiatan: form.kegiatan,
          pic: form.pic,
          tanggal_mulai_rencana: form.tanggal_mulai_rencana,
          tanggal_selesai_rencana: form.tanggal_selesai_rencana,
          is_milestone: form.is_milestone,
          catatan: form.catatan || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Gagal menambah kegiatan')
      onCreated(json.data as Activity)
      toast.success('Kegiatan ditambahkan')
      setForm(EMPTY_FORM)
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambah kegiatan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          + Tambah Kegiatan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Kegiatan</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="add-kegiatan">Kegiatan</Label>
            <Input
              id="add-kegiatan"
              value={form.kegiatan}
              onChange={(e) => setForm({ ...form, kegiatan: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="add-pic">PIC</Label>
            <Input id="add-pic" value={form.pic} onChange={(e) => setForm({ ...form, pic: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="add-mulai">Rencana Mulai</Label>
              <Input
                id="add-mulai"
                type="date"
                value={form.tanggal_mulai_rencana}
                onChange={(e) => setForm({ ...form, tanggal_mulai_rencana: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="add-selesai">Rencana Selesai</Label>
              <Input
                id="add-selesai"
                type="date"
                value={form.tanggal_selesai_rencana}
                onChange={(e) => setForm({ ...form, tanggal_selesai_rencana: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="add-milestone"
              type="checkbox"
              checked={form.is_milestone}
              onChange={(e) => setForm({ ...form, is_milestone: e.target.checked })}
            />
            <Label htmlFor="add-milestone">Milestone</Label>
          </div>
          <div>
            <Label htmlFor="add-catatan">Catatan</Label>
            <Textarea
              id="add-catatan"
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Menyimpan…' : 'Tambah'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
