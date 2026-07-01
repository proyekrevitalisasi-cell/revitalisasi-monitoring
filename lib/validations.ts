import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
})

export type LoginInput = z.infer<typeof loginSchema>

// ─── Users ────────────────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: z.string().email('Email tidak valid'),
  full_name: z.string().min(2, 'Nama minimal 2 karakter'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  role: z.enum(['admin', 'viewer']),
})
export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  full_name: z.string().min(2).optional(),
  role: z.enum(['admin', 'viewer']).optional(),
  is_active: z.boolean().optional(),
})
export type UpdateUserInput = z.infer<typeof updateUserSchema>

// ─── Locations ────────────────────────────────────────────────────────────────

export const createLocationSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(1).max(10).toUpperCase(),
  description: z.string().optional(),
  project_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
})
export type CreateLocationInput = z.infer<typeof createLocationSchema>

export const updateLocationSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
})
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>

// ─── Phases ───────────────────────────────────────────────────────────────────

export const updatePhaseSchema = z.object({
  name: z.string().min(2).optional(),
  pic_utama: z.string().min(1).optional(),
})
export type UpdatePhaseInput = z.infer<typeof updatePhaseSchema>

// ─── Activities ───────────────────────────────────────────────────────────────

export const createActivitySchema = z.object({
  kegiatan: z.string().min(2),
  pic: z.string().min(1),
  tanggal_mulai_rencana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tanggal_selesai_rencana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_milestone: z.boolean().optional().default(false),
  catatan: z.string().optional(),
})
export type CreateActivityInput = z.infer<typeof createActivitySchema>

export const updateActivitySchema = z.object({
  kegiatan: z.string().min(2).optional(),
  pic: z.string().min(1).optional(),
  tanggal_mulai_rencana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tanggal_selesai_rencana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tanggal_mulai_realisasi: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  tanggal_selesai_realisasi: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(['belum_mulai', 'sedang_berjalan', 'selesai', 'ditunda']).optional(),
  progress_pct: z.number().int().min(0).max(100).optional(),
  catatan: z.string().nullable().optional(),
  is_milestone: z.boolean().optional(),
  date_locked: z.boolean().optional(),
})
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>

export const reorderActivitiesSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), display_order: z.number().int().min(0) })),
})
export type ReorderActivitiesInput = z.infer<typeof reorderActivitiesSchema>

// ─── Dependencies ─────────────────────────────────────────────────────────────

export const createDependencySchema = z.object({
  predecessor_id: z.string().uuid(),
  successor_id: z.string().uuid(),
  dep_type: z.enum(['FS', 'SS', 'FF', 'SF']),
  lag_days: z.number().int().default(0),
})
export type CreateDependencyInput = z.infer<typeof createDependencySchema>

export const updateDependencySchema = z.object({
  dep_type: z.enum(['FS', 'SS', 'FF', 'SF']).optional(),
  lag_days: z.number().int().optional(),
})
export type UpdateDependencyInput = z.infer<typeof updateDependencySchema>

// ─── Stakeholders ─────────────────────────────────────────────────────────────

export const createStakeholderSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2),
  group_name: z.string().min(1),
  display_order: z.number().int().min(0).optional().default(0),
})
export type CreateStakeholderInput = z.infer<typeof createStakeholderSchema>

export const updateStakeholderSchema = z.object({
  name: z.string().min(2).optional(),
  group_name: z.string().min(1).optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})
export type UpdateStakeholderInput = z.infer<typeof updateStakeholderSchema>

// ─── RACI ─────────────────────────────────────────────────────────────────────

export const upsertRaciSchema = z.object({
  role: z.enum(['R', 'A', 'C', 'I']).nullable(),
})
export type UpsertRaciInput = z.infer<typeof upsertRaciSchema>

// ─── Risk Items ───────────────────────────────────────────────────────────────

export const createRiskSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  category: z.enum(['teknis', 'hukum', 'keuangan', 'sosial', 'lingkungan', 'lainnya']),
  probability: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  mitigation: z.string().optional(),
  owner: z.string().optional(),
  status: z.enum(['open', 'mitigated', 'closed']).optional().default('open'),
  display_order: z.number().int().min(0).optional().default(0),
})
export type CreateRiskInput = z.infer<typeof createRiskSchema>

export const updateRiskSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  category: z.enum(['teknis', 'hukum', 'keuangan', 'sosial', 'lingkungan', 'lainnya']).optional(),
  probability: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  mitigation: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  status: z.enum(['open', 'mitigated', 'closed']).optional(),
  display_order: z.number().int().min(0).optional(),
})
export type UpdateRiskInput = z.infer<typeof updateRiskSchema>

// ─── Baselines ────────────────────────────────────────────────────────────────

export const createBaselineSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
})
export type CreateBaselineInput = z.infer<typeof createBaselineSchema>

// ─── KK Consent ───────────────────────────────────────────────────────────────

export const updateKkConsentSchema = z.object({
  target_kk: z.number().int().min(0).optional(),
  setuju: z.number().int().min(0).optional(),
  menolak: z.number().int().min(0).optional(),
  catatan: z.string().nullable().optional(),
})
export type UpdateKkConsentInput = z.infer<typeof updateKkConsentSchema>

// ─── Work Calendar ────────────────────────────────────────────────────────────

export const createWorkCalendarSchema = z.object({
  holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(2),
})
export type CreateWorkCalendarInput = z.infer<typeof createWorkCalendarSchema>

// ─── Reporting Items ──────────────────────────────────────────────────────────

export const createReportingItemSchema = z.object({
  jenis_laporan: z.string().min(2),
  dari_pic: z.string().min(1),
  kepada: z.string().min(1),
  frekuensi: z.string().min(1),
  isi_konten: z.string().min(1),
  format_media: z.string().min(1),
  display_order: z.number().int().min(0).optional().default(0),
})
export type CreateReportingItemInput = z.infer<typeof createReportingItemSchema>

export const updateReportingItemSchema = createReportingItemSchema.partial()
export type UpdateReportingItemInput = z.infer<typeof updateReportingItemSchema>
