import { format } from 'date-fns'
import { addWorkingDays } from '@/lib/calendar'
import type { SupabaseClient } from '@supabase/supabase-js'

interface ActivityTemplate {
  kegiatan: string
  pic: string
  offsetDaysStart: number
  durationWorkingDays: number
  is_milestone?: boolean
}

interface PhaseTemplate {
  phase_code: 'F1' | 'F2' | 'F3' | 'F4'
  name: string
  pic_utama: string
  display_order: number
  activities: ActivityTemplate[]
}

export const PHASE_TEMPLATES: PhaseTemplate[] = [
  {
    phase_code: 'F1',
    name: 'Fase 1 – Sosialisasi & Persetujuan Warga',
    pic_utama: 'Tim Revitalisasi',
    display_order: 1,
    activities: [
      { kegiatan: 'Persiapan materi sosialisasi', pic: 'TR', offsetDaysStart: 0, durationWorkingDays: 5 },
      { kegiatan: 'Rapat koordinasi internal', pic: 'TR', offsetDaysStart: 5, durationWorkingDays: 2 },
      { kegiatan: 'Sosialisasi Tahap 1 – Pertemuan warga RT/RW', pic: 'TR', offsetDaysStart: 7, durationWorkingDays: 5 },
      { kegiatan: 'FGD & kunjungan door-to-door warga', pic: 'TR', offsetDaysStart: 12, durationWorkingDays: 15 },
      { kegiatan: 'Pengumpulan data KK & tanda tangan persetujuan', pic: 'TR', offsetDaysStart: 27, durationWorkingDays: 20 },
      { kegiatan: 'Rekap & validasi data persetujuan warga', pic: 'TR', offsetDaysStart: 47, durationWorkingDays: 5 },
      { kegiatan: 'Pelaporan hasil sosialisasi kepada Direksi', pic: 'DIR', offsetDaysStart: 52, durationWorkingDays: 3, is_milestone: true },
    ],
  },
  {
    phase_code: 'F2',
    name: 'Fase 2 – Pencarian Investor & Mitra',
    pic_utama: 'Div. Pengembangan Bisnis',
    display_order: 2,
    activities: [
      { kegiatan: 'Penyusunan proposal investasi & studi kelayakan', pic: 'DB', offsetDaysStart: 0, durationWorkingDays: 15 },
      { kegiatan: 'Identifikasi & pendekatan calon mitra/investor', pic: 'DB', offsetDaysStart: 15, durationWorkingDays: 20 },
      { kegiatan: 'Presentasi & negosiasi skema KSO/JVco', pic: 'DB', offsetDaysStart: 35, durationWorkingDays: 20 },
      { kegiatan: 'Penandatanganan MoU / Letter of Intent', pic: 'DIR', offsetDaysStart: 55, durationWorkingDays: 2, is_milestone: true },
      { kegiatan: 'Due diligence bersama investor', pic: 'DB', offsetDaysStart: 57, durationWorkingDays: 30 },
      { kegiatan: 'Penyusunan & review Perjanjian KSO', pic: 'DH', offsetDaysStart: 87, durationWorkingDays: 15 },
      { kegiatan: 'Penandatanganan Perjanjian KSO', pic: 'DIR', offsetDaysStart: 102, durationWorkingDays: 1, is_milestone: true },
    ],
  },
  {
    phase_code: 'F3',
    name: 'Fase 3 – Pemasaran & NUP',
    pic_utama: 'Div. Pemasaran',
    display_order: 3,
    activities: [
      { kegiatan: 'Penetapan harga & skema pembiayaan unit', pic: 'DPm', offsetDaysStart: 0, durationWorkingDays: 10 },
      { kegiatan: 'Penyusunan materi pemasaran & desain brosur', pic: 'DPm', offsetDaysStart: 10, durationWorkingDays: 10 },
      { kegiatan: 'Soft launching / pre-marketing', pic: 'DPm', offsetDaysStart: 20, durationWorkingDays: 20 },
      { kegiatan: 'Pembukaan Nomor Urut Pemesanan (NUP)', pic: 'DPm', offsetDaysStart: 40, durationWorkingDays: 1, is_milestone: true },
      { kegiatan: 'Pengumpulan NUP hingga target terpenuhi', pic: 'DPm', offsetDaysStart: 41, durationWorkingDays: 40 },
      { kegiatan: 'Verifikasi data & kelayakan pemesan', pic: 'DPm', offsetDaysStart: 81, durationWorkingDays: 10 },
      { kegiatan: 'Penandatanganan PPJB', pic: 'DH', offsetDaysStart: 91, durationWorkingDays: 10, is_milestone: true },
    ],
  },
  {
    phase_code: 'F4',
    name: 'Fase 4 – Legal & Perizinan',
    pic_utama: 'Div. Hukum',
    display_order: 4,
    activities: [
      { kegiatan: 'Permohonan KKPR (Kesesuaian Kegiatan Pemanfaatan Ruang)', pic: 'DPT', offsetDaysStart: 0, durationWorkingDays: 30 },
      { kegiatan: 'Permohonan PBG (Persetujuan Bangunan Gedung)', pic: 'DPT', offsetDaysStart: 30, durationWorkingDays: 60 },
      { kegiatan: 'Proses pemecahan HGB Induk', pic: 'DPr', offsetDaysStart: 30, durationWorkingDays: 30 },
      { kegiatan: 'Pembentukan P3SRS (Perhimpunan Penghuni)', pic: 'DH', offsetDaysStart: 90, durationWorkingDays: 15 },
      { kegiatan: 'Penerbitan SHM Sarusun', pic: 'DPr', offsetDaysStart: 90, durationWorkingDays: 30 },
      { kegiatan: 'Serah terima unit kepada pemesan', pic: 'TR', offsetDaysStart: 120, durationWorkingDays: 10, is_milestone: true },
    ],
  },
]

export async function createLocationWithTemplate(
  supabase: SupabaseClient,
  locationId: string,
  projectStartDate: Date,
  holidays: Date[]
): Promise<void> {
  for (const phase of PHASE_TEMPLATES) {
    const { data: phaseRow } = await supabase
      .from('phases')
      .insert({
        location_id: locationId,
        phase_code: phase.phase_code,
        name: phase.name,
        pic_utama: phase.pic_utama,
        display_order: phase.display_order,
      })
      .select('id')
      .single()

    if (!phaseRow) continue

    for (let i = 0; i < phase.activities.length; i++) {
      const tmpl = phase.activities[i]
      const mulai = addWorkingDays(projectStartDate, tmpl.offsetDaysStart, holidays)
      const selesai = addWorkingDays(mulai, tmpl.durationWorkingDays - 1, holidays)

      await supabase.from('activities').insert({
        phase_id: phaseRow.id,
        display_order: i + 1,
        kegiatan: tmpl.kegiatan,
        pic: tmpl.pic,
        tanggal_mulai_rencana: format(mulai, 'yyyy-MM-dd'),
        tanggal_selesai_rencana: format(selesai, 'yyyy-MM-dd'),
        is_milestone: tmpl.is_milestone ?? false,
      })
    }
  }
}
