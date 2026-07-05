import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin, notFound } from '@/lib/auth-helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateUserSchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, profile } = await getSession()
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

    // Fetch target user. Uses the service-role client: profiles_select's RLS policy is
    // `is_active = TRUE` only, which would 404 this lookup for the very common "Aktifkan" case
    // (reactivating a currently-inactive target) since that target's row is invisible to the
    // anon/session-scoped client while inactive -- found live during Week 12 Task 14's E2E pass.
    const admin = createAdminClient()
    const { data: target } = await admin
      .from('profiles')
      .select('id, email, role, full_name, is_active')
      .eq('id', params.id)
      .single()

    if (!target) return notFound()

    // Prevent self-lockout/self-demotion: before the createAdminClient() fix below, every
    // profiles UPDATE via the session client silently failed anyway, which accidentally blocked
    // a Super Admin from self-PATCHing (e.g. is_active: false or role: 'viewer' on themselves).
    // Now that the write goes through the service-role client, that accidental protection is
    // gone, so it must be enforced explicitly here -- mirrors the DELETE handler's own guard.
    if (target.id === user.id) return forbidden()

    // Admin cannot modify Admin or Super Admin
    if (profile.role === 'admin' && target.role !== 'viewer') return forbidden()

    // Admin cannot escalate anyone to Admin
    if (profile.role === 'admin' && parsed.data.role === 'admin') return forbidden()

    // Note: super_admin escalation prevented at schema level (updateUserSchema only allows 'admin'|'viewer')

    // Use the same service-role client for the write: the profiles_update RLS policy only defines
    // a USING clause (no explicit WITH CHECK), and in practice that does not permit this update to
    // go through on the anon/session-scoped client even for a fully-authorized actor+target pair
    // (verified live: get_my_role() correctly returns the actor's role, yet the UPDATE itself is
    // rejected with a 42501 "new row violates row-level security policy" error) -- all authorization
    // for this mutation is already fully enforced above in application code (isAdmin, admin-cannot-
    // touch-non-viewer, admin-cannot-escalate), so bypassing RLS here for the write is safe and
    // mirrors this same route's existing use of createAdminClient() for auth.admin operations.
    const { data: updated, error } = await admin
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

    // Use the service-role client for the write -- same profiles_update RLS gap documented in
    // PATCH above (missing explicit WITH CHECK), verified live to silently no-op this exact
    // deactivate-via-DELETE path when run on the anon/session-scoped client. Unlike PATCH, this
    // update previously had no error check at all, so the bug was fully invisible: the route
    // still signed the target out, wrote a "Nonaktifkan user X" audit log entry, and returned a
    // 200 success to the client, while is_active silently remained TRUE in the database.
    const admin = createAdminClient()
    const { error: updateError } = await admin
      .from('profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    if (updateError) return serverError()

    // Sign out the user
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
