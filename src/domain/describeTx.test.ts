import { expect, it } from 'vitest'
import { describeTx } from './describeTx'
import { tx } from './fixtures'

it('子どもの名前・メモ・種類・pt数で説明する', () => {
  expect(describeTx(tx('stamp', 1, '2026-11-01T09:00', { memo: 'おてつだい' }), 'あおい')).toBe('あおい：おてつだい スタンプ 1pt')
  expect(describeTx(tx('deposit', 5, '2026-11-01T09:00'), 'そら')).toBe('そら：ちょきん 5pt')
})
