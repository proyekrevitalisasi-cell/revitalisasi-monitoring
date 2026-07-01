import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
import { createBaselineSchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function GET(_request: NextRequest, { params }: { params: { locationId: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    const { data, error } = await supabase
      .from('baselines')
      .select('id, name, description, is_active, created_at')
      .eq('location_id', params.locationId)
      .order('created_at', { ascending: false })
    if (error) return serverError()
    return NextResponse.json({ data, error: null })
  } catch {
    return serverError()
  }
}

export async function POST(request: NextRequest, { params }: { params: { locationId: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = createBaselineSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    // Deactivate all existing baselines for this location
    await supabase.from('baselines').update({ is_active: false }).eq('location_id', params.locationId)

    // Create new baseline
    const { data: baseline, error: bError } = await supabase
      .from('baselines')
      .insert({
        location_id: params.locationId,
        name: parsed.data.name,
        description: parsed.data.description,
        is_active: true,
        created_by: user.id,
      })
      .select('id, name, is_active, created_at')
      .single()

    if (bError || !baseline) return serverError()

    // Snapshot all activities for this location
    const { data: phases } = await supabase.from('phases').select('id').eq('location_id', params.locationId)
    if (phases && phases.length > 0) {
      const phaseIds = phases.map((p) => p.id)
      const { data: activities } = await supabase
        .from('activities')
        .select('id, kegiatan, tanggal_mulai_rencana, tanggal_selesai_rencana, is_milestone')
        .in('phase_id', phaseIds)

      if (activities && activities.length > 0) {
        await supabase.from('baseline_activities').insert(
          activities.map((a) => ({
            baseline_id: baseline.id,
            activity_id: a.id,
            kegiatan: a.kegiatan,
            tanggal_mulai_rencana: a.tanggal_mulai_rencana,
            tanggal_selesai_rencana: a.tanggal_selesai_rencana,
            is_milestone: a.is_milestone,
          }))
        )
      }
    }

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'BASELINE_SAVE', entityType: 'baselines', entityId: baseline.id,
      entityDescription: `Simpan baseline: ${parsed.data.name}`,
      newValue: { name: parsed.data.name, location_id: params.locationId },
    })

    return NextResponse.json({ data: baseline, error: null }, { status: 201 })
  } catch {
    return serverError()
  }
}
