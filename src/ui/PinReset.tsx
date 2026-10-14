import { useState } from 'react'
import { parsePoints } from '../domain/validate'
import { PinPad } from './common/PinPad'
import { useStore } from './store'

const twoDigit = () => 10 + Math.floor(Math.random() * 90)

export function PinReset({ onDone }: { onDone: () => void }) {
  const { repo, reload } = useStore()
  const [question] = useState(() => ({ a: twoDigit(), b: twoDigit() }))
  const [answer, setAnswer] = useState('')
  const [passed, setPassed] = useState(false)
  const [error, setError] = useState(false)

  if (passed) {
    return (
      <PinPad
        title="あたらしい PIN（4けた）"
        onSubmit={(pin) => {
          void repo.setPin(pin).then(reload).then(onDone)
          return true
        }}
        onCancel={onDone}
      />
    )
  }
  return (
    <div className="screen center">
      <h2>PIN の再設定</h2>
      <p>おとなの人が答えてください</p>
      <p className="question">
        {question.a} + {question.b} = ?
      </p>
      <input className="num-input" inputMode="numeric" aria-label="こたえ" value={answer} onChange={(e) => setAnswer(e.target.value)} />
      {error && <p className="error">ちがいます</p>}
      <div className="row">
        <button className="btn" onClick={onDone}>
          もどる
        </button>
        <button
          className="btn primary"
          onClick={() => {
            if (parsePoints(answer) === question.a + question.b) setPassed(true)
            else setError(true)
          }}
        >
          つぎへ
        </button>
      </div>
    </div>
  )
}
