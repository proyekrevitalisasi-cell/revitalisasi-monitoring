'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PHASE_COLORS, type GanttViewMode } from './gantt-constants'
import type { Phase } from '@/lib/types'

const PHASE_LABELS: Record<Phase['phase_code'], string> = {
  F1: 'Fase 1',
  F2: 'Fase 2',
  F3: 'Fase 3',
  F4: 'Fase 4',
}

interface GanttControlsProps {
  viewMode: GanttViewMode
  onViewModeChange: (mode: GanttViewMode) => void
  showBaseline: boolean
  onShowBaselineChange: (value: boolean) => void
  showDependencies: boolean
  onShowDependenciesChange: (value: boolean) => void
  showCriticalHighlight: boolean
  onShowCriticalHighlightChange: (value: boolean) => void
}

export function GanttControls({
  viewMode,
  onViewModeChange,
  showBaseline,
  onShowBaselineChange,
  showDependencies,
  onShowDependenciesChange,
  showCriticalHighlight,
  onShowCriticalHighlightChange,
}: GanttControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div className="flex flex-wrap items-center gap-4">
        <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as GanttViewMode)}>
          <TabsList>
            <TabsTrigger value="bulan">Tampilan Bulan</TabsTrigger>
            <TabsTrigger value="minggu">Tampilan Minggu</TabsTrigger>
          </TabsList>
        </Tabs>

        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showBaseline}
            onChange={(e) => onShowBaselineChange(e.target.checked)}
          />
          Tampilkan Baseline
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showDependencies}
            onChange={(e) => onShowDependenciesChange(e.target.checked)}
          />
          Tampilkan Panah Dependensi
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showCriticalHighlight}
            onChange={(e) => onShowCriticalHighlightChange(e.target.checked)}
          />
          Highlight Jalur Kritis
        </label>
      </div>

      <div className="flex items-center gap-3">
        {(Object.keys(PHASE_COLORS) as Array<Phase['phase_code']>).map((code) => (
          <span key={code} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: PHASE_COLORS[code] }}
            />
            {PHASE_LABELS[code]}
          </span>
        ))}
      </div>
    </div>
  )
}
