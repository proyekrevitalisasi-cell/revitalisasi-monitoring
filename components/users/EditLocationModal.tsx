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
import type { Location } from '@/lib/types'

interface EditLocationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  location: Location | null
  onSaved: (location: Location) => void
}

export function EditLocationModal({
  open,
  onOpenChange,
  location,
  onSaved,
}: EditLocationModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && location) {
      setName(location.name)
      setDescription(location.description ?? '')
    }
  }, [open, location])

  async function handleSubmit() {
    if (!location) return
    if (name.trim().length < 2) {
      toast.error('Nama minimal 2 karakter')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/locations/${location.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menyimpan lokasi')
      }
      onSaved({ ...location, ...json.data })
      toast.success('Lokasi diperbarui')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan lokasi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Lokasi</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nama</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Deskripsi</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
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
