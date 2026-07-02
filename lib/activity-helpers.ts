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
