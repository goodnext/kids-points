import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { balancesOf } from '../../domain/balance'
import { monthOutcome, projectedInterest, type MonthOutcome } from '../../domain/interest'
import { monthKey, prevMonth } from '../../domain/month'
import { isCardCompletedBy, stampCards } from '../../domain/stampcard'
import { Overlay } from '../common/Overlay'
import { playSound } from '../sound'
import { useStore } from '../store'
import { DepositPanel } from './DepositPanel'
import { Pockets } from './Pockets'
import { StampCard } from './StampCard'

export function ChildHome({
  childId,
  celebrateTxId,
  onBack,
  onParent,
}: {
  childId: string
  celebrateTxId?: string
  onBack: () => void
  onParent: () => void
}) {
  const { repo, snap, reload } = useStore()
  const txs = snap.transactions
  const child = snap.children.find((c) => c.id === childId)
  const cards = useMemo(() => stampCards(txs, childId), [txs, childId])
  const now = repo.now()
  const lastMonth = prevMonth(monthKey(now))
  const [celebrate, setCelebrate] = useState<'stamp' | 'complete' | null>(() =>
    celebrateTxId ? (isCardCompletedBy(cards, celebrateTxId) ? 'complete' : 'stamp') : null,
  )
  const [outcome, setOutcome] = useState<MonthOutcome | null>(null)
  const outcomeChecked = useRef(false)
  const soundOn = snap.settings.soundOn

  useEffect(() => {
    if (celebrate) playSound(celebrate === 'complete' ? 'fanfare' : 'stamp', soundOn)
    // 開いたときに1回だけ鳴らす
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 月が変わって初めて開いたときに、前月の結果（利息 or おやすみ）を見せる
  useEffect(() => {
    if (outcomeChecked.current || celebrateTxId) return
    outcomeChecked.current = true
    if (snap.seen[childId] === lastMonth) return
    const result = monthOutcome(txs, childId, lastMonth)
    if (result.kind !== 'none') {
      setOutcome(result)
      playSound(result.kind === 'interest' ? 'coin' : 'stamp', soundOn)
    }
    void repo.markSeen(childId, lastMonth).then(reload)
  }, [celebrateTxId, childId, lastMonth, reload, repo, snap.seen, soundOn, txs])

  if (!child) {
    return (
      <div className="screen">
        <button className="btn" onClick={onBack}>
          ◀ もどる
        </button>
      </div>
    )
  }

  const balances = balancesOf(txs, childId)
  const projected = projectedInterest(txs, childId, snap.settings.interestPercent, now)
  const deposit = async (points: number) => {
    await repo.addTx({ childId, type: 'deposit', points })
    playSound('coin', soundOn)
    await reload()
  }

  return (
    <div className="screen" style={{ '--child-color': child.color } as CSSProperties}>
      <header className="child-header">
        <button className="btn" onClick={onBack}>
          ◀ もどる
        </button>
        <h1>
          <span className="child-avatar small">{child.avatar}</span>
          {child.name}
        </h1>
        <button className="lock-btn static" aria-label="おやのメニュー" onClick={onParent}>
          🔒
        </button>
      </header>
      <div className="child-grid">
        <StampCard cards={cards} highlightId={celebrate ? celebrateTxId : undefined} />
        <div>
          <Pockets balances={balances} mode={child.displayMode} projected={projected} percent={snap.settings.interestPercent} />
          <DepositPanel wallet={balances.wallet} mode={child.displayMode} onDeposit={deposit} />
        </div>
      </div>
      {celebrate === 'complete' && (
        <Overlay emoji="🏆" title="カード コンプリート！" onClose={() => setCelebrate(null)}>
          <p>20こ あつめたよ！ つぎの カードに すすむよ</p>
        </Overlay>
      )}
      {outcome?.kind === 'interest' && (
        <Overlay emoji="🐷✨" title="ふえたよ！" onClose={() => setOutcome(null)}>
          <p className="big-number">+{outcome.points}pt</p>
          <p>ちょきんばこに りそくが ついたよ</p>
        </Overlay>
      )}
      {outcome?.kind === 'rest' && (
        <Overlay emoji="😴" title="こんげつは おやすみ" onClose={() => setOutcome(null)}>
          <p>ひきだしたから、りそくは つかなかったよ</p>
        </Overlay>
      )}
    </div>
  )
}
