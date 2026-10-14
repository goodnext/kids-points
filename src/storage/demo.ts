import { pendingInterest } from '../domain/interest'
import { addMonths, monthKey, monthStart } from '../domain/month'
import type { Child, MenuItem, MonthKey, Transaction, TxType } from '../domain/types'
import type { KidsPointsDB } from './db'
import { DEFAULT_MENU } from './defaults'
import { hashPin } from './pin'
import { DEFAULT_SETTINGS } from './repo'

export const DEMO_PIN = '0000'
export const DEMO_CHILD_IDS = ['demo-aoi', 'demo-sora']
const OFFSET_KEY = 'demoMonthOffset'

export async function getDemoOffset(db: KidsPointsDB): Promise<number> {
  const row = await db.kv.get(OFFSET_KEY)
  return typeof row?.value === 'number' ? row.value : 0
}

export async function setDemoOffset(db: KidsPointsDB, offset: number): Promise<void> {
  await db.kv.put({ key: OFFSET_KEY, value: offset })
}

export function demoClock(offset: number): () => Date {
  return () => addMonths(new Date(), offset)
}

// デモ用の子ども2人と、過去3ヶ月分の記録を作り直す。進めた月数もリセットする
export async function seedDemo(db: KidsPointsDB, now: Date): Promise<void> {
  const [aoi, sora] = DEMO_CHILD_IDS
  const children: Child[] = [
    { id: aoi, name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 },
    { id: sora, name: 'そら', avatar: '🐰', color: '#5cb8ff', displayMode: 'young', order: 1 },
  ]
  const menuItems: MenuItem[] = DEFAULT_MENU.map((m, i) => ({ id: `demo-menu-${i}`, ...m, childIds: DEMO_CHILD_IDS, order: i }))

  const txs: Transaction[] = []
  let seq = 0
  const add = (childId: string, type: TxType, points: number, at: Date, extra: Partial<Transaction> = {}) => {
    seq += 1
    txs.push({ id: `demo-tx-${seq}`, childId, type, points, at: at.toISOString(), ...extra })
  }
  const thisMonth = monthKey(now)
  const months: MonthKey[] = [3, 2, 1].map((n) => monthKey(addMonths(monthStart(thisMonth), -n)))
  const day = (m: MonthKey, d: number) => {
    const s = monthStart(m)
    return new Date(s.getFullYear(), s.getMonth(), d, 18, 0)
  }

  add(aoi, 'opening', 30, day(months[0], 1))
  add(sora, 'opening', 10, day(months[0], 1))
  months.forEach((m, i) => {
    for (let d = 2; d <= 24; d += 3) {
      const item = DEFAULT_MENU[d % DEFAULT_MENU.length]
      add(aoi, 'stamp', item.points, day(m, d), { memo: item.label, icon: item.icon })
    }
    for (let d = 3; d <= 19; d += 4) {
      const item = DEFAULT_MENU[(d + 1) % DEFAULT_MENU.length]
      add(sora, 'stamp', item.points, day(m, d), { memo: item.label, icon: item.icon })
    }
    add(aoi, 'deposit', 10, day(m, 25))
    add(sora, 'deposit', 5, day(m, 25))
    if (i === 1) {
      add(aoi, 'spend', 5, day(m, 27), { memo: 'おかし' })
      add(sora, 'withdraw', 3, day(m, 27))
    }
  })
  let interestSeq = 0
  for (const c of children) {
    txs.push(...pendingInterest(txs, c.id, DEFAULT_SETTINGS.interestPercent, now, () => `demo-int-${++interestSeq}`))
  }

  await db.transaction('rw', [db.children, db.menuItems, db.transactions, db.kv], async () => {
    await Promise.all([db.children.clear(), db.menuItems.clear(), db.transactions.clear(), db.kv.clear()])
    await db.children.bulkPut(children)
    await db.menuItems.bulkPut(menuItems)
    await db.transactions.bulkPut(txs)
    await db.kv.bulkPut([
      { key: 'settings', value: { ...DEFAULT_SETTINGS, pinHash: hashPin(DEMO_PIN), lastBackupAt: now.toISOString() } },
      // 最初に開いたときは演出を出さず、「1ヶ月すすめる」で初めて出す
      { key: 'seen', value: { [aoi]: months[2], [sora]: months[2] } },
    ])
  })
}
