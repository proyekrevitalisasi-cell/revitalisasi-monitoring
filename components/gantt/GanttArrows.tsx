'use client'

import { useState } from 'react'
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

interface ArrowGeometry {
  dep: Dependency
  x1: number
  y1: number
  x2: number
  y2: number
  isCritical: boolean
  pathD: string
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
  const [hoveredDepId, setHoveredDepId] = useState<string | null>(null)
  const activityById = new Map(activities.map((a) => [a.id, a]))
  const activityIndex = new Map(activities.map((a, i) => [a.id, i]))

  const arrows: ArrowGeometry[] = dependencies.flatMap((dep) => {
    const predecessor = activityById.get(dep.predecessor_id)
    const successor = activityById.get(dep.successor_id)
    const predIndex = activityIndex.get(dep.predecessor_id)
    const succIndex = activityIndex.get(dep.successor_id)
    if (!predecessor || !successor || predIndex === undefined || succIndex === undefined) return []

    const anchor = dependencyAnchor(dep.dep_type)
    const x1 = edgeX(predecessor, anchor.predecessorEdge, rangeStart, dayWidth)
    const x2 = edgeX(successor, anchor.successorEdge, rangeStart, dayWidth)
    const y1 = predIndex * ROW_HEIGHT + ROW_HEIGHT / 2
    const y2 = succIndex * ROW_HEIGHT + ROW_HEIGHT / 2
    const isCritical =
      highlightCritical && predecessor.is_on_critical_path && successor.is_on_critical_path
    const pathD = `M ${x1} ${y1} L ${x1 + 10} ${y1} L ${x2 - 10} ${y2} L ${x2} ${y2}`

    return [{ dep, x1, y1, x2, y2, isCritical, pathD }]
  })

  const hovered = arrows.find((a) => a.dep.id === hoveredDepId)

  return (
    <div className="absolute left-0 top-0 pointer-events-none" style={{ width: totalWidth, height: totalHeight }}>
      <svg className="absolute left-0 top-0 pointer-events-none" width={totalWidth} height={totalHeight}>
        <defs>
          <marker id="gantt-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#898781" />
          </marker>
        </defs>
        {arrows.map(({ dep, pathD, isCritical }) => (
          <g key={dep.id} className="pointer-events-auto cursor-default">
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={10}
              onMouseEnter={() => setHoveredDepId(dep.id)}
              onMouseLeave={() => setHoveredDepId((current) => (current === dep.id ? null : current))}
            />
            <path
              d={pathD}
              fill="none"
              stroke={isCritical ? CRITICAL_COLOR : BASELINE_COLOR}
              strokeWidth={1.5}
              markerEnd="url(#gantt-arrowhead)"
              className="pointer-events-none"
            />
          </g>
        ))}
      </svg>

      {hovered && (
        <div
          className="absolute z-50 rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md pointer-events-none"
          style={{
            left: (hovered.x1 + hovered.x2) / 2,
            top: Math.min(hovered.y1, hovered.y2) - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <GanttArrowTooltipContent depType={hovered.dep.dep_type} lagDays={hovered.dep.lag_days} />
        </div>
      )}
    </div>
  )
}
