import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, serverError } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()
    if (profile.role === 'viewer') return forbidden()

    const { searchParams } = request.nextUrl
    const entity_type = searchParams.get('entity_type')
    const user_id = searchParams.get('user_id')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const offset = (page - 1) * limit

    let query = supabase
      .from('audit_logs')
      .select('id, user_email, user_name, action, entity_type, entity_id, entity_description, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (entity_type) query = query.eq('entity_type', entity_type)
    if (user_id) query = query.eq('user_id', user_id)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)

    const { data, count, error } = await query
    if (error) return serverError()

    return NextResponse.json({
      data: { items: data, total: count ?? 0, page, limit },
      error: null,
    })
  } catch {
    return serverError()
  }
}
