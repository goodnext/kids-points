import type { Child, MenuItem, Settings, Transaction, TxType } from '../domain/types'
import { DEFAULT_SETTINGS, type Repo } from './repo'

export interface BackupFile {
  app: 'kids-points'
  version: 1
  exportedAt: string
  children: Child[]
  menuItems: MenuItem[]
  transactions: Transaction[]
  settings: Settings
}

export class BackupError extends Error {}

const TX_TYPES: TxType[] = ['opening', 'stamp', 'spend', 'deposit', 'withdraw', 'interest']
const DAY_MS = 24 * 60 * 60 * 1000
export const BACKUP_REMINDER_DAYS = 30

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isPositiveInt(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1
}

export async function exportBackup(repo: Repo): Promise<string> {
  const exportedAt = repo.now().toISOString()
  await repo.updateSettings({ lastBackupAt: exportedAt })
  const s = await repo.snapshot()
  const file: BackupFile = {
    app: 'kids-points',
    version: 1,
    exportedAt,
    children: s.children,
    menuItems: s.menuItems,
    transactions: s.transactions,
    settings: s.settings,
  }
  return JSON.stringify(file, null, 2)
}

export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('JSON として読めないファイルです')
  }
  if (!isObj(data) || data.app !== 'kids-points' || data.version !== 1) {
    throw new BackupError('このアプリのバックアップではありません')
  }
  const { children, menuItems, transactions, settings, exportedAt } = data
  if (!Array.isArray(children) || !Array.isArray(menuItems) || !Array.isArray(transactions) || !isObj(settings) || typeof exportedAt !== 'string') {
    throw new BackupError('ファイルの中身が足りません')
  }
  const childIds = new Set<string>()
  for (const c of children) {
    if (!isObj(c) || typeof c.id !== 'string' || typeof c.name !== 'string') throw new BackupError('こどものデータが壊れています')
    childIds.add(c.id)
  }
  for (const m of menuItems) {
    if (!isObj(m) || typeof m.id !== 'string' || typeof m.label !== 'string' || !isPositiveInt(m.points)) {
      throw new BackupError('メニューのデータが壊れています')
    }
  }
  for (const t of transactions) {
    if (
      !isObj(t) ||
      typeof t.id !== 'string' ||
      typeof t.childId !== 'string' ||
      !childIds.has(t.childId) ||
      !TX_TYPES.includes(t.type as TxType) ||
      !isPositiveInt(t.points) ||
      typeof t.at !== 'string' ||
      Number.isNaN(Date.parse(t.at))
    ) {
      throw new BackupError('きろくのデータが壊れています')
    }
  }
  return data as unknown as BackupFile
}

export async function importBackup(repo: Repo, file: BackupFile): Promise<void> {
  const db = repo.db
  await db.transaction('rw', [db.children, db.menuItems, db.transactions, db.kv], async () => {
    await Promise.all([db.children.clear(), db.menuItems.clear(), db.transactions.clear()])
    await db.children.bulkAdd(file.children)
    await db.menuItems.bulkAdd(file.menuItems)
    await db.transactions.bulkAdd(file.transactions)
    await db.kv.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, ...file.settings } })
  })
}

export function needsBackupReminder(settings: Settings, now: Date): boolean {
  if (!settings.lastBackupAt) return true
  return now.getTime() - Date.parse(settings.lastBackupAt) >= BACKUP_REMINDER_DAYS * DAY_MS
}
