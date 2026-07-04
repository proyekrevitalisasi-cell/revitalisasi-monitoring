export type ScoreBand = 'low' | 'medium' | 'high'

export function getScoreBand(score: number): ScoreBand {
  if (score <= 6) return 'low'
  if (score <= 12) return 'medium'
  return 'high'
}

export function getScoreBandClasses(score: number): string {
  const band = getScoreBand(score)
  if (band === 'low') return 'bg-green-50 text-green-600 border-green-200'
  if (band === 'medium') return 'bg-amber-50 text-amber-600 border-amber-200'
  return 'bg-red-50 text-red-600 border-red-200'
}
