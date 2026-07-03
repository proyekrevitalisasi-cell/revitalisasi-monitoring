'use client'

import { useMemo, useState } from 'react'
import { addDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { computeDateRange, dateToOffset } from '@/lib/gantt-layout'
import { GanttControls } from './GanttControls'
import { GanttRow } from './GanttRow'
import { GanttArrows } from './GanttArrows'
import { DAY_WIDTH, ROW_HEIGHT, HEADER_HEIGHT, NAME_COLUMN_WIDTH, type GanttViewMode } from './gantt-constants'
import type { Phase, Activity, Dependency, BaselineActivitySnapshot } from '@/lib/types'

interface GanttChartProps {
  phases: Phase[]
  dependencies: Dependency[]
  baselineActivities: BaselineActivitySnapshot[]
  holidays: string[]
}

interface FlatActivity {
  activity: Activity
  phaseCode: Phase['phase_code']
}

export function GanttChart({ phases, dependencies, baselineActivities, holidays }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<GanttViewMode>('bulan')
  const [showBaseline, setShowBaseline] = useState(true)
  const [showDependencies, setShowDependencies] = useState(true)
  const [showCriticalHighlight, setShowCriticalHighlight] = useState(true)

  const flatActivities: FlatActivity[] = useMemo(
    () =>
      phases.flatMap((phase) =>
        phase.activities.map((activity) => ({ activity, phaseCode: phase.phase_code }))
      ),
    [phases]
  )

  const baselineByActivityId = useMemo(
    () => new Map(baselineActivities.map((b) => [b.activity_id, b])),
    [baselineActivities]
  )

  const holidayDates = useMemo(() => holidays.map((h) => new Date(h)), [holidays])

  const dateRange = useMemo(
    () => computeDateRange(flatActivities.map((f) => f.activity), baselineActivities),
    [flatActivities, baselineActivities]
  )

  const dayWidth = DAY_WIDTH[viewMode]
  const totalDays = Math.ceil(
    (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
  )
  const totalWidth = Math.max(totalDays * dayWidth, 1)
  const totalHeight = flatActivities.length * ROW_HEIGHT
  const activitiesForArrows = flatActivities.map((f) => f.activity)

  const months = useMemo(() => {
    const result: { label: string; left: number; width: number; isCurrent: boolean }[] = []
    let cursor = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), 1)
    const now = new Date()
    while (cursor < dateRange.end) {
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
      const segmentStart = cursor < dateRange.start ? dateRange.start : cursor
      const segmentEnd = nextMonth > dateRange.end ? dateRange.end : nextMonth
      const left = dateToOffset(segmentStart, dateRange.start, dayWidth)
      const width = dateToOffset(segmentEnd, dateRange.start, dayWidth) - left
      result.push({
        label: cursor.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
        left,
        width,
        isCurrent: cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth(),
      })
      cursor = nextMonth
    }
    return result
  }, [dateRange, dayWidth])

  const weekendStrips = useMemo(() => {
    if (viewMode !== 'minggu') return []
    const strips: { left: number; width: number }[] = []
    let cursor = new Date(dateRange.start)
    while (cursor < dateRange.end) {
      const day = cursor.getDay()
      if (day === 0 || day === 6) {
        strips.push({ left: dateToOffset(cursor, dateRange.start, dayWidth), width: dayWidth })
      }
      cursor = addDays(cursor, 1)
    }
    return strips
  }, [dateRange, dayWidth, viewMode])

  return (
    <div>
      <GanttControls
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showBaseline={showBaseline}
        onShowBaselineChange={setShowBaseline}
        showDependencies={showDependencies}
        onShowDependenciesChange={setShowDependencies}
        showCriticalHighlight={showCriticalHighlight}
        onShowCriticalHighlightChange={setShowCriticalHighlight}
      />
      <div className="flex border border-gray-200 rounded-md overflow-hidden">
        <div
          className="flex-shrink-0 border-r border-gray-200 bg-white z-10"
          style={{ width: NAME_COLUMN_WIDTH }}
        >
          <div style={{ height: HEADER_HEIGHT }} className="border-b border-gray-200 bg-gray-50" />
          {flatActivities.map(({ activity }) => (
            <div
              key={activity.id}
              style={{ height: ROW_HEIGHT }}
              className="flex items-center px-2 text-sm border-b border-gray-100 truncate"
            >
              {activity.is_on_critical_path && showCriticalHighlight && <span className="mr-1">🔴</span>}
              {activity.kegiatan}
            </div>
          ))}
        </div>

        <div className="overflow-x-auto flex-1">
          <div style={{ width: totalWidth }}>
            <div style={{ height: HEADER_HEIGHT }} className="relative bg-gray-50 border-b border-gray-200">
              {months.map((m) => (
                <div
                  key={`${m.label}-${m.left}`}
                  className={cn(
                    'absolute top-0 h-full flex items-center px-1 text-xs text-gray-500 border-r border-gray-200',
                    m.isCurrent && 'bg-gray-200/70 font-medium text-gray-700'
                  )}
                  style={{ left: m.left, width: m.width }}
                >
                  {m.label}
                </div>
              ))}
            </div>

            <div className="relative">
              {weekendStrips.map((s, i) => (
                <div
                  key={i}
                  className="absolute top-0 bg-gray-100/60 pointer-events-none"
                  style={{ left: s.left, width: s.width, height: totalHeight }}
                />
              ))}

              {flatActivities.map(({ activity, phaseCode }) => (
                <GanttRow
                  key={activity.id}
                  activity={activity}
                  phaseCode={phaseCode}
                  baseline={baselineByActivityId.get(activity.id)}
                  rangeStart={dateRange.start}
                  dayWidth={dayWidth}
                  holidays={holidayDates}
                  showBaseline={showBaseline}
                  highlightCritical={showCriticalHighlight}
                />
              ))}

              {showDependencies && (
                <GanttArrows
                  activities={activitiesForArrows}
                  dependencies={dependencies}
                  rangeStart={dateRange.start}
                  dayWidth={dayWidth}
                  totalWidth={totalWidth}
                  totalHeight={totalHeight}
                  highlightCritical={showCriticalHighlight}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
