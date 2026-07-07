import { format } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runCpm, cpmStartToDate, cpmFinishToDate, type CpmActivity, type CpmDependency, type CpmNode } from '@/lib/cpm'
import { computeDurasiHK } from '@/lib/calendar'
import { insertAuditLog } from '@/lib/audit'
import type { CpmSummary } from '@/lib/types'

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
  shiftedCount: number
}

export interface CpmUpdateInput {
  id: string
  tanggal_mulai_rencana: string
  tanggal_selesai_rencana: string
  date_locked: boolean
  is_on_critical_path: boolean
  total_float_days: number
}

export interface CpmUpdateResult {
  updates: Record<string, unknown>
  mulai: string
  selesai: string
  shifted: boolean
  changed: boolean
}

// Only bump updated_at/updated_by when this activity's CPM-derived state
// actually changed. Every holiday/dependency/activity edit anywhere
// re-runs CPM for the WHOLE location (runCpmForAllActiveLocations re-runs
// it for EVERY active location), which previously stamped updated_at on
// every activity unconditionally -- including already-`selesai` ones that
// nothing happened to. Weekly Summary's "Selesai Minggu Ini" panel reads
// updated_at as "completed this week," so a totally unrelated admin
// action (e.g. adding a national holiday next year) was silently making
// long-completed activities in every other location look freshly done.
export function computeActivityCpmUpdate(
  activity: CpmUpdateInput,
  node: CpmNode,
  projectStart: Date,
  holidays: Date[]
): CpmUpdateResult {
  let mulai = activity.tanggal_mulai_rencana
  let selesai = activity.tanggal_selesai_rencana
  let shifted = false

  if (!activity.date_locked) {
    mulai = format(cpmStartToDate(node.earliestStart, projectStart, holidays), 'yyyy-MM-dd')
    selesai = format(cpmFinishToDate(node.earliestFinish, projectStart, holidays), 'yyyy-MM-dd')
    shifted = mulai !== activity.tanggal_mulai_rencana || selesai !== activity.tanggal_selesai_rencana
  }

  const updates: Record<string, unknown> = {
    is_on_critical_path: node.isCritical,
    total_float_days: node.totalFloat,
  }
  if (!activity.date_locked) {
    updates.tanggal_mulai_rencana = mulai
    updates.tanggal_selesai_rencana = selesai
  }

  const changed =
    shifted ||
    activity.is_on_critical_path !== node.isCritical ||
    activity.total_float_days !== node.totalFloat

  return { updates, mulai, selesai, shifted, changed }
}

type PhaseEmbed = { location_id: string } | { location_id: string }[] | null

export function extractLocationId(phases: PhaseEmbed): string | null {
  if (!phases) return null
  return Array.isArray(phases) ? (phases[0]?.location_id ?? null) : phases.location_id
}

export async function getActivityLocationId(supabase: SupabaseClient, activityId: string): Promise<string | null> {
  const { data, error } = await supabase.from('activities').select('phases(location_id)').eq('id', activityId).single()
  if (error) {
    // A silently-swallowed error here (e.g. a missing/renamed column) would
    // make CPM appear to succeed while quietly doing nothing — throw so it
    // surfaces as a 500 through the calling route's existing try/catch,
    // instead of a no-op that looks identical to "nothing to recalculate".
    throw new Error(`getActivityLocationId: failed to load activity ${activityId}: ${error.message}`)
  }
  if (!data) return null
  return extractLocationId(data.phases as PhaseEmbed)
}

