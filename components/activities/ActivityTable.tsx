'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ActivityRow } from './ActivityRow'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import type { Activity } from '@/lib/types'
import type { SaveStatus } from './SaveStatusBadge'

interface ActivityTableProps {
  phaseId: string
  initialActivities: Activity[]
  depCounts: Record<string, number>
  holidays: string[]
  isAdmin: boolean
}

export function ActivityTable({ phaseId, initialActivities, depCounts, holidays, isAdmin }: ActivityTableProps) {
  void phaseId // reserved for Task 7-8 (reorder/lock persistence); not yet used in this task
  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({})
  const pendingChanges = useRef<Record<string, Partial<Activity>>>({})
  const savedSnapshots = useRef<Record<string, Activity>>(
    Object.fromEntries(initialActivities.map((a) => [a.id, a]))
  )

  const setRowStatus = useCallback((id: string, status: SaveStatus) => {
    setSaveStatuses((prev) => ({ ...prev, [id]: status }))
    if (status === 'saved' || status === 'error') {
      setTimeout(
        () => {
          setSaveStatuses((prev) => (prev[id] === status ? { ...prev, [id]: 'idle' } : prev))
        },
        status === 'saved' ? 2000 : 3000
      )
    }
  }, [])

  const flushSave = useCallback(
    async (id: string) => {
      const changes = pendingChanges.current[id]
      if (!changes) return
      delete pendingChanges.current[id]
      setRowStatus(id, 'saving')

      try {
        const res = await fetch(`/api/activities/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Gagal menyimpan perubahan')
        }
        const updated = json.data as Activity
        savedSnapshots.current[id] = updated
        setActivities((prev) => prev.map((a) => (a.id === id ? updated : a)))
        setRowStatus(id, 'saved')
      } catch (err) {
        const snapshot = savedSnapshots.current[id]
        setActivities((prev) => prev.map((a) => (a.id === id ? snapshot : a)))
        setRowStatus(id, 'error')
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan perubahan')
      }
    },
    [setRowStatus]
  )

  const debouncedFlush = useDebouncedCallback((id: string) => {
    flushSave(id)
  }, 600)

  const handleFieldChange = useCallback(
    (id: string, changes: Partial<Activity>) => {
      setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)))
      pendingChanges.current[id] = { ...pendingChanges.current[id], ...changes }
      debouncedFlush(id)
    },
    [debouncedFlush]
  )

  // Wired to real reorder/lock logic in Tasks 7-8; no-op placeholders keep this task self-contained.
  const handleMove = useCallback((id: string, direction: 'up' | 'down') => {
    void id
    void direction
  }, [])
  const handleToggleLock = useCallback((id: string) => {
    void id
  }, [])

  const sortedActivities = [...activities].sort((a, b) => a.display_order - b.display_order)

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {isAdmin && <TableHead className="w-8" />}
            <TableHead className="w-10">Urut</TableHead>
            <TableHead className="w-8">♦</TableHead>
            <TableHead className="w-8">🔒</TableHead>
            <TableHead className="w-16">Kritis</TableHead>
            <TableHead>Kegiatan</TableHead>
            <TableHead>PIC</TableHead>
            <TableHead className="w-14">Dep</TableHead>
            <TableHead>Rencana Mulai</TableHead>
            <TableHead>Rencana Selesai</TableHead>
            <TableHead className="w-20">Durasi (HK)</TableHead>
            <TableHead>Baseline Mulai</TableHead>
            <TableHead className="w-20">Deviasi</TableHead>
            <TableHead>Realisasi Mulai</TableHead>
            <TableHead>Realisasi Selesai</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24">%</TableHead>
            <TableHead>Catatan</TableHead>
            <TableHead className="w-16">Risiko</TableHead>
            {isAdmin && <TableHead className="w-20">Simpan</TableHead>}
            {isAdmin && <TableHead className="w-8" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedActivities.map((activity, index) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              index={index}
              isFirst={index === 0}
              isLast={index === sortedActivities.length - 1}
              depCount={depCounts[activity.id] ?? 0}
              holidays={holidays}
              isAdmin={isAdmin}
              saveStatus={saveStatuses[activity.id] ?? 'idle'}
              onFieldChange={handleFieldChange}
              onMove={handleMove}
              onToggleLock={handleToggleLock}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
