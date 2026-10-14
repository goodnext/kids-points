import Dexie, { type Table } from 'dexie'
import type { Child, MenuItem, Transaction } from '../domain/types'

export interface KV {
  key: string
  value: unknown
}

export const REAL_DB = 'kids-points'
export const DEMO_DB = 'kids-points-demo'

export class KidsPointsDB extends Dexie {
  // useDefineForClassFields で Dexie のテーブルが上書きされないよう declare を使う
  declare children: Table<Child, string>
  declare menuItems: Table<MenuItem, string>
  declare transactions: Table<Transaction, string>
  declare kv: Table<KV, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      children: 'id',
      menuItems: 'id',
      transactions: 'id, childId, at',
      kv: 'key',
    })
  }
}
