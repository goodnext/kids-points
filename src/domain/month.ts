import type { MonthKey } from './types'

export function monthKey(d: Date): MonthKey {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthStart(key: MonthKey): Date {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1, 0, 0, 0, 0)
}

export function nextMonth(key: MonthKey): MonthKey {
  const d = monthStart(key)
  return monthKey(new Date(d.getFullYear(), d.getMonth() + 1, 1))
}

export function prevMonth(key: MonthKey): MonthKey {
  const d = monthStart(key)
  return monthKey(new Date(d.getFullYear(), d.getMonth() - 1, 1))
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getTime())
  const day = r.getDate()
  r.setDate(1)
  r.setMonth(r.getMonth() + n)
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(day, lastDay))
  return r
}
