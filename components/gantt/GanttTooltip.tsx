import { computeDeviationDays } from '@/lib/gantt-layout'
import type { Activity, BaselineActivitySnapshot, Dependency } from '@/lib/types'

const STATUS_LABELS: Record<Activity['status'], string> = {
  belum_mulai: 'Belum Mulai',
  sedang_berjalan: 'Sedang Berjalan',
  selesai: 'Selesai',
  ditunda: 'Ditunda',
}

interface GanttBarTooltipContentProps {
  activity: Activity
  baseline: BaselineActivitySnapshot | undefined
  holidays: Date[]
}

export function GanttBarTooltipContent({ activity, baseline, holidays }: GanttBarTooltipContentProps) {
  const deviation = baseline
    ? computeDeviationDays(
        new Date(baseline.tanggal_mulai_rencana),
        new Date(activity.tanggal_mulai_rencana),
        holidays
      )
    : null

  return (
    <div className="text-xs space-y-0.5 max-w-[220px]">
      <p className="font-medium">{activity.kegiatan}</p>
      <p>PIC: {activity.pic}</p>
      <p>
        Rencana: {activity.tanggal_mulai_rencana} – {activity.tanggal_selesai_rencana}
      </p>
      {baseline && deviation !== null && (
        <p>
          Baseline: {baseline.tanggal_mulai_rencana} (deviasi {deviation >= 0 ? '+' : ''}
          {deviation} hari kerja)
        </p>
      )}
      {activity.tanggal_mulai_realisasi && (
        <p>
          Realisasi: {activity.tanggal_mulai_realisasi} – {activity.tanggal_selesai_realisasi ?? '–'}
        </p>
      )}
      <p>Status: {STATUS_LABELS[activity.status]}</p>
      <p>
        {activity.is_on_critical_path
          ? 'Jalur Kritis: Ya'
          : `Float: ${activity.total_float_days} hari kerja`}
      </p>
    </div>
  )
}

interface GanttArrowTooltipContentProps {
  depType: Dependency['dep_type']
  lagDays: number
}

export function GanttArrowTooltipContent({ depType, lagDays }: GanttArrowTooltipContentProps) {
  return (
    <div className="text-xs">
      {depType} · lag {lagDays} hari
    </div>
  )
}
