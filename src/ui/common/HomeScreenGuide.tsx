export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

export function HomeScreenGuide() {
  if (isStandalone()) return <p>ホーム画面から起動しています。このまま使ってください。</p>
  return (
    <div className="card">
      <h3>ホーム画面に追加してください</h3>
      <ol>
        <li>Safari の共有ボタン（四角から矢印が出ているアイコン）をタップ</li>
        <li>「ホーム画面に追加」を選ぶ</li>
        <li>ホーム画面にできたアイコンから開く</li>
      </ol>
      <p className="note">ホーム画面に追加しないと、しばらく使わないあいだにデータが消えることがあります。</p>
    </div>
  )
}
