'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { Holiday } from '@/lib/types'

interface AddHolidayModalProps {
  onAdded: (holiday: Holiday) => void
}

export function AddHolidayModal({ onAdded }: AddHolidayModalProps) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!date || name.trim().length < 2) {
      toast.error('Tanggal dan nama hari libur wajib diisi')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/work-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holiday_date: date, name }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menambah hari libur')
      }
      onAdded(json.data as Holiday)
      toast.success('Hari libur ditambahkan, CPM sedang dihitung ulang')
      setOpen(false)
      setDate('')
      setName('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambah hari libur')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Tambah Hari Libur</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Hari Libur</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Tanggal</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Nama</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Cuti Bersama" />
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
