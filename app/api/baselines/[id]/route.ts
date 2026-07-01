import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, notFound } from '@/lib/auth-helpers'
import { insertAuditLog } from '@/lib/audit'

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (profile.role !== 'super_admin') return forbidden()

    const { data: current } = await supabase.from('baselines').select('id, name, location_id').eq('id', params.id).single()
    if (!current) return notFound()

    const { error } = await supabase.from('baselines').delete().eq('id', params.id)
    if (error) return serverError()

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'DELETE', entityType: 'baselines', entityId: params.id,
      entityDescription: `Hapus baseline: ${current.name}`,
    })
    return NextResponse.json({ data: { id: params.id }, error: null })
  } catch {
    return serverError()
  }
}
