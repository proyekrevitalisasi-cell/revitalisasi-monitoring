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

interface DeleteHolidayDialogProps {
  holidayId: string
  holidayName: string
  children: React.ReactNode
  onDeleted: (id: string) => void
}

export function DeleteHolidayDialog({ holidayId, holidayName, children, onDeleted }: DeleteHolidayDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleConfirm() {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/work-calendar/${holidayId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json.error) {
        setErrorMessage(json.error?.message ?? 'Gagal menghapus hari libur')
        return
      }
      onDeleted(holidayId)
      toast.success('Hari libur dihapus, CPM sedang dihitung ulang')
      setOpen(false)
    } catch {
      setErrorMessage('Gagal menghapus hari libur')
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
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus Hari Libur</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          Yakin ingin menghapus <span className="font-medium">{holidayName}</span>? Perubahan
          kalender akan mentrigger recalculate CPM di semua lokasi.
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
