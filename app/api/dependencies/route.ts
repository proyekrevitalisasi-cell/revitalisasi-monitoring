import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError, isAdmin } from '@/lib/auth-helpers'
import { createDependencySchema } from '@/lib/validations'
import { insertAuditLog } from '@/lib/audit'
import { getActivityLocationId, runCpmForLocation, toCpmSummary } from '@/lib/cpm-runner'
import type { CpmSummary } from '@/lib/types'
import { detectCycle, type CpmDependency, type DepType } from '@/lib/cpm'

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

    const predecessorLocationId = await getActivityLocationId(supabase, parsed.data.predecessor_id)
    const successorLocationId = await getActivityLocationId(supabase, parsed.data.successor_id)
    if (!predecessorLocationId || !successorLocationId) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'Kegiatan predecessor atau successor tidak ditemukan' } },
        { status: 400 }
      )
    }
    if (predecessorLocationId !== successorLocationId) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'Predecessor dan successor harus berada di lokasi yang sama' } },
        { status: 400 }
      )
    }
    const locationId = predecessorLocationId

    const { data: phaseRows, error: phaseError } = await supabase.from('phases').select('id').eq('location_id', locationId)
    if (phaseError) return serverError()
    const phaseIds = (phaseRows ?? []).map((p: { id: string }) => p.id)
    const { data: activityRows, error: activityError } = await supabase.from('activities').select('id').in('phase_id', phaseIds)
    if (activityError) return serverError()
    const activityIds = (activityRows ?? []).map((a: { id: string }) => a.id)
    const { data: existingDepRows, error: existingDepError } = await supabase
      .from('activity_dependencies')
      .select('predecessor_id, successor_id, dep_type, lag_days')
      .in('predecessor_id', activityIds)
    if (existingDepError) return serverError()

    const hypotheticalDeps: CpmDependency[] = [
      ...(existingDepRows ?? []).map((d: { predecessor_id: string; successor_id: string; dep_type: DepType; lag_days: number }) => ({
        predecessorId: d.predecessor_id,
        successorId: d.successor_id,
        type: d.dep_type,
        lagDays: d.lag_days,
      })),
      {
        predecessorId: parsed.data.predecessor_id,
        successorId: parsed.data.successor_id,
        type: parsed.data.dep_type,
        lagDays: parsed.data.lag_days,
      },
    ]
    const cycleCheck = detectCycle(activityIds, hypotheticalDeps)
    if (cycleCheck.hasCycle) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: 'CYCLE_DETECTED',
            message: 'Dependensi ini akan menciptakan siklus (circular dependency)',
            cycleIds: cycleCheck.cycleIds,
          },
        },
        { status: 422 }
      )
    }

    const { data: dep, error } = await supabase
      .from('activity_dependencies')
      .insert({ ...parsed.data, created_by: user.id })
      .select('id, predecessor_id, successor_id, dep_type, lag_days')
      .single()

    if (error) {
      const msg = error.message.includes('unique') ? 'Dependensi ini sudah ada' : 'Gagal membuat dependensi'
      return NextResponse.json({ data: null, error: { code: 'CREATE_ERROR', message: msg } }, { status: 400 })
    }

    const result = await runCpmForLocation(supabase, locationId, { id: user.id, email: profile.email, full_name: profile.full_name })
    const cpm: CpmSummary = toCpmSummary(result)

    await insertAuditLog({
      userId: user.id, userEmail: profile.email, userName: profile.full_name,
      action: 'CREATE', entityType: 'activity_dependencies', entityId: dep.id,
      entityDescription: `Tambah dependensi ${dep.dep_type}: ${dep.predecessor_id} → ${dep.successor_id}`,
      newValue: dep,
    })

    return NextResponse.json({ data: { dependency: dep, cpm }, error: null }, { status: 201 })
  } catch {
    return serverError()
  }
}
