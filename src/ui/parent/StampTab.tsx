import { useRef, useState } from 'react'
import { parsePoints } from '../../domain/validate'
import { playSound } from '../sound'
import { useStore } from '../store'

export function StampTab({ childId, onStamped }: { childId: string; onStamped: (childId: string, txId: string) => void }) {
  const { repo, snap, reload } = useStore()
  const [points, setPoints] = useState('')
  const [memo, setMemo] = useState('')
  const [message, setMessage] = useState('')
  const busy = useRef(false)
  const menu = snap.menuItems.filter((m) => m.childIds.includes(childId))
  const special = parsePoints(points)

  const stamp = async (input: { points: number; memo: string; icon: string; menuItemId?: string }) => {
    if (busy.current) return
    busy.current = true
    try {
      const tx = await repo.addTx({ childId, type: 'stamp', ...input })
      playSound('stamp', snap.settings.soundOn)
      await reload()
      onStamped(childId, tx.id)
    } catch {
      setMessage('スタンプを おせませんでした')
    } finally {
      busy.current = false
    }
  }

  return (
    <div>
      <h2>ていばん</h2>
      {menu.length === 0 && <p>ていばんメニューがありません。せってい から追加してください。</p>}
      <div className="menu-grid">
        {menu.map((m) => (
          <button key={m.id} className="menu-btn" onClick={() => void stamp({ points: m.points, memo: m.label, icon: m.icon, menuItemId: m.id })}>
            <span className="menu-icon">{m.icon}</span>
            {m.label}
            <small>{m.points}pt</small>
          </button>
        ))}
      </div>
      <h2>とくべつスタンプ</h2>
      <div className="row">
        <input className="num-input" inputMode="numeric" aria-label="とくべつ ポイント" placeholder="pt" value={points} onChange={(e) => setPoints(e.target.value)} />
        <input aria-label="とくべつ メモ" placeholder="なにが できた？" value={memo} onChange={(e) => setMemo(e.target.value)} />
        <button
          className="btn primary"
          disabled={special === null}
          onClick={() => {
            if (special !== null) void stamp({ points: special, memo: memo.trim() || 'とくべつ', icon: '🌟' })
          }}
        >
          おす
        </button>
      </div>
      {points.trim() !== '' && special === null && <p className="error">1以上の整数で入れてください</p>}
      {message && <p className="error">{message}</p>}
    </div>
  )
}
