import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Tidak terautentikasi' } },
      { status: 401 }
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, is_active, created_at')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    data: {
      id: user.id,
      email: user.email,
      full_name: profile?.full_name ?? '',
      role: profile?.role ?? 'viewer',
      is_active: profile?.is_active ?? false,
    },
    error: null,
  })
}
