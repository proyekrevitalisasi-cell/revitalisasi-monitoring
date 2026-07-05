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

interface DeleteStakeholderDialogProps {
  stakeholderId: string
  stakeholderLabel: string
  onDeleted: (id: string) => void
}

export function DeleteStakeholderDialog({
  stakeholderId,
  stakeholderLabel,
  onDeleted,
}: DeleteStakeholderDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleConfirm() {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/stakeholders/${stakeholderId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json.error) {
        setErrorMessage(json.error?.message ?? 'Gagal menonaktifkan stakeholder')
        return
      }
      onDeleted(stakeholderId)
      toast.success('Stakeholder dinonaktifkan')
      setOpen(false)
    } catch {
      setErrorMessage('Gagal menonaktifkan stakeholder')
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
        <button
          type="button"
          className="text-gray-400 hover:text-red-600 text-sm leading-none px-1"
          title={`Nonaktifkan ${stakeholderLabel}`}
        >
          ×
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nonaktifkan Stakeholder</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          Yakin ingin menonaktifkan <span className="font-medium">{stakeholderLabel}</span>? Nilai
          RACI stakeholder ini di semua fase tetap tersimpan, tapi kolomnya tidak akan tampil lagi
          di matriks.
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
            {submitting ? 'Menonaktifkan…' : 'Nonaktifkan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
