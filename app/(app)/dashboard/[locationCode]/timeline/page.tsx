import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GanttChart } from '@/components/gantt/GanttChart'
import type { Dependency, BaselineActivitySnapshot } from '@/lib/types'

export default async function TimelinePage({ params }: { params: { locationCode: string } }) {
  const supabase = createClient()

  const { data: location } = await supabase
    .from('locations')
    .select('id, code, name')
    .eq('code', params.locationCode.toUpperCase())
    .eq('is_active', true)
    .single()

  if (!location) notFound()

  const { data: phases } = await supabase
    .from('phases')
    .select(
      `
      id, location_id, phase_code, name, pic_utama, display_order,
      activities (
        id, phase_id, display_order, kegiatan, pic,
        tanggal_mulai_rencana, tanggal_selesai_rencana,
        tanggal_mulai_realisasi, tanggal_selesai_realisasi,
        status, progress_pct, catatan, is_milestone, is_on_critical_path,
        date_locked, total_float_days, created_at, updated_at
      )
    `
    )
    .eq('location_id', location.id)
    .order('display_order')
    .order('display_order', { referencedTable: 'activities' })

  const allPhases = phases ?? []
  const allActivityIds = allPhases.flatMap((p) => p.activities.map((a: { id: string }) => a.id))

  const { data: dependencyRows } = allActivityIds.length
    ? await supabase
        .from('activity_dependencies')
        .select('id, predecessor_id, successor_id, dep_type, lag_days')
        .in('predecessor_id', allActivityIds)
    : { data: [] }

  const { data: activeBaseline } = await supabase
    .from('baselines')
    .select('id, name')
    .eq('location_id', location.id)
    .eq('is_active', true)
    .maybeSingle()

  let baselineActivities: BaselineActivitySnapshot[] = []
  if (activeBaseline) {
    const { data: baselineRows } = await supabase
      .from('baseline_activities')
      .select('activity_id, kegiatan, tanggal_mulai_rencana, tanggal_selesai_rencana, is_milestone')
      .eq('baseline_id', activeBaseline.id)
    baselineActivities = baselineRows ?? []
  }

  const { data: holidayRows } = await supabase.from('work_calendar').select('holiday_date')
  const holidays = (holidayRows ?? []).map((h: { holiday_date: string }) => h.holiday_date)

  const dependencies = (dependencyRows ?? []) as Dependency[]

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline / Gantt — {location.name}</h2>
      <GanttChart
        phases={allPhases}
        dependencies={dependencies}
        baselineActivities={baselineActivities}
        holidays={holidays}
      />
    </div>
  )
}
