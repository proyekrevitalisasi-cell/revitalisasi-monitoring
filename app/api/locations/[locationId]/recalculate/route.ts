import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
import { insertAuditLog } from '@/lib/audit'

export async function POST(_request: NextRequest, { params }: { params: { locationId: string } }) {
  try {
    const { user, profile } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    // TODO Week 4: implement full CPM recalculate
    // For now, return stub response

    await insertAuditLog({
      userId: user.id,
      userEmail: profile.email,
      userName: profile.full_name,
      action: 'RECALCULATE',
      entityType: 'locations',
      entityId: params.locationId,
      entityDescription: 'CPM recalculate (stub — Week 4)',
    })

    return NextResponse.json({
      data: { updatedCount: 0, criticalPath: [] },
      error: null,
    })
  } catch {
    return serverError()
  }
}
