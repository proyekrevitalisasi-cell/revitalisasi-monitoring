'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GanttBarTooltipContent } from './GanttTooltip'
import { BASELINE_COLOR, CRITICAL_COLOR, BAR_HEIGHT } from './gantt-constants'
import type { Activity, BaselineActivitySnapshot } from '@/lib/types'

export type GanttBarLayer = 'baseline' | 'rencana' | 'realisasi'

interface GanttBarProps {
  activity: Activity
  layer: GanttBarLayer
  left: number
  width: number
  top: number
  color: string
  baseline: BaselineActivitySnapshot | undefined
  holidays: Date[]
  highlightCritical: boolean
}

export function GanttBar({
  activity,
  layer,
  left,
  width,
  top,
  color,
  baseline,
  holidays,
  highlightCritical,
}: GanttBarProps) {
  const isCriticalLayer = layer === 'rencana' && activity.is_on_critical_path && highlightCritical
  const fill = layer === 'baseline' ? BASELINE_COLOR : isCriticalLayer ? CRITICAL_COLOR : color

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="absolute flex items-center cursor-default"
          style={{ left, width: Math.max(width, 2), height: BAR_HEIGHT + 16, top: top - 8 }}
        >
          <div
            className="w-full hover:brightness-110"
            style={{
              height: BAR_HEIGHT,
              backgroundColor: fill,
              filter: layer === 'realisasi' ? 'brightness(0.65)' : undefined,
              borderRadius: BAR_HEIGHT / 2,
            }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <GanttBarTooltipContent activity={activity} baseline={baseline} holidays={holidays} />
      </TooltipContent>
    </Tooltip>
  )
}
