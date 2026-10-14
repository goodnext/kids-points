import { useState } from 'react'
import { CARD_SIZE } from '../../domain/stampcard'
import type { Transaction } from '../../domain/types'

export function StampCard({ cards, highlightId }: { cards: Transaction[][]; highlightId?: string }) {
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
          const className = ['stamp-cell', t ? 'filled' : '', t && t.id === highlightId ? 'pop' : ''].filter(Boolean).join(' ')
          return (
            <div key={i} className={className} aria-label={t ? 'スタンプ' : 'あき'} title={t?.memo}>
              {t ? (t.icon ?? '⭐') : i + 1}
            </div>
          )
        })}
      </div>
    </section>
  )
}
