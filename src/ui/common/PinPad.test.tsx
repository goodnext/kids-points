// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PinPad } from './PinPad'

describe('PinPad', () => {
  it('4けた入れると onSubmit を呼び、false ならエラーを出して消す', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => false)
    render(<PinPad title="PIN" onSubmit={onSubmit} />)
    for (const d of '1234') await user.click(screen.getByRole('button', { name: d }))
    expect(onSubmit).toHaveBeenCalledWith('1234')
    expect(screen.getByText('ちがうよ')).toBeInTheDocument()
    expect(screen.getByLabelText('0けた にゅうりょくずみ')).toBeInTheDocument()
  })

  it('けす ボタンで1けた戻せる', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => true)
    render(<PinPad title="PIN" onSubmit={onSubmit} />)
    for (const d of '129') await user.click(screen.getByRole('button', { name: d }))
    await user.click(screen.getByRole('button', { name: 'けす' }))
    await user.click(screen.getByRole('button', { name: '3' }))
    await user.click(screen.getByRole('button', { name: '4' }))
    expect(onSubmit).toHaveBeenCalledWith('1234')
  })
})
