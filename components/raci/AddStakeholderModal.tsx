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
import type { Stakeholder } from '@/lib/types'

interface AddStakeholderModalProps {
  nextDisplayOrder: number
  onAdded: (stakeholder: Stakeholder) => void
}

export function AddStakeholderModal({ nextDisplayOrder, onAdded }: AddStakeholderModalProps) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (code.trim().length < 1 || name.trim().length < 2 || groupName.trim().length < 1) {
      toast.error('Kode, nama, dan grup wajib diisi')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/stakeholders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name,
          group_name: groupName,
          display_order: nextDisplayOrder,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menambah stakeholder')
      }
      onAdded(json.data as Stakeholder)
      toast.success('Stakeholder ditambahkan')
      setOpen(false)
      setCode('')
      setName('')
      setGroupName('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambah stakeholder')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Tambah Stakeholder</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Stakeholder</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Kode</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="mis. BAPPENAS" />
          </div>
          <div className="space-y-1">
            <Label>Nama</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Kementerian PPN/Bappenas"
            />
          </div>
          <div className="space-y-1">
            <Label>Grup</Label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="mis. Bappenas"
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
