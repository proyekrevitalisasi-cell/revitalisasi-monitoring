import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Role = 'super_admin' | 'admin' | 'viewer'

interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  is_active: boolean
}

interface Session {
  supabase: ReturnType<typeof createClient>
  user: { id: string; email: string } | null
  profile: Profile | null
}

export async function getSession(): Promise<Session> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { supabase, user: null, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) return { supabase, user: null, profile: null }

  return { supabase, user: { id: user.id, email: user.email! }, profile }
}

export function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: 'UNAUTHORIZED', message: 'Tidak terautentikasi' } },
    { status: 401 }
  )
}

export function forbidden() {
  return NextResponse.json(
    { data: null, error: { code: 'FORBIDDEN', message: 'Tidak memiliki izin' } },
    { status: 403 }
  )
}

export function serverError(message = 'Terjadi kesalahan server') {
  return NextResponse.json(
    { data: null, error: { code: 'SERVER_ERROR', message } },
    { status: 500 }
  )
}

export function notFound(message = 'Data tidak ditemukan') {
  return NextResponse.json(
    { data: null, error: { code: 'NOT_FOUND', message } },
    { status: 404 }
  )
}

export function isAdmin(role: Role) {
  return role === 'admin' || role === 'super_admin'
}
