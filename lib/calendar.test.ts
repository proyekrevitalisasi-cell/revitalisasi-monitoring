import { describe, it, expect } from 'vitest'
import { addWorkingDays, workingDaysBetween, computeDurasiHK } from './calendar'

describe('addWorkingDays', () => {
  it('adding 0 days returns the same date', () => {
    const start = new Date('2026-07-01')
    expect(addWorkingDays(start, 0, [])).toEqual(start)
  })

  it('skips weekends when adding forward', () => {
    const friday = new Date('2026-07-03') // Friday
    const result = addWorkingDays(friday, 1, [])
    expect(result.toISOString().slice(0, 10)).toBe('2026-07-06') // Monday
  })

  it('skips holidays when adding forward', () => {
    const start = new Date('2026-07-01') // Wednesday
    const holiday = new Date('2026-07-02') // Thursday, declared a holiday
    const result = addWorkingDays(start, 1, [holiday])
    expect(result.toISOString().slice(0, 10)).toBe('2026-07-03') // Friday, skipping the holiday
  })

  it('goes backward correctly with negative days', () => {
    const monday = new Date('2026-07-06')
    const result = addWorkingDays(monday, -1, [])
    expect(result.toISOString().slice(0, 10)).toBe('2026-07-03') // Friday
  })
})

describe('workingDaysBetween', () => {
  it('returns 0 when start >= end', () => {
    const date = new Date('2026-07-01')
    expect(workingDaysBetween(date, date, [])).toBe(0)
  })

  it('counts working days exclusive of start, inclusive of end', () => {
    const wed = new Date('2026-07-01')
    const nextTue = new Date('2026-07-07') // Thu, Fri, (weekend), Mon, Tue = 4 working days
    expect(workingDaysBetween(wed, nextTue, [])).toBe(4)
  })

  it('excludes holidays from the count', () => {
    const wed = new Date('2026-07-01')
    const nextTue = new Date('2026-07-07')
    const holiday = new Date('2026-07-03') // Friday
    expect(workingDaysBetween(wed, nextTue, [holiday])).toBe(3)
  })
})

describe('computeDurasiHK', () => {
  it('returns 1 for a single-day activity', () => {
    expect(computeDurasiHK('2026-07-01', '2026-07-01', [])).toBe(1)
  })

  it('returns 5 for a Wed-Tue span (skipping one weekend)', () => {
    expect(computeDurasiHK('2026-07-01', '2026-07-07', [])).toBe(5)
  })

  it('excludes holidays from the duration', () => {
    const holiday = new Date('2026-07-03') // Friday, inside the span
    expect(computeDurasiHK('2026-07-01', '2026-07-07', [holiday])).toBe(4)
  })
})
