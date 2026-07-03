import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, serverError } from '@/lib/auth-helpers'

export async function GET(_request: NextRequest, { params }: { params: { locationId: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()

    const { data: phases, error } = await supabase
      .from('phases')
      .select(`
        id, location_id, phase_code, name, pic_utama, display_order, created_at, updated_at,
        activities (
          id, phase_id, display_order, kegiatan, pic,
          tanggal_mulai_rencana, tanggal_selesai_rencana,
          tanggal_mulai_realisasi, tanggal_selesai_realisasi,
          status, progress_pct, catatan, is_milestone, is_on_critical_path,
          date_locked, total_float_days, created_at, updated_at
        )
      `)
      .eq('location_id', params.locationId)
      .order('display_order')
      .order('display_order', { referencedTable: 'activities' })

    if (error) return serverError()
    return NextResponse.json({ data: phases, error: null })
  } catch {
    return serverError()
  }
}
