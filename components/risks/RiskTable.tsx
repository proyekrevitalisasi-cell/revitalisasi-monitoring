'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { DeleteRiskDialog } from './DeleteRiskDialog'
import { getScoreBandClasses } from '@/lib/risk-utils'
import { cn } from '@/lib/utils'
import type { RiskWithPhase } from '@/lib/types'

const CATEGORY_LABELS: Record<RiskWithPhase['category'], string> = {
  teknis: 'Teknis',
  hukum: 'Hukum',
  keuangan: 'Keuangan',
  sosial: 'Sosial',
  lingkungan: 'Lingkungan',
  lainnya: 'Lainnya',
}

const STATUS_LABELS: Record<RiskWithPhase['status'], string> = {
  open: 'Open',
  mitigated: 'Mitigated',
  closed: 'Closed',
}

const LEVELS = [1, 2, 3, 4, 5]

interface RiskTableProps {
  risks: RiskWithPhase[]
  isAdmin: boolean
  onUpdated: (risk: RiskWithPhase) => void
  onDeleted: (id: string) => void
  onEditRequested: (risk: RiskWithPhase) => void
}

export function RiskTable({ risks, isAdmin, onUpdated, onDeleted, onEditRequested }: RiskTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function handleFieldChange(
    risk: RiskWithPhase,
    changes: { probability?: number; impact?: number }
  ) {
    setSavingId(risk.id)
    try {
      const res = await fetch(`/api/risks/${risk.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menyimpan perubahan')
      }
      onUpdated({ ...risk, ...json.data })
      toast.success('Risiko diperbarui')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan perubahan')
    } finally {
      setSavingId(null)
    }
  }

  if (risks.length === 0) {
    return <p className="text-sm text-gray-500">Tidak ada risiko.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Risiko</TableHead>
          <TableHead>Kategori</TableHead>
          <TableHead>Fase</TableHead>
          <TableHead>Probabilitas</TableHead>
          <TableHead>Dampak</TableHead>
          <TableHead>Skor</TableHead>
          <TableHead>Mitigasi</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Status</TableHead>
          {isAdmin && <TableHead>Aksi</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {risks.map((risk, index) => {
          const isExpanded = expandedId === risk.id
          return (
            <TableRow key={risk.id}>
              <TableCell className="text-gray-400">{index + 1}</TableCell>
              <TableCell>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : risk.id)}
                  className="text-left font-medium text-gray-900 hover:text-blue-700"
                >
                  {risk.title}
                </button>
                {isExpanded && risk.description && (
                  <p className="text-xs text-gray-500 mt-1">{risk.description}</p>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{CATEGORY_LABELS[risk.category]}</Badge>
              </TableCell>
              <TableCell className="text-xs text-gray-500">{risk.phaseCode}</TableCell>
              <TableCell>
                {isAdmin ? (
                  <Select
                    value={String(risk.probability)}
                    onValueChange={(v) => handleFieldChange(risk, { probability: Number(v) })}
                    disabled={savingId === risk.id}
                  >
                    <SelectTrigger className="w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((level) => (
                        <SelectItem key={level} value={String(level)}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  risk.probability
                )}
              </TableCell>
              <TableCell>
                {isAdmin ? (
                  <Select
                    value={String(risk.impact)}
                    onValueChange={(v) => handleFieldChange(risk, { impact: Number(v) })}
                    disabled={savingId === risk.id}
                  >
                    <SelectTrigger className="w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((level) => (
                        <SelectItem key={level} value={String(level)}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  risk.impact
                )}
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-8 h-8 rounded-md border text-sm font-semibold',
                    getScoreBandClasses(risk.score)
                  )}
                >
                  {risk.score}
                </span>
              </TableCell>
              <TableCell className="text-gray-500 max-w-xs truncate">
                {risk.mitigation ?? '–'}
              </TableCell>
              <TableCell className="text-gray-500">{risk.owner ?? '–'}</TableCell>
              <TableCell>
                <Badge variant={risk.status === 'closed' ? 'secondary' : 'outline'}>
                  {STATUS_LABELS[risk.status]}
                </Badge>
              </TableCell>
              {isAdmin && (
                <TableCell>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEditRequested(risk)}
                      className="text-gray-400 hover:text-blue-600"
                      title="Edit risiko"
                    >
                      ✏️
                    </button>
                    <DeleteRiskDialog riskId={risk.id} riskTitle={risk.title} onDeleted={onDeleted} />
                  </div>
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
