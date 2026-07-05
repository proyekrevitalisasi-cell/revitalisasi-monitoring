'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { RaciMatrix } from './RaciMatrix'
import { AddStakeholderModal } from './AddStakeholderModal'
import type { RaciLocation, RaciRole, Stakeholder } from '@/lib/types'

interface RaciClientProps {
  locations: RaciLocation[]
  initialStakeholders: Stakeholder[]
  isAdmin: boolean
}

export function RaciClient({ locations, initialStakeholders, isAdmin }: RaciClientProps) {
  const [locationsState, setLocationsState] = useState<RaciLocation[]>(locations)
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>(
    [...initialStakeholders].sort((a, b) => a.display_order - b.display_order)
  )
  const [selectedCode, setSelectedCode] = useState(locations[0]?.code ?? '')

  if (locationsState.length === 0) {
    return <p className="text-sm text-gray-500">Tidak ada lokasi aktif.</p>
  }

  const selectedLocation = locationsState.find((loc) => loc.code === selectedCode) ?? null
  const phases = selectedLocation
    ? [...selectedLocation.phases].sort((a, b) => a.display_order - b.display_order)
    : []

  function handleCellChanged(phaseId: string, stakeholderId: string, role: RaciRole | null) {
    setLocationsState((prev) =>
      prev.map((loc) => ({
        ...loc,
        phases: loc.phases.map((phase) => {
          if (phase.id !== phaseId) return phase
          const withoutEntry = phase.raci_entries.filter((e) => e.stakeholder_id !== stakeholderId)
          return {
            ...phase,
            raci_entries: role
              ? [...withoutEntry, { stakeholder_id: stakeholderId, role }]
              : withoutEntry,
          }
        }),
      }))
    )
  }

  async function handleReorder(stakeholderId: string, direction: 'up' | 'down') {
    const index = stakeholders.findIndex((s) => s.id === stakeholderId)
    const neighborIndex = direction === 'up' ? index - 1 : index + 1
    if (index === -1 || neighborIndex < 0 || neighborIndex >= stakeholders.length) return

    const current = stakeholders[index]
    const neighbor = stakeholders[neighborIndex]
    const previous = stakeholders

    const swapped = [...stakeholders]
    swapped[index] = { ...neighbor, display_order: current.display_order }
    swapped[neighborIndex] = { ...current, display_order: neighbor.display_order }
    setStakeholders(swapped.sort((a, b) => a.display_order - b.display_order))

    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/stakeholders/${current.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_order: neighbor.display_order }),
        }),
        fetch(`/api/stakeholders/${neighbor.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_order: current.display_order }),
        }),
      ])
      const [json1, json2] = await Promise.all([res1.json(), res2.json()])
      if (!res1.ok || json1.error || !res2.ok || json2.error) {
        throw new Error(json1.error?.message ?? json2.error?.message ?? 'Gagal menukar urutan')
      }
    } catch (err) {
      setStakeholders(previous)
      toast.error(err instanceof Error ? err.message : 'Gagal menukar urutan')
    }
  }

  function handleStakeholderDeleted(id: string) {
    setStakeholders((prev) => prev.filter((s) => s.id !== id))
  }

  function handleStakeholderAdded(stakeholder: Stakeholder) {
    setStakeholders((prev) =>
      [...prev, stakeholder].sort((a, b) => a.display_order - b.display_order)
    )
  }

  const nextDisplayOrder =
    stakeholders.length === 0 ? 0 : Math.max(...stakeholders.map((s) => s.display_order)) + 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-500">Lokasi</Label>
          <Select value={selectedCode} onValueChange={setSelectedCode}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locationsState.map((loc) => (
                <SelectItem key={loc.code} value={loc.code}>
                  {loc.name} ({loc.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <AddStakeholderModal nextDisplayOrder={nextDisplayOrder} onAdded={handleStakeholderAdded} />
        )}
      </div>

      <RaciMatrix
        phases={phases}
        stakeholders={stakeholders}
        isAdmin={isAdmin}
        onCellChanged={handleCellChanged}
        onReorder={handleReorder}
        onDeleted={handleStakeholderDeleted}
      />
    </div>
  )
}
