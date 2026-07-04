import { createClient } from '@/lib/supabase/server'
import { LocationSummaryCard } from '@/components/dashboard/LocationSummaryCard'
import { ComparativeTable } from '@/components/dashboard/ComparativeTable'
import { ActivityIssueTable, type ActivityIssueRow } from '@/components/dashboard/ActivityIssueTable'
import { isNeedsAttention, computeOverdueDays } from '@/lib/dashboard-metrics'
import type { Phase, ActivityStatus } from '@/lib/types'

interface LocationWithPhases {
  id: string
  code: string
  name: string
  description: string | null
  phases: Array<{
    phase_code: Phase['phase_code']
    activities: Array<{
      id: string
      kegiatan: string
      pic: string
      status: ActivityStatus
      progress_pct: number
      is_on_critical_path: boolean
      tanggal_selesai_rencana: string
    }>
  }>
}

export default async function HomePage() {
  const supabase = createClient()
  const { data: locationRows } = await supabase
    .from('locations')
    .select(
      `
      id, code, name, description,
      phases (
        phase_code,
        activities ( id, kegiatan, pic, status, progress_pct, is_on_critical_path, tanggal_selesai_rencana )
      )
    `
    )
    .eq('is_active', true)
    .order('display_order')

  const locations = (locationRows ?? []) as LocationWithPhases[]
  const today = new Date()

  const issues: ActivityIssueRow[] = locations
    .flatMap((location) =>
      location.phases.flatMap((phase) =>
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
            locationName: location.name,
            locationCode: location.code,
          }))
      )
    )
    .sort((a, b) => b.overdueDays - a.overdueDays)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Program Revitalisasi Rusun</h1>
      <p className="text-gray-500 mt-1 mb-6">Ringkasan Semua Lokasi — Perum Perumnas</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {locations.map((location) => (
          <LocationSummaryCard key={location.id} location={location} phases={location.phases} />
        ))}
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Ringkasan Komparatif</h2>
        <ComparativeTable locations={locations} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Isu Lintas-Lokasi</h2>
        <ActivityIssueTable issues={issues} showLocation />
      </div>
    </div>
  )
}
