import { describe, expect, it } from 'vitest'
import { tx } from './fixtures'
import { checkUndo, checkVoidStamp } from './undo'

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

describe('checkVoidStamp', () => {
  it('前の月のスタンプでも消せる', () => {
    const old = tx('stamp', 2, '2026-10-20T09:00')
    const txs = [tx('stamp', 1, '2026-10-01T09:00'), old, tx('stamp', 1, '2026-12-01T09:00')]
    expect(checkVoidStamp(txs, old.id)).toEqual({ ok: true, tx: old })
  })

  it('ちょきん・つかう で おさいふから出た分のスタンプは消せない。残っている新しいスタンプは消せる', () => {
    const a = tx('stamp', 1, '2026-12-01T09:00')
    const b = tx('stamp', 1, '2026-12-01T09:01')
    const c = tx('stamp', 1, '2026-12-01T09:02')
    const txs = [a, b, c, tx('spend', 2, '2026-12-01T10:00')]
    expect(checkVoidStamp(txs, a.id)).toMatchObject({ ok: false, reason: 'used' })
    expect(checkVoidStamp(txs, b.id)).toMatchObject({ ok: false, reason: 'used' })
    expect(checkVoidStamp(txs, c.id)).toEqual({ ok: true, tx: c })
  })

  it('2マスのうち1マスでも つかっていたら消せない', () => {
    const s = tx('stamp', 2, '2026-12-01T09:00')
    const txs = [s, tx('deposit', 1, '2026-12-01T10:00')]
    expect(checkVoidStamp(txs, s.id)).toMatchObject({ ok: false, reason: 'used' })
  })

  it('ほかの子の残高は関係ない', () => {
    const s = tx('stamp', 1, '2026-12-01T09:00')
    const txs = [s, tx('opening', 5, '2026-11-01T09:00', { childId: 'c2' }), tx('spend', 5, '2026-12-01T10:00', { childId: 'c2' })]
    expect(checkVoidStamp(txs, s.id)).toEqual({ ok: true, tx: s })
  })

  it('スタンプ以外・消し済み・見つからない記録は消せない', () => {
    const opening = tx('opening', 5, '2026-11-01T09:00')
    const voided = tx('stamp', 1, '2026-12-01T09:00', { voidedAt: '2026-12-01T01:00:00.000Z' })
    const txs = [opening, voided]
    expect(checkVoidStamp(txs, opening.id)).toEqual({ ok: false, reason: 'none' })
    expect(checkVoidStamp(txs, voided.id)).toEqual({ ok: false, reason: 'none' })
    expect(checkVoidStamp(txs, 'nothing')).toEqual({ ok: false, reason: 'none' })
  })
})
