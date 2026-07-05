export interface ApiResponse<T> {
  data: T | null
  error: { code: string; message: string } | null
}

export type ActivityStatus = 'belum_mulai' | 'sedang_berjalan' | 'selesai' | 'ditunda'

export interface Activity {
  id: string
  phase_id: string
  display_order: number
  kegiatan: string
  pic: string
  tanggal_mulai_rencana: string
  tanggal_selesai_rencana: string
  tanggal_mulai_realisasi: string | null
  tanggal_selesai_realisasi: string | null
  status: ActivityStatus
  progress_pct: number
  catatan: string | null
  is_milestone: boolean
  is_on_critical_path: boolean
  date_locked: boolean
  total_float_days: number
  created_at: string
  updated_at: string
}

export interface Phase {
  id: string
  location_id: string
  phase_code: 'F1' | 'F2' | 'F3' | 'F4'
  name: string
  pic_utama: string
  display_order: number
  activities: Activity[]
}

export interface Dependency {
  id: string
  predecessor_id: string
  successor_id: string
  dep_type: 'FS' | 'SS' | 'FF' | 'SF'
  lag_days: number
}

export interface CpmSummary {
  shiftedCount: number
  hasCycle: boolean
  criticalPath: string[]
  updatedActivities: Array<{
    id: string
    tanggal_mulai_rencana: string
    tanggal_selesai_rencana: string
    is_on_critical_path: boolean
  }>
}

export interface LocationActivitySummary {
  id: string
  kegiatan: string
  phaseCode: string
}

export interface BaselineActivitySnapshot {
  activity_id: string
  kegiatan: string
  tanggal_mulai_rencana: string
  tanggal_selesai_rencana: string
  is_milestone: boolean
}

export interface Baseline {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface KkConsent {
  id: string
  location_id: string
  target_kk: number
  setuju: number
  menolak: number
  belum_dihubungi: number
  threshold_pct: number
  catatan: string | null
  updated_at: string
}

export type RiskCategory = 'teknis' | 'hukum' | 'keuangan' | 'sosial' | 'lingkungan' | 'lainnya'
export type RiskStatus = 'open' | 'mitigated' | 'closed'

export interface RiskItem {
  id: string
  phase_id: string
  title: string
  description: string | null
  category: RiskCategory
  probability: number
  impact: number
  score: number
  mitigation: string | null
  owner: string | null
  status: RiskStatus
  display_order: number
  created_at: string
  updated_at: string
}

export interface RiskWithPhase extends RiskItem {
  phaseCode: string
}

export interface RiskPhaseOption {
  id: string
  phase_code: string
  name: string
}

export interface WorkloadActivity {
  id: string
  kegiatan: string
  pic: string
  status: ActivityStatus
  progress_pct: number
  tanggal_mulai_rencana: string
  tanggal_selesai_rencana: string
  phaseCode: string
  locationCode: string
  locationName: string
}
