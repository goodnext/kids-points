import { describe, expect, it } from 'vitest'
import { BackupError, exportBackup, importBackup, needsBackupReminder, parseBackup } from './backup'
import { KidsPointsDB } from './db'
import { newId } from './ids'
import { DEFAULT_SETTINGS, Repo } from './repo'

const now = () => new Date('2026-11-05T09:00')
const makeRepo = () => new Repo(new KidsPointsDB(`test-${newId()}`), now)

async function seeded() {
  const repo = makeRepo()
  await repo.saveChild({ id: 'c1', name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 })
  await repo.saveMenuItem({ id: 'm1', label: 'はみがき', icon: '🪥', points: 1, childIds: ['c1'], order: 0 })
  await repo.addTx({ childId: 'c1', type: 'opening', points: 30 })
  await repo.setPin('1234')
  return repo
}

describe('backup', () => {
  it('書き出したものを別のDBに読み込むと同じ内容になり、書き出し日時が残る', async () => {
    const src = await seeded()
    const text = await exportBackup(src)
    expect((await src.settings()).lastBackupAt).toBe(now().toISOString())

    const dst = makeRepo()
    await importBackup(dst, parseBackup(text))
    const [a, b] = [await src.snapshot(), await dst.snapshot()]
    expect(b.children).toEqual(a.children)
    expect(b.menuItems).toEqual(a.menuItems)
    expect(b.transactions).toEqual(a.transactions)
    expect(await dst.checkPin('1234')).toBe(true)
  })

  it('読み込みは今のデータを丸ごと置き換える', async () => {
    const src = await seeded()
    const text = await exportBackup(src)
    const dst = makeRepo()
    await dst.saveChild({ id: 'old', name: 'まえの子', avatar: '🐶', color: '#000', displayMode: 'young', order: 0 })
    await importBackup(dst, parseBackup(text))
    expect((await dst.snapshot()).children.map((c) => c.id)).toEqual(['c1'])
  })

  it('壊れたファイルや別アプリのファイルは BackupError', async () => {
    const good = JSON.parse(await exportBackup(await seeded()))
    const bad = [
      'これはJSONではない',
      JSON.stringify({ app: 'other', version: 1 }),
      JSON.stringify({ ...good, transactions: 'x' }),
      JSON.stringify({ ...good, transactions: [{ ...good.transactions[0], points: 1.5 }] }),
      JSON.stringify({ ...good, transactions: [{ ...good.transactions[0], type: 'steal' }] }),
      JSON.stringify({ ...good, transactions: [{ ...good.transactions[0], childId: 'nobody' }] }),
    ]
    for (const text of bad) expect(() => parseBackup(text)).toThrow(BackupError)
  })

  it('最後の書き出しから30日以上、または一度も書き出していなければリマインドする', () => {
    const base = new Date('2026-11-05T09:00')
    expect(needsBackupReminder({ ...DEFAULT_SETTINGS, lastBackupAt: null }, base)).toBe(true)
    expect(needsBackupReminder({ ...DEFAULT_SETTINGS, lastBackupAt: new Date('2026-10-07T09:00').toISOString() }, base)).toBe(false)
    expect(needsBackupReminder({ ...DEFAULT_SETTINGS, lastBackupAt: new Date('2026-10-06T09:00').toISOString() }, base)).toBe(true)
  })
})
