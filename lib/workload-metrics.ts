import { addDays, startOfWeek, format } from 'date-fns'
import { computeProgressPct } from './dashboard-metrics'
import type { WorkloadActivity } from './types'

export interface WeekColumn {
  start: string
  end: string
  label: string
}

export function computeWeekColumns(referenceDate: Date, weeksAhead: number): WeekColumn[] {
  const firstMonday = startOfWeek(referenceDate, { weekStartsOn: 1 })
  const columns: WeekColumn[] = []
  for (let i = 0; i < weeksAhead; i++) {
    const monday = addDays(firstMonday, i * 7)
    const friday = addDays(monday, 4)
    columns.push({
      start: format(monday, 'yyyy-MM-dd'),
      end: format(friday, 'yyyy-MM-dd'),
      label: `${format(monday, 'd MMM')} – ${format(friday, 'd MMM')}`,
    })
  }
  return columns
}

function overlapsWeek(activity: WorkloadActivity, week: WeekColumn): boolean {
  return activity.tanggal_mulai_rencana <= week.end && activity.tanggal_selesai_rencana >= week.start
}

export type WorkloadBand = 'low' | 'medium' | 'high'

export function getWorkloadBand(count: number): WorkloadBand {
  if (count <= 1) return 'low'
  if (count <= 3) return 'medium'
  return 'high'
}

export function getWorkloadBandClasses(count: number): string {
  const band = getWorkloadBand(count)
  if (band === 'low') return 'bg-green-50 text-green-600 border-green-200'
  if (band === 'medium') return 'bg-amber-50 text-amber-600 border-amber-200'
  return 'bg-red-50 text-red-600 border-red-200'
}

export interface PicWorkloadRow {
  pic: string
  activeCount: number
  nextStart: string | null
  avgProgress: number
  weekCounts: number[]
}

export function buildPicWorkload(
  activities: WorkloadActivity[],
  weekColumns: WeekColumn[],
  today: Date
): PicWorkloadRow[] {
  const todayStr = format(today, 'yyyy-MM-dd')
  const pics = Array.from(new Set(activities.map((a) => a.pic))).sort()

  return pics.map((pic) => {
    const picActivities = activities.filter((a) => a.pic === pic)
    const nonSelesai = picActivities.filter((a) => a.status !== 'selesai')

    const upcoming = nonSelesai
      .filter((a) => a.tanggal_mulai_rencana >= todayStr)
      .sort((a, b) => a.tanggal_mulai_rencana.localeCompare(b.tanggal_mulai_rencana))
    const earliestOverall = nonSelesai
      .slice()
      .sort((a, b) => a.tanggal_mulai_rencana.localeCompare(b.tanggal_mulai_rencana))

    const nextStart =
      upcoming.length > 0
        ? upcoming[0].tanggal_mulai_rencana
        : earliestOverall.length > 0
          ? earliestOverall[0].tanggal_mulai_rencana
          : null

    return {
      pic,
      activeCount: nonSelesai.length,
      nextStart,
      avgProgress: computeProgressPct(picActivities),
      weekCounts: weekColumns.map((week) => nonSelesai.filter((a) => overlapsWeek(a, week)).length),
    }
  })
}

export function getActivitiesInCell(
  activities: WorkloadActivity[],
  pic: string,
  week: WeekColumn
): WorkloadActivity[] {
  return activities.filter((a) => a.pic === pic && a.status !== 'selesai' && overlapsWeek(a, week))
}
