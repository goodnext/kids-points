import { describe, expect, it } from 'vitest'
import { tx } from './fixtures'
import { checkUndo } from './undo'

const now = new Date('2026-12-02T09:00')

describe('checkUndo', () => {
  it('記録がなければ none', () => {
    expect(checkUndo([], now)).toEqual({ ok: false, reason: 'none' })
  })

  it('時刻がいちばん新しい有効な記録が対象', () => {
    const a = tx('stamp', 1, '2026-12-01T10:00')
    const b = tx('stamp', 2, '2026-12-02T08:00', { childId: 'c2' })
    const c = tx('stamp', 3, '2026-12-02T08:30', { voidedAt: '2026-12-01T23:31:00.000Z' })
    const r = checkUndo([b, a, c], now)
    expect(r).toEqual({ ok: true, tx: b })
  })

  it('利息は取り消せない', () => {
    const it1 = tx('interest', 5, '2026-12-01T00:00', { period: '2026-11' })
    expect(checkUndo([tx('deposit', 100, '2026-11-10T09:00'), it1], now)).toMatchObject({ ok: false, reason: 'interest' })
  })

  it('前の月の記録は取り消せない', () => {
    expect(checkUndo([tx('stamp', 1, '2026-11-20T09:00')], now)).toMatchObject({ ok: false, reason: 'settled' })
  })

  it('取り消すと残高がマイナスになる場合は取り消せない', () => {
    // 読み込んだデータなどで、開始残高より前に使った記録がある場合
    const txs = [tx('spend', 10, '2026-12-01T09:00'), tx('opening', 10, '2026-12-02T08:00')]
    expect(checkUndo(txs, now)).toMatchObject({ ok: false, reason: 'negative' })
  })
})
