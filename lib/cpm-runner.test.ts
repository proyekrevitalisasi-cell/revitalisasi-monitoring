import { describe, it, expect } from 'vitest'
import { computeActivityCpmUpdate, type CpmUpdateInput } from './cpm-runner'
import type { CpmNode } from './cpm'

const projectStart = new Date('2026-07-01')
const holidays: Date[] = []

function makeActivity(overrides: Partial<CpmUpdateInput> = {}): CpmUpdateInput {
  return {
    id: 'a1',
    tanggal_mulai_rencana: '2026-07-01',
    tanggal_selesai_rencana: '2026-07-02',
    date_locked: false,
    is_on_critical_path: false,
    total_float_days: 0,
    ...overrides,
  }
}

function makeNode(overrides: Partial<CpmNode> = {}): CpmNode {
  return {
    id: 'a1',
    duration: 2,
    dateLocked: false,
    lockedStartDate: null,
    earliestStart: 0,
    earliestFinish: 2,
    latestStart: 0,
    latestFinish: 2,
    totalFloat: 0,
    isCritical: false,
    ...overrides,
  }
}

describe('computeActivityCpmUpdate', () => {
  it('marks changed=true and includes new dates when an unlocked activity shifts', () => {
    const activity = makeActivity({ tanggal_mulai_rencana: '2026-07-05', tanggal_selesai_rencana: '2026-07-07' })
    const node = makeNode({ earliestStart: 0, earliestFinish: 2 })
    const result = computeActivityCpmUpdate(activity, node, projectStart, holidays)
    expect(result.shifted).toBe(true)
    expect(result.changed).toBe(true)
    expect(result.mulai).toBe('2026-07-01')
    expect(result.updates.tanggal_mulai_rencana).toBe('2026-07-01')
  })

  it('marks changed=false and omits updated_at/updated_by-relevant fields when nothing about the activity changed', () => {
    const activity = makeActivity({ is_on_critical_path: false, total_float_days: 0 })
    const node = makeNode({ earliestStart: 0, earliestFinish: 2, isCritical: false, totalFloat: 0 })
    const result = computeActivityCpmUpdate(activity, node, projectStart, holidays)
    expect(result.shifted).toBe(false)
    expect(result.changed).toBe(false)
    expect(result.updates).not.toHaveProperty('updated_at')
    expect(result.updates).not.toHaveProperty('updated_by')
  })

  it('marks changed=true on a critical-path flip alone, with no date shift', () => {
    const activity = makeActivity({ date_locked: true, is_on_critical_path: false, total_float_days: 0 })
    const node = makeNode({ isCritical: true, totalFloat: 0 })
    const result = computeActivityCpmUpdate(activity, node, projectStart, holidays)
    expect(result.shifted).toBe(false)
    expect(result.changed).toBe(true)
    expect(result.updates).not.toHaveProperty('tanggal_mulai_rencana')
  })

  it('never includes date fields in updates when the activity is date_locked', () => {
    const activity = makeActivity({ date_locked: true })
    const node = makeNode({ earliestStart: 5, earliestFinish: 7 })
    const result = computeActivityCpmUpdate(activity, node, projectStart, holidays)
    expect(result.updates).not.toHaveProperty('tanggal_mulai_rencana')
    expect(result.updates).not.toHaveProperty('tanggal_selesai_rencana')
    expect(result.updates.is_on_critical_path).toBe(false)
    expect(result.updates.total_float_days).toBe(0)
  })
})
