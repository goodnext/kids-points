// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { newId } from '../../storage/ids'
import { StoreProvider, useStore } from '../store'
import { DemoTab } from './DemoTab'

function Offset() {
  const { demoOffset, mode } = useStore()
  return (
    <p>
      {mode}:{demoOffset}
    </p>
  )
}

it('デモで1ヶ月すすめると月がずれ、最初の子の画面を開く。リセットで0に戻る', async () => {
  const user = userEvent.setup()
  const onShowChild = vi.fn()
  render(
    <StoreProvider dbNames={{ real: `real-${newId()}`, demo: `demo-${newId()}` }} initialMode="demo">
      <Offset />
      <DemoTab onExit={() => {}} onShowChild={onShowChild} />
    </StoreProvider>,
  )
  expect(await screen.findByText('demo:0')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '1ヶ月 すすめる' }))
  expect(await screen.findByText('demo:1')).toBeInTheDocument()
  expect(onShowChild).toHaveBeenCalledWith('demo-aoi')
  await user.click(screen.getByRole('button', { name: 'デモを リセット' }))
  expect(await screen.findByText('demo:0')).toBeInTheDocument()
})
