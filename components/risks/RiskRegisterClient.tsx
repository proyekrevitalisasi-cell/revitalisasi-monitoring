'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { RiskMatrix } from './RiskMatrix'
import { RiskTable } from './RiskTable'
import { RiskFormModal } from './RiskFormModal'
import type { RiskWithPhase, RiskCategory, RiskStatus, RiskPhaseOption } from '@/lib/types'

const CATEGORY_OPTIONS: Array<{ value: RiskCategory; label: string }> = [
  { value: 'teknis', label: 'Teknis' },
  { value: 'hukum', label: 'Hukum' },
  { value: 'keuangan', label: 'Keuangan' },
  { value: 'sosial', label: 'Sosial' },
  { value: 'lingkungan', label: 'Lingkungan' },
  { value: 'lainnya', label: 'Lainnya' },
]

const STATUS_OPTIONS: Array<{ value: RiskStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'mitigated', label: 'Mitigated' },
  { value: 'closed', label: 'Closed' },
]

interface RiskRegisterClientProps {
  initialRisks: RiskWithPhase[]
  phases: RiskPhaseOption[]
  isAdmin: boolean
}

export function RiskRegisterClient({ initialRisks, phases, isAdmin }: RiskRegisterClientProps) {
  const [risks, setRisks] = useState<RiskWithPhase[]>(initialRisks)
  const [faseFilter, setFaseFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [matrixFilter, setMatrixFilter] = useState<{ probability: number; impact: number } | null>(
    null
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRisk, setEditingRisk] = useState<RiskWithPhase | null>(null)

  const baseFiltered = risks.filter((r) => {
    if (faseFilter !== 'all' && r.phaseCode !== faseFilter) return false
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
    return true
  })

  const tableFiltered = baseFiltered.filter((r) => {
    if (!matrixFilter) return true
    return r.probability === matrixFilter.probability && r.impact === matrixFilter.impact
  })

  function handleCellClick(probability: number, impact: number) {
    setMatrixFilter((prev) =>
      prev && prev.probability === probability && prev.impact === impact
        ? null
        : { probability, impact }
    )
  }

  function handleUpdated(updated: RiskWithPhase) {
    setRisks((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
  }

  function handleDeleted(id: string) {
    setRisks((prev) => prev.filter((r) => r.id !== id))
  }

  function handleSaved(saved: RiskWithPhase) {
    setRisks((prev) => {
      const exists = prev.some((r) => r.id === saved.id)
      return exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved]
    })
  }

  function openCreateModal() {
    setEditingRisk(null)
    setModalOpen(true)
  }

  function openEditModal(risk: RiskWithPhase) {
    setEditingRisk(risk)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Fase</label>
            <Select value={faseFilter} onValueChange={setFaseFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Fase</SelectItem>
                {phases.map((phase) => (
                  <SelectItem key={phase.id} value={phase.phase_code}>
                    {phase.phase_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Kategori</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {isAdmin && <Button onClick={openCreateModal}>+ Tambah Risiko</Button>}
      </div>

      <RiskMatrix risks={baseFiltered} activeCell={matrixFilter} onCellClick={handleCellClick} />

      <RiskTable
        risks={tableFiltered}
        isAdmin={isAdmin}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        onEditRequested={openEditModal}
      />

      {isAdmin && (
        <RiskFormModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          phases={phases}
          risk={editingRisk}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
