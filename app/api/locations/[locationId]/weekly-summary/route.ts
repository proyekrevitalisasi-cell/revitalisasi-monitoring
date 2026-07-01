import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, serverError } from '@/lib/auth-helpers'
import {
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  parseISO,
  isBefore,
  isWithinInterval,
} from 'date-fns'

interface ActivityItem {
  id: string
  kegiatan: string
  pic: string
  phase_code: string
  status: string
  progress_pct: number
  tanggal_mulai_rencana: string
  tanggal_selesai_rencana: string
  updated_at: string
}

export async function GET(request: NextRequest, { params }: { params: { locationId: string } }) {
  try {
    const { user, profile, supabase } = await getSession()
    if (!user || !profile) return unauthorized()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const monday = startOfWeek(today, { weekStartsOn: 1 })
    const sunday = endOfWeek(today, { weekStartsOn: 1 })
    const nextMonday = addDays(monday, 7)
    const nextSunday = addDays(sunday, 7)

    // Fetch location name
    const { data: location } = await supabase
      .from('locations')
      .select('name, code')
      .eq('id', params.locationId)
      .single()

    // Fetch all non-done activities with phase info
    const { data: phases } = await supabase
      .from('phases')
      .select('id, phase_code, name, activities(id, kegiatan, pic, status, progress_pct, tanggal_mulai_rencana, tanggal_selesai_rencana, updated_at)')
      .eq('location_id', params.locationId)
      .order('display_order')

    if (!phases) return serverError()

    const allActivities: ActivityItem[] = phases.flatMap((ph) =>
      (ph.activities as ActivityItem[] ?? []).map((a) => ({ ...a, phase_code: ph.phase_code }))
    )

    const selesai_minggu_ini = allActivities.filter((a) => {
      if (a.status !== 'selesai') return false
      const updated = parseISO(a.updated_at)
      return isWithinInterval(updated, { start: monday, end: sunday })
    })

    const mulai_minggu_depan = allActivities.filter((a) => {
      if (a.status === 'selesai') return false
      const mulai = parseISO(a.tanggal_mulai_rencana)
      return isWithinInterval(mulai, { start: nextMonday, end: nextSunday })
    })

    const terlambat = allActivities.filter((a) => {
      if (a.status === 'selesai') return false
      return isBefore(parseISO(a.tanggal_selesai_rencana), today)
    })

    const ditunda = allActivities.filter((a) => a.status === 'ditunda')

    // Overall progress
    const totalPct = allActivities.length > 0
      ? Math.round(allActivities.reduce((sum, a) => sum + (a.progress_pct ?? 0), 0) / allActivities.length)
      : 0

    // Phase progress
    const phaseProgress = phases.map((ph) => {
      const acts = ph.activities as ActivityItem[] ?? []
      const pct = acts.length > 0
        ? Math.round(acts.reduce((sum, a) => sum + (a.progress_pct ?? 0), 0) / acts.length)
        : 0
      return { phase_code: ph.phase_code, name: ph.name, pct }
    })

    const weekLabel = `${format(monday, 'd MMM')} – ${format(sunday, 'd MMM yyyy')}`

    const whatsapp_text = [
      `*LAPORAN MINGGUAN REVITALISASI RUSUN*`,
      `*Lokasi: ${location?.name ?? params.locationId} | ${weekLabel}*`,
      ``,
      `✅ *SELESAI MINGGU INI*`,
      ...(selesai_minggu_ini.length > 0
        ? selesai_minggu_ini.map((a) => `• ${a.kegiatan} (${a.phase_code}) — ${a.pic}`)
        : ['• —']),
      ``,
      `🚀 *DIMULAI MINGGU DEPAN*`,
      ...(mulai_minggu_depan.length > 0
        ? mulai_minggu_depan.map((a) => `• ${a.kegiatan} (${a.phase_code}) — ${a.pic}`)
        : ['• —']),
      ``,
      `⚠️ *PERLU PERHATIAN*`,
      ...(terlambat.length > 0
        ? terlambat.map((a) => `• ${a.kegiatan} (${a.phase_code}) — terlambat`)
        : ditunda.length > 0
        ? ditunda.map((a) => `• ${a.kegiatan} (${a.phase_code}) — ditunda`)
        : ['• —']),
      ``,
      `📊 *PROGRES KESELURUHAN: ${totalPct}%*`,
      phaseProgress.map((p) => `${p.phase_code}: ${p.pct}%`).join(' | '),
    ].join('\n')

    return NextResponse.json({
      data: {
        week: weekLabel,
        location: location,
        selesai_minggu_ini,
        mulai_minggu_depan,
        terlambat,
        ditunda,
        overall_pct: totalPct,
        phase_progress: phaseProgress,
        whatsapp_text,
      },
      error: null,
    })
  } catch {
    return serverError()
  }
}