export async function runCpmForLocation(
  supabase: SupabaseClient,
  locationId: string,
  actor: Actor
): Promise<CpmRunResult> {
  const empty: CpmRunResult = { updatedActivities: [], criticalPath: [], hasCycle: false, cycleIds: [], shiftedCount: 0 }

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

  const { data: phases, error: phasesError } = await supabase.from('phases').select('id').eq('location_id', locationId)
  if (phasesError) {
    // A silently-swallowed error here (e.g. a missing/renamed column) would
    // make CPM appear to succeed while quietly doing nothing — throw so it
    // surfaces as a 500 through the calling route's existing try/catch,
    // instead of a no-op that looks identical to "nothing to recalculate".
    throw new Error(`runCpmForLocation: failed to load phases for location ${locationId}: ${phasesError.message}`)
  }
  const phaseIds = (phases ?? []).map((p: { id: string }) => p.id)
  if (phaseIds.length === 0) return empty

  const { data: activityRows, error: activitiesError } = await supabase
    .from('activities')
    .select('id, tanggal_mulai_rencana, tanggal_selesai_rencana, date_locked, is_on_critical_path, total_float_days')
    .in('phase_id', phaseIds)
  if (activitiesError) {
    // A silently-swallowed error here (e.g. a missing/renamed column) would
    // make CPM appear to succeed while quietly doing nothing — throw so it
    // surfaces as a 500 through the calling route's existing try/catch,
    // instead of a no-op that looks identical to "nothing to recalculate".
    throw new Error(`runCpmForLocation: failed to load activities for location ${locationId}: ${activitiesError.message}`)
  }
  const activities = (activityRows ?? []) as Array<{
    id: string
    tanggal_mulai_rencana: string
    tanggal_selesai_rencana: string
    date_locked: boolean
    is_on_critical_path: boolean
    total_float_days: number
  }>
  if (activities.length === 0) return empty
  const activityIds = activities.map((a) => a.id)

  const { data: depRows, error: depRowsError } = await supabase
    .from('activity_dependencies')
    .select('predecessor_id, successor_id, dep_type, lag_days')
    .in('predecessor_id', activityIds)
  if (depRowsError) {
    // A silently-swallowed error here would make every activity look like it
    // has no dependencies, resetting all unlocked activities to ES=0 and
    // writing those wrong dates to the database — throw instead so it
    // surfaces as a 500 through the calling route's existing try/catch.
    throw new Error(`runCpmForLocation: failed to load dependencies for location ${locationId}: ${depRowsError.message}`)
  }

  const { data: holidayRows, error: holidayRowsError } = await supabase.from('work_calendar').select('holiday_date')
  if (holidayRowsError) {
    // A silently-swallowed error here would make durations and date
    // conversions be computed as if no holidays exist, writing wrong dates
    // to the database — throw instead so it surfaces as a 500 through the
    // calling route's existing try/catch.
    throw new Error(`runCpmForLocation: failed to load work_calendar holidays: ${holidayRowsError.message}`)
  }
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
    return { updatedActivities: [], criticalPath: [], hasCycle: true, cycleIds: result.cycleIds, shiftedCount: 0 }
  }

  const updateResults = await Promise.all(
    activities.map(async (activity) => {
      const node = result.nodes.get(activity.id)
      if (!node) return null

      const { updates, mulai, selesai, shifted, changed } = computeActivityCpmUpdate(
        activity,
        node,
        projectStart,
        holidays
      )
      if (changed) {
        updates.updated_by = actor.id
        updates.updated_at = new Date().toISOString()
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

  return { updatedActivities, criticalPath: result.criticalPath, hasCycle: false, cycleIds: [], shiftedCount }
}

export async function runCpmForAllActiveLocations(supabase: SupabaseClient, actor: Actor): Promise<void> {
  const { data: locations } = await supabase.from('locations').select('id').eq('is_active', true)
  for (const location of (locations ?? []) as Array<{ id: string }>) {
    await runCpmForLocation(supabase, location.id, actor)
  }
}

export function toCpmSummary(result: CpmRunResult): CpmSummary {
  return {
    shiftedCount: result.shiftedCount,
    hasCycle: result.hasCycle,
    criticalPath: result.criticalPath,
    updatedActivities: result.updatedActivities,
  }
}
