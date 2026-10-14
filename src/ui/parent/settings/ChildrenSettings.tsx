import { useState } from 'react'
import type { Child } from '../../../domain/types'
import { parsePoints } from '../../../domain/validate'
import { ChildForm, type ChildDraft } from '../../common/ChildForm'
import { useStore } from '../../store'

function ChildEditor({ child }: { child: Child }) {
  const { repo, snap, reload } = useStore()
  const hasOpening = snap.transactions.some((t) => t.childId === child.id && t.type === 'opening' && !t.voidedAt)
  const [draft, setDraft] = useState<ChildDraft>({ name: child.name, avatar: child.avatar, color: child.color, displayMode: child.displayMode, opening: '' })
  const [message, setMessage] = useState('')

  const save = async () => {
    if (!draft.name.trim()) return setMessage('なまえを入れてください')
    const openingText = draft.opening.trim()
    const opening = openingText === '' ? null : parsePoints(openingText)
    if (openingText !== '' && opening === null) return setMessage('いま貯まっているポイントは1以上の整数で入れてください')
    await repo.saveChild({ ...child, name: draft.name.trim(), avatar: draft.avatar, color: draft.color, displayMode: draft.displayMode })
    if (opening !== null && !hasOpening) await repo.addTx({ childId: child.id, type: 'opening', points: opening })
    await reload()
    setDraft({ ...draft, opening: '' })
    setMessage('保存しました')
  }

  return (
    <div>
      <ChildForm label={child.name} value={draft} onChange={setDraft} showOpening={!hasOpening} />
      <button className="btn primary" onClick={() => void save()}>
        保存
      </button>
      {message && <p className="message">{message}</p>}
    </div>
  )
}

export function ChildrenSettings() {
  const { snap } = useStore()
  return (
    <section>
      <h2>こども</h2>
      {snap.children.map((c) => (
        <ChildEditor key={c.id} child={c} />
      ))}
    </section>
  )
}
