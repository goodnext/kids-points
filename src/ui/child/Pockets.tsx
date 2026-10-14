import type { Balances, DisplayMode } from '../../domain/types'

const COIN_LIMIT = 20

function Coins({ label, count }: { label: string; count: number }) {
  const shown = Math.min(count, COIN_LIMIT)
  return (
    <div className="coins" aria-label={`${label} コイン ${count}こ`}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i}>🪙</span>
      ))}
      {count > COIN_LIMIT && <span className="more">+{count - COIN_LIMIT}</span>}
      {count === 0 && <span className="empty">からっぽ</span>}
    </div>
  )
}

function Amount({ points }: { points: number }) {
  return (
    <p className="amount">
      {points}pt <small>（{(points * 10).toLocaleString('ja-JP')}円）</small>
    </p>
  )
}

export function Pockets({
  balances,
  mode,
  projected,
  percent,
}: {
  balances: Balances
  mode: DisplayMode
  projected: { savings: number; points: number; blocked: boolean }
  percent: number
}) {
  return (
    <div className="pockets">
      <div className="pocket">
        <h2>👛 おさいふ</h2>
        {mode === 'young' ? <Coins label="おさいふ" count={balances.wallet} /> : <Amount points={balances.wallet} />}
      </div>
      <div className="pocket">
        <h2>🐷 ちょきんばこ</h2>
        {mode === 'young' ? (
          <Coins label="ちょきんばこ" count={balances.savings} />
        ) : (
          <>
            <Amount points={balances.savings} />
            {projected.blocked ? (
              <p className="hint">こんげつは ひきだしたので、りそくは おやすみ</p>
            ) : projected.points > 0 ? (
              <p className="hint">
                らいげつの りそく みこみ：{projected.savings}pt × {percent}% → {projected.points}pt
              </p>
            ) : (
              <p className="hint">ちょきんすると、まいつき {percent}% ふえるよ</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
