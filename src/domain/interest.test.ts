import { describe, expect, it } from 'vitest'
import { tx } from './fixtures'
import { interestFor, monthOutcome, nextInterestStep, pendingInterest, projectedInterest } from './interest'
import type { Transaction } from './types'

let idSeq = 0
const newId = () => `i${++idSeq}`

describe('interestFor', () => {
  it('切り捨て、ただし1pt以上あれば最低1pt', () => {
    expect(interestFor(100, 5)).toBe(5)
    expect(interestFor(39, 5)).toBe(1)
    expect(interestFor(40, 5)).toBe(2)
    expect(interestFor(10, 5)).toBe(1)
    expect(interestFor(1, 5)).toBe(1)
  })

  it('残高0、または利率0なら0', () => {
    expect(interestFor(0, 5)).toBe(0)
    expect(interestFor(100, 0)).toBe(0)
  })
})

describe('pendingInterest', () => {
  it('前月末のちょきんばこ残高に利息をつけ、翌月1日0時で記録する', () => {
    const txs = [tx('opening', 100, '2026-11-01T09:00'), tx('deposit', 100, '2026-11-10T09:00')]
    const created = pendingInterest(txs, 'c1', 5, new Date('2026-12-02T09:00'), newId)
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      childId: 'c1',
      type: 'interest',
      points: 5,
      period: '2026-11',
      at: new Date('2026-12-01T00:00').toISOString(),
    })
  })

  it('今月の分はまだ計算しない', () => {
    const txs = [tx('opening', 100, '2026-11-01T09:00'), tx('deposit', 100, '2026-11-10T09:00')]
    expect(pendingInterest(txs, 'c1', 5, new Date('2026-11-30T23:59'), newId)).toEqual([])
  })

  it('その月に引き出していたら利息なし', () => {
    const txs = [
      tx('opening', 100, '2026-11-01T09:00'),
      tx('deposit', 100, '2026-11-10T09:00'),
      tx('withdraw', 1, '2026-11-20T09:00'),
    ]
    expect(pendingInterest(txs, 'c1', 5, new Date('2026-12-02T09:00'), newId)).toEqual([])
  })

  it('引き出しを取り消していれば利息あり', () => {
    const txs = [
      tx('opening', 100, '2026-11-01T09:00'),
      tx('deposit', 100, '2026-11-10T09:00'),
      tx('withdraw', 1, '2026-11-20T09:00', { voidedAt: '2026-11-20T01:00:00.000Z' }),
    ]
    expect(pendingInterest(txs, 'c1', 5, new Date('2026-12-02T09:00'), newId)).toHaveLength(1)
  })

  it('複数月をさかのぼって、前の月の利息を含めて複利で計算する', () => {
    const txs = [tx('opening', 1000, '2026-11-01T09:00'), tx('deposit', 1000, '2026-11-10T09:00')]
    const created = pendingInterest(txs, 'c1', 5, new Date('2027-02-15T09:00'), newId)
    expect(created.map((t) => [t.period, t.points])).toEqual([
      ['2026-11', 50],
      ['2026-12', 52],
      ['2027-01', 55],
    ])
  })

  it('計算済みの月は二重に計算しない', () => {
    const txs: Transaction[] = [tx('opening', 100, '2026-11-01T09:00'), tx('deposit', 100, '2026-11-10T09:00')]
    const now = new Date('2026-12-02T09:00')
    const first = pendingInterest(txs, 'c1', 5, now, newId)
    expect(pendingInterest([...txs, ...first], 'c1', 5, now, newId)).toEqual([])
  })

  it('残高0の月は飛ばし、あとの月は計算する', () => {
    const txs = [tx('opening', 100, '2026-11-01T09:00'), tx('deposit', 100, '2026-12-10T09:00')]
    const created = pendingInterest(txs, 'c1', 5, new Date('2027-01-05T09:00'), newId)
    expect(created.map((t) => t.period)).toEqual(['2026-12'])
  })

  it('ほかの子の記録は影響しない', () => {
    const txs = [
      tx('opening', 100, '2026-11-01T09:00'),
      tx('deposit', 100, '2026-11-10T09:00'),
      tx('withdraw', 50, '2026-11-20T09:00', { childId: 'c2' }),
    ]
    expect(pendingInterest(txs, 'c1', 5, new Date('2026-12-02T09:00'), newId)).toHaveLength(1)
    expect(pendingInterest(txs, 'c3', 5, new Date('2026-12-02T09:00'), newId)).toEqual([])
  })
})

