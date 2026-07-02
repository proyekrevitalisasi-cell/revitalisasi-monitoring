import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin, notFound } from '@/lib/auth-helpers'
import { updateActivitySchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'
import { extractLocationId, getActivityLocationId, runCpmForLocation } from '@/lib/cpm-runner'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = updateActivitySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    const { data: current } = await supabase
      .from('activities')
      .select('*')
      .eq('id', params.id)
      .single()
    if (!current) return notFound()

    const mergedMulaiRencana = parsed.data.tanggal_mulai_rencana ?? current.tanggal_mulai_rencana
    const mergedSelesaiRencana = parsed.data.tanggal_selesai_rencana ?? current.tanggal_selesai_rencana
    if (mergedSelesaiRencana < mergedMulaiRencana) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'Tanggal selesai rencana harus setelah tanggal mulai rencana' } },
        { status: 400 }
      )
    }

    const mergedMulaiRealisasi =
      parsed.data.tanggal_mulai_realisasi !== undefined ? parsed.data.tanggal_mulai_realisasi : current.tanggal_mulai_realisasi
    const mergedSelesaiRealisasi =
      parsed.data.tanggal_selesai_realisasi !== undefined ? parsed.data.tanggal_selesai_realisasi : current.tanggal_selesai_realisasi
    if (mergedMulaiRealisasi && mergedSelesaiRealisasi && mergedSelesaiRealisasi < mergedMulaiRealisasi) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'Tanggal selesai realisasi harus setelah tanggal mulai realisasi' } },
        { status: 400 }
      )
    }

    // Auto-set progress_pct based on status
    const updates = { ...parsed.data }
    if (updates.status === 'selesai') updates.progress_pct = 100
    if (updates.status === 'belum_mulai') updates.progress_pct = 0

    const { data: updated, error } = await supabase
      .from('activities')
      .update({ ...updates, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) return serverError()

    const datesChanged =
      parsed.data.tanggal_mulai_rencana !== undefined || parsed.data.tanggal_selesai_rencana !== undefined
    if (datesChanged) {
      const locationId = await getActivityLocationId(supabase, params.id)
      if (locationId) {
        await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
      }
    }

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'UPDATE', entityType: 'activities', entityId: params.id,
      entityDescription: `Update kegiatan: ${current.kegiatan}`,
      oldValue: current, newValue: updated,
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

    const { data: current } = await supabase
      .from('activities')
      .select('id, kegiatan, phase_id, phases(location_id)')
      .eq('id', params.id)
      .single()
    if (!current) return notFound()

    // Check for successors
    const { data: successors } = await supabase
      .from('activity_dependencies')
      .select('successor_id')
      .eq('predecessor_id', params.id)

    if (successors && successors.length > 0) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: 'HAS_SUCCESSORS',
            message: `Kegiatan ini memiliki ${successors.length} successor. Hapus dependensi terlebih dahulu.`,
          },
        },
        { status: 409 }
      )
    }

    const locationId = extractLocationId(current.phases as { location_id: string } | { location_id: string }[] | null)

    const { error } = await supabase.from('activities').delete().eq('id', params.id)
    if (error) return serverError()

    if (locationId) {
      await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
    }

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'DELETE', entityType: 'activities', entityId: params.id,
      entityDescription: `Hapus kegiatan: ${current.kegiatan}`,
      oldValue: current,
    })

    return NextResponse.json({ data: { id: params.id }, error: null })
  } catch {
    return serverError()
  }
}
