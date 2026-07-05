'use client'

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuditAction, ProfileOption } from '@/lib/types'

const ENTITY_TYPES = [
  'activities',
  'baselines',
  'kk_consent',
  'locations',
  'reporting_items',
  'stakeholders',
  'activity_dependencies',
  'risk_items',
  'phases',
  'work_calendar',
  'profiles',
  'raci_entries',
]

const ACTIONS: AuditAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'BASELINE_SAVE',
  'RECALCULATE',
]

export interface AuditLogFilterState {
  entityType: string
  userId: string
  action: string
  from: string
  to: string
}

interface AuditLogFiltersProps {
  filters: AuditLogFilterState
  profiles: ProfileOption[]
  onChange: (filters: AuditLogFilterState) => void
}

export function AuditLogFilters({ filters, profiles, onChange }: AuditLogFiltersProps) {
  function set<K extends keyof AuditLogFilterState>(key: K, value: AuditLogFilterState[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap gap-3">
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-500">Entitas</Label>
        <Select value={filters.entityType} onValueChange={(v) => set('entityType', v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Entitas</SelectItem>
            {ENTITY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-500">User</Label>
        <Select value={filters.userId} onValueChange={(v) => set('userId', v)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua User</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-500">Aksi</Label>
        <Select value={filters.action} onValueChange={(v) => set('action', v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Aksi</SelectItem>
            {ACTIONS.map((action) => (
              <SelectItem key={action} value={action}>
                {action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-500">Dari Tanggal</Label>
        <Input
          type="date"
          value={filters.from}
          onChange={(e) => set('from', e.target.value)}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-500">Sampai Tanggal</Label>
        <Input
          type="date"
          value={filters.to}
          onChange={(e) => set('to', e.target.value)}
          className="w-40"
        />
      </div>
    </div>
  )
}
