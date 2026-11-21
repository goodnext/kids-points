import { describe, expect, it } from 'vitest'
import { tx } from './fixtures'
import { CARD_SIZE, isCardCompletedBy, stampCards, usedCellCount } from './stampcard'

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

  it('2pt のスタンプは2マス使う', () => {
    const two = tx('stamp', 2, '2026-11-01T10:00')
    const cards = stampCards([tx('stamp', 1, '2026-11-01T09:00'), two], 'c1')
    expect(cards[0].map((t) => t.points)).toEqual([1, 2, 2])
  })

  it('2マスのスタンプが20マス目をまたぐと、カードを完成させて次のカードに続く', () => {
    const two = tx('stamp', 2, '2026-11-02T09:00')
    const cards = stampCards([...stamps(CARD_SIZE - 1), two], 'c1')
    expect(cards.map((c) => c.length)).toEqual([20, 1])
    expect(cards[1][0].id).toBe(two.id)
    expect(isCardCompletedBy(cards, two.id)).toBe(true)
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

describe('usedCellCount', () => {
  it('おさいふに残っている分だけ、新しいスタンプから まだ つかっていない とみなす', () => {
    const txs = [...stamps(5), tx('deposit', 3, '2026-11-02T09:00')]
    expect(usedCellCount(txs, 'c1')).toBe(3)
  })

  it('おさいふが 0 なら全部つかった。つかう でも同じ', () => {
    expect(usedCellCount([...stamps(4), tx('spend', 4, '2026-11-02T09:00')], 'c1')).toBe(4)
  })

  it('開始残高などで おさいふがスタンプより多ければ、つかったものはない', () => {
    expect(usedCellCount([tx('opening', 30, '2026-10-01T09:00'), ...stamps(3), tx('spend', 5, '2026-11-02T09:00')], 'c1')).toBe(0)
  })

  it('ひきだして おさいふに戻すと、その分は まだ つかっていない に戻る', () => {
    const txs = [...stamps(4), tx('deposit', 4, '2026-11-02T09:00'), tx('withdraw', 1, '2026-11-03T09:00')]
    expect(usedCellCount(txs, 'c1')).toBe(3)
  })
})
