import type { Balances, Transaction, TxType } from './types'

// [おさいふ, ちょきんばこ] に掛ける符号
const DELTA: Record<TxType, [number, number]> = {
  opening: [1, 0],
  stamp: [1, 0],
  spend: [-1, 0],
  deposit: [-1, 1],
  withdraw: [1, -1],
  interest: [0, 1],
}

export function byTime(a: Transaction, b: Transaction): number {
  return a.at < b.at ? -1 : a.at > b.at ? 1 : 0
}

export function balancesOf(txs: Transaction[], childId: string, before?: Date): Balances {
  let wallet = 0
  let savings = 0
  for (const t of txs) {
    if (t.childId !== childId || t.voidedAt) continue
    if (before && new Date(t.at) >= before) continue
    const [w, s] = DELTA[t.type]
    wallet += w * t.points
    savings += s * t.points
  }
  return { wallet, savings }
}
