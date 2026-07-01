import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, code')
    .eq('is_active', true)
    .order('display_order')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar profile={profile} locations={locations ?? []} />
      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-6 max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
