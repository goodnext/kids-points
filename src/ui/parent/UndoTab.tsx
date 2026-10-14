import { useEffect, useState } from 'react'
import { describeTx } from '../../domain/describeTx'
import type { UndoCheck, UndoFailReason } from '../../domain/undo'
import { OpFailed } from '../../storage/repo'
import { useStore } from '../store'

const REASON: Record<UndoFailReason, string> = {
  none: 'とりけせる操作がありません',
  interest: '利息は とりけせません',
  settled: '先月より前の操作は とりけせません',
  negative: 'とりけすと ポイントがマイナスになるので、とりけせません',
}

export function UndoTab() {
  const { repo, snap, reload } = useStore()
  const [check, setCheck] = useState<UndoCheck | null>(null)
  const [message, setMessage] = useState('')
  const name = (id: string) => snap.children.find((c) => c.id === id)?.name ?? ''

  useEffect(() => {
    let alive = true
    void repo.previewUndo().then((r) => {
      if (alive) setCheck(r)
    })
    return () => {
      alive = false
    }
  }, [repo, snap])

  const undo = async () => {
    try {
      const t = await repo.undoLast()
      setMessage(`「${describeTx(t, name(t.childId))}」を とりけしました`)
      await reload()
    } catch (e) {
      setMessage(e instanceof OpFailed ? (REASON[e.reason as UndoFailReason] ?? 'できませんでした') : 'できませんでした')
    }
  }

  return (
    <div>
      {message && <p className="message">{message}</p>}
      {check?.ok && (
        <>
          <p>さいごの操作：</p>
          <p className="amount">{describeTx(check.tx, name(check.tx.childId))}</p>
          <button className="btn danger" onClick={() => void undo()}>
            これを とりけす
          </button>
        </>
      )}
      {check && !check.ok && (
        <p>
          {REASON[check.reason]}
          {check.tx && `（さいごの操作：${describeTx(check.tx, name(check.tx.childId))}）`}
        </p>
      )}
    </div>
  )
}
