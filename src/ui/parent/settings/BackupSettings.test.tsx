// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { KidsPointsDB } from '../../../storage/db'
import { newId } from '../../../storage/ids'
import { Repo } from '../../../storage/repo'
import { StoreProvider } from '../../store'
import { BackupSettings } from './BackupSettings'

vi.mock('../../../storage/backup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../storage/backup')>()
  return { ...actual, importBackup: vi.fn(async () => Promise.reject(new Error('BulkError'))) }
})

it('読み込みに失敗したらメッセージを出し、確認カードを閉じる', async () => {
  const name = `real-${newId()}`
  const repo = new Repo(new KidsPointsDB(name), () => new Date())
  await repo.saveChild({ id: 'c1', name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 })
  await repo.setPin('1234')
  const { exportBackup } = await import('../../../storage/backup')
  const text = await exportBackup(repo)
  repo.db.close()

  const user = userEvent.setup()
  const { container } = render(
    <StoreProvider dbNames={{ real: name, demo: `demo-${newId()}` }} initialMode="real">
      <BackupSettings />
    </StoreProvider>,
  )
  await screen.findByRole('button', { name: '書き出す' })
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File([text], 'backup.json', { type: 'application/json' })] } })
  await user.click(await screen.findByRole('button', { name: '置き換える' }))
  expect(await screen.findByText('読み込めませんでした。いまのデータはそのままです')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '置き換える' })).toBeNull()
})
