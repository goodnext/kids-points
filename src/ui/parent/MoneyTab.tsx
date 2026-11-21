import { useRef, useState } from 'react'
import { balancesOf } from '../../domain/balance'
import { parsePoints } from '../../domain/validate'
import { OpFailed } from '../../storage/repo'
import { useStore } from '../store'

export function MoneyTab({ childId, type }: { childId: string; type: 'spend' | 'withdraw' }) {
  const { repo, snap, reload } = useStore()
  const [points, setPoints] = useState('')
  const [memo, setMemo] = useState('')
  const [message, setMessage] = useState('')
  const busy = useRef(false)
  const b = balancesOf(snap.transactions, childId)
  const available = type === 'spend' ? b.wallet : b.savings
  const parsed = parsePoints(points)
  const verb = type === 'spend' ? 'つかう' : 'ひきだす'

  const submit = async () => {
    if (parsed === null || busy.current) return
    busy.current = true
    try {
      await repo.addTx({ childId, type, points: parsed, memo: memo.trim() || undefined })
      await reload()
      setPoints('')
      setMemo('')
      setMessage(type === 'spend' ? `${parsed}pt つかいました` : `${parsed}pt ひきだしました`)
    } catch (e) {
      setMessage(e instanceof OpFailed && e.reason === 'insufficient' ? 'ポイントが たりません' : 'できませんでした')
    } finally {
      busy.current = false
    }
  }

  return (
    <div>
      <p className="amount">
        {type === 'spend' ? '👛 つかえる ポイント' : '🐷 ふえる ちょきん'}：{available}pt <small>（{(available * 10).toLocaleString('ja-JP')}円）</small>
      </p>
      {type === 'withdraw' && <p className="note">ひきだすと、今月の利息はつきません。</p>}
      <div className="row">
        <input className="num-input" inputMode="numeric" aria-label="ポイント" placeholder="pt" value={points} onChange={(e) => setPoints(e.target.value)} />
        {type === 'spend' && <input aria-label="つかいみち" placeholder="なにに つかった？" value={memo} onChange={(e) => setMemo(e.target.value)} />}
        <button className="btn primary" disabled={parsed === null || parsed > available} onClick={() => void submit()}>
          {verb} を きろく
        </button>
      </div>
      {parsed !== null && parsed > available && <p className="error">ポイントが たりません</p>}
      {points.trim() !== '' && parsed === null && <p className="error">1以上の整数で入れてください</p>}
      {message && <p className="message">{message}</p>}
    </div>
  )
}
