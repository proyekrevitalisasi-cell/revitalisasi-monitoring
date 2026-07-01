import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
import { reorderActivitiesSchema } from '@/lib/validations'

export async function PATCH(request: NextRequest) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const body = await request.json()
    const parsed = reorderActivitiesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } },
        { status: 400 }
      )
    }

    // Batch update display_order
    const results = await Promise.all(
      parsed.data.items.map(({ id, display_order }) =>
        supabase.from('activities').update({ display_order }).eq('id', id)
      )
    )

    const failed = results.filter((r) => r.error)
    if (failed.length > 0) return serverError()

    return NextResponse.json({ data: { updated: parsed.data.items.length }, error: null })
  } catch {
    return serverError()
  }
}
