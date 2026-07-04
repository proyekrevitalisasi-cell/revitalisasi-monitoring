import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { computeProgressPct } from '@/lib/dashboard-metrics'
import type { Phase } from '@/lib/types'

const PHASE_CODES: Phase['phase_code'][] = ['F1', 'F2', 'F3', 'F4']

interface ComparativeTableProps {
  locations: Array<{
    code: string
    name: string
    phases: Array<{
      phase_code: Phase['phase_code']
      activities: Array<{ progress_pct: number }>
    }>
  }>
}

export function ComparativeTable({ locations }: ComparativeTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lokasi</TableHead>
          {PHASE_CODES.map((code) => (
            <TableHead key={code} className="text-center">
              {code}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {locations.map((location) => (
          <TableRow key={location.code}>
            <TableCell className="font-medium">{location.name}</TableCell>
            {PHASE_CODES.map((code) => {
              const phase = location.phases.find((p) => p.phase_code === code)
              const pct = phase ? computeProgressPct(phase.activities) : 0
              return (
                <TableCell key={code} className="text-center text-gray-600">
                  {pct}%
                </TableCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
