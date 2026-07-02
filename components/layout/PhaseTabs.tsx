'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface PhaseTabsProps {
  locationCode: string
  phases: { id: string; phase_code: string; name: string }[]
}

export function PhaseTabs({ locationCode, phases }: PhaseTabsProps) {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 border-b border-gray-200 mb-6">
      {phases.map((phase) => {
        const phaseNumber = phase.phase_code.replace('F', '')
        const href = `/dashboard/${locationCode}/fase-${phaseNumber}`
        const isActive = pathname === href

        return (
          <Link
            key={phase.id}
            href={href}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              isActive
                ? 'text-blue-700 border-blue-600'
                : 'text-gray-600 border-transparent hover:text-blue-700 hover:border-blue-300'
            )}
          >
            {phase.name}
          </Link>
        )
      })}
    </div>
  )
}
