import { useState } from 'react'
import { DEMO_CHILD_IDS, DEMO_PIN } from '../../storage/demo'
import { useStore } from '../store'

export function DemoTab({ onExit, onShowChild }: { onExit: () => void; onShowChild: (childId: string) => void }) {
  const { mode, demoOffset, switchMode, advanceDemo, resetDemo } = useStore()
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<void>, after: () => void) => {
    setBusy(true)
    try {
      await action()
      after()
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'real') {
    return (
      <div>
        <p>LT などで見せるためのデモモードです。今のデータには影響しません。</p>
        <p>デモの PIN は {DEMO_PIN} です。</p>
        <button className="btn primary" disabled={busy} onClick={() => void run(() => switchMode('demo'), onExit)}>
          デモモードにする
        </button>
      </div>
    )
  }
  return (
    <div>
      <p>デモモード中です（{demoOffset}ヶ月 すすめています）。</p>
      <div className="row">
        <button className="btn primary" disabled={busy} onClick={() => void run(advanceDemo, () => onShowChild(DEMO_CHILD_IDS[0]))}>
          1ヶ月 すすめる
        </button>
        <button className="btn" disabled={busy} onClick={() => void run(resetDemo, () => {})}>
          デモを リセット
        </button>
        <button className="btn" disabled={busy} onClick={() => void run(() => switchMode('real'), onExit)}>
          ふだんのモードに もどる
        </button>
      </div>
    </div>
  )
}