describe('monthOutcome', () => {
  const base = [tx('opening', 100, '2026-11-01T09:00'), tx('deposit', 100, '2026-11-10T09:00')]

  it('利息があれば interest', () => {
    const txs = [...base, tx('interest', 5, '2026-12-01T00:00', { period: '2026-11' })]
    expect(monthOutcome(txs, 'c1', '2026-11')).toEqual({ kind: 'interest', points: 5 })
  })

  it('引き出して利息がなければ rest', () => {
    const txs = [...base, tx('withdraw', 1, '2026-11-20T09:00')]
    expect(monthOutcome(txs, 'c1', '2026-11')).toEqual({ kind: 'rest' })
  })

  it('どちらでもなければ none', () => {
    expect(monthOutcome([tx('opening', 5, '2026-11-01T09:00')], 'c1', '2026-11')).toEqual({ kind: 'none' })
  })
})

describe('nextInterestStep', () => {
  it('利息が1pt増えるには、あと何pt ちょきんすればよいか', () => {
    expect(nextInterestStep(33, 5)).toEqual({ more: 7, points: 2 })
    expect(nextInterestStep(39, 5)).toEqual({ more: 1, points: 2 })
    expect(nextInterestStep(40, 5)).toEqual({ more: 20, points: 3 })
    expect(nextInterestStep(10, 5)).toEqual({ more: 30, points: 2 })
    expect(nextInterestStep(50, 3)).toEqual({ more: 17, points: 2 })
    expect(nextInterestStep(33, 100)).toEqual({ more: 1, points: 34 })
  })

  it('ちょきんばこが0なら、1pt で利息がつく', () => {
    expect(nextInterestStep(0, 5)).toEqual({ more: 1, points: 1 })
  })

  it('利率0なら増えないので null', () => {
    expect(nextInterestStep(33, 0)).toBeNull()
  })
})

describe('projectedInterest', () => {
  it('今のちょきんばこ残高から、来月1日に入る利息の見込みと、次に増えるまでの pt を出す', () => {
    const txs = [tx('opening', 100, '2026-11-01T09:00'), tx('deposit', 60, '2026-11-10T09:00')]
    expect(projectedInterest(txs, 'c1', 5, new Date('2026-11-15T09:00'))).toEqual({
      savings: 60,
      points: 3,
      blocked: false,
      payAt: new Date('2026-12-01T00:00'),
      next: { more: 20, points: 4 },
    })
  })

  it('今月引き出していたら blocked で、次に増えるまでの pt は出さない', () => {
    const txs = [
      tx('opening', 100, '2026-11-01T09:00'),
      tx('deposit', 60, '2026-11-10T09:00'),
      tx('withdraw', 10, '2026-11-12T09:00'),
    ]
    expect(projectedInterest(txs, 'c1', 5, new Date('2026-11-15T09:00'))).toEqual({
      savings: 50,
      points: 0,
      blocked: true,
      payAt: new Date('2026-12-01T00:00'),
      next: null,
    })
  })

  it('12月なら、入るのは翌年の1月1日', () => {
    const txs = [tx('deposit', 20, '2026-12-10T09:00')]
    expect(projectedInterest(txs, 'c1', 5, new Date('2026-12-20T09:00')).payAt).toEqual(new Date('2027-01-01T00:00'))
  })
})
