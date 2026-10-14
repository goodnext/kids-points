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

function isStr(v: unknown): v is string {
  return typeof v === 'string'
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isIsoDate(v: unknown): v is string {
  return isStr(v) && !Number.isNaN(Date.parse(v))
}

function fail(message: string): never {
  throw new BackupError(message)
}

// 画面とルールが読む項目をすべて確かめる。ここを通ったものだけが今のデータを置き換える
export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    fail('JSON として読めないファイルです')
  }
  if (!isObj(data) || data.app !== 'kids-points' || data.version !== 1) fail('このアプリのバックアップではありません')
  const { children, menuItems, transactions, settings, exportedAt } = data
  if (!Array.isArray(children) || !Array.isArray(menuItems) || !Array.isArray(transactions) || !isObj(settings) || !isIsoDate(exportedAt)) {
    fail('ファイルの中身が足りません')
  }

  const childIds = new Set<string>()
  for (const c of children) {
    if (
      !isObj(c) ||
      !isStr(c.id) ||
      !isStr(c.name) ||
      !isStr(c.avatar) ||
      !isStr(c.color) ||
      (c.displayMode !== 'young' && c.displayMode !== 'older') ||
      !isNum(c.order) ||
      childIds.has(c.id)
    ) {
      fail('こどものデータが壊れています')
    }
    childIds.add(c.id)
  }

  const menuIds = new Set<string>()
  for (const m of menuItems) {
    if (
      !isObj(m) ||
      !isStr(m.id) ||
      !isStr(m.label) ||
      !isStr(m.icon) ||
      !isPositiveInt(m.points) ||
      !isNum(m.order) ||
      !Array.isArray(m.childIds) ||
      !m.childIds.every((id) => isStr(id) && childIds.has(id)) ||
      menuIds.has(m.id)
    ) {
      fail('メニューのデータが壊れています')
    }
    menuIds.add(m.id)
  }

  const txIds = new Set<string>()
  const normalized: Transaction[] = []
  for (const t of transactions) {
    if (
      !isObj(t) ||
      !isStr(t.id) ||
      txIds.has(t.id) ||
      !isStr(t.childId) ||
      !childIds.has(t.childId) ||
      !TX_TYPES.includes(t.type as TxType) ||
      !isPositiveInt(t.points) ||
      !isIsoDate(t.at) ||
      (t.type === 'interest' && !(isStr(t.period) && /^\d{4}-\d{2}$/.test(t.period))) ||
      (t.voidedAt !== undefined && !isIsoDate(t.voidedAt)) ||
      (t.memo !== undefined && !isStr(t.memo)) ||
      (t.icon !== undefined && !isStr(t.icon))
    ) {
      fail('きろくのデータが壊れています')
    }
    txIds.add(t.id)
    // 並び順を文字列比較で決めているので、日時は toISOString の形にそろえる
    normalized.push({
      ...(t as unknown as Transaction),
      at: new Date(t.at).toISOString(),
      ...(t.voidedAt !== undefined ? { voidedAt: new Date(t.voidedAt as string).toISOString() } : {}),
    })
  }

  const { interestPercent, soundOn, pinHash, lastBackupAt } = settings
  if (
    !isNum(interestPercent) ||
    !Number.isInteger(interestPercent) ||
    interestPercent < 0 ||
    interestPercent > 100 ||
    typeof soundOn !== 'boolean' ||
    !(pinHash === null || isStr(pinHash)) ||
    !(lastBackupAt === null || isIsoDate(lastBackupAt))
  ) {
    fail('せっていのデータが壊れています')
  }

  return {
    app: 'kids-points',
    version: 1,
    exportedAt,
    children: children as Child[],
    menuItems: menuItems as MenuItem[],
    transactions: normalized,
    settings: { interestPercent, soundOn, pinHash, lastBackupAt } as Settings,
  }
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
