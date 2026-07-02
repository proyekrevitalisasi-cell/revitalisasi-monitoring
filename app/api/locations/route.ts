import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
import { createLocationSchema } from '@/lib/validations'
import { createLocationWithTemplate } from '@/lib/templates'
import { insertAuditLog } from '@/lib/audit'
import { parseISO } from 'date-fns'

export async function GET() {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()

    const { data, error } = await supabase
      .from('locations')
      .select(`
        id, name, code, description, display_order, is_active, created_at,
        phases (
          id, phase_code, name,
          activities ( status, progress_pct, is_on_critical_path )
        )
      `)
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
    const parsed = createLocationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    const { name, code, description, project_start_date } = parsed.data

    // Insert location
    const { data: location, error: locError } = await supabase
      .from('locations')
      .insert({ name, code: code.toUpperCase(), description, project_start_date, created_by: user.id })
      .select('id, name, code')
      .single()

    if (locError || !location) {
      const msg = locError?.message?.includes('unique') ? 'Kode lokasi sudah digunakan' : 'Gagal membuat lokasi'
      return NextResponse.json({ data: null, error: { code: 'CREATE_ERROR', message: msg } }, { status: 400 })
    }

    // Fetch holidays for calendar calculation
    const { data: holidayRows, error: calError } = await supabase.from('work_calendar').select('holiday_date')
    if (calError) {
      await supabase.from('locations').delete().eq('id', location.id)
      return serverError()
    }
    const holidays = (holidayRows ?? []).map((h) => parseISO(h.holiday_date))

    // Create 4 phases + activities from template
    await createLocationWithTemplate(supabase, location.id, parseISO(project_start_date), holidays)

    // Insert kk_consent row
    const { error: kkError } = await supabase
      .from('kk_consent')
      .insert({ location_id: location.id, target_kk: 0, threshold_pct: 60 })
    if (kkError) {
      await supabase.from('locations').delete().eq('id', location.id)
      return serverError()
    }

    await insertAuditLog({
      userId: user.id,
      userEmail: profile.email,
      userName: profile.full_name,
      action: 'CREATE',
      entityType: 'locations',
      entityId: location.id,
      entityDescription: `Buat lokasi ${name} (${code})`,
      newValue: { name, code },
    })

    return NextResponse.json({ data: location, error: null }, { status: 201 })
  } catch {
    return serverError()
  }
}
