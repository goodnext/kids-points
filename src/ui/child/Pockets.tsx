import type { ProjectedInterest } from '../../domain/interest'
import type { Balances } from '../../domain/types'

function Amount({ points }: { points: number }) {
  return (
    <p className="amount">
      {points}pt <small>（{(points * 10).toLocaleString('ja-JP')}円）</small>
    </p>
  )
}

function InterestHint({ projected }: { projected: ProjectedInterest }) {
  const day = `${projected.payAt.getMonth() + 1}/${projected.payAt.getDate()}`
  if (projected.blocked) return <p className="hint">こんげつは ひきだしたので、{day} は ふえないよ</p>
  if (projected.points > 0) {
    return (
      <>
        <p className="interest-line">
          {day} に +{projected.points}pt ふえるよ
        </p>
        {projected.next && (
          <p className="hint">
            あと {projected.next.more}pt ちょきんすると +{projected.next.points}pt に なるよ
          </p>
        )}
      </>
    )
  }
  // 利率が0のときは何も書かない
  if (!projected.next) return null
  return <p className="hint">ちょきんすると、つぎの 1にちに ふえるよ</p>
}

export function Pockets({ balances, projected }: { balances: Balances; projected: ProjectedInterest }) {
  return (
    <div className="pockets">
      <section className="pocket" aria-label="つかえる ポイント">
        <h2>👛 つかえる ポイント</h2>
        <Amount points={balances.wallet} />
      </section>
      <section className="pocket" aria-label="ふえる ちょきん">
        <h2>🐷 ふえる ちょきん</h2>
        <Amount points={balances.savings} />
        <InterestHint projected={projected} />
      </section>
    </div>
  )
}
