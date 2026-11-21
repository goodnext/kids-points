import { describe, expect, it } from 'vitest'
import type { Child } from '../domain/types'
import { KidsPointsDB } from './db'
import { defaultMenuItems, replaceOldDefaultMenu } from './defaults'
import { newId } from './ids'

const older: Child = { id: 'big', name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 }
const young: Child = { id: 'small', name: 'そら', avatar: '🐰', color: '#5cb8ff', displayMode: 'young', order: 1 }
const OLD_LABELS = ['おてつだい', 'しゅくだい', 'はみがき', 'おかたづけ', 'おさらあらい']

function menuFor(items: ReturnType<typeof defaultMenuItems>, childId: string) {
  return items.filter((m) => m.childIds.includes(childId)).map((m) => [m.label, m.points])
}

describe('defaultMenuItems', () => {
  it('テストは おおきい表示の子だけ、給食と上履きは2人とも', () => {
    const items = defaultMenuItems([older, young], (i) => `m${i}`)
    expect(menuFor(items, 'big')).toEqual([
      ['テスト 100てん', 2],
      ['テスト 90てん', 1],
      ['きゅうしょく ぜんぶ たべた', 1],
      ['うわばき あらった', 1],
    ])
    expect(menuFor(items, 'small')).toEqual([
      ['きゅうしょく ぜんぶ たべた', 1],
      ['うわばき あらった', 1],
    ])
    expect(items.map((m) => m.order)).toEqual([0, 1, 2, 3])
  })

  it('対象の子がいないメニューは作らない', () => {
    const items = defaultMenuItems([young], (i) => `m${i}`)
    expect(items.map((m) => m.label)).toEqual(['きゅうしょく ぜんぶ たべた', 'うわばき あらった'])
  })
})

describe('replaceOldDefaultMenu', () => {
  async function seed(labels: string[]) {
    const db = new KidsPointsDB(`test-${newId()}`)
    await db.children.bulkPut([older, young])
    await db.menuItems.bulkPut(labels.map((label, i) => ({ id: `old${i}`, label, icon: '🧹', points: 1, childIds: ['big', 'small'], order: i })))
    return db
  }

  it('最初に入れたメニューのままなら、家のメニューに入れ替える', async () => {
    const db = await seed(OLD_LABELS)
    expect(await replaceOldDefaultMenu(db)).toBe(true)
    const items = (await db.menuItems.toArray()).sort((a, b) => a.order - b.order)
    expect(menuFor(items, 'big')).toHaveLength(4)
    expect(menuFor(items, 'small')).toHaveLength(2)
    // 2回目は何もしない
    expect(await replaceOldDefaultMenu(db)).toBe(false)
  })

  it('親がメニューを変えていたら、さわらない', async () => {
    const db = await seed([...OLD_LABELS.slice(0, 4), 'うわばき'])
    expect(await replaceOldDefaultMenu(db)).toBe(false)
    expect((await db.menuItems.toArray()).map((m) => m.label).sort()).toEqual([...OLD_LABELS.slice(0, 4), 'うわばき'].sort())
  })
})
