import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
import { createRiskSchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    const { data, error } = await supabase
      .from('risk_items')
      .select('*')
      .eq('phase_id', params.id)
      .order('display_order')
    if (error) return serverError()
    return NextResponse.json({ data, error: null })
  } catch {
    return serverError()
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = createRiskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    const { data: risk, error } = await supabase
      .from('risk_items')
      .insert({ phase_id: params.id, created_by: user.id, updated_by: user.id, ...parsed.data })
      .select('*')
      .single()

    if (error || !risk) return serverError()

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'CREATE', entityType: 'risk_items', entityId: risk.id,
      entityDescription: `Tambah risiko: ${parsed.data.title}`, newValue: parsed.data,
    })

    return NextResponse.json({ data: risk, error: null }, { status: 201 })
  } catch {
    return serverError()
  }
}
