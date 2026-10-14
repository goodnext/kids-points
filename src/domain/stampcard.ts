import { byTime } from './balance'
import type { Transaction } from './types'

export const CARD_SIZE = 20

export function stampCards(txs: Transaction[], childId: string): Transaction[][] {
  const stamps = txs.filter((t) => t.childId === childId && !t.voidedAt && t.type === 'stamp').sort(byTime)
  const cards: Transaction[][] = []
  for (let i = 0; i < stamps.length; i += CARD_SIZE) cards.push(stamps.slice(i, i + CARD_SIZE))
  if (cards.length === 0 || cards[cards.length - 1].length === CARD_SIZE) cards.push([])
  return cards
}

export function isCardCompletedBy(cards: Transaction[][], txId: string): boolean {
  return cards.some((c) => c.length === CARD_SIZE && c[CARD_SIZE - 1].id === txId)
}
