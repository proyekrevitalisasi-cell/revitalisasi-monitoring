import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
import { runCpmForLocation } from '@/lib/cpm-runner'

export async function POST(_request: NextRequest, { params }: { params: { locationId: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (!isAdmin(profile.role)) return forbidden()

    const result = await runCpmForLocation(supabase, params.locationId, {
      id: user.id,
      email: profile.email,
      full_name: profile.full_name,
    })

    if (result.hasCycle) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: 'CYCLE_DETECTED',
            message: 'Tidak dapat menghitung CPM: siklus terdeteksi pada data dependensi',
            cycleIds: result.cycleIds,
          },
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      data: { updatedCount: result.updatedActivities.length, criticalPath: result.criticalPath },
      error: null,
    })
  } catch {
    return serverError()
  }
}
