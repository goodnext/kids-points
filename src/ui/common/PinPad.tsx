import { useState } from 'react'

export function PinPad({
  title,
  onSubmit,
  onCancel,
}: {
  title: string
  onSubmit: (pin: string) => boolean
  onCancel?: () => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const press = (digit: string) => {
    if (pin.length >= 4) return
    const next = pin + digit
    setError(false)
    if (next.length < 4) {
      setPin(next)
      return
    }
    setPin('')
    if (!onSubmit(next)) setError(true)
  }

  return (
    <div className="screen center">
      <h2>{title}</h2>
      <div className={error ? 'pin-dots shake' : 'pin-dots'} aria-label={`${pin.length}けた にゅうりょくずみ`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < pin.length ? 'dot on' : 'dot'} />
        ))}
      </div>
      {error && <p className="error">ちがうよ</p>}
      <div className="pin-grid">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className="pin-key" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button className="pin-key" aria-label="けす" onClick={() => setPin(pin.slice(0, -1))}>
          ⌫
        </button>
        <button className="pin-key" onClick={() => press('0')}>
          0
        </button>
        {onCancel ? (
          <button className="pin-key small" onClick={onCancel}>
            もどる
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  )
}
