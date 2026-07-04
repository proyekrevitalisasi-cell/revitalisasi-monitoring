import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface KkConsentSummaryBarProps {
  locationCode: string
  targetKk: number
  setuju: number
  thresholdPct: number
}

export function KkConsentSummaryBar({ locationCode, targetKk, setuju, thresholdPct }: KkConsentSummaryBarProps) {
  const pct = targetKk > 0 ? Math.round((setuju / targetKk) * 100) : 0
  const metThreshold = pct >= thresholdPct

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-500">Persetujuan Warga (KK)</span>
        <span className={cn('font-medium', metThreshold ? 'text-green-600' : 'text-amber-600')}>
          {pct}% (ambang {thresholdPct}%)
        </span>
      </div>
      <Progress value={pct} />
      <Link
        href={`/dashboard/${locationCode}/kk-consent`}
        className="text-xs text-blue-500 hover:underline mt-1 inline-block"
      >
        Lihat detail →
      </Link>
    </div>
  )
}
