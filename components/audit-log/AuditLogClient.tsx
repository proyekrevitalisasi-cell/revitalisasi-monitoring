'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AuditLogFilters, type AuditLogFilterState } from './AuditLogFilters'
import { AuditLogTable } from './AuditLogTable'
import { AuditDetailModal } from './AuditDetailModal'
import type { AuditLogEntry, ProfileOption } from '@/lib/types'

interface AuditLogClientProps {
  initialEntries: AuditLogEntry[]
  initialTotal: number
  profiles: ProfileOption[]
}

const LIMIT = 50

function emptyFilters(): AuditLogFilterState {
  return { entityType: 'all', userId: 'all', action: 'all', from: '', to: '' }
}

export function AuditLogClient({ initialEntries, initialTotal, profiles }: AuditLogClientProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>(initialEntries)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<AuditLogFilterState>(emptyFilters())
  const [loading, setLoading] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (filters.entityType !== 'all') params.set('entity_type', filters.entityType)
    if (filters.userId !== 'all') params.set('user_id', filters.userId)
    if (filters.action !== 'all') params.set('action', filters.action)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)

    let cancelled = false
    setLoading(true)
    fetch(`/api/audit-logs?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.error) throw new Error(json.error.message)
        setEntries(json.data.items)
        setTotal(json.data.total)
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Gagal memuat audit log')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [page, filters])

  function handleFiltersChange(next: AuditLogFilterState) {
    setFilters(next)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <AuditLogFilters filters={filters} profiles={profiles} onChange={handleFiltersChange} />
      {loading ? (
        <p className="text-sm text-gray-500">Memuat…</p>
      ) : (
        <AuditLogTable
          entries={entries}
          page={page}
          limit={LIMIT}
          total={total}
          onPageChange={setPage}
          onRowClick={setSelectedEntry}
        />
      )}
      <AuditDetailModal
        entry={selectedEntry}
        onOpenChange={(open) => !open && setSelectedEntry(null)}
      />
    </div>
  )
}
