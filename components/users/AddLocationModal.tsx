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
import type { Location } from '@/lib/types'

interface AddLocationModalProps {
  onAdded: (location: Location) => void
}

export function AddLocationModal({ onAdded }: AddLocationModalProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [projectStartDate, setProjectStartDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (name.trim().length < 2) {
      toast.error('Nama minimal 2 karakter')
      return
    }
    if (code.trim().length < 1) {
      toast.error('Kode wajib diisi')
      return
    }
    if (!projectStartDate) {
      toast.error('Tanggal mulai proyek wajib diisi')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code,
          description: description || undefined,
          project_start_date: projectStartDate,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menambah lokasi')
      }
      onAdded({
        id: json.data.id,
        name: json.data.name,
        code: json.data.code,
        description: description || null,
        project_start_date: projectStartDate,
        created_at: new Date().toISOString(),
      })
      toast.success('Lokasi ditambahkan')
      setOpen(false)
      setName('')
      setCode('')
      setDescription('')
      setProjectStartDate('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambah lokasi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Tambah Lokasi</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Lokasi</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nama</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Tanah Abang" />
          </div>
          <div className="space-y-1">
            <Label>Kode</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="mis. TA" />
          </div>
          <div className="space-y-1">
            <Label>Deskripsi</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>Tanggal Mulai Proyek</Label>
            <Input
              type="date"
              value={projectStartDate}
              onChange={(e) => setProjectStartDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
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
