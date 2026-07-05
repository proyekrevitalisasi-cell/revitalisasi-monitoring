import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserSchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function GET() {
  try {
    const { user, profile } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    // Use the service-role client to read: profiles_select's RLS policy is `is_active = TRUE`
    // only (by design, so a deactivated user's own session immediately loses visibility of their
    // own profile), but that same policy also hides every deactivated user from this admin-only
    // management list on the session-scoped client -- found live during Week 12 Task 14's E2E
    // pass (a user correctly deactivated via the fixed PATCH/DELETE below then vanished from this
    // GET entirely instead of showing a "Nonaktif" row). isAdmin() above already gates this route.
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('profiles')
      .select('id, email, full_name, role, is_active, created_at')
      .order('created_at', { ascending: false })

    if (error) return serverError()
    return NextResponse.json({ data, error: null })
  } catch {
    return serverError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    const { email, full_name, password, role } = parsed.data

    // Admin can only create Viewer; Super Admin can create Admin or Viewer
    if (profile.role === 'admin' && role !== 'viewer') {
      return NextResponse.json(
        { data: null, error: { code: 'FORBIDDEN', message: 'Admin hanya dapat membuat akun Viewer' } },
        { status: 403 }
      )
    }

    const admin = createAdminClient()
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    })

    if (createError || !newUser.user) {
      const msg = createError?.message?.includes('already') ? 'Email sudah terdaftar' : 'Gagal membuat user'
      return NextResponse.json(
        { data: null, error: { code: 'CREATE_ERROR', message: msg } },
        { status: 400 }
      )
    }

    // Trigger handle_new_user sets role from metadata; also update created_by.
    // Use the service-role client: the profiles_update RLS policy has no explicit WITH CHECK,
    // which in practice silently fails this update on the anon/session-scoped client even for a
    // fully-authorized actor -- same gap documented in PATCH/DELETE at app/api/users/[id]/route.ts.
    // A failure here only affects creator attribution, not the already-created auth user, so it
    // is deliberately non-fatal: created_by simply stays NULL (a valid pre-existing value per
    // Profile.created_by: string | null in lib/types.ts).
    const { error: attributionError } = await admin
      .from('profiles')
      .update({ created_by: user.id })
      .eq('id', newUser.user.id)

    if (attributionError) console.error('Failed to set created_by:', attributionError)

    await insertAuditLog({
      userId: user.id,
      userEmail: profile.email,
      userName: profile.full_name,
      action: 'CREATE',
      entityType: 'profiles',
      entityId: newUser.user.id,
      entityDescription: `Buat user ${email} (${role})`,
      newValue: { email, role },
    })

    return NextResponse.json({ data: { id: newUser.user.id, email, full_name, role }, error: null }, { status: 201 })
  } catch {
    return serverError()
  }
}
