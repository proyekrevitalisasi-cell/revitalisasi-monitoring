import type { RiskCategory, RiskStatus } from '@/lib/types'

export const RISK_CATEGORY_OPTIONS: Array<{ value: RiskCategory; label: string }> = [
  { value: 'teknis', label: 'Teknis' },
  { value: 'hukum', label: 'Hukum' },
  { value: 'keuangan', label: 'Keuangan' },
  { value: 'sosial', label: 'Sosial' },
  { value: 'lingkungan', label: 'Lingkungan' },
  { value: 'lainnya', label: 'Lainnya' },
]

export const RISK_STATUS_OPTIONS: Array<{ value: RiskStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'mitigated', label: 'Mitigated' },
  { value: 'closed', label: 'Closed' },
]

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = Object.fromEntries(
  RISK_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
) as Record<RiskCategory, string>

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = Object.fromEntries(
  RISK_STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<RiskStatus, string>
