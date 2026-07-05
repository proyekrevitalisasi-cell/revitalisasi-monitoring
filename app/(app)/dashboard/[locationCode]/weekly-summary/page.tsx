import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WeeklySummaryClient } from '@/components/weekly-summary/WeeklySummaryClient'

export default async function WeeklySummaryPage({
  params,
}: {
  params: { locationCode: string }
}) {
  const supabase = createClient()
  const { data: location } = await supabase
    .from('locations')
    .select('id, code')
    .eq('code', params.locationCode.toUpperCase())
    .eq('is_active', true)
    .single()

  if (!location) notFound()

  return <WeeklySummaryClient locationId={location.id} />
}
