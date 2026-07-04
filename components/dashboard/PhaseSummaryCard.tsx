import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { computeProgressPct, computeStatusCounts } from '@/lib/dashboard-metrics'
import type { ActivityStatus } from '@/lib/types'

interface PhaseSummaryCardProps {
  name: string
  picUtama: string
  activities: Array<{ status: ActivityStatus; progress_pct: number; is_on_critical_path: boolean }>
}

export function PhaseSummaryCard({ name, picUtama, activities }: PhaseSummaryCardProps) {
  const pct = computeProgressPct(activities)
  const counts = computeStatusCounts(activities)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="font-semibold text-gray-900">{name}</div>
        <div className="text-xs text-gray-400">{picUtama}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{pct}%</div>
        <div className="text-xs text-gray-500 mt-1">
          {counts.selesai}/{counts.total} selesai
        </div>
        {counts.ditunda > 0 && (
          <Badge variant="secondary" className="mt-2">
            {counts.ditunda} ditunda
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}
