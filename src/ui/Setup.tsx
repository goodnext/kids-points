import { useState } from 'react'
import { parsePoints } from '../domain/validate'
import { AVATARS, COLORS, DEFAULT_MENU } from '../storage/defaults'
import { newId } from '../storage/ids'
import { ChildForm, type ChildDraft } from './common/ChildForm'
import { HomeScreenGuide } from './common/HomeScreenGuide'
import { PinPad } from './common/PinPad'
import { useStore } from './store'

type Step = 'pin' | 'pinConfirm' | 'children' | 'guide'

const INITIAL: ChildDraft[] = [
  { name: '', avatar: AVATARS[3], color: COLORS[0], displayMode: 'older', opening: '' },
  { name: '', avatar: AVATARS[2], color: COLORS[1], displayMode: 'young', opening: '' },
]

function openingError(text: string): boolean {
  const t = text.trim()
  return t !== '' && t !== '0' && parsePoints(t) === null
}

export function Setup() {
  const { repo, reload } = useStore()
  const [step, setStep] = useState<Step>('pin')
  const [pin, setPin] = useState('')
  const [drafts, setDrafts] = useState(INITIAL)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const next = () => {
    if (drafts.some((d) => !d.name.trim())) return setError('なまえを入れてください')
    if (drafts.some((d) => openingError(d.opening))) return setError('いま貯まっているポイントは 0 以上の整数で入れてください')
    setError('')
    setStep('guide')
  }

  const finish = async () => {
    setSaving(true)
    const ids = drafts.map(() => newId())
    for (const [i, d] of drafts.entries()) {
      await repo.saveChild({ id: ids[i], name: d.name.trim(), avatar: d.avatar, color: d.color, displayMode: d.displayMode, order: i })
    }
    for (const [i, m] of DEFAULT_MENU.entries()) {
      await repo.saveMenuItem({ id: newId(), ...m, childIds: ids, order: i })
    }
    for (const [i, d] of drafts.entries()) {
      const points = parsePoints(d.opening)
      if (points !== null) await repo.addTx({ childId: ids[i], type: 'opening', points })
    }
    // PIN があることを「設定ずみ」の印にしているので、最後に保存する
    await repo.setPin(pin)
    await reload()
  }

  if (step === 'pin') {
    return (
      <PinPad
        title="おやの PIN をきめてください（4けた）"
        onSubmit={(p) => {
          setPin(p)
          setStep('pinConfirm')
          return true
        }}
      />
    )
  }
  if (step === 'pinConfirm') {
    return (
      <PinPad
        title="もういちど入れてください"
        onSubmit={(p) => {
          if (p !== pin) return false
          setStep('children')
          return true
        }}
        onCancel={() => setStep('pin')}
      />
    )
  }
  return (
    <div className="screen">
      <h1>はじめの せってい</h1>
      {step === 'children' ? (
        <>
          {drafts.map((d, i) => (
            <ChildForm
              key={i}
              label={i === 0 ? '1人め' : '2人め'}
              value={d}
              showOpening
              onChange={(v) => setDrafts(drafts.map((x, j) => (j === i ? v : x)))}
            />
          ))}
          {error && <p className="error">{error}</p>}
          <button className="btn primary" onClick={next}>
            つぎへ
          </button>
        </>
      ) : (
        <>
          <HomeScreenGuide />
          <div className="row">
            <button className="btn" onClick={() => setStep('children')}>
              もどる
            </button>
            <button className="btn primary" disabled={saving} onClick={() => void finish()}>
              はじめる
            </button>
          </div>
        </>
      )}
    </div>
  )
}
