import { byTime } from '../domain/balance'
import { pendingInterest } from '../domain/interest'
import type { Child, MenuItem, MonthKey, Settings, Transaction, TxType } from '../domain/types'
import { checkUndo, checkVoidStamp, type UndoCheck, type UndoFailReason } from '../domain/undo'
import { validateOp, type OpError } from '../domain/validate'
import type { KidsPointsDB } from './db'
import { newId } from './ids'
import { hashPin, isValidPin } from './pin'

export const DEFAULT_SETTINGS: Settings = {
  pinHash: null,
  interestPercent: 5,
  soundOn: true,
  lastBackupAt: null,
}

export interface Snapshot {
  children: Child[]
  menuItems: MenuItem[]
  transactions: Transaction[]
  settings: Settings
  seen: Record<string, MonthKey>
}

export type NewTx = {
  childId: string
  type: Exclude<TxType, 'interest'>
  points: number
  memo?: string
  menuItemId?: string
  icon?: string
}

// stale: 画面で見せた記録と、いま最新の記録が違う
// used: ちょきん・つかう で おさいふから出た分のスタンプなので消せない
export type OpFailReason = OpError | UndoFailReason | 'stale' | 'duplicate_opening' | 'used'

export class OpFailed extends Error {
  readonly reason: OpFailReason

  constructor(reason: OpFailReason) {
    super(reason)
    this.name = 'OpFailed'
    this.reason = reason
  }
}

export class Repo {
  readonly db: KidsPointsDB
  private readonly clock: () => Date

  constructor(db: KidsPointsDB, clock: () => Date) {
    this.db = db
    this.clock = clock
  }

  now(): Date {
    return this.clock()
  }

  async settings(): Promise<Settings> {
    const row = await this.db.kv.get('settings')
    return { ...DEFAULT_SETTINGS, ...(row?.value as Partial<Settings> | undefined) }
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    await this.db.transaction('rw', [this.db.kv], async () => {
      const current = await this.settings()
      await this.db.kv.put({ key: 'settings', value: { ...current, ...patch } })
    })
  }

  async setPin(pin: string): Promise<void> {
    if (!isValidPin(pin)) throw new Error('PIN は4けたの数字です')
    await this.updateSettings({ pinHash: hashPin(pin) })
  }

  async checkPin(pin: string): Promise<boolean> {
    return (await this.settings()).pinHash === hashPin(pin)
  }

  async seen(): Promise<Record<string, MonthKey>> {
    const row = await this.db.kv.get('seen')
    return (row?.value as Record<string, MonthKey> | undefined) ?? {}
  }

  async markSeen(childId: string, period: MonthKey): Promise<void> {
    await this.db.transaction('rw', [this.db.kv], async () => {
      const seen = await this.seen()
      await this.db.kv.put({ key: 'seen', value: { ...seen, [childId]: period } })
    })
  }

  async saveChild(child: Child): Promise<void> {
    await this.db.children.put(child)
  }

  async saveMenuItem(item: MenuItem): Promise<void> {
    await this.db.menuItems.put(item)
  }

  async deleteMenuItem(id: string): Promise<void> {
    await this.db.menuItems.delete(id)
  }

  // 未計算の月の利息をすべて記録する。起動時・画面復帰時・各操作の前に呼ぶ
  async settle(): Promise<Transaction[]> {
    return this.db.transaction('rw', [this.db.children, this.db.transactions, this.db.kv], async () => {
      const [children, txs, settings] = await Promise.all([
        this.db.children.toArray(),
        this.db.transactions.toArray(),
        this.settings(),
      ])
      const now = this.clock()
      const created = children.flatMap((c) => pendingInterest(txs, c.id, settings.interestPercent, now, newId))
      if (created.length > 0) await this.db.transactions.bulkAdd(created)
      return created
    })
  }

  async addTx(input: NewTx): Promise<Transaction> {
    await this.settle()
    return this.db.transaction('rw', [this.db.transactions], async () => {
      const txs = await this.db.transactions.where('childId').equals(input.childId).toArray()
      const error = validateOp(txs, input.childId, input.type, input.points)
      if (error) throw new OpFailed(error)
      if (input.type === 'opening' && txs.some((t) => t.type === 'opening' && !t.voidedAt)) {
        throw new OpFailed('duplicate_opening')
      }
      const tx: Transaction = { id: newId(), at: this.clock().toISOString(), ...input }
      await this.db.transactions.add(tx)
      return tx
    })
  }

  async previewUndo(): Promise<UndoCheck> {
    await this.settle()
    return checkUndo(await this.db.transactions.toArray(), this.clock())
  }

  // expectedId を渡すと、最新の記録がそれと違うときは取り消さない（連打や古い画面からの取り消しを防ぐ）
  async undoLast(expectedId?: string): Promise<Transaction> {
    await this.settle()
    return this.db.transaction('rw', [this.db.transactions], async () => {
      const result = checkUndo(await this.db.transactions.toArray(), this.clock())
      if (!result.ok) throw new OpFailed(result.reason)
      if (expectedId !== undefined && result.tx.id !== expectedId) throw new OpFailed('stale')
      await this.db.transactions.update(result.tx.id, { voidedAt: this.clock().toISOString() })
      return result.tx
    })
  }

  // 指定したスタンプを消す。最後の記録でなくても、前の月のものでもよい
  async voidStamp(txId: string): Promise<Transaction> {
    await this.settle()
    return this.db.transaction('rw', [this.db.transactions], async () => {
      const result = checkVoidStamp(await this.db.transactions.toArray(), txId)
      if (!result.ok) throw new OpFailed(result.reason)
      await this.db.transactions.update(txId, { voidedAt: this.clock().toISOString() })
      return result.tx
    })
  }

  async snapshot(): Promise<Snapshot> {
    const [children, menuItems, transactions, settings, seen] = await Promise.all([
      this.db.children.toArray(),
      this.db.menuItems.toArray(),
      this.db.transactions.toArray(),
      this.settings(),
      this.seen(),
    ])
    return {
      children: children.sort((a, b) => a.order - b.order),
      menuItems: menuItems.sort((a, b) => a.order - b.order),
      transactions: transactions.sort(byTime),
      settings,
      seen,
    }
  }
}
