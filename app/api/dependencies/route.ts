import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
import { createDependencySchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = createDependencySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    if (parsed.data.predecessor_id === parsed.data.successor_id) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'Predecessor dan successor tidak boleh sama' } },
        { status: 400 }
      )
    }

    // TODO Week 4: detect cycles before insert using DFS on full dependency graph

    const { data: dep, error } = await supabase
      .from('activity_dependencies')
      .insert({ ...parsed.data, created_by: user.id })
      .select('id, predecessor_id, successor_id, dep_type, lag_days')
      .single()

    if (error) {
      const msg = error.message.includes('unique') ? 'Dependensi ini sudah ada' : 'Gagal membuat dependensi'
      return NextResponse.json({ data: null, error: { code: 'CREATE_ERROR', message: msg } }, { status: 400 })
    }

    // TODO Week 4: trigger CPM via runCpmForLocation(locationId)

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'CREATE', entityType: 'activity_dependencies', entityId: dep.id,
      entityDescription: `Tambah dependensi ${dep.dep_type}: ${dep.predecessor_id} → ${dep.successor_id}`,
      newValue: dep,
    })

    return NextResponse.json({ data: dep, error: null }, { status: 201 })
  } catch {
    return serverError()
  }
}
