import { createClient } from '@/lib/supabase/server'
import { getSession, isAdmin } from '@/lib/auth-helpers'
import { RaciClient } from '@/components/raci/RaciClient'
import type { RaciLocation, Stakeholder } from '@/lib/types'

export default async function RaciPage() {
  const supabase = createClient()
  const { profile } = await getSession()
  const canEdit = profile ? isAdmin(profile.role) : false

  const { data: locationRows } = await supabase
    .from('locations')
    .select(
      `
      id, code, name,
      phases (
        id, phase_code, name, display_order,
        raci_entries ( stakeholder_id, role )
      )
    `
    )
    .eq('is_active', true)
    .order('display_order')

  const { data: stakeholderRows } = await supabase
    .from('stakeholders')
    .select('id, code, name, group_name, display_order')
    .eq('is_active', true)
    .order('display_order')

  const locations = (locationRows ?? []) as RaciLocation[]
  const stakeholders = (stakeholderRows ?? []) as Stakeholder[]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">RACI</h1>
      <p className="text-gray-500 mt-1 mb-6">
        Matriks Responsible / Accountable / Consulted / Informed per fase dan stakeholder
      </p>
      <RaciClient locations={locations} initialStakeholders={stakeholders} isAdmin={canEdit} />
    </div>
  )
}
