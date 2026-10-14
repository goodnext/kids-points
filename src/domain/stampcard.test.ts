import { describe, expect, it } from 'vitest'
import { tx } from './fixtures'
import { CARD_SIZE, isCardCompletedBy, stampCards } from './stampcard'

const stamps = (n: number) =>
  Array.from({ length: n }, (_, i) => tx('stamp', 1, `2026-11-01T09:${String(i).padStart(2, '0')}`))

describe('stampCards', () => {
  it('スタンプがなければ空のカードが1枚', () => {
    expect(stampCards([], 'c1')).toEqual([[]])
  })

  it('20こまでは1枚目に入る', () => {
    expect(stampCards(stamps(3), 'c1').map((c) => c.length)).toEqual([3])
  })

  it('20こ埋まると次の空のカードに進む', () => {
    const s = stamps(CARD_SIZE)
    const cards = stampCards(s, 'c1')
    expect(cards.map((c) => c.length)).toEqual([20, 0])
    expect(isCardCompletedBy(cards, s[19].id)).toBe(true)
    expect(isCardCompletedBy(cards, s[18].id)).toBe(false)
  })

  it('21こ目は2枚目に入る', () => {
    expect(stampCards(stamps(21), 'c1').map((c) => c.length)).toEqual([20, 1])
  })

  it('取り消し済み・スタンプ以外・ほかの子は数えない', () => {
    const txs = [
      tx('stamp', 1, '2026-11-01T09:00'),
      tx('stamp', 1, '2026-11-01T09:01', { voidedAt: '2026-11-01T00:02:00.000Z' }),
      tx('opening', 10, '2026-11-01T09:02'),
      tx('stamp', 1, '2026-11-01T09:03', { childId: 'c2' }),
    ]
    expect(stampCards(txs, 'c1').map((c) => c.length)).toEqual([1])
  })
})
