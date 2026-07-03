'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GanttBarTooltipContent } from './GanttTooltip'
import { CRITICAL_COLOR } from './gantt-constants'
import type { Activity, BaselineActivitySnapshot } from '@/lib/types'

interface GanttMilestoneProps {
  activity: Activity
  left: number
  baseline: BaselineActivitySnapshot | undefined
  holidays: Date[]
  highlightCritical: boolean
}

export function GanttMilestone({ activity, left, baseline, holidays, highlightCritical }: GanttMilestoneProps) {
  const isCritical = activity.is_on_critical_path && highlightCritical
  const color = isCritical ? CRITICAL_COLOR : '#0b0b0b'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="absolute flex items-center justify-center cursor-default"
          style={{ left: left - 8, width: 16, height: 24, top: 8 }}
        >
          <div style={{ width: 10, height: 10, backgroundColor: color, transform: 'rotate(45deg)' }} />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <GanttBarTooltipContent activity={activity} baseline={baseline} holidays={holidays} />
      </TooltipContent>
    </Tooltip>
  )
}
