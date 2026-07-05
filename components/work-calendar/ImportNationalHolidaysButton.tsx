'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { NATIONAL_HOLIDAYS } from '@/lib/national-holidays'
import type { Holiday } from '@/lib/types'

interface ImportNationalHolidaysButtonProps {
  existingDates: Set<string>
  onImported: (holidays: Holiday[]) => void
}

const AVAILABLE_YEARS = [2026, 2027] as const

export function ImportNationalHolidaysButton({ existingDates, onImported }: ImportNationalHolidaysButtonProps) {
  const [year, setYear] = useState<(typeof AVAILABLE_YEARS)[number]>(2026)
  const [importing, setImporting] = useState(false)

  async function handleImport() {
    setImporting(true)
    const toAdd = NATIONAL_HOLIDAYS[year].filter((h) => !existingDates.has(h.holiday_date))
    const alreadyPresent = NATIONAL_HOLIDAYS[year].length - toAdd.length
    const added: Holiday[] = []
    let failed = 0

    for (const holiday of toAdd) {
      try {
        const res = await fetch('/api/work-calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ holiday_date: holiday.holiday_date, name: holiday.name }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          failed += 1
          continue
        }
        added.push(json.data as Holiday)
      } catch {
        failed += 1
      }
    }

    onImported(added)
    toast.success(`${added.length} hari libur ditambahkan, ${alreadyPresent + failed} sudah ada`)
    setImporting(false)
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={String(year)} onValueChange={(v) => setYear(Number(v) as (typeof AVAILABLE_YEARS)[number])}>
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_YEARS.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={handleImport} disabled={importing}>
        {importing ? 'Mengimpor…' : `Import Libur Nasional ${year}`}
      </Button>
    </div>
  )
}
