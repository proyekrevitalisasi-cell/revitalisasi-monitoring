import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin, notFound } from '@/lib/auth-helpers'
import { updateReportingItemSchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = updateReportingItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    const { data: current } = await supabase.from('reporting_items').select('*').eq('id', params.id).single()
    if (!current) return notFound()

    const { data: updated, error } = await supabase
      .from('reporting_items')
      .update({ ...parsed.data, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) return serverError()
    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'UPDATE', entityType: 'reporting_items', entityId: params.id,
      entityDescription: `Update item pelaporan`, oldValue: current, newValue: updated,
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

    const { data: current } = await supabase.from('reporting_items').select('id, jenis_laporan').eq('id', params.id).single()
    if (!current) return notFound()

    const { error } = await supabase.from('reporting_items').delete().eq('id', params.id)
    if (error) return serverError()

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'DELETE', entityType: 'reporting_items', entityId: params.id,
      entityDescription: `Hapus item pelaporan: ${current.jenis_laporan}`,
    })
    return NextResponse.json({ data: { id: params.id }, error: null })
  } catch {
    return serverError()
  }
}
