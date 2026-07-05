'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface SummaryActivity {
  id: string
  kegiatan: string
  pic: string
  phase_code: string
  status: string
}

interface WeeklySummaryData {
  week: string
  selesai_minggu_ini: SummaryActivity[]
  mulai_minggu_depan: SummaryActivity[]
  terlambat: SummaryActivity[]
  ditunda: SummaryActivity[]
  overall_pct: number
  phase_progress: Array<{ phase_code: string; name: string; pct: number }>
  whatsapp_text: string
}

interface WeeklySummaryClientProps {
  locationId: string
}

export function WeeklySummaryClient({ locationId }: WeeklySummaryClientProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [data, setData] = useState<WeeklySummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/locations/${locationId}/weekly-summary?weekOffset=${weekOffset}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.error) {
          toast.error(json.error.message ?? 'Gagal memuat ringkasan mingguan')
          return
        }
        setData(json.data as WeeklySummaryData)
      })
      .catch(() => {
        if (!cancelled) toast.error('Gagal memuat ringkasan mingguan')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [locationId, weekOffset])

  async function handleCopy() {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.whatsapp_text)
      toast.success('Teks disalin ke clipboard')
    } catch {
      toast.error('Gagal menyalin teks')
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-gray-500">Memuat ringkasan mingguan…</p>
  }

  if (!data) {
    return <p className="text-sm text-gray-500">Gagal memuat data.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setWeekOffset((w) => w - 1)}>
            ← Minggu Sebelumnya
          </Button>
          <span className="text-sm font-medium text-gray-900">{data.week}</span>
          <Button variant="outline" onClick={() => setWeekOffset((w) => w + 1)}>
            Minggu Berikutnya →
          </Button>
        </div>
        {weekOffset !== 0 && (
          <Button variant="ghost" onClick={() => setWeekOffset(0)}>
            Kembali ke Minggu Ini
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryPanel title="✅ Selesai Minggu Ini" items={data.selesai_minggu_ini} />
        <SummaryPanel title="🚀 Mulai Minggu Depan" items={data.mulai_minggu_depan} />
        <SummaryPanel title="⏰ Terlambat" items={data.terlambat} />
        <SummaryPanel title="⚠️ Ditunda" items={data.ditunda} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900">Teks WhatsApp</h2>
          <Button onClick={handleCopy}>Salin Teks WhatsApp</Button>
        </div>
        <pre className="font-mono text-xs bg-gray-50 border rounded-md p-4 whitespace-pre-wrap">
          {data.whatsapp_text}
        </pre>
      </div>
    </div>
  )
}

function SummaryPanel({ title, items }: { title: string; items: SummaryActivity[] }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-sm font-semibold text-gray-900 mb-2">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">Tidak ada</p>
      ) : (
        <ul className="space-y-1">
          {items.map((a) => (
            <li key={a.id} className="text-xs text-gray-600">
              {a.kegiatan} ({a.phase_code}) — {a.pic}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
