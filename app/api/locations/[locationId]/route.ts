import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin, notFound } from '@/lib/auth-helpers'
import { updateLocationSchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function PATCH(request: NextRequest, { params }: { params: { locationId: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = updateLocationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    const { data: current } = await supabase
      .from('locations')
      .select('id, name, code')
      .eq('id', params.locationId)
      .single()
    if (!current) return notFound()

    const { data: updated, error } = await supabase
      .from('locations')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', params.locationId)
      .select('id, name, code, description')
      .single()

    if (error) return serverError()

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'UPDATE', entityType: 'locations', entityId: params.locationId,
      entityDescription: `Update lokasi ${current.name}`, oldValue: current, newValue: updated,
    })

    return NextResponse.json({ data: updated, error: null })
  } catch {
    return serverError()
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { locationId: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (profile.role !== 'super_admin') return forbidden()

    const { data: current } = await supabase
      .from('locations')
      .select('id, name, code')
      .eq('id', params.locationId)
      .single()
    if (!current) return notFound()

    await supabase
      .from('locations')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', params.locationId)

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'DELETE', entityType: 'locations', entityId: params.locationId,
      entityDescription: `Nonaktifkan lokasi ${current.name} (${current.code})`,
    })

    return NextResponse.json({ data: { id: params.locationId }, error: null })
  } catch {
    return serverError()
  }
}
