// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { KidsPointsDB } from '../../storage/db'
import { newId } from '../../storage/ids'
import { Repo } from '../../storage/repo'
import { StoreProvider } from '../store'
import { ChildHome } from './ChildHome'

async function seed(name: string) {
  const repo = new Repo(new KidsPointsDB(name), () => new Date())
  await repo.saveChild({ id: 'c1', name: 'そら', avatar: '🐰', color: '#5cb8ff', displayMode: 'young', order: 0 })
  await repo.setPin('1234')
  await repo.addTx({ childId: 'c1', type: 'opening', points: 6 })
  await repo.addTx({ childId: 'c1', type: 'stamp', points: 1, icon: '🪥' })
  repo.db.close()
}

it('スタンプとコインを表示し、ちょきんするとちょきんばこに移る', async () => {
  const name = `real-${newId()}`
  await seed(name)
  const user = userEvent.setup()
  render(
    <StoreProvider dbNames={{ real: name, demo: `demo-${newId()}` }} initialMode="real">
      <ChildHome childId="c1" onBack={() => {}} onParent={() => {}} />
    </StoreProvider>,
  )
  expect(await screen.findAllByLabelText('スタンプ')).toHaveLength(1)
  expect(screen.getAllByLabelText('あき')).toHaveLength(19)
  expect(screen.getByLabelText('おさいふ コイン 7こ')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '5こ' }))
  expect(await screen.findByLabelText('ちょきんばこ コイン 5こ')).toBeInTheDocument()
  expect(screen.getByLabelText('おさいふ コイン 2こ')).toBeInTheDocument()
})
