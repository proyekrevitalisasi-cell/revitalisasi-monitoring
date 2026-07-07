'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatDateID } from '@/lib/date-format'
import type { Baseline } from '@/lib/types'

interface BaselinePanelProps {
  locationId: string
  baselines: Baseline[]
}

export function BaselinePanel({ locationId, baselines }: BaselinePanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)

  async function handleSave() {
    if (name.trim().length < 2) {
      toast.error('Nama baseline minimal 2 karakter')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/locations/${locationId}/baselines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menyimpan baseline')
      }
      toast.success('Baseline disimpan')
      setName('')
      setDescription('')
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan baseline')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleActivate(id: string) {
    setActivatingId(id)
    try {
      const res = await fetch(`/api/baselines/${id}/activate`, { method: 'PATCH' })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal mengaktifkan baseline')
      }
      toast.success('Baseline diaktifkan')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengaktifkan baseline')
    } finally {
      setActivatingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Kelola Baseline</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kelola Baseline</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Nama Baseline</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Baseline Awal"
          />
          <Label>Deskripsi (opsional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? 'Menyimpan…' : 'Simpan Baseline Baru'}
          </Button>
        </div>
        <div className="space-y-2 border-t pt-3">
          <Label>Riwayat Baseline</Label>
          {baselines.length === 0 && (
            <p className="text-sm text-gray-500">Belum ada baseline.</p>
          )}
          {baselines.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <div>
                <p className="font-medium">{b.name}</p>
                <p className="text-xs text-gray-500">{formatDateID(b.created_at)}</p>
              </div>
              {b.is_active ? (
                <Badge>Aktif</Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleActivate(b.id)}
                  disabled={activatingId === b.id}
                >
                  {activatingId === b.id ? 'Mengaktifkan…' : 'Aktifkan'}
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
