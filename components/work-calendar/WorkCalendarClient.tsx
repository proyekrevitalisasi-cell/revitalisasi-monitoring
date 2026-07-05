'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { YearCalendarGrid } from './YearCalendarGrid'
import { AddHolidayModal } from './AddHolidayModal'
import { ImportNationalHolidaysButton } from './ImportNationalHolidaysButton'
import type { Holiday } from '@/lib/types'

interface WorkCalendarClientProps {
  initialHolidays: Holiday[]
}

export function WorkCalendarClient({ initialHolidays }: WorkCalendarClientProps) {
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays)
  const [year, setYear] = useState(new Date().getFullYear())

  const yearHolidays = holidays.filter((h) => h.holiday_date.startsWith(String(year)))
  const existingDates = new Set(holidays.map((h) => h.holiday_date))

  function handleAdded(holiday: Holiday) {
    setHolidays((prev) => [...prev, holiday].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)))
  }

  function handleImported(imported: Holiday[]) {
    setHolidays((prev) => [...prev, ...imported].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)))
  }

  function handleDeleted(id: string) {
    setHolidays((prev) => prev.filter((h) => h.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-md p-3">
        Perubahan kalender akan mentrigger recalculate CPM di semua lokasi.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setYear((y) => y - 1)}>
            ← {year - 1}
          </Button>
          <span className="text-lg font-semibold text-gray-900 w-16 text-center">{year}</span>
          <Button variant="outline" onClick={() => setYear((y) => y + 1)}>
            {year + 1} →
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <ImportNationalHolidaysButton existingDates={existingDates} onImported={handleImported} />
          <AddHolidayModal onAdded={handleAdded} />
        </div>
      </div>

      <YearCalendarGrid year={year} holidays={yearHolidays} onDeleted={handleDeleted} />
    </div>
  )
}
