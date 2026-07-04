import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface CriticalPathCardProps {
  criticalCount: number
  finishDate: string | null
}

export function CriticalPathCard({ criticalCount, finishDate }: CriticalPathCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="font-semibold text-gray-900">Jalur Kritis</div>
      </CardHeader>
      <CardContent className="flex justify-between items-end">
        <div>
          <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
          <div className="text-xs text-gray-500">kegiatan kritis</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">{finishDate ?? '–'}</div>
          <div className="text-xs text-gray-500">estimasi selesai proyek</div>
        </div>
      </CardContent>
    </Card>
  )
}
