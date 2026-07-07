import type { RaciLocation, RaciRole, Stakeholder } from './types'

export function applyRaciCellChange(
  locations: RaciLocation[],
  phaseId: string,
  stakeholderId: string,
  role: RaciRole | null
): RaciLocation[] {
  return locations.map((loc) => ({
    ...loc,
    phases: loc.phases.map((phase) => {
      if (phase.id !== phaseId) return phase
      const withoutEntry = phase.raci_entries.filter((e) => e.stakeholder_id !== stakeholderId)
      return {
        ...phase,
        raci_entries: role ? [...withoutEntry, { stakeholder_id: stakeholderId, role }] : withoutEntry,
      }
    }),
  }))
}

export interface StakeholderSwapResult {
  stakeholders: Stakeholder[]
  swapped: [Stakeholder, Stakeholder]
}

export function swapStakeholderOrder(
  stakeholders: Stakeholder[],
  stakeholderId: string,
  direction: 'up' | 'down'
): StakeholderSwapResult | null {
  const index = stakeholders.findIndex((s) => s.id === stakeholderId)
  const neighborIndex = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || neighborIndex < 0 || neighborIndex >= stakeholders.length) return null

  const current = stakeholders[index]
  const neighbor = stakeholders[neighborIndex]
  const swappedCurrent = { ...current, display_order: neighbor.display_order }
  const swappedNeighbor = { ...neighbor, display_order: current.display_order }

  const result = [...stakeholders]
  result[index] = swappedNeighbor
  result[neighborIndex] = swappedCurrent
  result.sort((a, b) => a.display_order - b.display_order)

  return { stakeholders: result, swapped: [swappedCurrent, swappedNeighbor] }
}
