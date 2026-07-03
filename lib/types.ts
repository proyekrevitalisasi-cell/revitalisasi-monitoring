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
