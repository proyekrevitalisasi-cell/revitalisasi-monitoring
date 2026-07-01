import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin, notFound } from '@/lib/auth-helpers'
import { insertAuditLog } from '@/lib/audit'

export async function PATCH(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const { data: target } = await supabase.from('baselines').select('id, name, location_id').eq('id', params.id).single()
    if (!target) return notFound()

    // Deactivate all other baselines for this location
    await supabase.from('baselines').update({ is_active: false }).eq('location_id', target.location_id)

    const { data: activated, error } = await supabase
      .from('baselines')
      .update({ is_active: true })
      .eq('id', params.id)
      .select('id, name, is_active')
      .single()

    if (error) return serverError()

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'UPDATE', entityType: 'baselines', entityId: params.id,
      entityDescription: `Aktifkan baseline: ${target.name}`,
      newValue: { is_active: true },
    })

    return NextResponse.json({ data: activated, error: null })
  } catch {
    return serverError()
  }
}
