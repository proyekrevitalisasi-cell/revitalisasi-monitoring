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

// Same-day-due activities are treated as needing attention as soon as any
// time passes past midnight (this compares against a live `today` Date, not
// a start-of-day-normalized one). Confirmed intentional -- an activity due
// "today" should already show up as needing attention, not wait until the
// day is over.
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

export function buildActivityIssueRows(
  phaseGroups: Array<{
    phase_code: string
    activities: Array<{
      id: string
      kegiatan: string
      pic: string
      status: ActivityStatus
      tanggal_selesai_rencana: string
    }>
  }>,
  today: Date,
  locationMeta?: { locationName: string; locationCode: string }
) {
  return phaseGroups
    .flatMap((phase) =>
      phase.activities
        .filter((a) => isNeedsAttention(a, today))
        .map((a) => ({
          activityId: a.id,
          kegiatan: a.kegiatan,
          pic: a.pic,
          phaseCode: phase.phase_code,
          tanggalSelesaiRencana: a.tanggal_selesai_rencana,
          status: a.status,
          overdueDays: computeOverdueDays(a.tanggal_selesai_rencana, today),
          ...(locationMeta ?? {}),
        }))
    )
    .sort((a, b) => b.overdueDays - a.overdueDays)
}
