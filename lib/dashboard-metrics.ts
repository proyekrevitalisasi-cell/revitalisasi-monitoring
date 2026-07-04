import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { ActivityStatus } from '@/lib/types'

export function computeProgressPct(activities: Array<{ progress_pct: number }>): number {
  if (activities.length === 0) return 0
  const sum = activities.reduce((acc, a) => acc + a.progress_pct, 0)
  return Math.round(sum / activities.length)
}

export interface StatusCounts {
  critical: number
  ditunda: number
  selesai: number
  total: number
}

export function computeStatusCounts(
  activities: Array<{ status: ActivityStatus; is_on_critical_path: boolean }>
): StatusCounts {
  return {
    critical: activities.filter((a) => a.is_on_critical_path).length,
    ditunda: activities.filter((a) => a.status === 'ditunda').length,
    selesai: activities.filter((a) => a.status === 'selesai').length,
    total: activities.length,
  }
}

export function isNeedsAttention(
  activity: { status: ActivityStatus; tanggal_selesai_rencana: string },
  today: Date
): boolean {
  if (activity.status === 'ditunda') return true
  if (activity.status === 'selesai') return false
  return parseISO(activity.tanggal_selesai_rencana) < today
}

export function computeOverdueDays(tanggalSelesaiRencana: string, today: Date): number {
  return differenceInCalendarDays(today, parseISO(tanggalSelesaiRencana))
}

export function computeProjectFinishDate(
  activities: Array<{ tanggal_selesai_rencana: string }>
): string | null {
  if (activities.length === 0) return null
  return activities.reduce(
    (max, a) => (a.tanggal_selesai_rencana > max ? a.tanggal_selesai_rencana : max),
    activities[0].tanggal_selesai_rencana
  )
}
