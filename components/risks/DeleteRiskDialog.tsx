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

interface DeleteRiskDialogProps {
  riskId: string
  riskTitle: string
  onDeleted: (id: string) => void
}

export function DeleteRiskDialog({ riskId, riskTitle, onDeleted }: DeleteRiskDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleConfirm() {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/risks/${riskId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json.error) {
        setErrorMessage(json.error?.message ?? 'Gagal menghapus risiko')
        return
      }
      onDeleted(riskId)
      toast.success('Risiko dihapus')
      setOpen(false)
    } catch {
      setErrorMessage('Gagal menghapus risiko')
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
        <button type="button" className="text-gray-400 hover:text-red-600" title="Hapus risiko">
          🗑️
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus Risiko</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          Yakin ingin menghapus <span className="font-medium">{riskTitle}</span>?
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
