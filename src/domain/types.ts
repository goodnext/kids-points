export type MonthKey = string // 'YYYY-MM'
export type DisplayMode = 'young' | 'older'

export interface Child {
  id: string
  name: string
  avatar: string
  color: string
  displayMode: DisplayMode
  order: number
}

export interface MenuItem {
  id: string
  label: string
  icon: string
  points: number
  childIds: string[]
  order: number
}

export interface Settings {
  pinHash: string | null
  interestPercent: number
  soundOn: boolean
  lastBackupAt: string | null
}

export type TxType = 'opening' | 'stamp' | 'spend' | 'deposit' | 'withdraw' | 'interest'

export interface Transaction {
  id: string
  childId: string
  type: TxType
  points: number
  at: string // ISO 8601（toISOString）
  memo?: string
  menuItemId?: string
  icon?: string
  period?: MonthKey // interest のみ
  voidedAt?: string
}

export interface Balances {
  wallet: number
  savings: number
}
