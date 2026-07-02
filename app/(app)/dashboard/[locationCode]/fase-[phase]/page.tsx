import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSession, isAdmin } from '@/lib/auth-helpers'
import { ActivityTable } from '@/components/activities/ActivityTable'

const VALID_PHASE_NUMBERS = ['1', '2', '3', '4']

export default async function FasePage({
  params,
}: {
  params: { locationCode: string; phase: string }
}) {
  if (!VALID_PHASE_NUMBERS.includes(params.phase)) notFound()

  const supabase = createClient()
  const { profile } = await getSession()
  const canEdit = profile ? isAdmin(profile.role) : false

  const { data: location } = await supabase
    .from('locations')
    .select('id, code')
    .eq('code', params.locationCode.toUpperCase())
    .eq('is_active', true)
    .single()

  if (!location) notFound()

  const phaseCode = `F${params.phase}`
  const { data: phase } = await supabase
    .from('phases')
    .select(`
      id, location_id, phase_code, name, pic_utama, display_order,
      activities (
        id, phase_id, display_order, kegiatan, pic,
        tanggal_mulai_rencana, tanggal_selesai_rencana,
        tanggal_mulai_realisasi, tanggal_selesai_realisasi,
        status, progress_pct, catatan, is_milestone, is_on_critical_path,
        date_locked, created_at, updated_at
      )
    `)
    .eq('location_id', location.id)
    .eq('phase_code', phaseCode)
    .order('display_order', { referencedTable: 'activities' })
    .single()

  if (!phase) notFound()

  const { data: allPhases } = await supabase
    .from('phases')
    .select('id')
    .eq('location_id', location.id)
  const phaseIds = (allPhases ?? []).map((p: { id: string }) => p.id)

  const { data: allActivityRows } = phaseIds.length
    ? await supabase.from('activities').select('id').in('phase_id', phaseIds)
    : { data: [] }
  const allActivityIds = (allActivityRows ?? []).map((a: { id: string }) => a.id)

  const { data: dependencies } = allActivityIds.length
    ? await supabase
        .from('activity_dependencies')
        .select('id, predecessor_id, successor_id, dep_type, lag_days')
        .in('predecessor_id', allActivityIds)
    : { data: [] }

  const depCounts: Record<string, number> = {}
  for (const dep of dependencies ?? []) {
    depCounts[dep.predecessor_id] = (depCounts[dep.predecessor_id] ?? 0) + 1
    depCounts[dep.successor_id] = (depCounts[dep.successor_id] ?? 0) + 1
  }

  const { data: holidayRows } = await supabase.from('work_calendar').select('holiday_date')
  const holidays = (holidayRows ?? []).map((h: { holiday_date: string }) => h.holiday_date)

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{phase.name}</h2>
      <ActivityTable
        phaseId={phase.id}
        initialActivities={phase.activities}
        depCounts={depCounts}
        holidays={holidays}
        isAdmin={canEdit}
      />
    </div>
  )
}
