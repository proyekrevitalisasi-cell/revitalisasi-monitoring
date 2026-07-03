'use client'

import { GanttBar, type GanttBarLayer } from './GanttBar'
import { GanttMilestone } from './GanttMilestone'
import { dateToOffset } from '@/lib/gantt-layout'
import { PHASE_COLORS, ROW_HEIGHT, BAR_HEIGHT, BAR_GAP } from './gantt-constants'
import type { Activity, BaselineActivitySnapshot, Phase } from '@/lib/types'

interface GanttRowProps {
  activity: Activity
  phaseCode: Phase['phase_code']
  baseline: BaselineActivitySnapshot | undefined
  rangeStart: Date
  dayWidth: number
  holidays: Date[]
  showBaseline: boolean
  highlightCritical: boolean
}

interface Lane {
  layer: GanttBarLayer
  left: number
  width: number
}

export function GanttRow({
  activity,
  phaseCode,
  baseline,
  rangeStart,
  dayWidth,
  holidays,
  showBaseline,
  highlightCritical,
}: GanttRowProps) {
  const color = PHASE_COLORS[phaseCode]

  if (activity.is_milestone) {
    const left = dateToOffset(new Date(activity.tanggal_mulai_rencana), rangeStart, dayWidth)
    return (
      <div className="relative" style={{ height: ROW_HEIGHT }}>
        <GanttMilestone
          activity={activity}
          left={left}
          baseline={baseline}
          holidays={holidays}
          highlightCritical={highlightCritical}
        />
      </div>
    )
  }

  const lanes: Lane[] = []

  if (showBaseline && baseline) {
    const left = dateToOffset(new Date(baseline.tanggal_mulai_rencana), rangeStart, dayWidth)
    const width = dateToOffset(new Date(baseline.tanggal_selesai_rencana), rangeStart, dayWidth) - left
    lanes.push({ layer: 'baseline', left, width })
  }

  const rencanaLeft = dateToOffset(new Date(activity.tanggal_mulai_rencana), rangeStart, dayWidth)
  const rencanaWidth =
    dateToOffset(new Date(activity.tanggal_selesai_rencana), rangeStart, dayWidth) - rencanaLeft
  lanes.push({ layer: 'rencana', left: rencanaLeft, width: rencanaWidth })

  if (activity.tanggal_mulai_realisasi && activity.tanggal_selesai_realisasi) {
    const left = dateToOffset(new Date(activity.tanggal_mulai_realisasi), rangeStart, dayWidth)
    const width =
      dateToOffset(new Date(activity.tanggal_selesai_realisasi), rangeStart, dayWidth) - left
    lanes.push({ layer: 'realisasi', left, width })
  }

  const stackHeight = lanes.length * BAR_HEIGHT + (lanes.length - 1) * BAR_GAP
  const stackTop = (ROW_HEIGHT - stackHeight) / 2

  return (
    <div className="relative" style={{ height: ROW_HEIGHT }}>
      {lanes.map((lane, index) => (
        <GanttBar
          key={lane.layer}
          activity={activity}
          layer={lane.layer}
          left={lane.left}
          width={lane.width}
          top={stackTop + index * (BAR_HEIGHT + BAR_GAP)}
          color={color}
          baseline={baseline}
          holidays={holidays}
          highlightCritical={highlightCritical}
        />
      ))}
    </div>
  )
}
