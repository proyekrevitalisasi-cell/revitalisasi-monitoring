import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, isAdmin } from '@/lib/auth-helpers'
import { UsersLokasiClient } from '@/components/users/UsersLokasiClient'
import type { Profile, Location } from '@/lib/types'

export default async function UsersPage() {
  const { user, profile } = await getSession()
  if (!user || !profile || !isAdmin(profile.role)) notFound()

  const supabase = createClient()

  // Use the service-role client for profiles: profiles_select's RLS policy is `is_active = TRUE`
  // only, which otherwise hides every deactivated user from this admin management table entirely
  // (found live during Week 12 Task 14's E2E pass) instead of showing them with a "Nonaktif"
  // badge. The isAdmin() gate above already restricts who can reach this page.
  const admin = createAdminClient()
  const { data: profileRows } = await admin
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
