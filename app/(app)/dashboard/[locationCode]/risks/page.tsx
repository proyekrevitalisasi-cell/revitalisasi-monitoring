import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSession, isAdmin } from '@/lib/auth-helpers'
import { RiskRegisterClient } from '@/components/risks/RiskRegisterClient'
import type { RiskItem, RiskWithPhase, RiskPhaseOption } from '@/lib/types'

export default async function RiskRegisterPage({
  params,
}: {
  params: { locationCode: string }
}) {
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

  const { data: phaseRows } = await supabase
    .from('phases')
    .select(`id, phase_code, name, risk_items ( * )`)
    .eq('location_id', location.id)
    .order('display_order')

  const phases = (phaseRows ?? []) as Array<{
    id: string
    phase_code: string
    name: string
    risk_items: RiskItem[]
  }>

  const phaseOptions: RiskPhaseOption[] = phases.map((p) => ({
    id: p.id,
    phase_code: p.phase_code,
    name: p.name,
  }))

  const risks: RiskWithPhase[] = phases.flatMap((phase) =>
    phase.risk_items
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map((risk) => ({ ...risk, phaseCode: phase.phase_code }))
  )

  return <RiskRegisterClient initialRisks={risks} phases={phaseOptions} isAdmin={canEdit} />
}
