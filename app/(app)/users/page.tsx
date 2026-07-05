import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSession, isAdmin } from '@/lib/auth-helpers'
import { UsersLokasiClient } from '@/components/users/UsersLokasiClient'
import type { Profile, Location } from '@/lib/types'

export default async function UsersPage() {
  const { user, profile } = await getSession()
  if (!user || !profile || !isAdmin(profile.role)) notFound()

  const supabase = createClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active, created_by, created_at')
    .order('created_at', { ascending: false })

  const { data: locationRows } = await supabase
    .from('locations')
    .select('id, name, code, description, project_start_date, created_at')
    .eq('is_active', true)
    .order('display_order')

  const profiles = (profileRows ?? []) as Profile[]
  const locations = (locationRows ?? []) as Location[]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Users & Lokasi</h1>
      <p className="text-gray-500 mt-1 mb-6">Manajemen akun pengguna dan lokasi proyek</p>
      <UsersLokasiClient
        initialProfiles={profiles}
        initialLocations={locations}
        actorRole={profile.role === 'super_admin' ? 'super_admin' : 'admin'}
        actorUserId={user.id}
      />
    </div>
  )
}
