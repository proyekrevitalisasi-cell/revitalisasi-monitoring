import { describe, it, expect } from 'vitest'
import {
  computeProgressPct,
  computeStatusCounts,
  isNeedsAttention,
  computeOverdueDays,
  computeProjectFinishDate,
} from './dashboard-metrics'

describe('computeProgressPct', () => {
  it('returns 0 for an empty array', () => {
    expect(computeProgressPct([])).toBe(0)
  })

  it("returns the single activity's own percentage", () => {
    expect(computeProgressPct([{ progress_pct: 40 }])).toBe(40)
  })

  it('averages multiple activities', () => {
    expect(
      computeProgressPct([{ progress_pct: 0 }, { progress_pct: 50 }, { progress_pct: 100 }])
    ).toBe(50)
  })

  it('rounds a non-integer average to the nearest integer', () => {
    expect(
      computeProgressPct([{ progress_pct: 0 }, { progress_pct: 0 }, { progress_pct: 100 }])
    ).toBe(33)
  })
})

describe('computeStatusCounts', () => {
  it('returns all zeros for an empty array', () => {
    expect(computeStatusCounts([])).toEqual({ critical: 0, ditunda: 0, selesai: 0, total: 0 })
  })

  it('counts critical, ditunda, and selesai independently across a mixed set', () => {
    const activities = [
      { status: 'selesai' as const, is_on_critical_path: true },
      { status: 'ditunda' as const, is_on_critical_path: false },
      { status: 'sedang_berjalan' as const, is_on_critical_path: true },
      { status: 'belum_mulai' as const, is_on_critical_path: false },
    ]
    expect(computeStatusCounts(activities)).toEqual({ critical: 2, ditunda: 1, selesai: 1, total: 4 })
  })
})

describe('isNeedsAttention', () => {
  const today = new Date('2026-07-10')

  it('is true when status is ditunda regardless of date', () => {
    expect(
      isNeedsAttention({ status: 'ditunda', tanggal_selesai_rencana: '2026-08-01' }, today)
    ).toBe(true)
  })

  it('is true when overdue and not selesai', () => {
    expect(
      isNeedsAttention({ status: 'sedang_berjalan', tanggal_selesai_rencana: '2026-07-01' }, today)
    ).toBe(true)
  })

  it('is false when overdue but already selesai', () => {
    expect(
      isNeedsAttention({ status: 'selesai', tanggal_selesai_rencana: '2026-07-01' }, today)
    ).toBe(false)
  })

  it('is false when not overdue and not ditunda', () => {
    expect(
      isNeedsAttention({ status: 'belum_mulai', tanggal_selesai_rencana: '2026-08-01' }, today)
    ).toBe(false)
  })
})

describe('computeOverdueDays', () => {
  const today = new Date('2026-07-10')

  it('returns a positive count when overdue', () => {
    expect(computeOverdueDays('2026-07-05', today)).toBe(5)
  })

  it('returns 0 when due exactly today', () => {
    expect(computeOverdueDays('2026-07-10', today)).toBe(0)
  })

  it('returns a negative count when not yet due', () => {
    expect(computeOverdueDays('2026-07-15', today)).toBe(-5)
  })
})

describe('computeProjectFinishDate', () => {
  it('returns null for an empty array', () => {
    expect(computeProjectFinishDate([])).toBeNull()
  })

  it("returns the single activity's date", () => {
    expect(computeProjectFinishDate([{ tanggal_selesai_rencana: '2026-07-10' }])).toBe('2026-07-10')
  })

  it('returns the maximum date across multiple activities', () => {
    const activities = [
      { tanggal_selesai_rencana: '2026-07-10' },
      { tanggal_selesai_rencana: '2026-09-01' },
      { tanggal_selesai_rencana: '2026-08-15' },
    ]
    expect(computeProjectFinishDate(activities)).toBe('2026-09-01')
  })
})
