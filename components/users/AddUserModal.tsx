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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import type { Profile } from '@/lib/types'

interface AddUserModalProps {
  actorRole: 'admin' | 'super_admin'
  actorUserId: string
  onAdded: (profile: Profile) => void
}

export function AddUserModal({ actorRole, actorUserId, onAdded }: AddUserModalProps) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer')
  const [submitting, setSubmitting] = useState(false)

  const roleOptions: Array<{ value: 'admin' | 'viewer'; label: string }> =
    actorRole === 'super_admin'
      ? [
          { value: 'admin', label: 'Admin' },
          { value: 'viewer', label: 'Viewer' },
        ]
      : [{ value: 'viewer', label: 'Viewer' }]

  async function handleSubmit() {
    if (!email.includes('@')) {
      toast.error('Email tidak valid')
      return
    }
    if (fullName.trim().length < 2) {
      toast.error('Nama minimal 2 karakter')
      return
    }
    if (password.length < 8) {
      toast.error('Password minimal 8 karakter')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, full_name: fullName, password, role }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal membuat user')
      }
      onAdded({
        id: json.data.id,
        email: json.data.email,
        full_name: json.data.full_name,
        role: json.data.role,
        is_active: true,
        created_by: actorUserId,
        created_at: new Date().toISOString(),
      })
      toast.success('User dibuat')
      setOpen(false)
      setEmail('')
      setFullName('')
      setPassword('')
      setRole('viewer')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Buat User</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat User</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Nama Lengkap</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'viewer')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
