import { useState } from 'react'
import { CARD_SIZE } from '../../domain/stampcard'
import type { Transaction } from '../../domain/types'

export function StampCard({
  cards,
  highlightId,
  usedCount,
  onSelect,
}: {
  cards: Transaction[][]
  highlightId?: string
  // 最初からこの数のマスは、ちょきん・つかう で おさいふから出た分として うすく見せる
  usedCount: number
  onSelect: (tx: Transaction) => void
}) {
  const found = highlightId ? cards.findIndex((c) => c.some((t) => t.id === highlightId)) : -1
  const [index, setIndex] = useState(found >= 0 ? found : cards.length - 1)
  const shown = Math.min(index, cards.length - 1)
  const card = cards[shown]

  return (
    <section className="stamp-card" aria-label="スタンプカード">
      <div className="card-head">
        <button className="btn small" aria-label="まえの カード" disabled={shown === 0} onClick={() => setIndex(shown - 1)}>
          ◀
        </button>
        <span>{shown + 1}まいめ</span>
        <button className="btn small" aria-label="つぎの カード" disabled={shown >= cards.length - 1} onClick={() => setIndex(shown + 1)}>
          ▶
        </button>
      </div>
      <div className="stamp-grid">
        {Array.from({ length: CARD_SIZE }, (_, i) => {
          const t = card[i]
          if (!t) {
            return (
              <div key={i} className="stamp-cell" aria-label="あき">
                {i + 1}
              </div>
            )
          }
          const used = shown * CARD_SIZE + i < usedCount
          return (
            <button
              key={i}
              className={['stamp-cell filled', used ? 'used' : '', t.id === highlightId ? 'pop' : ''].filter(Boolean).join(' ')}
              aria-label={used ? 'つかった スタンプ' : 'スタンプ'}
              title={t.memo}
              onClick={() => onSelect(t)}
            >
              {t.icon ?? '⭐'}
            </button>
          )
        })}
      </div>
    </section>
  )
}
