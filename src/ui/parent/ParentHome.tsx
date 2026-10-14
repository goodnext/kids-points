export function ParentHome({
  onExit,
}: {
  onExit: () => void
  onShowChild: (childId: string, celebrateTxId?: string) => void
}) {
  return (
    <div className="screen">
      <button className="btn" onClick={onExit}>
        🔒 とじる
      </button>
    </div>
  )
}
