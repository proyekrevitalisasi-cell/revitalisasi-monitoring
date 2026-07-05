'use client'

import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AuditAction, AuditLogEntry } from '@/lib/types'

const ACTION_CLASSES: Record<AuditAction, string> = {
  CREATE: 'bg-green-50 text-green-700 border-green-200',
  UPDATE: 'bg-blue-50 text-blue-700 border-blue-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
  LOGIN: 'bg-gray-50 text-gray-600 border-gray-200',
  LOGOUT: 'bg-gray-50 text-gray-600 border-gray-200',
  BASELINE_SAVE: 'bg-purple-50 text-purple-700 border-purple-200',
  RECALCULATE: 'bg-amber-50 text-amber-700 border-amber-200',
}

interface AuditLogTableProps {
  entries: AuditLogEntry[]
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onRowClick: (entry: AuditLogEntry) => void
}

export function AuditLogTable({
  entries,
  page,
  limit,
  total,
  onPageChange,
  onRowClick,
}: AuditLogTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))

  if (entries.length === 0) {
    return <p className="text-sm text-gray-500">Tidak ada log untuk filter ini.</p>
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Waktu</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Aksi</TableHead>
            <TableHead>Entitas</TableHead>
            <TableHead>Perubahan Ringkas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow
              key={entry.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => onRowClick(entry)}
            >
              <TableCell className="text-gray-500 whitespace-nowrap">
                {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm')}
              </TableCell>
              <TableCell>
                <div className="font-medium text-gray-900">{entry.user_name}</div>
                <div className="text-xs text-gray-500">{entry.user_email}</div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={ACTION_CLASSES[entry.action]}>
                  {entry.action}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-gray-500">{entry.entity_type}</TableCell>
              <TableCell className="text-gray-600">{entry.entity_description ?? '–'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Halaman {page} dari {totalPages} ({total} total)
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </div>
  )
}
