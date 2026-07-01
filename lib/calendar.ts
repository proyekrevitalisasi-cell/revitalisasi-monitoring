import { addDays, isSameDay, isWeekend } from 'date-fns'

function isHoliday(date: Date, holidays: Date[]): boolean {
  return holidays.some((h) => isSameDay(h, date))
}

function isWorkingDay(date: Date, holidays: Date[]): boolean {
  return !isWeekend(date) && !isHoliday(date, holidays)
}

/**
 * Add N working days to startDate, skipping weekends and holidays.
 * Negative days go backward.
 */
export function addWorkingDays(startDate: Date, days: number, holidays: Date[]): Date {
  if (days === 0) return new Date(startDate)
  let current = new Date(startDate)
  let remaining = Math.abs(days)
  const step = days > 0 ? 1 : -1
  while (remaining > 0) {
    current = addDays(current, step)
    if (isWorkingDay(current, holidays)) remaining--
  }
  return current
}

/**
 * Count working days between start (exclusive) and end (inclusive).
 */
export function workingDaysBetween(start: Date, end: Date, holidays: Date[]): number {
  if (start >= end) return 0
  let count = 0
  let current = addDays(start, 1)
  while (current <= end) {
    if (isWorkingDay(current, holidays)) count++
    current = addDays(current, 1)
  }
  return count
}
