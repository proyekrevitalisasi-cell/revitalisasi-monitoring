import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PhaseTabs } from '@/components/layout/PhaseTabs'

export default async function LocationLayout({
  children,
  params,
}: {
  children: React.ReactNode
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

  const { data: phases } = await supabase
    .from('phases')
    .select('id, phase_code, name')
    .eq('location_id', location.id)
    .order('display_order')

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">{location.name}</h1>
        <p className="text-sm text-gray-400">{location.code}</p>
      </div>

      <PhaseTabs locationCode={location.code} phases={phases ?? []} />

      {children}
    </div>
  )
}
