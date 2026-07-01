import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
import { upsertRaciSchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; stakeholderId: string } }
) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = upsertRaciSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    if (parsed.data.role === null) {
      // Delete the entry
      await supabase
        .from('raci_entries')
        .delete()
        .eq('phase_id', params.id)
        .eq('stakeholder_id', params.stakeholderId)
      return NextResponse.json({ data: null, error: null })
    }

    const { data: upserted, error } = await supabase
      .from('raci_entries')
      .upsert(
        {
          phase_id: params.id,
          stakeholder_id: params.stakeholderId,
          role: parsed.data.role,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'phase_id,stakeholder_id' }
      )
      .select('id, phase_id, stakeholder_id, role')
      .single()

    if (error) return serverError()

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'UPDATE', entityType: 'raci_entries', entityId: upserted?.id,
      entityDescription: `Set RACI ${parsed.data.role} untuk stakeholder ${params.stakeholderId}`,
      newValue: upserted,
    })

    return NextResponse.json({ data: upserted, error: null })
  } catch {
    return serverError()
  }
}
