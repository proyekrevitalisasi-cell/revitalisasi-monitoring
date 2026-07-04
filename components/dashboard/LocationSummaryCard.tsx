import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { PHASE_COLORS } from '@/components/gantt/gantt-constants'
import { computeProgressPct, computeStatusCounts } from '@/lib/dashboard-metrics'
import type { Phase, ActivityStatus } from '@/lib/types'

interface LocationSummaryCardProps {
  location: { code: string; name: string; description: string | null }
  phases: Array<{
    phase_code: Phase['phase_code']
    activities: Array<{ status: ActivityStatus; progress_pct: number; is_on_critical_path: boolean }>
  }>
}

export function LocationSummaryCard({ location, phases }: LocationSummaryCardProps) {
  const allActivities = phases.flatMap((p) => p.activities)
  const overallPct = computeProgressPct(allActivities)
  const counts = computeStatusCounts(allActivities)

  return (
    <Link href={`/dashboard/${location.code}`} className="block">
      <Card className="hover:border-blue-400 hover:shadow-md transition-all">
        <CardHeader className="pb-2">
          <div className="text-xs font-bold text-blue-600 uppercase tracking-wide">{location.code}</div>
          <div className="font-semibold text-gray-900">{location.name}</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Progres Keseluruhan</span>
              <span className="font-medium text-gray-900">{overallPct}%</span>
            </div>
            <Progress value={overallPct} />
          </div>

          <div className="flex gap-2">
            {phases.map((phase) => {
              const phasePct = computeProgressPct(phase.activities)
              return (
                <div key={phase.phase_code} className="flex-1 text-center">
                  <div
                    className="h-1.5 rounded-full mb-1"
                    style={{ backgroundColor: PHASE_COLORS[phase.phase_code] }}
                  />
                  <div className="text-[11px] text-gray-500">
                    {phase.phase_code} {phasePct}%
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-between text-xs pt-1 border-t border-gray-100">
            <span className="text-red-600 font-medium">{counts.critical} kritis</span>
            <span className="text-amber-600 font-medium">{counts.ditunda} ditunda</span>
            <span className="text-gray-500">
              {counts.selesai}/{counts.total} selesai
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
