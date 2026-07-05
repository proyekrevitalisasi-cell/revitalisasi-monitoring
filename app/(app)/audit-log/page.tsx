import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSession, isAdmin } from '@/lib/auth-helpers'
import { AuditLogClient } from '@/components/audit-log/AuditLogClient'
import type { AuditLogEntry, ProfileOption } from '@/lib/types'

const LIMIT = 50

export default async function AuditLogPage() {
  const { profile } = await getSession()
  if (!profile || !isAdmin(profile.role)) notFound()

  const supabase = createClient()

  const { data: entryRows, count } = await supabase
    .from('audit_logs')
    .select(
      'id, user_email, user_name, action, entity_type, entity_id, entity_description, old_value, new_value, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(0, LIMIT - 1)

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .order('full_name')

  const entries = (entryRows ?? []) as AuditLogEntry[]
  const profiles = (profileRows ?? []) as ProfileOption[]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
      <p className="text-gray-500 mt-1 mb-6">Riwayat perubahan data di seluruh sistem</p>
      <AuditLogClient initialEntries={entries} initialTotal={count ?? 0} profiles={profiles} />
    </div>
  )
}
