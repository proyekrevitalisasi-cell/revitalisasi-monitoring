'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { getWorkloadBandClasses, getActivitiesInCell, type WeekColumn, type PicWorkloadRow } from '@/lib/workload-metrics'
import type { WorkloadActivity } from '@/lib/types'

interface WorkloadHeatmapProps {
  rows: PicWorkloadRow[]
  weekColumns: WeekColumn[]
  activities: WorkloadActivity[]
}

export function WorkloadHeatmap({ rows, weekColumns, activities }: WorkloadHeatmapProps) {
  const [selectedCell, setSelectedCell] = useState<{ pic: string; week: WeekColumn } | null>(null)

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">Tidak ada data PIC untuk ditampilkan.</p>
  }

  const cellActivities = selectedCell
    ? getActivitiesInCell(activities, selectedCell.pic, selectedCell.week)
    : []

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-white">PIC</TableHead>
              {weekColumns.map((week) => (
                <TableHead key={week.start} className="text-center whitespace-nowrap">
                  {week.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.pic}>
                <TableCell className="sticky left-0 bg-white font-medium">{row.pic}</TableCell>
                {row.weekCounts.map((count, i) => (
                  <TableCell key={weekColumns[i].start} className="text-center p-1">
                    <button
                      type="button"
                      onClick={() => count > 0 && setSelectedCell({ pic: row.pic, week: weekColumns[i] })}
                      className={cn(
                        'w-full h-9 flex items-center justify-center text-sm font-semibold rounded-md border transition-colors',
                        getWorkloadBandClasses(count)
                      )}
                    >
                      {count > 0 ? count : ''}
                    </button>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={selectedCell !== null} onOpenChange={(open) => !open && setSelectedCell(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCell ? `${selectedCell.pic} — ${selectedCell.week.label}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {cellActivities.length === 0 ? (
              <p className="text-sm text-gray-500">Tidak ada kegiatan.</p>
            ) : (
              cellActivities.map((a) => (
                <div key={a.id} className="text-sm border rounded-md p-2">
                  <div className="font-medium">{a.kegiatan}</div>
                  <div className="text-gray-500 text-xs">
                    {a.locationName} ({a.locationCode}) — {a.phaseCode}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
