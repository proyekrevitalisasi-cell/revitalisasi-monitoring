import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, serverError } from '@/lib/auth-helpers'

export async function GET(_request: NextRequest, { params }: { params: { locationId: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()

    // Get all activity IDs for this location
    const { data: phases } = await supabase
      .from('phases')
      .select('id')
      .eq('location_id', params.locationId)

    if (!phases || phases.length === 0) return NextResponse.json({ data: [], error: null })

    const phaseIds = phases.map((p) => p.id)
    const { data: activities } = await supabase
      .from('activities')
      .select('id')
      .in('phase_id', phaseIds)

    if (!activities || activities.length === 0) return NextResponse.json({ data: [], error: null })

    const activityIds = activities.map((a) => a.id)
    const { data: deps, error } = await supabase
      .from('activity_dependencies')
      .select('id, predecessor_id, successor_id, dep_type, lag_days, created_at')
      .in('predecessor_id', activityIds)

    if (error) return serverError()
    return NextResponse.json({ data: deps, error: null })
  } catch {
    return serverError()
  }
}
