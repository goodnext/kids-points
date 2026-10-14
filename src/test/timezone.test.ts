import { expect, it } from 'vitest'

it('テストは日本時間で動く（月の境目の計算の前提）', () => {
  expect(new Date('2026-12-01T00:00').toISOString()).toBe('2026-11-30T15:00:00.000Z')
})
