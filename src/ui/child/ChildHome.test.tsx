// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { KidsPointsDB } from '../../storage/db'
import { newId } from '../../storage/ids'
import { Repo } from '../../storage/repo'
import { StoreProvider } from '../store'
import { ChildHome } from './ChildHome'

afterEach(() => {
  vi.useRealTimers()
})

async function seed(name: string) {
  const repo = new Repo(new KidsPointsDB(name), () => new Date())
  await repo.saveChild({ id: 'c1', name: 'そら', avatar: '🐰', color: '#5cb8ff', displayMode: 'young', order: 0 })
  await repo.saveChild({ id: 'c2', name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 1 })
  await repo.saveMenuItem({ id: 'm1', label: 'うわばき あらった', icon: '👟', points: 1, childIds: ['c1', 'c2'], order: 0 })
  await repo.saveMenuItem({ id: 'm2', label: 'テスト 100てん', icon: '💯', points: 2, childIds: ['c2'], order: 1 })
  await repo.setPin('1234')
  await repo.addTx({ childId: 'c1', type: 'opening', points: 6 })
  await repo.addTx({ childId: 'c1', type: 'stamp', points: 1, icon: '🪥' })
  repo.db.close()
}

async function renderChild(childId = 'c1') {
  const name = `real-${newId()}`
  await seed(name)
  render(
    <StoreProvider dbNames={{ real: name, demo: `demo-${newId()}` }} initialMode="real">
      <ChildHome childId={childId} onBack={() => {}} onParent={() => {}} />
    </StoreProvider>,
  )
  await screen.findAllByLabelText('あき')
}

function pocket(name: 'つかえる ポイント' | 'ふえる ちょきん') {
  return within(screen.getByRole('region', { name }))
}

it('スタンプと残高を表示し、ちょきんすると ふえる ちょきんに移る。下の子も pt と円で見せる', async () => {
  const user = userEvent.setup()
  await renderChild()
  expect(screen.getAllByLabelText('スタンプ')).toHaveLength(1)
  expect(screen.getAllByLabelText('あき')).toHaveLength(19)
  expect(pocket('つかえる ポイント').getByText('7pt')).toBeInTheDocument()
  expect(pocket('つかえる ポイント').getByText('（70円）')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '5こ' }))
  expect(await pocket('ふえる ちょきん').findByText('5pt')).toBeInTheDocument()
  expect(pocket('つかえる ポイント').getByText('2pt')).toBeInTheDocument()
})

it('自分の画面に出るのは、自分向けのメニューだけ', async () => {
  await renderChild('c1')
  expect(screen.getByRole('button', { name: /うわばき あらった/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /テスト 100てん/ })).not.toBeInTheDocument()
})

it('メニューを押すと PIN なしでスタンプが押され、まちがえたら とりけせる', async () => {
  const user = userEvent.setup()
  await renderChild()
  await user.click(screen.getByRole('button', { name: /うわばき あらった/ }))
  await waitFor(() => expect(screen.getAllByLabelText('スタンプ')).toHaveLength(2))
  expect(pocket('つかえる ポイント').getByText('8pt')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /まちがえた/ }))
  expect(await screen.findByText('とりけしたよ')).toBeInTheDocument()
  expect(screen.getAllByLabelText('スタンプ')).toHaveLength(1)
  expect(pocket('つかえる ポイント').getByText('7pt')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /まちがえた/ })).not.toBeInTheDocument()
})

it('2pt のメニューを押すと、スタンプが2こ増える', async () => {
  const user = userEvent.setup()
  await renderChild('c2')
  await user.click(screen.getByRole('button', { name: /テスト 100てん/ }))
  await waitFor(() => expect(screen.getAllByLabelText('スタンプ')).toHaveLength(2))
  expect(pocket('つかえる ポイント').getByText('2pt')).toBeInTheDocument()
})

it('カードのスタンプを押すと、最後のものでなくても消せる。やめる なら消えない', async () => {
  const user = userEvent.setup()
  await renderChild()
  await user.click(screen.getByRole('button', { name: /うわばき あらった/ }))
  await screen.findByRole('button', { name: /まちがえた/ })

  // 前からあった 🪥 のスタンプ（最後ではない）を押す
  await user.click(screen.getAllByLabelText('スタンプ')[0])
  expect(screen.getByRole('dialog', { name: 'スタンプを けす？' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'やめる' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getAllByLabelText('スタンプ')).toHaveLength(2)

  await user.click(screen.getAllByLabelText('スタンプ')[0])
  await user.click(screen.getByRole('button', { name: 'けす' }))
  expect(await screen.findByText('けしたよ')).toBeInTheDocument()
  expect(screen.getAllByLabelText('スタンプ')).toHaveLength(1)
  expect(screen.getByLabelText('スタンプ')).toHaveTextContent('👟')
  expect(pocket('つかえる ポイント').getByText('7pt')).toBeInTheDocument()
})

it('ちょきんして つかえる ポイントから出た分のスタンプは うすく表示し、押しても消せない', async () => {
  const user = userEvent.setup()
  await renderChild()
  await user.click(screen.getByRole('button', { name: 'ぜんぶ' }))
  expect(await screen.findByLabelText('つかった スタンプ')).toBeInTheDocument()
  expect(screen.queryByLabelText('スタンプ')).not.toBeInTheDocument()

  await user.click(screen.getByLabelText('つかった スタンプ'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByText('もう ちょきんしたり つかったりしたので けせないよ')).toBeInTheDocument()
  expect(screen.getByLabelText('つかった スタンプ')).toBeInTheDocument()
})

it('押してから30秒たつと、まちがえた ボタンは消える', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await renderChild()
  await user.click(screen.getByRole('button', { name: /うわばき あらった/ }))
  expect(await screen.findByRole('button', { name: /まちがえた/ })).toBeInTheDocument()
  act(() => {
    vi.advanceTimersByTime(30_000)
  })
  expect(screen.queryByRole('button', { name: /まちがえた/ })).not.toBeInTheDocument()
  expect(screen.getAllByLabelText('スタンプ')).toHaveLength(2)
})
