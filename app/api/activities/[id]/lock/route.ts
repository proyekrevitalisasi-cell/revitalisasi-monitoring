import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin, notFound } from '@/lib/auth-helpers'
import { insertAuditLog } from '@/lib/audit'

export async function PATCH(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const { data: current } = await supabase
      .from('activities')
      .select('id, kegiatan, date_locked')
      .eq('id', params.id)
      .single()
    if (!current) return notFound()

    const newLocked = !current.date_locked
    const { data: updated, error } = await supabase
      .from('activities')
      .update({ date_locked: newLocked, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('id, kegiatan, date_locked')
      .single()

    if (error) return serverError()

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'UPDATE', entityType: 'activities', entityId: params.id,
      entityDescription: `${newLocked ? 'Kunci' : 'Buka kunci'} tanggal: ${current.kegiatan}`,
      oldValue: { date_locked: current.date_locked }, newValue: { date_locked: newLocked },
    })

    return NextResponse.json({ data: updated, error: null })
  } catch {
    return serverError()
  }
}
