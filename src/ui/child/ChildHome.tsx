import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { balancesOf } from '../../domain/balance'
import { monthOutcome, projectedInterest, type MonthOutcome } from '../../domain/interest'
import { monthKey, prevMonth } from '../../domain/month'
import { isCardCompletedBy, stampCards, usedCellCount } from '../../domain/stampcard'
import type { MenuItem, Transaction } from '../../domain/types'
import { checkVoidStamp } from '../../domain/undo'
import { OpFailed } from '../../storage/repo'
import { Overlay } from '../common/Overlay'
import { playSound } from '../sound'
import { useStore } from '../store'
import { DepositPanel } from './DepositPanel'
import { Pockets } from './Pockets'
import { StampCard } from './StampCard'

// 子どもが自分で押したスタンプを「まちがえた」で取り消せる時間
const UNDO_MS = 30 * 1000
const USED_MESSAGE = 'もう ちょきんしたり つかったりしたので けせないよ'

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
  const [highlightId, setHighlightId] = useState(celebrateTxId)
  const [complete, setComplete] = useState(() => (celebrateTxId ? isCardCompletedBy(cards, celebrateTxId) : false))
  const [justStamped, setJustStamped] = useState<Transaction | null>(null)
  const [removing, setRemoving] = useState<Transaction | null>(null)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [outcome, setOutcome] = useState<MonthOutcome | null>(null)
  const outcomeChecked = useRef(false)
  const busy = useRef(false)
  const undoTimer = useRef<number | undefined>(undefined)
  const soundOn = snap.settings.soundOn

  useEffect(() => {
    if (celebrateTxId) playSound(complete ? 'fanfare' : 'stamp', soundOn)
    // 開いたときに1回だけ鳴らす
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => window.clearTimeout(undoTimer.current), [])

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
  const menu = snap.menuItems.filter((m) => m.childIds.includes(childId))

  const closeUndo = () => {
    window.clearTimeout(undoTimer.current)
    setJustStamped(null)
  }

  const stamp = async (m: MenuItem) => {
    if (busy.current) return
    busy.current = true
    closeUndo()
    setNotice(null)
    try {
      const tx = await repo.addTx({ childId, type: 'stamp', points: m.points, memo: m.label, icon: m.icon, menuItemId: m.id })
      const done = isCardCompletedBy(stampCards([...txs, tx], childId), tx.id)
      playSound(done ? 'fanfare' : 'stamp', soundOn)
      await reload()
      setHighlightId(tx.id)
      setComplete(done)
      setJustStamped(tx)
      undoTimer.current = window.setTimeout(() => setJustStamped(null), UNDO_MS)
    } catch {
      setNotice({ text: 'おせなかったよ', error: true })
    } finally {
      busy.current = false
    }
  }

  // まちがえた ボタンとカードのスタンプから、指定したスタンプを消す
  const removeStamp = async (t: Transaction, done: string) => {
    if (busy.current) return
    busy.current = true
    closeUndo()
    setRemoving(null)
    try {
      await repo.voidStamp(t.id)
      await reload()
      if (t.id === highlightId) {
        setHighlightId(undefined)
        setComplete(false)
      }
      setNotice({ text: done })
    } catch (e) {
      await reload()
      const used = e instanceof OpFailed && e.reason === 'used'
      setNotice({ text: used ? USED_MESSAGE : 'けせなかったよ', error: true })
    } finally {
      busy.current = false
    }
  }

  // カードのスタンプを押したとき。つかった分なら確認を出さずに、消せないことを伝える
  const selectStamp = (t: Transaction) => {
    const check = checkVoidStamp(txs, t.id)
    if (check.ok) return setRemoving(t)
    closeUndo()
    setNotice({ text: check.reason === 'used' ? USED_MESSAGE : 'けせなかったよ', error: true })
  }

  const deposit = async (points: number) => {
    closeUndo()
    setNotice(null)
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
      {menu.length > 0 && (
        <section className="done-panel" aria-label="できたこと">
          <div className="done-grid">
            {menu.map((m) => (
              <button key={m.id} className="done-btn" onClick={() => void stamp(m)}>
                <span className="done-icon">{m.icon}</span>
                <span className="done-label">{m.label}</span>
                <span className="done-points">+{m.points}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="done-status" aria-live="polite">
        {justStamped ? (
          <>
            <span>
              {justStamped.icon} {justStamped.memo} を おしたよ
            </span>
            <button className="btn small" onClick={() => void removeStamp(justStamped, 'とりけしたよ')}>
              ↩ まちがえた
            </button>
          </>
        ) : (
          notice && <span className={notice.error ? 'error' : 'message'}>{notice.text}</span>
        )}
      </div>
      <div className="child-grid">
        {/* 押したスタンプのあるカードを開くよう、押すたびに作り直す */}
        <StampCard
          key={highlightId ?? ''}
          cards={cards}
          highlightId={highlightId}
          usedCount={usedCellCount(txs, childId)}
          onSelect={selectStamp}
        />
        <div>
          <Pockets balances={balances} projected={projected} />
          <DepositPanel wallet={balances.wallet} mode={child.displayMode} onDeposit={deposit} />
        </div>
      </div>
      {removing && (
        <Overlay
          emoji={removing.icon ?? '⭐'}
          title="スタンプを けす？"
          onClose={() => setRemoving(null)}
          actions={
            <div className="row center-row">
              <button className="btn" onClick={() => setRemoving(null)}>
                やめる
              </button>
              <button className="btn danger" onClick={() => void removeStamp(removing, 'けしたよ')}>
                けす
              </button>
            </div>
          }
        >
          <p>
            {removing.memo ?? 'スタンプ'}（{new Date(removing.at).getMonth() + 1}/{new Date(removing.at).getDate()}）
            {removing.points > 1 && ` ・ ${removing.points}こ ぶん`}
          </p>
        </Overlay>
      )}
      {complete && (
        <Overlay emoji="🏆" title="カード コンプリート！" onClose={() => setComplete(false)}>
          <p>20こ あつめたよ！ つぎの カードに すすむよ</p>
        </Overlay>
      )}
      {outcome?.kind === 'interest' && (
        <Overlay emoji="🐷✨" title="ふえたよ！" onClose={() => setOutcome(null)}>
          <p className="big-number">+{outcome.points}pt</p>
          <p>ふえる ちょきんに りそくが ついたよ</p>
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
