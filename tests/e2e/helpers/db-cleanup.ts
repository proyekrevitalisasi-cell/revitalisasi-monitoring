import { createAdminClient } from '../../../lib/supabase/admin'

export async function deleteLocationByCode(code: string) {
  const supabase = createAdminClient()
  const { data } = await supabase.from('locations').select('id').eq('code', code).maybeSingle()
  if (!data) return
  await supabase.from('locations').delete().eq('id', data.id)
}

export async function deleteUserByEmail(email: string) {
  const supabase = createAdminClient()
  const { data } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
  if (!data) return
  await supabase.auth.admin.deleteUser(data.id)
}

export async function deleteStakeholderByCode(code: string) {
  const supabase = createAdminClient()
  const { data } = await supabase.from('stakeholders').select('id').eq('code', code).maybeSingle()
  if (!data) return
  await supabase.from('stakeholders').delete().eq('id', data.id)
}

export async function deleteReportingItemById(id: string) {
  await createAdminClient().from('reporting_items').delete().eq('id', id)
}
