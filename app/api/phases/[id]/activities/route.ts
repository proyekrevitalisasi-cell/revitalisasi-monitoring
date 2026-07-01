import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
import { createActivitySchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()

    const { data, error } = await supabase
      .from('activities')
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
    const parsed = createActivitySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    if (parsed.data.tanggal_selesai_rencana < parsed.data.tanggal_mulai_rencana) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'Tanggal selesai harus setelah tanggal mulai' } },
        { status: 400 }
      )
    }

    // Get max display_order for this phase
    const { data: maxRow } = await supabase
      .from('activities')
      .select('display_order')
      .eq('phase_id', params.id)
      .order('display_order', { ascending: false })
      .limit(1)
      .single()

    const display_order = maxRow ? maxRow.display_order + 1 : 1

    const { data: activity, error } = await supabase
      .from('activities')
      .insert({
        phase_id: params.id,
        display_order,
        created_by: user.id,
        updated_by: user.id,
        ...parsed.data,
      })
      .select('*')
      .single()

    if (error || !activity) return serverError()

    // TODO Week 4: trigger CPM via runCpmForLocation(locationId)

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'CREATE', entityType: 'activities', entityId: activity.id,
      entityDescription: `Tambah kegiatan: ${parsed.data.kegiatan}`,
      newValue: parsed.data,
    })

    return NextResponse.json({ data: activity, error: null }, { status: 201 })
  } catch {
    return serverError()
  }
}
