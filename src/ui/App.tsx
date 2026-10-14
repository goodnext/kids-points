import { useState } from 'react'
import { hashPin } from '../storage/pin'
import { ChildHome } from './child/ChildHome'
import { PinPad } from './common/PinPad'
import { ParentHome } from './parent/ParentHome'
import { PinReset } from './PinReset'
import { Setup } from './Setup'
import { useStore } from './store'
import { Top } from './Top'

type Screen =
  | { name: 'top' }
  | { name: 'child'; childId: string; celebrateTxId?: string }
  | { name: 'pin' }
  | { name: 'pinReset' }
  | { name: 'parent' }

// スタンプのあと子どもの画面へ移ったとき、親がすぐ戻るなら PIN を入れ直さなくてよい時間。
// iPad を子どもに渡したあとで子どもが親メニューに入れないよう、短くしておく
const UNLOCK_MS = 20 * 1000

export function App() {
  const { snap, mode } = useStore()
  const [screen, setScreen] = useState<Screen>({ name: 'top' })
  const [unlockedUntil, setUnlockedUntil] = useState(0)

  if (!snap.settings.pinHash) return <Setup />

  const openParent = () => setScreen(Date.now() < unlockedUntil ? { name: 'parent' } : { name: 'pin' })
  const goTop = () => setScreen({ name: 'top' })

  return (
    <>
      {mode === 'demo' && <div className="demo-badge">デモ（PIN 0000）</div>}
      {screen.name === 'top' && (
        <Top
          onSelectChild={(childId) => setScreen({ name: 'child', childId })}
          onParent={openParent}
          onPinReset={() => setScreen({ name: 'pinReset' })}
        />
      )}
      {screen.name === 'child' && (
        <ChildHome
          key={`${screen.childId}-${screen.celebrateTxId ?? ''}`}
          childId={screen.childId}
          celebrateTxId={screen.celebrateTxId}
          onBack={goTop}
          onParent={openParent}
        />
      )}
      {screen.name === 'pin' && (
        <PinPad
          title="おやの PIN"
          onCancel={goTop}
          onSubmit={(pin) => {
            if (hashPin(pin) !== snap.settings.pinHash) return false
            setUnlockedUntil(Date.now() + UNLOCK_MS)
            setScreen({ name: 'parent' })
            return true
          }}
        />
      )}
      {screen.name === 'pinReset' && <PinReset onDone={goTop} />}
      {screen.name === 'parent' && (
        <ParentHome
          onExit={() => {
            setUnlockedUntil(0)
            goTop()
          }}
          onShowChild={(childId, celebrateTxId) => setScreen({ name: 'child', childId, celebrateTxId })}
        />
      )}
    </>
  )
}
