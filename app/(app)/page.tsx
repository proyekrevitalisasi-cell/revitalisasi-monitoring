import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = createClient()
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, code, description')
    .eq('is_active', true)
    .order('display_order')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">
        Program Revitalisasi Rusun
      </h1>
      <p className="text-gray-500 mt-1 mb-6">Ringkasan Semua Lokasi — Perum Perumnas</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(locations ?? []).map((loc) => (
          <Link
            key={loc.code}
            href={`/dashboard/${loc.code}`}
            className="block p-5 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all group"
          >
            <div className="text-xs font-bold text-blue-600 mb-1 uppercase tracking-wide">
              {loc.code}
            </div>
            <div className="font-semibold text-gray-900 group-hover:text-blue-700">
              {loc.name}
            </div>
            {loc.description && (
              <div className="text-xs text-gray-400 mt-1">{loc.description}</div>
            )}
            <div className="text-xs text-blue-500 mt-3 group-hover:underline">
              Buka Dashboard →
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-700 font-medium">Minggu 1 — Fondasi selesai</p>
        <p className="text-xs text-amber-600 mt-1">
          Fase berikutnya: API routes data layer (Minggu 2), lalu Fase CRUD (Minggu 3).
          CPM Engine mulai Minggu 4.
        </p>
      </div>
    </div>
  )
}
