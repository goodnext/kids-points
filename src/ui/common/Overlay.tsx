import type { ReactNode } from 'react'

export function Overlay({
  emoji,
  title,
  children,
  actions,
  onClose,
}: {
  emoji: string
  title: string
  children?: ReactNode
  // 渡すと OK のかわりに出す。カードの中を押しても閉じないようにする
  actions?: ReactNode
  onClose: () => void
}) {
  return (
    <div className="overlay" role="dialog" aria-label={title} onClick={onClose}>
      <div className="overlay-card pop" onClick={actions ? (e) => e.stopPropagation() : undefined}>
        <div className="overlay-emoji">{emoji}</div>
        <h2>{title}</h2>
        {children}
        {actions ?? (
          <button className="big-btn" onClick={onClose}>
            OK
          </button>
        )}
      </div>
    </div>
  )
}
