import { addDays, subDays } from 'date-fns'
import { workingDaysBetween } from '@/lib/calendar'

const RANGE_PADDING_DAYS = 3

export interface DateRange {
  start: Date
  end: Date
}

interface ActivityDateFields {
  tanggal_mulai_rencana: string
  tanggal_selesai_rencana: string
  tanggal_mulai_realisasi: string | null
  tanggal_selesai_realisasi: string | null
}

interface BaselineDateFields {
  tanggal_mulai_rencana: string
  tanggal_selesai_rencana: string
}

export function computeDateRange(
  activities: ActivityDateFields[],
  baselineActivities: BaselineDateFields[]
): DateRange {
  const dates: Date[] = []
  for (const a of activities) {
    dates.push(new Date(a.tanggal_mulai_rencana))
    dates.push(new Date(a.tanggal_selesai_rencana))
    if (a.tanggal_mulai_realisasi) dates.push(new Date(a.tanggal_mulai_realisasi))
    if (a.tanggal_selesai_realisasi) dates.push(new Date(a.tanggal_selesai_realisasi))
  }
  for (const b of baselineActivities) {
    dates.push(new Date(b.tanggal_mulai_rencana))
    dates.push(new Date(b.tanggal_selesai_rencana))
  }

  if (dates.length === 0) {
    const today = new Date()
    return { start: subDays(today, RANGE_PADDING_DAYS), end: addDays(today, RANGE_PADDING_DAYS) }
  }

  const min = new Date(Math.min(...dates.map((d) => d.getTime())))
  const max = new Date(Math.max(...dates.map((d) => d.getTime())))
  return { start: subDays(min, RANGE_PADDING_DAYS), end: addDays(max, RANGE_PADDING_DAYS) }
}

export function dateToOffset(date: Date, rangeStart: Date, dayWidth: number): number {
  const diffMs = date.getTime() - rangeStart.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays * dayWidth
}

/**
 * Signed working-day difference between a baseline date and the current
 * (rencana) date. Positive = slipped later than baseline, negative = moved
 * earlier. lib/calendar.ts's workingDaysBetween(start, end, holidays) only
 * counts forward and returns 0 when start >= end, so it cannot represent
 * "earlier than baseline" on its own — this wraps it with a direction check.
 */
export function computeDeviationDays(baselineDate: Date, actualDate: Date, holidays: Date[]): number {
  if (actualDate.getTime() === baselineDate.getTime()) return 0
  if (actualDate.getTime() > baselineDate.getTime()) {
    return workingDaysBetween(baselineDate, actualDate, holidays)
  }
  return -workingDaysBetween(actualDate, baselineDate, holidays)
}

export type GanttDepType = 'FS' | 'SS' | 'FF' | 'SF'

export function dependencyAnchor(depType: GanttDepType): {
  predecessorEdge: 'start' | 'finish'
  successorEdge: 'start' | 'finish'
} {
  switch (depType) {
    case 'FS':
      return { predecessorEdge: 'finish', successorEdge: 'start' }
    case 'SS':
      return { predecessorEdge: 'start', successorEdge: 'start' }
    case 'FF':
      return { predecessorEdge: 'finish', successorEdge: 'finish' }
    case 'SF':
      return { predecessorEdge: 'start', successorEdge: 'finish' }
  }
}
