import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
import { createStakeholderSchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function GET() {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    const { data, error } = await supabase
      .from('stakeholders')
      .select('id, code, name, group_name, display_order, is_active')
      .eq('is_active', true)
      .order('display_order')
    if (error) return serverError()
    return NextResponse.json({ data, error: null })
  } catch {
    return serverError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = createStakeholderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    const { data: sh, error } = await supabase
      .from('stakeholders')
      .insert({ ...parsed.data, created_by: user.id })
      .select('id, code, name, group_name, display_order')
      .single()

    if (error) {
      return NextResponse.json(
        { data: null, error: { code: 'CREATE_ERROR', message: error.message.includes('unique') ? 'Kode sudah digunakan' : 'Gagal membuat stakeholder' } },
        { status: 400 }
      )
    }

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'CREATE', entityType: 'stakeholders', entityId: sh!.id,
      entityDescription: `Tambah stakeholder ${parsed.data.code} – ${parsed.data.name}`,
      newValue: parsed.data,
    })

    return NextResponse.json({ data: sh, error: null }, { status: 201 })
  } catch {
    return serverError()
  }
}
