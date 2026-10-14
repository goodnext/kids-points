import { useRef, useState } from 'react'
import type { DisplayMode } from '../../domain/types'
import { parsePoints } from '../../domain/validate'

export function DepositPanel({
  wallet,
  mode,
  onDeposit,
}: {
  wallet: number
  mode: DisplayMode
  onDeposit: (points: number) => Promise<void>
}) {
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState('')
  const [message, setMessage] = useState('')
  const typed = parsePoints(input)

  const run = async (points: number) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      await onDeposit(points)
      setInput('')
    } catch {
      setMessage('ちょきん できなかったよ')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <section className="deposit">
      <h2>ちょきんする</h2>
      <div className="row">
        {[1, 5].map((n) => (
          <button key={n} className="big-btn" disabled={busy || wallet < n} onClick={() => void run(n)}>
            {n}こ
          </button>
        ))}
        <button className="big-btn" disabled={busy || wallet < 1} onClick={() => void run(wallet)}>
          ぜんぶ
        </button>
      </div>
      {mode === 'older' && (
        <div className="row">
          <input className="num-input" inputMode="numeric" aria-label="ちょきんする ポイント" value={input} onChange={(e) => setInput(e.target.value)} />
          <button
            className="btn primary"
            disabled={busy || typed === null || typed > wallet}
            onClick={() => {
              if (typed !== null) void run(typed)
            }}
          >
            ちょきん
          </button>
        </div>
      )}
      {message && <p className="error">{message}</p>}
    </section>
  )
}
