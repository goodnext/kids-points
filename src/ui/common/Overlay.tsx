import type { ReactNode } from 'react'

export function Overlay({
  emoji,
  title,
  children,
  onClose,
}: {
  emoji: string
  title: string
  children?: ReactNode
  onClose: () => void
}) {
  return (
    <div className="overlay" role="dialog" aria-label={title} onClick={onClose}>
      <div className="overlay-card pop">
        <div className="overlay-emoji">{emoji}</div>
        <h2>{title}</h2>
        {children}
        <button className="big-btn" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  )
}
