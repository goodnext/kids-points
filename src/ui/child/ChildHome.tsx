export function ChildHome({
  childId,
  onBack,
}: {
  childId: string
  celebrateTxId?: string
  onBack: () => void
  onParent: () => void
}) {
  return (
    <div className="screen">
      <button className="btn" onClick={onBack}>
        ◀ もどる
      </button>
      <p>{childId}</p>
    </div>
  )
}
