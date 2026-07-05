import { createClient } from '@/lib/supabase/server'
import { getSession, isAdmin } from '@/lib/auth-helpers'
import { PelaporanClient } from '@/components/pelaporan/PelaporanClient'
import type { ReportingItem } from '@/lib/types'

export default async function PelaporanPage() {
  const supabase = createClient()
  const { profile } = await getSession()
  const canEdit = profile ? isAdmin(profile.role) : false

  const { data: itemRows } = await supabase
    .from('reporting_items')
    .select('id, display_order, jenis_laporan, dari_pic, kepada, frekuensi, isi_konten, format_media')
    .order('display_order')

  const items = (itemRows ?? []) as ReportingItem[]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Pelaporan</h1>
      <p className="text-gray-500 mt-1 mb-6">Rencana pelaporan: jenis, PIC, frekuensi, dan format</p>
      <PelaporanClient initialItems={items} isAdmin={canEdit} />
    </div>
  )
}
