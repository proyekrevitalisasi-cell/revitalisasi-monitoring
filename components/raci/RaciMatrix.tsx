'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RaciCell } from './RaciCell'
import { DeleteStakeholderDialog } from './DeleteStakeholderDialog'
import type { RaciPhase, RaciRole, Stakeholder } from '@/lib/types'

const ROLE_LEGEND: Array<{ code: RaciRole; label: string }> = [
  { code: 'R', label: 'Responsible — pelaksana' },
  { code: 'A', label: 'Accountable — penanggung jawab' },
  { code: 'C', label: 'Consulted — dikonsultasikan' },
  { code: 'I', label: 'Informed — diinformasikan' },
]

interface RaciMatrixProps {
  phases: RaciPhase[]
  stakeholders: Stakeholder[]
  isAdmin: boolean
  onCellChanged: (phaseId: string, stakeholderId: string, role: RaciRole | null) => void
  onReorder: (stakeholderId: string, direction: 'up' | 'down') => void
  onDeleted: (stakeholderId: string) => void
}

function roleOf(phase: RaciPhase, stakeholderId: string): RaciRole | null {
  return phase.raci_entries.find((e) => e.stakeholder_id === stakeholderId)?.role ?? null
}

export function RaciMatrix({
  phases,
  stakeholders,
  isAdmin,
  onCellChanged,
  onReorder,
  onDeleted,
}: RaciMatrixProps) {
  if (phases.length === 0) {
    return <p className="text-sm text-gray-500">Lokasi ini belum punya fase.</p>
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-white">Fase</TableHead>
              {stakeholders.map((sh, index) => (
                <TableHead key={sh.id} className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span title={`${sh.name} (${sh.group_name})`}>{sh.code}</span>
                    {isAdmin && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <button
                          type="button"
                          onClick={() => onReorder(sh.id, 'up')}
                          disabled={index === 0}
                          className="hover:text-gray-900 disabled:opacity-30"
                          title="Geser kiri"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => onReorder(sh.id, 'down')}
                          disabled={index === stakeholders.length - 1}
                          className="hover:text-gray-900 disabled:opacity-30"
                          title="Geser kanan"
                        >
                          ▼
                        </button>
                        <DeleteStakeholderDialog
                          stakeholderId={sh.id}
                          stakeholderLabel={`${sh.code} — ${sh.name}`}
                          onDeleted={onDeleted}
                        />
                      </div>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {phases.map((phase) => (
              <TableRow key={phase.id}>
                <TableCell className="sticky left-0 bg-white font-medium whitespace-nowrap">
                  {phase.phase_code} — {phase.name}
                </TableCell>
                {stakeholders.map((sh) => (
                  <TableCell key={sh.id} className="text-center p-1">
                    <RaciCell
                      phaseId={phase.id}
                      stakeholderId={sh.id}
                      role={roleOf(phase, sh.id)}
                      canEdit={isAdmin}
                      onChanged={(role) => onCellChanged(phase.id, sh.id, role)}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-gray-500 space-y-2 border-t pt-3">
        <div className="flex flex-wrap gap-4">
          {ROLE_LEGEND.map((r) => (
            <span key={r.code}>
              <span className="font-semibold">{r.code}</span> = {r.label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {stakeholders.map((sh) => (
            <span key={sh.id}>
              <span className="font-medium">{sh.code}</span> — {sh.name} ({sh.group_name})
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
