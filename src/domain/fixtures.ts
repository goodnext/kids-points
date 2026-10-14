import type { Transaction, TxType } from './types'

let seq = 0

// at はローカル時刻の文字列（例: '2026-11-05T10:00'）
export function tx(type: TxType, points: number, at: string, extra: Partial<Transaction> = {}): Transaction {
  seq += 1
  return { id: `t${seq}`, childId: 'c1', type, points, at: new Date(at).toISOString(), ...extra }
}
