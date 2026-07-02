import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin, notFound } from '@/lib/auth-helpers'
import { updateDependencySchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'
import { getActivityLocationId, runCpmForLocation } from '@/lib/cpm-runner'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = updateDependencySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    const { data: current } = await supabase
      .from('activity_dependencies')
      .select('*')
      .eq('id', params.id)
      .single()
    if (!current) return notFound()

    const { data: updated, error } = await supabase
      .from('activity_dependencies')
      .update(parsed.data)
      .eq('id', params.id)
      .select('id, predecessor_id, successor_id, dep_type, lag_days')
      .single()

    if (error) return serverError()

    const locationId = await getActivityLocationId(supabase, current.predecessor_id)
    if (locationId) {
      await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
    }

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'UPDATE', entityType: 'activity_dependencies', entityId: params.id,
      entityDescription: `Update dependensi ${updated.dep_type}`,
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
      .from('activity_dependencies')
      .select('*')
      .eq('id', params.id)
      .single()
    if (!current) return notFound()

    const { error } = await supabase.from('activity_dependencies').delete().eq('id', params.id)
    if (error) return serverError()

    const locationId = await getActivityLocationId(supabase, current.predecessor_id)
    if (locationId) {
      await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
    }

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'DELETE', entityType: 'activity_dependencies', entityId: params.id,
      entityDescription: `Hapus dependensi ${current.dep_type}: ${current.predecessor_id} → ${current.successor_id}`,
      oldValue: current,
    })

    return NextResponse.json({ data: { id: params.id }, error: null })
  } catch {
    return serverError()
  }
}
