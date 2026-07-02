import { format } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runCpm, cpmStartToDate, cpmFinishToDate, type CpmActivity, type CpmDependency } from '@/lib/cpm'
import { computeDurasiHK } from '@/lib/calendar'
import { insertAuditLog } from '@/lib/audit'

interface Actor {
  id: string
  email: string
  full_name: string
}

interface UpdatedActivity {
  id: string
  tanggal_mulai_rencana: string
  tanggal_selesai_rencana: string
  is_on_critical_path: boolean
}

interface CpmRunResult {
  updatedActivities: UpdatedActivity[]
  criticalPath: string[]
  hasCycle: boolean
  cycleIds: string[]
}

type PhaseEmbed = { location_id: string } | { location_id: string }[] | null

export function extractLocationId(phases: PhaseEmbed): string | null {
  if (!phases) return null
  return Array.isArray(phases) ? (phases[0]?.location_id ?? null) : phases.location_id
}

export async function getActivityLocationId(supabase: SupabaseClient, activityId: string): Promise<string | null> {
  const { data } = await supabase.from('activities').select('phases(location_id)').eq('id', activityId).single()
  if (!data) return null
  return extractLocationId(data.phases as PhaseEmbed)
}

export async function runCpmForLocation(
  supabase: SupabaseClient,
  locationId: string,
  actor: Actor
): Promise<CpmRunResult> {
  const empty: CpmRunResult = { updatedActivities: [], criticalPath: [], hasCycle: false, cycleIds: [] }

  const { data: location, error: locationError } = await supabase
    .from('locations')
    .select('project_start_date')
    .eq('id', locationId)
    .single()
  if (locationError) {
    // A silently-swallowed error here (e.g. a missing/renamed column) would
    // make CPM appear to succeed while quietly doing nothing — throw so it
    // surfaces as a 500 through the calling route's existing try/catch,
    // instead of a no-op that looks identical to "nothing to recalculate".
    throw new Error(`runCpmForLocation: failed to load location ${locationId}: ${locationError.message}`)
  }
  if (!location || !location.project_start_date) return empty

  const { data: phases } = await supabase.from('phases').select('id').eq('location_id', locationId)
  const phaseIds = (phases ?? []).map((p: { id: string }) => p.id)
  if (phaseIds.length === 0) return empty

  const { data: activityRows } = await supabase
    .from('activities')
    .select('id, tanggal_mulai_rencana, tanggal_selesai_rencana, date_locked')
    .in('phase_id', phaseIds)
  const activities = (activityRows ?? []) as Array<{
    id: string
    tanggal_mulai_rencana: string
    tanggal_selesai_rencana: string
    date_locked: boolean
  }>
  if (activities.length === 0) return empty
  const activityIds = activities.map((a) => a.id)

  const { data: depRows } = await supabase
    .from('activity_dependencies')
    .select('predecessor_id, successor_id, dep_type, lag_days')
    .in('predecessor_id', activityIds)

  const { data: holidayRows } = await supabase.from('work_calendar').select('holiday_date')
  const holidays = (holidayRows ?? []).map((h: { holiday_date: string }) => new Date(h.holiday_date))

  const projectStart = new Date(location.project_start_date)

  const cpmActivities: CpmActivity[] = activities.map((a) => ({
    id: a.id,
    duration: computeDurasiHK(a.tanggal_mulai_rencana, a.tanggal_selesai_rencana, holidays),
    dateLocked: a.date_locked,
    lockedStartDate: a.date_locked ? new Date(a.tanggal_mulai_rencana) : null,
  }))

  const cpmDependencies: CpmDependency[] = (depRows ?? []).map(
    (d: { predecessor_id: string; successor_id: string; dep_type: 'FS' | 'SS' | 'FF' | 'SF'; lag_days: number }) => ({
      predecessorId: d.predecessor_id,
      successorId: d.successor_id,
      type: d.dep_type,
      lagDays: d.lag_days,
    })
  )

  const result = runCpm(cpmActivities, cpmDependencies, projectStart, holidays)

  if (result.hasCycle) {
    // hasCycle here means a cycle already exists in stored data — cycle
    // creation is gated upstream at POST /api/dependencies, so this is a
    // pre-existing inconsistency, not a rejection of the caller's own
    // request (which already succeeded before this ran). Log and move on.
    await insertAuditLog({
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.full_name,
      action: 'RECALCULATE',
      entityType: 'locations',
      entityId: locationId,
      entityDescription: 'CPM recalculate gagal: siklus terdeteksi pada data dependensi yang sudah tersimpan',
    })
    return { updatedActivities: [], criticalPath: [], hasCycle: true, cycleIds: result.cycleIds }
  }

  const updateResults = await Promise.all(
    activities.map(async (activity) => {
      const node = result.nodes.get(activity.id)
      if (!node) return null

      const updates: Record<string, unknown> = {
        is_on_critical_path: node.isCritical,
        updated_by: actor.id,
        updated_at: new Date().toISOString(),
      }

      let mulai = activity.tanggal_mulai_rencana
      let selesai = activity.tanggal_selesai_rencana
      let shifted = false

      if (!activity.date_locked) {
        mulai = format(cpmStartToDate(node.earliestStart, projectStart, holidays), 'yyyy-MM-dd')
        selesai = format(cpmFinishToDate(node.earliestFinish, projectStart, holidays), 'yyyy-MM-dd')
        shifted = mulai !== activity.tanggal_mulai_rencana || selesai !== activity.tanggal_selesai_rencana
        updates.tanggal_mulai_rencana = mulai
        updates.tanggal_selesai_rencana = selesai
      }

      const { error } = await supabase.from('activities').update(updates).eq('id', activity.id)
      if (error) return null
      return { id: activity.id, tanggal_mulai_rencana: mulai, tanggal_selesai_rencana: selesai, is_on_critical_path: node.isCritical, shifted }
    })
  )

  const updatedActivities: UpdatedActivity[] = []
  let shiftedCount = 0
  for (const r of updateResults) {
    if (!r) continue
    updatedActivities.push({
      id: r.id,
      tanggal_mulai_rencana: r.tanggal_mulai_rencana,
      tanggal_selesai_rencana: r.tanggal_selesai_rencana,
      is_on_critical_path: r.is_on_critical_path,
    })
    if (r.shifted) shiftedCount++
  }

  await insertAuditLog({
    userId: actor.id,
    userEmail: actor.email,
    userName: actor.full_name,
    action: 'RECALCULATE',
    entityType: 'locations',
    entityId: locationId,
    entityDescription: `CPM recalculate: ${shiftedCount} kegiatan disesuaikan, ${result.criticalPath.length} pada jalur kritis`,
  })

  return { updatedActivities, criticalPath: result.criticalPath, hasCycle: false, cycleIds: [] }
}

export async function runCpmForAllActiveLocations(supabase: SupabaseClient, actor: Actor): Promise<void> {
  const { data: locations } = await supabase.from('locations').select('id').eq('is_active', true)
  for (const location of (locations ?? []) as Array<{ id: string }>) {
    await runCpmForLocation(supabase, location.id, actor)
  }
}
