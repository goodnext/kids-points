import { describe, expect, it } from 'vitest'
import { addMonths, monthKey, monthStart, nextMonth, prevMonth } from './month'

describe('month', () => {
  it('monthKey はローカル時刻の年月を返す', () => {
    expect(monthKey(new Date('2026-11-30T23:59'))).toBe('2026-11')
    expect(monthKey(new Date('2026-12-01T00:00'))).toBe('2026-12')
  })

  it('nextMonth / prevMonth は年をまたぐ', () => {
    expect(nextMonth('2026-12')).toBe('2027-01')
    expect(prevMonth('2027-01')).toBe('2026-12')
  })

  it('monthStart はその月の1日0時', () => {
    expect(monthStart('2026-11').getTime()).toBe(new Date('2026-11-01T00:00').getTime())
  })

  it('addMonths は月末の日付を丸める', () => {
    const d = addMonths(new Date('2026-01-31T12:00'), 1)
    expect(monthKey(d)).toBe('2026-02')
    expect(d.getDate()).toBe(28)
    expect(monthKey(addMonths(new Date('2026-03-15T12:00'), -3))).toBe('2025-12')
  })
})
