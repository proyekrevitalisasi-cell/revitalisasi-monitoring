'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AuditLogEntry } from '@/lib/types'

interface AuditDetailModalProps {
  entry: AuditLogEntry | null
  onOpenChange: (open: boolean) => void
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(kosong)'
  return JSON.stringify(value, null, 2)
}

export function AuditDetailModal({ entry, onOpenChange }: AuditDetailModalProps) {
  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{entry?.entity_description ?? 'Detail Audit Log'}</DialogTitle>
        </DialogHeader>
        {entry && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Nilai Lama</p>
              <pre className="text-xs bg-gray-50 border border-gray-200 rounded-md p-3 overflow-auto max-h-96 whitespace-pre-wrap">
                {formatValue(entry.old_value)}
              </pre>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Nilai Baru</p>
              <pre className="text-xs bg-gray-50 border border-gray-200 rounded-md p-3 overflow-auto max-h-96 whitespace-pre-wrap">
                {formatValue(entry.new_value)}
              </pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
