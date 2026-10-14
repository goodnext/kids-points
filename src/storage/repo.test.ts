import { describe, expect, it } from 'vitest'
import { balancesOf } from '../domain/balance'
import { KidsPointsDB } from './db'
import { newId } from './ids'
import { OpFailed, Repo } from './repo'

function makeRepo(start: string) {
  const clock = { now: new Date(start) }
  const repo = new Repo(new KidsPointsDB(`test-${newId()}`), () => clock.now)
  return { repo, clock }
}

describe('Repo', () => {
  it('取引を記録し、スナップショットから残高が出る', async () => {
    const { repo } = makeRepo('2026-11-05T09:00')
    await repo.addTx({ childId: 'c1', type: 'opening', points: 30 })
    await repo.addTx({ childId: 'c1', type: 'deposit', points: 10 })
    const snap = await repo.snapshot()
    expect(balancesOf(snap.transactions, 'c1')).toEqual({ wallet: 20, savings: 10 })
    expect(snap.transactions[0].at).toBe(new Date('2026-11-05T09:00').toISOString())
  })

  it('残高不足は OpFailed(insufficient) で拒否し、記録しない', async () => {
    const { repo } = makeRepo('2026-11-05T09:00')
    await repo.addTx({ childId: 'c1', type: 'opening', points: 3 })
    await expect(repo.addTx({ childId: 'c1', type: 'spend', points: 4 })).rejects.toMatchObject({ reason: 'insufficient' })
    expect((await repo.snapshot()).transactions).toHaveLength(1)
  })

  it('settle は前月の利息を1回だけ記録する', async () => {
    const { repo, clock } = makeRepo('2026-11-05T09:00')
    await repo.saveChild({ id: 'c1', name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 })
    await repo.addTx({ childId: 'c1', type: 'opening', points: 100 })
    await repo.addTx({ childId: 'c1', type: 'deposit', points: 100 })
    clock.now = new Date('2026-12-03T09:00')
    expect(await repo.settle()).toHaveLength(1)
    expect(await repo.settle()).toHaveLength(0)
    expect(balancesOf((await repo.snapshot()).transactions, 'c1').savings).toBe(105)
  })

  it('月が変わった直後の操作では、先に前月の利息を確定させる', async () => {
    const { repo, clock } = makeRepo('2026-11-30T23:58')
    await repo.saveChild({ id: 'c1', name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 })
    await repo.addTx({ childId: 'c1', type: 'opening', points: 100 })
    await repo.addTx({ childId: 'c1', type: 'deposit', points: 100 })
    clock.now = new Date('2026-12-01T00:00:05')
    await repo.addTx({ childId: 'c1', type: 'stamp', points: 1 })
    const interest = (await repo.snapshot()).transactions.filter((t) => t.type === 'interest')
    expect(interest).toMatchObject([{ period: '2026-11', points: 5 }])
  })

  it('undoLast は直前の記録に voidedAt をつける。利息は取り消せない', async () => {
    const { repo, clock } = makeRepo('2026-11-05T09:00')
    await repo.saveChild({ id: 'c1', name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 })
    await repo.addTx({ childId: 'c1', type: 'opening', points: 100 })
    const stamp = await repo.addTx({ childId: 'c1', type: 'stamp', points: 2 })
    expect((await repo.undoLast()).id).toBe(stamp.id)
    const voided = (await repo.snapshot()).transactions.find((t) => t.id === stamp.id)
    expect(voided?.voidedAt).toBeDefined()

    await repo.addTx({ childId: 'c1', type: 'deposit', points: 100 })
    clock.now = new Date('2026-12-02T09:00')
    await expect(repo.undoLast()).rejects.toBeInstanceOf(OpFailed)
    await expect(repo.undoLast()).rejects.toMatchObject({ reason: 'interest' })
  })

  it('設定・PIN・既読を保存できる', async () => {
    const { repo } = makeRepo('2026-11-05T09:00')
    expect((await repo.settings()).interestPercent).toBe(5)
    await repo.setPin('1234')
    expect(await repo.checkPin('1234')).toBe(true)
    expect(await repo.checkPin('9999')).toBe(false)
    await expect(repo.setPin('12')).rejects.toThrow()
    await repo.markSeen('c1', '2026-10')
    expect((await repo.snapshot()).seen).toEqual({ c1: '2026-10' })
  })

  it('子どもとメニューは並び順でスナップショットに入る', async () => {
    const { repo } = makeRepo('2026-11-05T09:00')
    await repo.saveChild({ id: 'b', name: 'そら', avatar: '🐰', color: '#5cb8ff', displayMode: 'young', order: 1 })
    await repo.saveChild({ id: 'a', name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 })
    await repo.saveMenuItem({ id: 'm1', label: 'はみがき', icon: '🪥', points: 1, childIds: ['a'], order: 0 })
    await repo.deleteMenuItem('m1')
    const snap = await repo.snapshot()
    expect(snap.children.map((c) => c.id)).toEqual(['a', 'b'])
    expect(snap.menuItems).toEqual([])
  })

  it('undoLast(expectedId) は、最新の記録が見せたものと違えば取り消さない', async () => {
    const { repo } = makeRepo('2026-11-05T09:00')
    const opening = await repo.addTx({ childId: 'c1', type: 'opening', points: 10 })
    const stamp = await repo.addTx({ childId: 'c1', type: 'stamp', points: 1 })
    await repo.undoLast(stamp.id)
    await expect(repo.undoLast(stamp.id)).rejects.toMatchObject({ reason: 'stale' })
    const txs = (await repo.snapshot()).transactions
    expect(txs.find((t) => t.id === opening.id)?.voidedAt).toBeUndefined()
  })
})
