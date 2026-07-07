import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateID } from '@/lib/date-format'
import type { ActivityStatus } from '@/lib/types'

export interface ActivityIssueRow {
  activityId: string
  kegiatan: string
  pic: string
  phaseCode: string
  tanggalSelesaiRencana: string
  status: ActivityStatus
  overdueDays: number
  locationName?: string
  locationCode?: string
}

interface ActivityIssueTableProps {
  issues: ActivityIssueRow[]
  showLocation: boolean
}

export function ActivityIssueTable({ issues, showLocation }: ActivityIssueTableProps) {
  if (issues.length === 0) {
    return <p className="text-sm text-gray-500">Tidak ada isu saat ini.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showLocation && <TableHead>Lokasi</TableHead>}
          <TableHead>Fase</TableHead>
          <TableHead>Kegiatan</TableHead>
          <TableHead>PIC</TableHead>
          <TableHead>Selesai Rencana</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => (
          <TableRow key={issue.activityId}>
            {showLocation && (
              <TableCell className="text-xs text-gray-500">
                {issue.locationCode} — {issue.locationName}
              </TableCell>
            )}
            <TableCell className="text-xs text-gray-500">{issue.phaseCode}</TableCell>
            <TableCell>{issue.kegiatan}</TableCell>
            <TableCell className="text-gray-500">{issue.pic}</TableCell>
            <TableCell className="text-gray-500">{formatDateID(issue.tanggalSelesaiRencana)}</TableCell>
            <TableCell>
              {issue.status === 'ditunda' ? (
                <Badge variant="secondary">Ditunda</Badge>
              ) : (
                <span className="text-amber-600 text-sm">{issue.overdueDays} hari telat</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
