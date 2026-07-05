'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import type { RaciRole } from '@/lib/types'

const ROLE_LABELS: Record<RaciRole, string> = { R: 'R', A: 'A', C: 'C', I: 'I' }

interface RaciCellProps {
  phaseId: string
  stakeholderId: string
  role: RaciRole | null
  canEdit: boolean
  onChanged: (role: RaciRole | null) => void
}

export function RaciCell({ phaseId, stakeholderId, role, canEdit, onChanged }: RaciCellProps) {
  const [saving, setSaving] = useState(false)

  async function handleChange(value: string) {
    const nextRole = value === 'NONE' ? null : (value as RaciRole)
    setSaving(true)
    try {
      const res = await fetch(`/api/phases/${phaseId}/raci/${stakeholderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menyimpan RACI')
      }
      onChanged(nextRole)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan RACI')
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) {
    return (
      <span className="flex items-center justify-center text-sm font-medium text-gray-600">
        {role ? ROLE_LABELS[role] : '–'}
      </span>
    )
  }

  return (
    <Select value={role ?? 'NONE'} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className="w-14 h-8 mx-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="NONE">–</SelectItem>
        <SelectItem value="R">R</SelectItem>
        <SelectItem value="A">A</SelectItem>
        <SelectItem value="C">C</SelectItem>
        <SelectItem value="I">I</SelectItem>
      </SelectContent>
    </Select>
  )
}
