import { balancesOf } from './balance'
import { monthKey } from './month'
import { stampCells, usedCellCount } from './stampcard'
import type { Transaction } from './types'

export type UndoFailReason = 'none' | 'interest' | 'settled' | 'negative'
export type UndoCheck = { ok: true; tx: Transaction } | { ok: false; reason: UndoFailReason; tx?: Transaction }

export type VoidStampCheck = { ok: true; tx: Transaction } | { ok: false; reason: 'none' | 'used' }

// 指定したスタンプを消せるか。スタンプはおさいふにしか入らず利息に関係しないので、前の月のものでも消せる。
// ただし ちょきん・つかう で おさいふから出た分のマス（usedCellCount）を1マスでも含むスタンプは消せない。
// 消せるスタンプのマスはすべて おさいふに残っている分なので、消しても おさいふはマイナスにならない
export function checkVoidStamp(txs: Transaction[], txId: string): VoidStampCheck {
  const target = txs.find((t) => t.id === txId)
  if (!target || target.type !== 'stamp' || target.voidedAt) return { ok: false, reason: 'none' }
  const first = stampCells(txs, target.childId).findIndex((t) => t.id === txId)
  if (first < usedCellCount(txs, target.childId)) return { ok: false, reason: 'used' }
  return { ok: true, tx: target }
}

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
