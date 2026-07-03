'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { CpmSummary } from '@/lib/types'

interface DeleteActivityDialogProps {
  activityId: string
  activityName: string
  onDeleted: (id: string, cpm: CpmSummary | null) => void
}

export function DeleteActivityDialog({ activityId, activityName, onDeleted }: DeleteActivityDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleConfirm() {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/activities/${activityId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json.error) {
        setErrorMessage(json.error?.message ?? 'Gagal menghapus kegiatan')
        return
      }
      const { cpm } = json.data as { id: string; cpm: CpmSummary | null }
      onDeleted(activityId, cpm)
      toast.success('Kegiatan dihapus')
      setOpen(false)
    } catch {
      setErrorMessage('Gagal menghapus kegiatan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setErrorMessage(null)
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className="text-gray-400 hover:text-red-600" title="Hapus kegiatan">
          🗑️
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus Kegiatan</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          Yakin ingin menghapus <span className="font-medium">{activityName}</span>?
        </p>
        {errorMessage && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{errorMessage}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Batal
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Menghapus…' : 'Hapus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
