import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin, notFound } from '@/lib/auth-helpers'
import { updateKkConsentSchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function GET(_request: NextRequest, { params }: { params: { locationId: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    const { data, error } = await supabase
      .from('kk_consent')
      .select('*')
      .eq('location_id', params.locationId)
      .single()
    if (error) {
      // PGRST116 = no rows returned by .single()
      if (error.code === 'PGRST116') return notFound()
      return serverError()
    }
    return NextResponse.json({ data, error: null })
  } catch {
    return serverError()
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { locationId: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = updateKkConsentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    const { data: current } = await supabase.from('kk_consent').select('*').eq('location_id', params.locationId).single()
    if (!current) return notFound()

    const { data: updated, error } = await supabase
      .from('kk_consent')
      .update({ ...parsed.data, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('location_id', params.locationId)
      .select('*')
      .single()

    if (error) return serverError()

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'UPDATE', entityType: 'kk_consent', entityId: params.locationId,
      entityDescription: `Update KK consent lokasi ${params.locationId}`,
      oldValue: current, newValue: updated,
    })
    return NextResponse.json({ data: updated, error: null })
  } catch {
    return serverError()
  }
}
