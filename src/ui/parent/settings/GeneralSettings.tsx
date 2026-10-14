import { useState } from 'react'
import { parsePoints } from '../../../domain/validate'
import { isValidPin } from '../../../storage/pin'
import { useStore } from '../../store'

export function GeneralSettings() {
  const { repo, snap, reload } = useStore()
  const [rate, setRate] = useState(String(snap.settings.interestPercent))
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState('')
  const rateValue = rate.trim() === '0' ? 0 : parsePoints(rate)
  const rateValid = rateValue !== null && rateValue <= 100

  return (
    <section>
      <h2>そのほか</h2>
      <div className="row">
        <label>
          利率（月 %）
          <input className="num-input" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <button
          className="btn primary"
          disabled={!rateValid}
          onClick={async () => {
            if (rateValue === null) return
            await repo.updateSettings({ interestPercent: rateValue })
            await reload()
            setMessage('利率を変えました（これから計算する月から使われます）')
          }}
        >
          保存
        </button>
      </div>
      <div className="row">
        <label>
          新しい PIN（4けた）
          <input className="num-input" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} />
        </label>
        <button
          className="btn primary"
          disabled={!isValidPin(pin)}
          onClick={async () => {
            await repo.setPin(pin)
            setPin('')
            await reload()
            setMessage('PIN を変えました')
          }}
        >
          保存
        </button>
      </div>
      <label className="row">
        <input
          type="checkbox"
          checked={snap.settings.soundOn}
          onChange={async (e) => {
            await repo.updateSettings({ soundOn: e.target.checked })
            await reload()
          }}
        />
        効果音
      </label>
      {message && <p className="message">{message}</p>}
    </section>
  )
}
