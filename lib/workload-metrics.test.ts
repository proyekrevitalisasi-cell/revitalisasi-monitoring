import { describe, it, expect } from 'vitest'
import {
  computeWeekColumns,
  getWorkloadBand,
  buildPicWorkload,
  getActivitiesInCell,
} from './workload-metrics'
import type { WorkloadActivity } from './types'

function makeActivity(overrides: Partial<WorkloadActivity> & Pick<WorkloadActivity, 'pic' | 'status' | 'tanggal_mulai_rencana' | 'tanggal_selesai_rencana'>): WorkloadActivity {
  return {
    id: 'a1',
    kegiatan: 'Kegiatan Test',
    progress_pct: 0,
    phaseCode: 'F1',
    locationCode: 'TA',
    locationName: 'Tanah Abang',
    ...overrides,
  }
}

describe('computeWeekColumns', () => {
  it('starts the first window on the Monday of the reference week', () => {
    const columns = computeWeekColumns(new Date('2026-07-08'), 3) // Wednesday
    expect(columns[0].start).toBe('2026-07-06') // Monday
    expect(columns[0].end).toBe('2026-07-10') // Friday
  })

  it('returns the requested number of weeks', () => {
    const columns = computeWeekColumns(new Date('2026-07-08'), 12)
    expect(columns).toHaveLength(12)
  })

  it('advances each window by 7 days', () => {
    const columns = computeWeekColumns(new Date('2026-07-08'), 2)
    expect(columns[1].start).toBe('2026-07-13')
    expect(columns[1].end).toBe('2026-07-17')
  })
})

describe('getWorkloadBand', () => {
  it('returns low at 0', () => expect(getWorkloadBand(0)).toBe('low'))
  it('returns low at 1', () => expect(getWorkloadBand(1)).toBe('low'))
  it('returns medium at 2', () => expect(getWorkloadBand(2)).toBe('medium'))
  it('returns medium at 3', () => expect(getWorkloadBand(3)).toBe('medium'))
  it('returns high at 4', () => expect(getWorkloadBand(4)).toBe('high'))
  it('returns high above 4', () => expect(getWorkloadBand(10)).toBe('high'))
})

describe('buildPicWorkload', () => {
  const today = new Date('2026-07-08')
  const weekColumns = computeWeekColumns(today, 2) // [07-06..10], [07-13..17]

  it('excludes selesai activities from activeCount and weekCounts', () => {
    const activities = [
      makeActivity({ pic: 'Budi', status: 'selesai', tanggal_mulai_rencana: '2026-07-06', tanggal_selesai_rencana: '2026-07-08' }),
      makeActivity({ pic: 'Budi', status: 'sedang_berjalan', tanggal_mulai_rencana: '2026-07-07', tanggal_selesai_rencana: '2026-07-09' }),
    ]
    const rows = buildPicWorkload(activities, weekColumns, today)
    expect(rows[0].activeCount).toBe(1)
    expect(rows[0].weekCounts[0]).toBe(1)
  })

  it("counts an activity in every week its date range overlaps", () => {
    const activities = [
      makeActivity({ pic: 'Citra', status: 'belum_mulai', tanggal_mulai_rencana: '2026-07-09', tanggal_selesai_rencana: '2026-07-14' }),
    ]
    const rows = buildPicWorkload(activities, weekColumns, today)
    expect(rows[0].weekCounts).toEqual([1, 1])
  })

  it('picks the earliest upcoming start date over a past-due one', () => {
    const activities = [
      makeActivity({ pic: 'Dedi', status: 'sedang_berjalan', tanggal_mulai_rencana: '2026-07-01', tanggal_selesai_rencana: '2026-07-05' }),
      makeActivity({ pic: 'Dedi', status: 'belum_mulai', tanggal_mulai_rencana: '2026-07-20', tanggal_selesai_rencana: '2026-07-25' }),
    ]
    const rows = buildPicWorkload(activities, weekColumns, today)
    expect(rows[0].nextStart).toBe('2026-07-20')
  })

  it('falls back to the earliest overall start when nothing is upcoming', () => {
    const activities = [
      makeActivity({ pic: 'Eka', status: 'sedang_berjalan', tanggal_mulai_rencana: '2026-07-01', tanggal_selesai_rencana: '2026-07-05' }),
      makeActivity({ pic: 'Eka', status: 'ditunda', tanggal_mulai_rencana: '2026-06-20', tanggal_selesai_rencana: '2026-06-25' }),
    ]
    const rows = buildPicWorkload(activities, weekColumns, today)
    expect(rows[0].nextStart).toBe('2026-06-20')
  })

  it('sorts PIC rows alphabetically', () => {
    const activities = [
      makeActivity({ pic: 'Zainal', status: 'belum_mulai', tanggal_mulai_rencana: '2026-07-06', tanggal_selesai_rencana: '2026-07-10' }),
      makeActivity({ pic: 'Ani', status: 'belum_mulai', tanggal_mulai_rencana: '2026-07-06', tanggal_selesai_rencana: '2026-07-10' }),
    ]
    const rows = buildPicWorkload(activities, weekColumns, today)
    expect(rows.map((r) => r.pic)).toEqual(['Ani', 'Zainal'])
  })
})

describe('getActivitiesInCell', () => {
  it('returns only activities matching pic, non-selesai, and week overlap', () => {
    const weekColumns = computeWeekColumns(new Date('2026-07-08'), 1)
    const activities = [
      makeActivity({ id: 'a1', pic: 'Budi', status: 'sedang_berjalan', tanggal_mulai_rencana: '2026-07-06', tanggal_selesai_rencana: '2026-07-08' }),
      makeActivity({ id: 'a2', pic: 'Budi', status: 'selesai', tanggal_mulai_rencana: '2026-07-06', tanggal_selesai_rencana: '2026-07-08' }),
      makeActivity({ id: 'a3', pic: 'Citra', status: 'sedang_berjalan', tanggal_mulai_rencana: '2026-07-06', tanggal_selesai_rencana: '2026-07-08' }),
    ]
    const result = getActivitiesInCell(activities, 'Budi', weekColumns[0])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a1')
  })
})
