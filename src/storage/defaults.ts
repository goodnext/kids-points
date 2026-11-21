import type { Child, MenuItem } from '../domain/types'
import type { KidsPointsDB } from './db'
import { newId } from './ids'

export const AVATARS = ['🐶', '🐱', '🐰', '🦊', '🐼', '🐻', '🐸', '🦁', '🐧', '🦄']
export const COLORS = ['#ff8a5c', '#5cb8ff', '#62c47a', '#b38bff', '#f2b33d', '#ff7eb6']
export const MENU_ICONS = ['💯', '📝', '🍽️', '👟', '🧹', '📚', '🪥', '🧸', '👕', '🛁', '🌱', '🎹', '⚽', '💪', '⭐']

// 家で実際に使っているメニュー。olderOnly は「おおきい」表示の子だけに出す
export const DEFAULT_MENU: { label: string; icon: string; points: number; olderOnly?: boolean }[] = [
  { label: 'テスト 100てん', icon: '💯', points: 2, olderOnly: true },
  { label: 'テスト 90てん', icon: '📝', points: 1, olderOnly: true },
  { label: 'きゅうしょく ぜんぶ たべた', icon: '🍽️', points: 1 },
  { label: 'うわばき あらった', icon: '👟', points: 1 },
]

export function defaultMenuItems(children: Pick<Child, 'id' | 'displayMode'>[], makeId: (index: number) => string): MenuItem[] {
  return DEFAULT_MENU.map(({ olderOnly, ...m }) => ({
    ...m,
    childIds: children.filter((c) => !olderOnly || c.displayMode === 'older').map((c) => c.id),
  }))
    .filter((m) => m.childIds.length > 0)
    .map((m, i) => ({ id: makeId(i), ...m, order: i }))
}

// 最初の版で入れていた定番メニュー
const OLD_DEFAULT_LABELS = ['おてつだい', 'しゅくだい', 'はみがき', 'おかたづけ', 'おさらあらい']

// 定番メニューが最初の版のまま（親が手を入れていない）なら、家のメニューに入れ替える。入れ替えたら true
export async function replaceOldDefaultMenu(db: KidsPointsDB): Promise<boolean> {
  return db.transaction('rw', [db.children, db.menuItems], async () => {
    const [children, items] = await Promise.all([db.children.toArray(), db.menuItems.toArray()])
    const labels = items.map((m) => m.label).sort()
    if (children.length === 0 || labels.join('\n') !== [...OLD_DEFAULT_LABELS].sort().join('\n')) return false
    await db.menuItems.clear()
    await db.menuItems.bulkPut(defaultMenuItems(children.sort((a, b) => a.order - b.order), () => newId()))
    return true
  })
}
