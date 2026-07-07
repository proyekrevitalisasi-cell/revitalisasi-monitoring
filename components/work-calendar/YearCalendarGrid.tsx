'use client'

import type { KeyboardEvent } from 'react'
import {
  eachMonthOfInterval,
  eachDayOfInterval,
  startOfYear,
  endOfYear,
  startOfMonth,
  endOfMonth,
  format,
  getDay,
} from 'date-fns'
import { DeleteHolidayDialog } from './DeleteHolidayDialog'
import { cn } from '@/lib/utils'
import type { Holiday } from '@/lib/types'

interface YearCalendarGridProps {
  year: number
  holidays: Holiday[]
  onDeleted: (id: string) => void
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const DAY_LABELS = ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg']

export function YearCalendarGrid({ year, holidays, onDeleted }: YearCalendarGridProps) {
  const holidayByDate = new Map(holidays.map((h) => [h.holiday_date, h]))
  const months = eachMonthOfInterval({
    start: startOfYear(new Date(year, 0, 1)),
    end: endOfYear(new Date(year, 0, 1)),
  })

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {months.map((monthStart) => {
        const days = eachDayOfInterval({ start: startOfMonth(monthStart), end: endOfMonth(monthStart) })
        const leadingBlanks = (getDay(startOfMonth(monthStart)) + 6) % 7

        return (
          <div key={monthStart.toISOString()} className="border rounded-md p-3">
            <div className="text-sm font-semibold text-gray-900 mb-2">
              {MONTH_NAMES[monthStart.getMonth()]} {year}
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs text-gray-400 mb-1">
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const holiday = holidayByDate.get(dateStr)
                const cell = (
                  <div
                    className={cn(
                      'text-center text-xs rounded p-1',
                      holiday ? 'bg-red-100 text-red-700 font-medium cursor-pointer' : 'text-gray-700'
                    )}
                    title={holiday?.name}
                    {...(holiday
                      ? {
                          tabIndex: 0,
                          role: 'button' as const,
                          onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.currentTarget.click()
                            }
                          },
                        }
                      : {})}
                  >
                    {format(day, 'd')}
                  </div>
                )
                if (holiday) {
                  return (
                    <DeleteHolidayDialog key={dateStr} holidayId={holiday.id} holidayName={holiday.name} onDeleted={onDeleted}>
                      {cell}
                    </DeleteHolidayDialog>
                  )
                }
                return <div key={dateStr}>{cell}</div>
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
