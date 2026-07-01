import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
import { createReportingItemSchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function GET() {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    const { data, error } = await supabase
      .from('reporting_items')
      .select('*')
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
    const parsed = createReportingItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    const { data: item, error } = await supabase
      .from('reporting_items')
      .insert({ ...parsed.data, updated_by: user.id })
      .select('*')
      .single()

    if (error || !item) return serverError()

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'CREATE', entityType: 'reporting_items', entityId: item.id,
      entityDescription: `Tambah item pelaporan: ${parsed.data.jenis_laporan}`,
      newValue: parsed.data,
    })
    return NextResponse.json({ data: item, error: null }, { status: 201 })
  } catch {
    return serverError()
  }
}
