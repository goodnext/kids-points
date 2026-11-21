// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DepositPanel } from './DepositPanel'

describe('DepositPanel', () => {
  it('連打しても1回だけ預け入れる', async () => {
    let resolve: () => void = () => {}
    const onDeposit = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    render(<DepositPanel wallet={10} mode="young" onDeposit={onDeposit} />)
    const all = screen.getByRole('button', { name: 'ぜんぶ' })
    fireEvent.click(all)
    fireEvent.click(all)
    expect(onDeposit).toHaveBeenCalledTimes(1)
    expect(onDeposit).toHaveBeenCalledWith(10)
    await act(async () => resolve())
  })

  it('つかえる ポイントより多いボタンは押せない', () => {
    render(<DepositPanel wallet={3} mode="young" onDeposit={vi.fn(async () => {})} />)
    expect(screen.getByRole('button', { name: '1こ' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '5こ' })).toBeDisabled()
  })

  it('おさないモードには数字の入力欄がなく、おおきいモードにはある', () => {
    const { unmount } = render(<DepositPanel wallet={3} mode="young" onDeposit={vi.fn(async () => {})} />)
    expect(screen.queryByLabelText('ちょきんする ポイント')).toBeNull()
    unmount()
    render(<DepositPanel wallet={3} mode="older" onDeposit={vi.fn(async () => {})} />)
    expect(screen.getByLabelText('ちょきんする ポイント')).toBeInTheDocument()
  })

  it('失敗したらメッセージを出し、また押せるようになる', async () => {
    const onDeposit = vi.fn(async () => {
      throw new Error('x')
    })
    render(<DepositPanel wallet={3} mode="young" onDeposit={onDeposit} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '1こ' })))
    expect(screen.getByText('ちょきん できなかったよ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1こ' })).toBeEnabled()
  })
})
