import { describe, it, expect } from 'vitest'
import { applyRaciCellChange, swapStakeholderOrder } from './raci-utils'
import type { RaciLocation, Stakeholder } from './types'

function makeLocations(): RaciLocation[] {
  return [
    {
      id: 'loc1', code: 'TA', name: 'Tebet A',
      phases: [
        { id: 'p1', phase_code: 'F1', name: 'Fase 1', display_order: 1, raci_entries: [{ stakeholder_id: 's1', role: 'R' }] },
        { id: 'p2', phase_code: 'F2', name: 'Fase 2', display_order: 2, raci_entries: [] },
      ],
    },
  ]
}

describe('applyRaciCellChange', () => {
  it('adds a new entry to an empty cell', () => {
    const result = applyRaciCellChange(makeLocations(), 'p2', 's2', 'A')
    expect(result[0].phases[1].raci_entries).toEqual([{ stakeholder_id: 's2', role: 'A' }])
  })

  it('replaces an existing entry for the same stakeholder', () => {
    const result = applyRaciCellChange(makeLocations(), 'p1', 's1', 'C')
    expect(result[0].phases[0].raci_entries).toEqual([{ stakeholder_id: 's1', role: 'C' }])
  })

  it('clears an entry when role is null', () => {
    const result = applyRaciCellChange(makeLocations(), 'p1', 's1', null)
    expect(result[0].phases[0].raci_entries).toEqual([])
  })

  it('does not touch a different phase', () => {
    const result = applyRaciCellChange(makeLocations(), 'p2', 's2', 'A')
    expect(result[0].phases[0].raci_entries).toEqual([{ stakeholder_id: 's1', role: 'R' }])
  })
})

function makeStakeholders(): Stakeholder[] {
  return [
    { id: 's1', code: 'A', name: 'Alpha', group_name: 'Internal', display_order: 1 },
    { id: 's2', code: 'B', name: 'Bravo', group_name: 'Internal', display_order: 2 },
    { id: 's3', code: 'C', name: 'Charlie', group_name: 'Internal', display_order: 3 },
  ]
}

describe('swapStakeholderOrder', () => {
  it('swaps a middle row up', () => {
    const result = swapStakeholderOrder(makeStakeholders(), 's2', 'up')
    expect(result).not.toBeNull()
    expect(result!.stakeholders.map((s) => s.id)).toEqual(['s2', 's1', 's3'])
    expect(result!.stakeholders.find((s) => s.id === 's2')!.display_order).toBe(1)
    expect(result!.stakeholders.find((s) => s.id === 's1')!.display_order).toBe(2)
  })

  it('swaps a middle row down', () => {
    const result = swapStakeholderOrder(makeStakeholders(), 's2', 'down')
    expect(result!.stakeholders.map((s) => s.id)).toEqual(['s1', 's3', 's2'])
  })

  it('returns null at the top boundary', () => {
    expect(swapStakeholderOrder(makeStakeholders(), 's1', 'up')).toBeNull()
  })

  it('returns null at the bottom boundary', () => {
    expect(swapStakeholderOrder(makeStakeholders(), 's3', 'down')).toBeNull()
  })

  it('returns null for an unknown stakeholder id', () => {
    expect(swapStakeholderOrder(makeStakeholders(), 'unknown', 'up')).toBeNull()
  })
})
