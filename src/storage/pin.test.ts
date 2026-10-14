import { describe, expect, it } from 'vitest'
import { hashPin, isValidPin } from './pin'

describe('pin', () => {
  it('4けたの数字だけ有効', () => {
    expect(isValidPin('0123')).toBe(true)
    for (const p of ['123', '12345', 'abcd', '12 3']) expect(isValidPin(p)).toBe(false)
  })

  it('同じPINは同じハッシュ、違うPINは違うハッシュ、PINそのものではない', () => {
    expect(hashPin('1234')).toBe(hashPin('1234'))
    expect(hashPin('1234')).not.toBe(hashPin('1235'))
    expect(hashPin('1234')).not.toContain('1234')
  })
})
