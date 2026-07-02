import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin, notFound } from '@/lib/auth-helpers'
import { insertAuditLog } from '@/lib/audit'
import { runCpmForAllActiveLocations } from '@/lib/cpm-runner'

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const { data: current } = await supabase.from('work_calendar').select('id, holiday_date, name').eq('id', params.id).single()
    if (!current) return notFound()

    const { error } = await supabase.from('work_calendar').delete().eq('id', params.id)
    if (error) return serverError()

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'DELETE', entityType: 'work_calendar', entityId: params.id,
      entityDescription: `Hapus hari libur: ${current.name} (${current.holiday_date})`,
    })

    await runCpmForAllActiveLocations(supabase, { id: user.id, email: profile.email, full_name: profile.full_name })

    return NextResponse.json({ data: { id: params.id }, error: null })
  } catch {
    return serverError()
  }
}
