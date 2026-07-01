import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
import { createWorkCalendarSchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function GET() {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    const { data, error } = await supabase
      .from('work_calendar')
      .select('id, holiday_date, name, created_at')
      .order('holiday_date')
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
    const parsed = createWorkCalendarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    const { data: holiday, error } = await supabase
      .from('work_calendar')
      .insert({ ...parsed.data, created_by: user.id })
      .select('id, holiday_date, name')
      .single()

    if (error) {
      return NextResponse.json(
        { data: null, error: { code: 'CREATE_ERROR', message: error.message.includes('unique') ? 'Tanggal sudah ada' : 'Gagal tambah hari libur' } },
        { status: 400 }
      )
    }

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'CREATE', entityType: 'work_calendar', entityId: holiday!.id,
      entityDescription: `Tambah hari libur: ${parsed.data.name} (${parsed.data.holiday_date})`,
      newValue: parsed.data,
    })

    // TODO Week 4: trigger CPM recalculate for ALL active locations after calendar change

    return NextResponse.json({ data: holiday, error: null }, { status: 201 })
  } catch {
    return serverError()
  }
}
