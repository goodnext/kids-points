// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { newId } from '../storage/ids'
import { App } from './App'
import { StoreProvider } from './store'

export function renderApp() {
  const id = newId()
  return render(
    <StoreProvider dbNames={{ real: `real-${id}`, demo: `demo-${id}` }} initialMode="real">
      <App />
    </StoreProvider>,
  )
}

export async function typePin(user: ReturnType<typeof userEvent.setup>, pin: string) {
  for (const d of pin) await user.click(screen.getByRole('button', { name: d }))
}

export async function setUp(user: ReturnType<typeof userEvent.setup>) {
  renderApp()
  await screen.findByText('おやの PIN をきめてください（4けた）')
  await typePin(user, '1234')
  await screen.findByText('もういちど入れてください')
  await typePin(user, '1234')
  const names = await screen.findAllByLabelText('なまえ（ニックネーム）')
  await user.type(names[0], 'あおい')
  await user.type(names[1], 'そら')
  await user.type(screen.getAllByLabelText('いま貯まっているポイント')[0], '30')
  await user.click(screen.getByRole('button', { name: 'つぎへ' }))
  await user.click(await screen.findByRole('button', { name: 'はじめる' }))
}

it('はじめの設定を終えるとトップに2人が並ぶ', async () => {
  const user = userEvent.setup()
  await setUp(user)
  expect(await screen.findByRole('button', { name: /あおい/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /そら/ })).toBeInTheDocument()
})

it('なまえが空なら先に進めない', async () => {
  const user = userEvent.setup()
  renderApp()
  await screen.findByText('おやの PIN をきめてください（4けた）')
  await typePin(user, '1234')
  await screen.findByText('もういちど入れてください')
  await typePin(user, '1234')
  await user.click(await screen.findByRole('button', { name: 'つぎへ' }))
  expect(screen.getByText('なまえを入れてください')).toBeInTheDocument()
})
