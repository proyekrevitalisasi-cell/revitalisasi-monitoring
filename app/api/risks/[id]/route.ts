import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin, notFound } from '@/lib/auth-helpers'
import { updateRiskSchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = updateRiskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    const { data: current } = await supabase.from('risk_items').select('*').eq('id', params.id).single()
    if (!current) return notFound()

    const { data: updated, error } = await supabase
      .from('risk_items')
      .update({ ...parsed.data, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) return serverError()
    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'UPDATE', entityType: 'risk_items', entityId: params.id,
      entityDescription: `Update risiko: ${current.title}`, oldValue: current, newValue: updated,
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

    const { data: current } = await supabase.from('risk_items').select('id, title').eq('id', params.id).single()
    if (!current) return notFound()

    const { error } = await supabase.from('risk_items').delete().eq('id', params.id)
    if (error) return serverError()

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'DELETE', entityType: 'risk_items', entityId: params.id,
      entityDescription: `Hapus risiko: ${current.title}`, oldValue: current,
    })
    return NextResponse.json({ data: { id: params.id }, error: null })
  } catch {
    return serverError()
  }
}
