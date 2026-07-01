import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin, notFound } from '@/lib/auth-helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateUserSchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = updateUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    // Fetch target user
    const { data: target } = await supabase
      .from('profiles')
      .select('id, email, role, full_name, is_active')
      .eq('id', params.id)
      .single()

    if (!target) return notFound()

    // Admin cannot modify Admin or Super Admin
    if (profile.role === 'admin' && target.role !== 'viewer') return forbidden()

    // Admin cannot escalate anyone to Admin
    if (profile.role === 'admin' && parsed.data.role === 'admin') return forbidden()

    // Note: super_admin escalation prevented at schema level (updateUserSchema only allows 'admin'|'viewer')

    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('id, email, full_name, role, is_active')
      .single()

    if (error) return serverError()

    await insertAuditLog({
      userId: user.id,
      userEmail: profile.email,
      userName: profile.full_name,
      action: 'UPDATE',
      entityType: 'profiles',
      entityId: params.id,
      entityDescription: `Update user ${target.email}`,
      oldValue: target,
      newValue: updated,
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
    if (profile.role !== 'super_admin') return forbidden()

    const { data: target } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', params.id)
      .single()

    if (!target) return notFound()
    if (target.id === user.id) {
      return NextResponse.json(
        { data: null, error: { code: 'FORBIDDEN', message: 'Tidak bisa menonaktifkan diri sendiri' } },
        { status: 403 }
      )
    }

    await supabase
      .from('profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    // Sign out the user
    const admin = createAdminClient()
    await admin.auth.admin.signOut(params.id)

    await insertAuditLog({
      userId: user.id,
      userEmail: profile.email,
      userName: profile.full_name,
      action: 'DELETE',
      entityType: 'profiles',
      entityId: params.id,
      entityDescription: `Nonaktifkan user ${target.email}`,
      oldValue: { is_active: true },
      newValue: { is_active: false },
    })

    return NextResponse.json({ data: { id: params.id }, error: null })
  } catch {
    return serverError()
  }
}
