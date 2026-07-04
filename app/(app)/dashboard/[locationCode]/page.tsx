import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Progress } from '@/components/ui/progress'
import { PhaseSummaryCard } from '@/components/dashboard/PhaseSummaryCard'
import { CriticalPathCard } from '@/components/dashboard/CriticalPathCard'
import { UpcomingActivitiesPanel } from '@/components/dashboard/UpcomingActivitiesPanel'
import { ActivityIssueTable, type ActivityIssueRow } from '@/components/dashboard/ActivityIssueTable'
import { KkConsentSummaryBar } from '@/components/dashboard/KkConsentSummaryBar'
import {
  computeProgressPct,
  computeStatusCounts,
  computeProjectFinishDate,
  isNeedsAttention,
  computeOverdueDays,
} from '@/lib/dashboard-metrics'
import type { Phase, ActivityStatus, KkConsent } from '@/lib/types'

interface ActivityForDashboard {
  id: string
  kegiatan: string
  pic: string
  status: ActivityStatus
  progress_pct: number
  is_on_critical_path: boolean
  tanggal_mulai_rencana: string
  tanggal_selesai_rencana: string
}

export default async function LocationDashboardPage({
  params,
}: {
  params: { locationCode: string }
}) {
  const supabase = createClient()

  const { data: location } = await supabase
    .from('locations')
    .select('id, name, code')
    .eq('code', params.locationCode.toUpperCase())
    .eq('is_active', true)
    .single()

  if (!location) notFound()

  const { data: phaseRows } = await supabase
    .from('phases')
    .select(
      `
      id, phase_code, name, pic_utama,
      activities ( id, kegiatan, pic, status, progress_pct, is_on_critical_path, tanggal_mulai_rencana, tanggal_selesai_rencana )
    `
    )
    .eq('location_id', location.id)
    .order('display_order')

  const phases = (phaseRows ?? []) as Array<{
    id: string
    phase_code: Phase['phase_code']
    name: string
    pic_utama: string
    activities: ActivityForDashboard[]
  }>

  const { data: kkConsentRow } = await supabase
    .from('kk_consent')
    .select('*')
    .eq('location_id', location.id)
    .single()
  const kkConsent = kkConsentRow as KkConsent | null

  const allActivities = phases.flatMap((p) => p.activities)
  const overallPct = computeProgressPct(allActivities)
  const statusCounts = computeStatusCounts(allActivities)
  const finishDate = computeProjectFinishDate(allActivities)
  const today = new Date()

  const upcoming = allActivities
    .filter((a) => a.status !== 'selesai')
    .sort((a, b) => a.tanggal_mulai_rencana.localeCompare(b.tanggal_mulai_rencana))
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      kegiatan: a.kegiatan,
      pic: a.pic,
      tanggalMulaiRencana: a.tanggal_mulai_rencana,
    }))

  const issues: ActivityIssueRow[] = phases
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
        }))
    )
    .sort((a, b) => b.overdueDays - a.overdueDays)

  return (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-500">Progres Keseluruhan</span>
          <span className="font-medium text-gray-900">{overallPct}%</span>
        </div>
        <Progress value={overallPct} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {phases.map((phase) => (
          <PhaseSummaryCard
            key={phase.id}
            name={phase.name}
            picUtama={phase.pic_utama}
            activities={phase.activities}
          />
        ))}
      </div>

      <CriticalPathCard criticalCount={statusCounts.critical} finishDate={finishDate} />

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Kegiatan Mendatang</h2>
        <UpcomingActivitiesPanel activities={upcoming} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Perlu Perhatian</h2>
        <ActivityIssueTable issues={issues} showLocation={false} />
      </div>

      {kkConsent && kkConsent.target_kk > 0 && (
        <KkConsentSummaryBar
          locationCode={location.code}
          targetKk={kkConsent.target_kk}
          setuju={kkConsent.setuju}
          thresholdPct={kkConsent.threshold_pct}
        />
      )}
    </div>
  )
}
