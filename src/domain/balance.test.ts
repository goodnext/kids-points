import { describe, expect, it } from 'vitest'
import { balancesOf } from './balance'
import { tx } from './fixtures'

describe('balancesOf', () => {
  it('種類ごとにおさいふとちょきんばこを増減する', () => {
    const txs = [
      tx('opening', 30, '2026-11-01T09:00'),
      tx('stamp', 2, '2026-11-02T09:00'),
      tx('spend', 5, '2026-11-03T09:00'),
      tx('deposit', 10, '2026-11-04T09:00'),
      tx('withdraw', 4, '2026-11-05T09:00'),
      tx('interest', 1, '2026-11-06T09:00'),
    ]
    expect(balancesOf(txs, 'c1')).toEqual({ wallet: 21, savings: 7 })
  })

  it('取り消し済みと、ほかの子の記録は数えない', () => {
    const txs = [
      tx('stamp', 3, '2026-11-01T09:00'),
      tx('stamp', 5, '2026-11-01T10:00', { voidedAt: '2026-11-01T01:01:00.000Z' }),
      tx('stamp', 7, '2026-11-01T11:00', { childId: 'c2' }),
    ]
    expect(balancesOf(txs, 'c1')).toEqual({ wallet: 3, savings: 0 })
  })

  it('before を渡すと、その時刻より前の記録だけを数える', () => {
    const txs = [tx('opening', 10, '2026-11-01T09:00'), tx('stamp', 4, '2026-12-01T00:00')]
    expect(balancesOf(txs, 'c1', new Date('2026-12-01T00:00'))).toEqual({ wallet: 10, savings: 0 })
  })
})
