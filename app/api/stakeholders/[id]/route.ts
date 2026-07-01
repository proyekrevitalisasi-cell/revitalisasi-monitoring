import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin, notFound } from '@/lib/auth-helpers'
import { updateStakeholderSchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = updateStakeholderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    const { data: current } = await supabase.from('stakeholders').select('*').eq('id', params.id).single()
    if (!current) return notFound()

    const { data: updated, error } = await supabase
      .from('stakeholders')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('id, code, name, group_name, display_order, is_active')
      .single()

    if (error) return serverError()
    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'UPDATE', entityType: 'stakeholders', entityId: params.id,
      entityDescription: `Update stakeholder ${current.code}`, oldValue: current, newValue: updated,
    })
    return NextResponse.json({ data: updated, error: null })
  } catch {
    return serverError()
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const { data: current } = await supabase.from('stakeholders').select('id, code, name').eq('id', params.id).single()
    if (!current) return notFound()

    await supabase.from('stakeholders').update({ is_active: false }).eq('id', params.id)
    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'DELETE', entityType: 'stakeholders', entityId: params.id,
      entityDescription: `Nonaktifkan stakeholder ${current.code}`,
    })
    return NextResponse.json({ data: { id: params.id }, error: null })
  } catch {
    return serverError()
  }
}
