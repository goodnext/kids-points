import { balancesOf } from './balance'
import { monthKey, monthStart, nextMonth } from './month'
import type { MonthKey, Transaction } from './types'

export function interestFor(savings: number, percent: number): number {
  if (savings <= 0 || percent <= 0) return 0
  return Math.max(1, Math.floor((savings * percent) / 100))
}

export function withdrewIn(txs: Transaction[], childId: string, m: MonthKey): boolean {
  const start = monthStart(m)
  const end = monthStart(nextMonth(m))
  return txs.some((t) => {
    if (t.childId !== childId || t.voidedAt || t.type !== 'withdraw') return false
    const at = new Date(t.at)
    return at >= start && at < end
  })
}

export function pendingInterest(
  txs: Transaction[],
  childId: string,
  percent: number,
  now: Date,
  newId: () => string,
): Transaction[] {
  const mine = txs.filter((t) => t.childId === childId && !t.voidedAt)
  if (mine.length === 0) return []
  const firstAt = mine.reduce((min, t) => (t.at < min ? t.at : min), mine[0].at)
  const current = monthKey(now)
  const settled = new Set(mine.filter((t) => t.type === 'interest').map((t) => t.period))
  const working = [...txs]
  const created: Transaction[] = []
  for (let m = monthKey(new Date(firstAt)); m < current; m = nextMonth(m)) {
    if (settled.has(m) || withdrewIn(working, childId, m)) continue
    const end = monthStart(nextMonth(m))
    const points = interestFor(balancesOf(working, childId, end).savings, percent)
    if (points === 0) continue
    const t: Transaction = { id: newId(), childId, type: 'interest', points, at: end.toISOString(), period: m }
    working.push(t)
    created.push(t)
  }
  return created
}

export type MonthOutcome = { kind: 'interest'; points: number } | { kind: 'rest' } | { kind: 'none' }

export function monthOutcome(txs: Transaction[], childId: string, m: MonthKey): MonthOutcome {
  const it = txs.find((t) => t.childId === childId && !t.voidedAt && t.type === 'interest' && t.period === m)
  if (it) return { kind: 'interest', points: it.points }
  if (withdrewIn(txs, childId, m)) return { kind: 'rest' }
  return { kind: 'none' }
}

export function projectedInterest(
  txs: Transaction[],
  childId: string,
  percent: number,
  now: Date,
): { savings: number; points: number; blocked: boolean } {
  const { savings } = balancesOf(txs, childId)
  const blocked = withdrewIn(txs, childId, monthKey(now))
  return { savings, points: blocked ? 0 : interestFor(savings, percent), blocked }
}
