'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ActivityRow } from './ActivityRow'
import { AddActivityDialog } from './AddActivityDialog'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import type { Activity, CpmSummary } from '@/lib/types'
import type { SaveStatus } from './SaveStatusBadge'

interface ActivityTableProps {
  phaseId: string
  initialActivities: Activity[]
  depCounts: Record<string, number>
  holidays: string[]
  isAdmin: boolean
}

export function ActivityTable({ phaseId, initialActivities, depCounts, holidays, isAdmin }: ActivityTableProps) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({})
  const [movingIds, setMovingIds] = useState<Set<string>>(new Set())
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

  const applyCpmResult = useCallback((cpm: CpmSummary | null) => {
    if (!cpm) return
    setActivities((prev) =>
      prev.map((a) => {
        const match = cpm.updatedActivities.find((u) => u.id === a.id)
        return match ? { ...a, ...match } : a
      })
    )
    if (cpm.shiftedCount > 0) {
      toast.info(`${cpm.shiftedCount} kegiatan ikut disesuaikan jadwalnya`)
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
        const { activity: updated, cpm } = json.data as { activity: Activity; cpm: CpmSummary | null }
        savedSnapshots.current[id] = updated
        setActivities((prev) => prev.map((a) => (a.id === id ? updated : a)))
        setRowStatus(id, 'saved')
        applyCpmResult(cpm)
      } catch (err) {
        const snapshot = savedSnapshots.current[id]
        setActivities((prev) => prev.map((a) => (a.id === id ? snapshot : a)))
        setRowStatus(id, 'error')
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan perubahan')
      }
    },
    [setRowStatus, applyCpmResult]
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

  const handleCreated = useCallback((activity: Activity) => {
    savedSnapshots.current[activity.id] = activity
    setActivities((prev) => [...prev, activity])
  }, [])

  const handleDeleted = useCallback(
    (id: string, cpm: CpmSummary | null) => {
      delete savedSnapshots.current[id]
      setActivities((prev) => prev.filter((a) => a.id !== id))
      applyCpmResult(cpm)
    },
    [applyCpmResult]
  )

  const handleMove = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      const sorted = [...activities].sort((a, b) => a.display_order - b.display_order)
      const currentIndex = sorted.findIndex((a) => a.id === id)
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= sorted.length) return

      const current = sorted[currentIndex]
      const target = sorted[targetIndex]
      if (movingIds.has(current.id) || movingIds.has(target.id)) return

      setMovingIds((prev) => new Set(prev).add(current.id).add(target.id))

      const swappedOrders: Record<string, number> = {
        [current.id]: target.display_order,
        [target.id]: current.display_order,
      }

      setActivities((prev) =>
        prev.map((a) => (a.id in swappedOrders ? { ...a, display_order: swappedOrders[a.id] } : a))
      )

      try {
        const res = await fetch('/api/activities/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [
              { id: current.id, display_order: target.display_order },
              { id: target.id, display_order: current.display_order },
            ],
          }),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Gagal mengubah urutan')
      } catch (err) {
        setActivities((prev) =>
          prev.map((a) => {
            if (a.id === current.id) return { ...a, display_order: current.display_order }
            if (a.id === target.id) return { ...a, display_order: target.display_order }
            return a
          })
        )
        toast.error(err instanceof Error ? err.message : 'Gagal mengubah urutan')
      } finally {
        setMovingIds((prev) => {
          const next = new Set(prev)
          next.delete(current.id)
          next.delete(target.id)
          return next
        })
      }
    },
    [activities, movingIds]
  )
  const handleToggleLock = useCallback(
    async (id: string) => {
      setRowStatus(id, 'saving')
      try {
        const res = await fetch(`/api/activities/${id}/lock`, { method: 'PATCH' })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Gagal mengubah kunci tanggal')
        const dateLocked = json.data.date_locked as boolean
        setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, date_locked: dateLocked } : a)))
        savedSnapshots.current[id] = { ...savedSnapshots.current[id], date_locked: dateLocked }
        setRowStatus(id, 'saved')
      } catch (err) {
        setRowStatus(id, 'error')
        toast.error(err instanceof Error ? err.message : 'Gagal mengubah kunci tanggal')
      }
    },
    [setRowStatus]
  )

  const sortedActivities = [...activities].sort((a, b) => a.display_order - b.display_order)

  return (
    <div>
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
                isMoving={movingIds.has(activity.id)}
                onFieldChange={handleFieldChange}
                onMove={handleMove}
                onToggleLock={handleToggleLock}
                onDeleted={handleDeleted}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      {isAdmin && (
        <div className="mt-3">
          <AddActivityDialog phaseId={phaseId} onCreated={handleCreated} />
        </div>
      )}
    </div>
  )
}
