'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GanttArrowTooltipContent } from './GanttTooltip'
import { dateToOffset, dependencyAnchor } from '@/lib/gantt-layout'
import { ROW_HEIGHT, CRITICAL_COLOR, BASELINE_COLOR } from './gantt-constants'
import type { Activity, Dependency } from '@/lib/types'

interface GanttArrowsProps {
  activities: Activity[]
  dependencies: Dependency[]
  rangeStart: Date
  dayWidth: number
  totalWidth: number
  totalHeight: number
  highlightCritical: boolean
}

function edgeX(activity: Activity, edge: 'start' | 'finish', rangeStart: Date, dayWidth: number): number {
  const dateStr = edge === 'start' ? activity.tanggal_mulai_rencana : activity.tanggal_selesai_rencana
  return dateToOffset(new Date(dateStr), rangeStart, dayWidth)
}

export function GanttArrows({
  activities,
  dependencies,
  rangeStart,
  dayWidth,
  totalWidth,
  totalHeight,
  highlightCritical,
}: GanttArrowsProps) {
  const activityById = new Map(activities.map((a) => [a.id, a]))
  const activityIndex = new Map(activities.map((a, i) => [a.id, i]))

  const arrows = dependencies
    .map((dep) => {
      const predecessor = activityById.get(dep.predecessor_id)
      const successor = activityById.get(dep.successor_id)
      const predIndex = activityIndex.get(dep.predecessor_id)
      const succIndex = activityIndex.get(dep.successor_id)
      if (!predecessor || !successor || predIndex === undefined || succIndex === undefined) return null

      const anchor = dependencyAnchor(dep.dep_type)
      const x1 = edgeX(predecessor, anchor.predecessorEdge, rangeStart, dayWidth)
      const x2 = edgeX(successor, anchor.successorEdge, rangeStart, dayWidth)
      const y1 = predIndex * ROW_HEIGHT + ROW_HEIGHT / 2
      const y2 = succIndex * ROW_HEIGHT + ROW_HEIGHT / 2
      const isCritical =
        highlightCritical && predecessor.is_on_critical_path && successor.is_on_critical_path
      const pathD = `M ${x1} ${y1} L ${x1 + 10} ${y1} L ${x2 - 10} ${y2} L ${x2} ${y2}`

      return { dep, x1, y1, x2, y2, isCritical, pathD }
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)

  return (
    <div className="absolute left-0 top-0 pointer-events-none" style={{ width: totalWidth, height: totalHeight }}>
      <svg className="absolute left-0 top-0" width={totalWidth} height={totalHeight}>
        <defs>
          <marker id="gantt-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#898781" />
          </marker>
        </defs>
        {arrows.map(({ dep, isCritical, pathD }) => (
          <path
            key={dep.id}
            d={pathD}
            fill="none"
            stroke={isCritical ? CRITICAL_COLOR : BASELINE_COLOR}
            strokeWidth={1.5}
            markerEnd="url(#gantt-arrowhead)"
          />
        ))}
      </svg>
      {/*
        Tooltip triggers are separate HTML overlay divs (not the SVG path itself): Radix
        Tooltip's floating-ui positioning cannot compute a valid anchor rect for an SVG
        <g>/<path> reference (SVG elements lack the HTMLElement box-layout properties
        floating-ui relies on), which silently produces a 0x0, unpositioned, invisible
        tooltip. An absolutely-positioned HTML div over the arrow's bounding box gives
        floating-ui a normal element to anchor to while keeping the same generous hover
        area the old strokeWidth=10 hit-path provided.
      */}
      {arrows.map(({ dep, x1, y1, x2, y2 }) => {
        const left = Math.min(x1, x2) - 5
        const top = Math.min(y1, y2) - 5
        const width = Math.abs(x2 - x1) + 10
        const height = Math.abs(y2 - y1) + 10
        return (
          <Tooltip key={dep.id}>
            <TooltipTrigger asChild>
              <div
                className="absolute pointer-events-auto cursor-default"
                style={{ left, top, width, height }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <GanttArrowTooltipContent depType={dep.dep_type} lagDays={dep.lag_days} />
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
