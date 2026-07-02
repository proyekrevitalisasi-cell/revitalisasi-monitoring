import { subDays } from 'date-fns'
import { workingDaysBetween } from '@/lib/calendar'

/**
 * Inclusive working-day count from mulai to selesai. Mirrors the inverse of
 * lib/templates.ts's `addWorkingDays(mulai, durationWorkingDays - 1, holidays)`.
 */
export function computeDurasiHK(mulai: string, selesai: string, holidays: Date[]): number {
  const start = subDays(new Date(mulai), 1)
  const end = new Date(selesai)
  return workingDaysBetween(start, end, holidays)
}

export function validateRencanaDates(mulai: string, selesai: string): string | null {
  if (selesai < mulai) return 'Tanggal selesai rencana harus setelah tanggal mulai rencana'
  return null
}

export function validateRealisasiDates(mulai: string | null, selesai: string | null): string | null {
  if (mulai && selesai && selesai < mulai) {
    return 'Tanggal selesai realisasi harus setelah tanggal mulai realisasi'
  }
  return null
}
