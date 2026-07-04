'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import type { RiskCategory, RiskStatus, RiskWithPhase, RiskPhaseOption } from '@/lib/types'

const CATEGORIES: Array<{ value: RiskCategory; label: string }> = [
  { value: 'teknis', label: 'Teknis' },
  { value: 'hukum', label: 'Hukum' },
  { value: 'keuangan', label: 'Keuangan' },
  { value: 'sosial', label: 'Sosial' },
  { value: 'lingkungan', label: 'Lingkungan' },
  { value: 'lainnya', label: 'Lainnya' },
]

const STATUSES: Array<{ value: RiskStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'mitigated', label: 'Mitigated' },
  { value: 'closed', label: 'Closed' },
]

const LEVELS = [1, 2, 3, 4, 5]

interface RiskFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  phases: RiskPhaseOption[]
  risk: RiskWithPhase | null
  onSaved: (risk: RiskWithPhase, phaseId: string) => void
}

interface FormState {
  phaseId: string
  title: string
  description: string
  category: RiskCategory
  probability: number
  impact: number
  mitigation: string
  owner: string
  status: RiskStatus
}

function emptyForm(defaultPhaseId: string): FormState {
  return {
    phaseId: defaultPhaseId,
    title: '',
    description: '',
    category: 'teknis',
    probability: 1,
    impact: 1,
    mitigation: '',
    owner: '',
    status: 'open',
  }
}

function formFromRisk(risk: RiskWithPhase): FormState {
  return {
    phaseId: risk.phase_id,
    title: risk.title,
    description: risk.description ?? '',
    category: risk.category,
    probability: risk.probability,
    impact: risk.impact,
    mitigation: risk.mitigation ?? '',
    owner: risk.owner ?? '',
    status: risk.status,
  }
}

export function RiskFormModal({ open, onOpenChange, phases, risk, onSaved }: RiskFormModalProps) {
  const isEdit = risk !== null
  const [form, setForm] = useState<FormState>(() =>
    risk ? formFromRisk(risk) : emptyForm(phases[0]?.id ?? '')
  )
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(risk ? formFromRisk(risk) : emptyForm(phases[0]?.id ?? ''))
    }
  }, [open, risk, phases])

  async function handleSubmit() {
    if (form.title.trim().length < 2) {
      toast.error('Judul risiko minimal 2 karakter')
      return
    }
    if (!form.phaseId) {
      toast.error('Pilih fase terlebih dahulu')
      return
    }

    setSubmitting(true)
    try {
      const body = isEdit
        ? {
            title: form.title,
            description: form.description || null,
            category: form.category,
            probability: form.probability,
            impact: form.impact,
            mitigation: form.mitigation || null,
            owner: form.owner || null,
            status: form.status,
          }
        : {
            title: form.title,
            description: form.description || undefined,
            category: form.category,
            probability: form.probability,
            impact: form.impact,
            mitigation: form.mitigation || undefined,
            owner: form.owner || undefined,
            status: form.status,
          }

      const res =
        isEdit && risk
          ? await fetch(`/api/risks/${risk.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
          : await fetch(`/api/phases/${form.phaseId}/risks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Gagal menyimpan risiko')
      }

      const phaseCode = phases.find((p) => p.id === form.phaseId)?.phase_code ?? ''
      onSaved({ ...json.data, phaseCode }, form.phaseId)
      toast.success(isEdit ? 'Risiko diperbarui' : 'Risiko ditambahkan')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan risiko')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Risiko' : 'Tambah Risiko'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!isEdit && (
            <div className="space-y-1">
              <Label>Fase</Label>
              <Select
                value={form.phaseId}
                onValueChange={(v) => setForm((f) => ({ ...f, phaseId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih fase" />
                </SelectTrigger>
                <SelectContent>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.phase_code} — {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Judul</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Deskripsi</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Kategori</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v as RiskCategory }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Probabilitas</Label>
              <Select
                value={String(form.probability)}
                onValueChange={(v) => setForm((f) => ({ ...f, probability: Number(v) }))}
              >
                <SelectTrigger>
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
            </div>
            <div className="space-y-1">
              <Label>Dampak</Label>
              <Select
                value={String(form.impact)}
                onValueChange={(v) => setForm((f) => ({ ...f, impact: Number(v) }))}
              >
                <SelectTrigger>
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
            </div>
          </div>
          <div className="space-y-1">
            <Label>Mitigasi</Label>
            <Textarea
              value={form.mitigation}
              onChange={(e) => setForm((f) => ({ ...f, mitigation: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Owner</Label>
              <Input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} />
            </div>
            {isEdit && (
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as RiskStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
