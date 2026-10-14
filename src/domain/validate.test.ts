import { describe, expect, it } from 'vitest'
import { tx } from './fixtures'
import { parsePoints, validateOp } from './validate'

describe('validateOp', () => {
  const txs = [tx('opening', 10, '2026-11-01T09:00'), tx('deposit', 4, '2026-11-02T09:00')]

  it('1以上の整数でなければ invalid_points', () => {
    expect(validateOp(txs, 'c1', 'stamp', 0)).toBe('invalid_points')
    expect(validateOp(txs, 'c1', 'stamp', -1)).toBe('invalid_points')
    expect(validateOp(txs, 'c1', 'stamp', 1.5)).toBe('invalid_points')
  })

  it('おさいふを超える spend / deposit は insufficient', () => {
    expect(validateOp(txs, 'c1', 'spend', 6)).toBe(null)
    expect(validateOp(txs, 'c1', 'spend', 7)).toBe('insufficient')
    expect(validateOp(txs, 'c1', 'deposit', 7)).toBe('insufficient')
  })

  it('ちょきんばこを超える withdraw は insufficient', () => {
    expect(validateOp(txs, 'c1', 'withdraw', 4)).toBe(null)
    expect(validateOp(txs, 'c1', 'withdraw', 5)).toBe('insufficient')
  })

  it('スタンプと開始残高は残高に関係なく受け付ける', () => {
    expect(validateOp([], 'c1', 'stamp', 3)).toBe(null)
    expect(validateOp([], 'c1', 'opening', 100)).toBe(null)
  })
})

describe('parsePoints', () => {
  it('半角・全角の正の整数を数値にする', () => {
    expect(parsePoints('10')).toBe(10)
    expect(parsePoints('１０')).toBe(10)
    expect(parsePoints(' 7 ')).toBe(7)
  })

  it('空・0・負数・小数・文字は null', () => {
    for (const s of ['', '0', '-3', '1.5', 'abc', '1e3']) expect(parsePoints(s)).toBe(null)
  })
})
