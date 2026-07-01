import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, serverError } from '@/lib/auth-helpers'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()

    const { data, error } = await supabase
      .from('raci_entries')
      .select('id, phase_id, stakeholder_id, role, updated_at, stakeholders(code, name, group_name)')
      .eq('phase_id', params.id)

    if (error) return serverError()
    return NextResponse.json({ data, error: null })
  } catch {
    return serverError()
  }
}
