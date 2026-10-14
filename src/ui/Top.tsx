import { useRef } from 'react'
import { useStore } from './store'

const LONG_PRESS_MS = 1500

export function Top({
  onSelectChild,
  onParent,
  onPinReset,
}: {
  onSelectChild: (childId: string) => void
  onParent: () => void
  onPinReset: () => void
}) {
  const { snap } = useStore()
  const timer = useRef<number | undefined>(undefined)
  const longPressed = useRef(false)

  const startPress = () => {
    longPressed.current = false
    timer.current = window.setTimeout(() => {
      longPressed.current = true
      onPinReset()
    }, LONG_PRESS_MS)
  }
  const endPress = () => window.clearTimeout(timer.current)

  return (
    <div className="screen">
      <button
        className="lock-btn"
        aria-label="おやのメニュー"
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onClick={() => {
          if (!longPressed.current) onParent()
        }}
      >
        🔒
      </button>
      <h1 className="title">だれの ページ？</h1>
      <div className="child-picker">
        {snap.children.map((c) => (
          <button key={c.id} className="child-btn" style={{ background: c.color }} onClick={() => onSelectChild(c.id)}>
            <span className="child-avatar">{c.avatar}</span>
            <span className="child-name">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
