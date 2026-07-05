import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSession, isAdmin } from '@/lib/auth-helpers'
import { WorkCalendarClient } from '@/components/work-calendar/WorkCalendarClient'
import type { Holiday } from '@/lib/types'

export default async function WorkCalendarPage() {
  const { profile } = await getSession()
  if (!profile || !isAdmin(profile.role)) notFound()

  const supabase = createClient()
  const { data: holidayRows } = await supabase
    .from('work_calendar')
    .select('id, holiday_date, name')
    .order('holiday_date')

  const holidays = (holidayRows ?? []) as Holiday[]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Kalender Kerja</h1>
      <p className="text-gray-500 mt-1 mb-6">Hari libur nasional dan cuti bersama</p>
      <WorkCalendarClient initialHolidays={holidays} />
    </div>
  )
}
