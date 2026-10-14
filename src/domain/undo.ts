import { balancesOf } from './balance'
import { monthKey } from './month'
import type { Transaction } from './types'

export type UndoFailReason = 'none' | 'interest' | 'settled' | 'negative'
export type UndoCheck = { ok: true; tx: Transaction } | { ok: false; reason: UndoFailReason; tx?: Transaction }

export function checkUndo(txs: Transaction[], now: Date): UndoCheck {
  const active = txs.filter((t) => !t.voidedAt)
  if (active.length === 0) return { ok: false, reason: 'none' }
  const last = active.reduce((a, b) => (b.at >= a.at ? b : a))
  if (last.type === 'interest') return { ok: false, reason: 'interest', tx: last }
  if (monthKey(new Date(last.at)) < monthKey(now)) return { ok: false, reason: 'settled', tx: last }
  const b = balancesOf(
    txs.filter((t) => t.id !== last.id),
    last.childId,
  )
  if (b.wallet < 0 || b.savings < 0) return { ok: false, reason: 'negative', tx: last }
  return { ok: true, tx: last }
}
