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

interface DeleteReportingItemDialogProps {
  itemId: string
  itemLabel: string
  onDeleted: (id: string) => void
}

export function DeleteReportingItemDialog({
  itemId,
  itemLabel,
  onDeleted,
}: DeleteReportingItemDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleConfirm() {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/reporting-items/${itemId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json.error) {
        setErrorMessage(json.error?.message ?? 'Gagal menghapus item pelaporan')
        return
      }
      onDeleted(itemId)
      toast.success('Item pelaporan dihapus')
      setOpen(false)
    } catch {
      setErrorMessage('Gagal menghapus item pelaporan')
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
        <button type="button" className="text-gray-400 hover:text-red-600" title="Hapus item pelaporan">
          🗑️
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus Item Pelaporan</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          Yakin ingin menghapus <span className="font-medium">{itemLabel}</span>?
        </p>
        {errorMessage && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
            {errorMessage}
          </p>
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
