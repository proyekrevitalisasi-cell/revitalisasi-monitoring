'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import type { Dependency, LocationActivitySummary, CpmSummary } from '@/lib/types'

const DEP_TYPES: Array<Dependency['dep_type']> = ['FS', 'SS', 'FF', 'SF']

interface DependencyPanelProps {
  activity: { id: string; kegiatan: string }
  dependencies: Dependency[]
  locationActivities: LocationActivitySummary[]
  isAdmin: boolean
  onDependencyAdded: (dep: Dependency, cpm: CpmSummary | null) => void
  onDependencyDeleted: (depId: string, cpm: CpmSummary | null) => void
}

function activityLabel(id: string, locationActivities: LocationActivitySummary[]): string {
  const found = locationActivities.find((a) => a.id === id)
  return found ? `${found.phaseCode} — ${found.kegiatan}` : id
}

export function DependencyPanel({
  activity,
  dependencies,
  locationActivities,
  isAdmin,
  onDependencyAdded,
  onDependencyDeleted,
}: DependencyPanelProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'predecessor' | 'successor'>('predecessor')
  const [selectedActivityId, setSelectedActivityId] = useState('')
  const [depType, setDepType] = useState<Dependency['dep_type']>('FS')
  const [lagDays, setLagDays] = useState('0')
  const [submitting, setSubmitting] = useState(false)

  const predecessors = dependencies.filter((d) => d.successor_id === activity.id)
  const successors = dependencies.filter((d) => d.predecessor_id === activity.id)
  const depCount = predecessors.length + successors.length

  const relatedIds = new Set([
    activity.id,
    ...(tab === 'predecessor' ? predecessors.map((d) => d.predecessor_id) : successors.map((d) => d.successor_id)),
  ])
  const candidateActivities = locationActivities.filter((a) => !relatedIds.has(a.id))

  function resetForm() {
    setSelectedActivityId('')
    setDepType('FS')
    setLagDays('0')
  }

  async function handleAdd() {
    if (!selectedActivityId) {
      toast.error('Pilih kegiatan terlebih dahulu')
      return
    }
    const body =
      tab === 'predecessor'
        ? { predecessor_id: selectedActivityId, successor_id: activity.id, dep_type: depType, lag_days: Number(lagDays) || 0 }
        : { predecessor_id: activity.id, successor_id: selectedActivityId, dep_type: depType, lag_days: Number(lagDays) || 0 }

    setSubmitting(true)
    try {
      const res = await fetch('/api/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menambah dependensi')
      }
      const { dependency, cpm } = json.data as { dependency: Dependency; cpm: CpmSummary | null }
      onDependencyAdded(dependency, cpm)
      toast.success('Dependensi ditambahkan')
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambah dependensi')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(depId: string) {
    try {
      const res = await fetch(`/api/dependencies/${depId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menghapus dependensi')
      }
      const { cpm } = json.data as { id: string; cpm: CpmSummary | null }
      onDependencyDeleted(depId, cpm)
      toast.success('Dependensi dihapus')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus dependensi')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <button type="button">
          <Badge variant="secondary">{depCount}</Badge>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dependensi Kegiatan: {activity.kegiatan}</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'predecessor' | 'successor')}>
          <TabsList>
            <TabsTrigger value="predecessor">Predecessor ({predecessors.length})</TabsTrigger>
            <TabsTrigger value="successor">Successor ({successors.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="predecessor" className="space-y-2">
            {predecessors.length === 0 && <p className="text-sm text-gray-500">Belum ada predecessor.</p>}
            {predecessors.map((dep) => (
              <div key={dep.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>
                  {activityLabel(dep.predecessor_id, locationActivities)} — {dep.dep_type}, lag {dep.lag_days}
                </span>
                {isAdmin && (
                  <button type="button" onClick={() => handleDelete(dep.id)} className="text-gray-400 hover:text-red-600">
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="successor" className="space-y-2">
            {successors.length === 0 && <p className="text-sm text-gray-500">Belum ada successor.</p>}
            {successors.map((dep) => (
              <div key={dep.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>
                  {activityLabel(dep.successor_id, locationActivities)} — {dep.dep_type}, lag {dep.lag_days}
                </span>
                {isAdmin && (
                  <button type="button" onClick={() => handleDelete(dep.id)} className="text-gray-400 hover:text-red-600">
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
        {isAdmin && (
          <div className="space-y-2 border-t pt-3">
            <Label>+ Tambah {tab === 'predecessor' ? 'Predecessor' : 'Successor'}</Label>
            <Select value={selectedActivityId} onValueChange={setSelectedActivityId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kegiatan" />
              </SelectTrigger>
              <SelectContent>
                {candidateActivities.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.phaseCode} — {a.kegiatan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Select value={depType} onValueChange={(v) => setDepType(v as Dependency['dep_type'])}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={lagDays}
                onChange={(e) => setLagDays(e.target.value)}
                placeholder="Lag (hari)"
                className="w-28"
              />
              <Button onClick={handleAdd} disabled={submitting}>
                {submitting ? 'Menyimpan…' : 'Tambah'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
