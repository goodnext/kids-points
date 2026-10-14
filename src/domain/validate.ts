import { balancesOf } from './balance'
import type { Transaction, TxType } from './types'

export type OpError = 'invalid_points' | 'insufficient'

export function validateOp(txs: Transaction[], childId: string, type: TxType, points: number): OpError | null {
  if (!Number.isInteger(points) || points < 1) return 'invalid_points'
  const b = balancesOf(txs, childId)
  if ((type === 'spend' || type === 'deposit') && b.wallet < points) return 'insufficient'
  if (type === 'withdraw' && b.savings < points) return 'insufficient'
  return null
}

export function parsePoints(input: string): number | null {
  const s = input.trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return n >= 1 && Number.isSafeInteger(n) ? n : null
}
