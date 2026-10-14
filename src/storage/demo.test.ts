import { describe, expect, it } from 'vitest'
import { balancesOf } from '../domain/balance'
import { monthOutcome } from '../domain/interest'
import { addMonths, monthKey } from '../domain/month'
import { KidsPointsDB } from './db'
import { DEMO_CHILD_IDS, DEMO_PIN, demoClock, getDemoOffset, seedDemo, setDemoOffset } from './demo'
import { newId } from './ids'
import { Repo } from './repo'

const now = new Date('2026-11-05T09:00')

describe('demo', () => {
  it('子ども2人と過去3ヶ月分の記録・利息を作る', async () => {
    const db = new KidsPointsDB(`test-${newId()}`)
    await seedDemo(db, now)
    const repo = new Repo(db, () => now)
    const snap = await repo.snapshot()
    expect(snap.children.map((c) => c.id)).toEqual(DEMO_CHILD_IDS)
    expect(await repo.checkPin(DEMO_PIN)).toBe(true)
    for (const id of DEMO_CHILD_IDS) {
      const b = balancesOf(snap.transactions, id)
      expect(b.wallet).toBeGreaterThanOrEqual(0)
      expect(b.savings).toBeGreaterThan(0)
    }
    expect(monthOutcome(snap.transactions, 'demo-aoi', '2026-10')).toMatchObject({ kind: 'interest' })
    expect(monthOutcome(snap.transactions, 'demo-sora', '2026-09')).toEqual({ kind: 'rest' })
    expect(snap.seen).toEqual({ 'demo-aoi': '2026-10', 'demo-sora': '2026-10' })
    // 既に計算済みなので、同じ時刻で settle しても増えない
    expect(await repo.settle()).toHaveLength(0)
  })

  it('もう一度 seed すると初期状態に戻る', async () => {
    const db = new KidsPointsDB(`test-${newId()}`)
    await seedDemo(db, now)
    const count = await db.transactions.count()
    await setDemoOffset(db, 2)
    await seedDemo(db, now)
    expect(await db.transactions.count()).toBe(count)
    expect(await getDemoOffset(db)).toBe(0)
  })

  it('demoClock は月をずらし、1ヶ月すすめると今月分の利息がつく', async () => {
    expect(monthKey(demoClock(1)())).toBe(monthKey(addMonths(new Date(), 1)))
    const db = new KidsPointsDB(`test-${newId()}`)
    await seedDemo(db, now)
    const repo = new Repo(db, () => addMonths(now, 1))
    const created = await repo.settle()
    expect(created.map((t) => [t.childId, t.period])).toEqual([
      ['demo-aoi', '2026-11'],
      ['demo-sora', '2026-11'],
    ])
  })
})
