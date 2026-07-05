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
} from '@/components/ui/dialog'
import type { Profile } from '@/lib/types'

interface UserActiveToggleProps {
  targetUserId: string
  targetRole: Profile['role']
  targetIsActive: boolean
  targetLabel: string
  actorRole: 'admin' | 'super_admin'
  actorUserId: string
  onToggled: (id: string, isActive: boolean) => void
}

export function UserActiveToggle({
  targetUserId,
  targetRole,
  targetIsActive,
  targetLabel,
  actorRole,
  actorUserId,
  onToggled,
}: UserActiveToggleProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (targetUserId === actorUserId) return null
  if (actorRole === 'admin' && targetRole !== 'viewer') return null

  async function deactivate() {
    setSubmitting(true)
    try {
      const res =
        actorRole === 'super_admin'
          ? await fetch(`/api/users/${targetUserId}`, { method: 'DELETE' })
          : await fetch(`/api/users/${targetUserId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_active: false }),
            })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menonaktifkan user')
      }
      onToggled(targetUserId, false)
      toast.success('User dinonaktifkan')
      setConfirmOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menonaktifkan user')
    } finally {
      setSubmitting(false)
    }
  }

  async function reactivate() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/users/${targetUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal mengaktifkan user')
      }
      onToggled(targetUserId, true)
      toast.success('User diaktifkan kembali')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengaktifkan user')
    } finally {
      setSubmitting(false)
    }
  }

  if (!targetIsActive) {
    return (
      <Button size="sm" variant="outline" onClick={reactivate} disabled={submitting}>
        {submitting ? 'Memproses…' : 'Aktifkan'}
      </Button>
    )
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setConfirmOpen(true)}>
        Nonaktifkan
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nonaktifkan User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Yakin ingin menonaktifkan <span className="font-medium">{targetLabel}</span>?
            {actorRole === 'super_admin' && ' User akan langsung ter-sign-out dari semua sesi.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Batal
            </Button>
            <Button variant="destructive" onClick={deactivate} disabled={submitting}>
              {submitting ? 'Menonaktifkan…' : 'Nonaktifkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
