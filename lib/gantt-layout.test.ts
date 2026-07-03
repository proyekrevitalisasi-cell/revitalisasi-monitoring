import { describe, it, expect } from 'vitest'
import { computeDateRange, dateToOffset, computeDeviationDays, dependencyAnchor } from './gantt-layout'

describe('computeDateRange', () => {
  it('pads 3 days before the earliest and after the latest rencana date when no realisasi/baseline exist', () => {
    const activities = [
      {
        tanggal_mulai_rencana: '2026-07-01',
        tanggal_selesai_rencana: '2026-07-10',
        tanggal_mulai_realisasi: null,
        tanggal_selesai_realisasi: null,
      },
    ]
    const result = computeDateRange(activities, [])
    expect(result.start.toISOString().slice(0, 10)).toBe('2026-06-28')
    expect(result.end.toISOString().slice(0, 10)).toBe('2026-07-13')
  })

  it('extends the range when realisasi dates go past the rencana range', () => {
    const activities = [
      {
        tanggal_mulai_rencana: '2026-07-01',
        tanggal_selesai_rencana: '2026-07-10',
        tanggal_mulai_realisasi: '2026-07-02',
        tanggal_selesai_realisasi: '2026-07-15',
      },
    ]
    const result = computeDateRange(activities, [])
    expect(result.end.toISOString().slice(0, 10)).toBe('2026-07-18')
  })

  it('extends the range to cover baseline dates when a baseline exists', () => {
    const activities = [
      {
        tanggal_mulai_rencana: '2026-07-05',
        tanggal_selesai_rencana: '2026-07-10',
        tanggal_mulai_realisasi: null,
        tanggal_selesai_realisasi: null,
      },
    ]
    const baseline = [{ tanggal_mulai_rencana: '2026-06-20', tanggal_selesai_rencana: '2026-07-08' }]
    const result = computeDateRange(activities, baseline)
    expect(result.start.toISOString().slice(0, 10)).toBe('2026-06-17')
  })

  it('returns a small window around today when there are no activities at all', () => {
    const result = computeDateRange([], [])
    const diffDays = (result.end.getTime() - result.start.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBe(6)
  })
})

describe('dateToOffset', () => {
  it('returns 0 for the range start itself', () => {
    const start = new Date('2026-07-01')
    expect(dateToOffset(start, start, 24)).toBe(0)
  })

  it('scales linearly by dayWidth', () => {
    const start = new Date('2026-07-01')
    const date = new Date('2026-07-11') // 10 days later
    expect(dateToOffset(date, start, 4)).toBe(40)
    expect(dateToOffset(date, start, 24)).toBe(240)
  })

  it('returns a negative offset for a date before the range start', () => {
    const start = new Date('2026-07-10')
    const date = new Date('2026-07-05')
    expect(dateToOffset(date, start, 10)).toBe(-50)
  })
})

describe('computeDeviationDays', () => {
  it('returns 0 when the dates are identical', () => {
    const d = new Date('2026-07-01')
    expect(computeDeviationDays(d, d, [])).toBe(0)
  })

  it('returns a positive count when the actual date is later than baseline (slipped)', () => {
    const baseline = new Date('2026-07-01') // Wednesday
    const actual = new Date('2026-07-07') // Thu,Fri,Mon,Tue = 4 working days
    expect(computeDeviationDays(baseline, actual, [])).toBe(4)
  })

  it('returns a negative count when the actual date is earlier than baseline (ahead of schedule)', () => {
    const baseline = new Date('2026-07-07')
    const actual = new Date('2026-07-01')
    expect(computeDeviationDays(baseline, actual, [])).toBe(-4)
  })

  it('excludes holidays from the count', () => {
    const baseline = new Date('2026-07-01')
    const actual = new Date('2026-07-07')
    const holiday = new Date('2026-07-03') // Friday, inside the span
    expect(computeDeviationDays(baseline, actual, [holiday])).toBe(3)
  })
})

describe('dependencyAnchor', () => {
  it('FS: predecessor finish to successor start', () => {
    expect(dependencyAnchor('FS')).toEqual({ predecessorEdge: 'finish', successorEdge: 'start' })
  })
  it('SS: predecessor start to successor start', () => {
    expect(dependencyAnchor('SS')).toEqual({ predecessorEdge: 'start', successorEdge: 'start' })
  })
  it('FF: predecessor finish to successor finish', () => {
    expect(dependencyAnchor('FF')).toEqual({ predecessorEdge: 'finish', successorEdge: 'finish' })
  })
  it('SF: predecessor start to successor finish', () => {
    expect(dependencyAnchor('SF')).toEqual({ predecessorEdge: 'start', successorEdge: 'finish' })
  })
})
