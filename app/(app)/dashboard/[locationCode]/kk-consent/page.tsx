import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSession, isAdmin } from '@/lib/auth-helpers'
import { KkConsentForm } from '@/components/kk-consent/KkConsentForm'
import type { KkConsent } from '@/lib/types'

export default async function KkConsentPage({
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

  const { data: kkConsent } = await supabase
    .from('kk_consent')
    .select('*')
    .eq('location_id', location.id)
    .single()

  if (!kkConsent) notFound()

  return (
    <KkConsentForm
      locationId={location.id}
      initialData={kkConsent as KkConsent}
      isAdmin={canEdit}
    />
  )
}
