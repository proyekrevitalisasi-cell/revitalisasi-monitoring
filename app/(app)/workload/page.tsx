import { createClient } from '@/lib/supabase/server'
import { WorkloadClient } from '@/components/workload/WorkloadClient'
import type { ActivityStatus, WorkloadActivity } from '@/lib/types'

interface LocationWithPhases {
  id: string
  code: string
  name: string
  phases: Array<{
    phase_code: string
    activities: Array<{
      id: string
      kegiatan: string
      pic: string
      status: ActivityStatus
      progress_pct: number
      tanggal_mulai_rencana: string
      tanggal_selesai_rencana: string
    }>
  }>
}

export default async function WorkloadPage() {
  const supabase = createClient()
  const { data: locationRows } = await supabase
    .from('locations')
    .select(
      `
      id, code, name,
      phases ( phase_code,
        activities ( id, kegiatan, pic, status, progress_pct, tanggal_mulai_rencana, tanggal_selesai_rencana )
      )
    `
    )
    .eq('is_active', true)
    .order('display_order')

  const locations = (locationRows ?? []) as LocationWithPhases[]

  const activities: WorkloadActivity[] = locations.flatMap((location) =>
    location.phases.flatMap((phase) =>
      phase.activities.map((a) => ({
        ...a,
        phaseCode: phase.phase_code,
        locationCode: location.code,
        locationName: location.name,
      }))
    )
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Workload View</h1>
      <p className="text-gray-500 mt-1 mb-6">Beban kerja PIC lintas-lokasi, 12 minggu ke depan</p>
      <WorkloadClient
        activities={activities}
        locations={locations.map((l) => ({ code: l.code, name: l.name }))}
      />
    </div>
  )
}
