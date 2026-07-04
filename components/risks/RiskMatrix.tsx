'use client'

import { cn } from '@/lib/utils'
import { getScoreBandClasses } from '@/lib/risk-utils'

interface RiskMatrixProps {
  risks: Array<{ probability: number; impact: number }>
  activeCell: { probability: number; impact: number } | null
  onCellClick: (probability: number, impact: number) => void
}

const LEVELS = [1, 2, 3, 4, 5]

export function RiskMatrix({ risks, activeCell, onCellClick }: RiskMatrixProps) {
  function countFor(probability: number, impact: number): number {
    return risks.filter((r) => r.probability === probability && r.impact === impact).length
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">
        Baris = Probabilitas, Kolom = Dampak. Klik sel untuk memfilter tabel.
      </p>
      <div className="inline-block">
        <div className="flex gap-1 mb-1 ml-8">
          {LEVELS.map((impact) => (
            <div key={impact} className="w-14 text-center text-xs font-medium text-gray-400">
              D{impact}
            </div>
          ))}
        </div>
        {[...LEVELS].reverse().map((probability) => (
          <div key={probability} className="flex items-center gap-1 mb-1">
            <div className="w-8 text-center text-xs font-medium text-gray-400">P{probability}</div>
            {LEVELS.map((impact) => {
              const score = probability * impact
              const count = countFor(probability, impact)
              const isActive =
                activeCell?.probability === probability && activeCell?.impact === impact
              return (
                <button
                  key={impact}
                  type="button"
                  onClick={() => onCellClick(probability, impact)}
                  className={cn(
                    'w-14 h-10 flex items-center justify-center text-sm font-semibold rounded-md border transition-colors',
                    getScoreBandClasses(score),
                    isActive && 'ring-2 ring-blue-600 ring-offset-1'
                  )}
                  title={`Probabilitas ${probability} × Dampak ${impact} = Skor ${score}`}
                >
                  {count > 0 ? count : ''}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
