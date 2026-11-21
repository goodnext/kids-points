import { balancesOf, byTime } from './balance'
import type { Transaction } from './types'

export const CARD_SIZE = 20

// スタンプは pt 数と同じ数のマスを使う。2pt なら同じ記録が2マス続けて並ぶ
export function stampCells(txs: Transaction[], childId: string): Transaction[] {
  return txs
    .filter((t) => t.childId === childId && !t.voidedAt && t.type === 'stamp')
    .sort(byTime)
    .flatMap((t) => Array.from({ length: t.points }, () => t))
}

// おさいふに残っている pt 数だけ、新しいマスから順に「まだ つかっていない」とみなす。
// それより前のマス（ちょきん・つかう で おさいふから出た分）の数を返す
export function usedCellCount(txs: Transaction[], childId: string): number {
  const wallet = Math.max(0, balancesOf(txs, childId).wallet)
  return Math.max(0, stampCells(txs, childId).length - wallet)
}

export function stampCards(txs: Transaction[], childId: string): Transaction[][] {
  const cells = stampCells(txs, childId)
  const cards: Transaction[][] = []
  for (let i = 0; i < cells.length; i += CARD_SIZE) cards.push(cells.slice(i, i + CARD_SIZE))
  if (cards.length === 0 || cards[cards.length - 1].length === CARD_SIZE) cards.push([])
  return cards
}

export function isCardCompletedBy(cards: Transaction[][], txId: string): boolean {
  return cards.some((c) => c.length === CARD_SIZE && c[CARD_SIZE - 1].id === txId)
}
