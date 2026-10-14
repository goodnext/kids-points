import { useRef, useState } from 'react'
import { exportBackup, importBackup, parseBackup, type BackupFile } from '../../../storage/backup'
import { useStore } from '../../store'

export function BackupSettings() {
  const { repo, snap, reload } = useStore()
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [message, setMessage] = useState('')
  const busy = useRef(false)

  const replace = async (file: BackupFile) => {
    if (busy.current) return
    busy.current = true
    try {
      await importBackup(repo, file)
      await reload()
      setMessage('読み込みました')
    } catch {
      // 読み込みは1つのトランザクションなので、失敗したら何も変わっていない
      setMessage('読み込めませんでした。いまのデータはそのままです')
    } finally {
      setPending(null)
      busy.current = false
    }
  }

  const download = async () => {
    const text = await exportBackup(repo)
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `kids-points-${repo.now().toISOString().slice(0, 10)}.json`
    a.click()
    // iPad で保存が終わる前に消さないよう、少し待ってから解放する
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    await reload()
    setMessage('書き出しました')
  }

  const pick = async (file: File) => {
    try {
      setPending(parseBackup(await file.text()))
      setMessage('')
    } catch (e) {
      setPending(null)
      setMessage(e instanceof Error ? e.message : '読み込めませんでした')
    }
  }

  return (
    <section>
      <h2>バックアップ</h2>
      <p>最後の書き出し：{snap.settings.lastBackupAt ? new Date(snap.settings.lastBackupAt).toLocaleDateString('ja-JP') : 'まだありません'}</p>
      <div className="row">
        <button className="btn primary" onClick={() => void download()}>
          書き出す
        </button>
        <label className="btn">
          読み込む
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void pick(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {pending && (
        <div className="card">
          <p>このファイルの内容で、今のデータをすべて置き換えます。</p>
          <ul>
            <li>書き出した日時：{new Date(pending.exportedAt).toLocaleString('ja-JP')}</li>
            <li>こども：{pending.children.map((c) => c.name).join('、')}</li>
            <li>記録：{pending.transactions.length}件</li>
          </ul>
          <div className="row">
            <button className="btn" onClick={() => setPending(null)}>
              やめる
            </button>
            <button
              className="btn danger"
              onClick={() => void replace(pending)}
            >
              置き換える
            </button>
          </div>
        </div>
      )}
      {message && <p className="message">{message}</p>}
    </section>
  )
}
