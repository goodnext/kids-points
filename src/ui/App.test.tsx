// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { KidsPointsDB } from '../storage/db'
import { newId } from '../storage/ids'
import { Repo } from '../storage/repo'
import { App } from './App'
import { StoreProvider } from './store'

export function renderApp(id = newId()) {
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

it('親がスタンプを押すと子どもの画面にスタンプが出て、とりけしでは誰の何かを表示する', async () => {
  const user = userEvent.setup()
  await setUp(user)
  await user.click(await screen.findByRole('button', { name: 'おやのメニュー' }))
  await typePin(user, '1234')
  await user.click(await screen.findByRole('button', { name: /きゅうしょく/ }))

  expect(await screen.findAllByLabelText('スタンプ')).toHaveLength(1)
  expect(screen.getByText(/31pt/)).toBeInTheDocument()

  // 5分以内なら PIN なしで親メニューに戻れる
  await user.click(screen.getByRole('button', { name: 'おやのメニュー' }))
  await user.click(await screen.findByRole('button', { name: 'とりけし' }))
  expect(await screen.findByText('あおい：きゅうしょく ぜんぶ たべた スタンプ 1pt')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'これを とりけす' }))
  expect(await screen.findByText('「あおい：きゅうしょく ぜんぶ たべた スタンプ 1pt」を とりけしました')).toBeInTheDocument()
})

it('つかう で残高より多いと押せず、正しい値なら減る', async () => {
  const user = userEvent.setup()
  await setUp(user)
  await user.click(await screen.findByRole('button', { name: 'おやのメニュー' }))
  await typePin(user, '1234')
  await user.click(await screen.findByRole('button', { name: 'つかう' }))
  const input = screen.getByLabelText('ポイント')
  await user.type(input, '31')
  expect(screen.getByRole('button', { name: 'つかう を きろく' })).toBeDisabled()
  expect(screen.getByText('ポイントが たりません')).toBeInTheDocument()
  await user.clear(input)
  await user.type(input, '１０')
  await user.type(screen.getByLabelText('つかいみち'), 'おかし')
  await user.click(screen.getByRole('button', { name: 'つかう を きろく' }))
  expect(await screen.findByText('10pt つかいました')).toBeInTheDocument()
  expect(screen.getByText(/つかえる ポイント：20pt/)).toBeInTheDocument()
})

it('とりけし を連打しても1件だけ取り消す', async () => {
  const user = userEvent.setup()
  await setUp(user)
  await user.click(await screen.findByRole('button', { name: 'おやのメニュー' }))
  await typePin(user, '1234')
  await user.click(await screen.findByRole('button', { name: /きゅうしょく/ }))
  await user.click(await screen.findByRole('button', { name: 'おやのメニュー' }))
  await user.click(await screen.findByRole('button', { name: 'とりけし' }))
  const btn = await screen.findByRole('button', { name: 'これを とりけす' })
  expect(screen.getByText('あおい：きゅうしょく ぜんぶ たべた スタンプ 1pt')).toBeInTheDocument()
  fireEvent.click(btn)
  fireEvent.click(btn)
  expect(await screen.findByText('「あおい：きゅうしょく ぜんぶ たべた スタンプ 1pt」を とりけしました')).toBeInTheDocument()
  // 2回目のタップで、見せていない開始残高まで取り消されていないこと
  expect(await screen.findByText('あおい：はじめのポイント 30pt')).toBeInTheDocument()
})

it('スタンプのあと20秒たつと、鍵からは PIN なしで親メニューに入れない', async () => {
  const user = userEvent.setup()
  await setUp(user)
  await user.click(await screen.findByRole('button', { name: 'おやのメニュー' }))
  await typePin(user, '1234')
  await user.click(await screen.findByRole('button', { name: /きゅうしょく/ }))
  await screen.findAllByLabelText('スタンプ')
  const later = Date.now() + 21_000
  const spy = vi.spyOn(Date, 'now').mockReturnValue(later)
  await user.click(screen.getByRole('button', { name: 'おやのメニュー' }))
  expect(await screen.findByText('おやの PIN')).toBeInTheDocument()
  spy.mockRestore()
})

it('トップから子どもを選ぶと、PIN なしで自分のメニューを押せる。テストは上の子だけ', async () => {
  const user = userEvent.setup()
  await setUp(user)
  await user.click(await screen.findByRole('button', { name: /そら/ }))
  expect(await screen.findByRole('button', { name: /うわばき あらった/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /テスト/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /きゅうしょく/ }))
  expect(await screen.findAllByLabelText('スタンプ')).toHaveLength(1)
  expect(screen.queryByText('おやの PIN')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '◀ もどる' }))
  await user.click(await screen.findByRole('button', { name: /あおい/ }))
  expect(await screen.findByRole('button', { name: /テスト 100てん/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /テスト 90てん/ })).toBeInTheDocument()
})

it('最初の版のメニューのままなら、開いたときに家のメニューに入れ替わる', async () => {
  const id = newId()
  const repo = new Repo(new KidsPointsDB(`real-${id}`), () => new Date())
  await repo.saveChild({ id: 'c1', name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 })
  await repo.saveChild({ id: 'c2', name: 'そら', avatar: '🐰', color: '#5cb8ff', displayMode: 'young', order: 1 })
  const old = ['おてつだい', 'しゅくだい', 'はみがき', 'おかたづけ', 'おさらあらい']
  for (const [i, label] of old.entries()) {
    await repo.saveMenuItem({ id: `old${i}`, label, icon: '🧹', points: 1, childIds: ['c1', 'c2'], order: i })
  }
  await repo.setPin('1234')
  repo.db.close()

  const user = userEvent.setup()
  renderApp(id)
  await user.click(await screen.findByRole('button', { name: /あおい/ }))
  expect(await screen.findByRole('button', { name: /テスト 100てん/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /おてつだい/ })).not.toBeInTheDocument()
})
