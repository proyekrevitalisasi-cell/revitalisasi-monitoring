'use client'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const CONFIG: Record<Exclude<SaveStatus, 'idle'>, { text: string; className: string }> = {
  saving: { text: 'Menyimpan…', className: 'text-gray-400' },
  saved: { text: '✓ Tersimpan', className: 'text-green-600' },
  error: { text: '⚠ Gagal', className: 'text-red-600' },
}

export function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  const config = CONFIG[status]
  return <span className={`text-xs whitespace-nowrap ${config.className}`}>{config.text}</span>
}
