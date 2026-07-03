import type { Phase } from '@/lib/types'

// Validated via the dataviz skill's six-checks palette validator
// (categorical slots 1-4, fixed order — see docs/superpowers/specs/2026-07-03-minggu6-gantt-design.md).
export const PHASE_COLORS: Record<Phase['phase_code'], string> = {
  F1: '#2a78d6',
  F2: '#1baf7a',
  F3: '#eda100',
  F4: '#008300',
}

export const BASELINE_COLOR = '#c3c2b7'
export const CRITICAL_COLOR = '#d03b3b'

export const ROW_HEIGHT = 40
export const BAR_HEIGHT = 8
export const BAR_GAP = 2
export const HEADER_HEIGHT = 32
export const NAME_COLUMN_WIDTH = 224

export const DAY_WIDTH = {
  bulan: 4,
  minggu: 24,
} as const

export type GanttViewMode = keyof typeof DAY_WIDTH
