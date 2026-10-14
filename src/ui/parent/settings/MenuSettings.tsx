import { useState } from 'react'
import type { MenuItem } from '../../../domain/types'
import { parsePoints } from '../../../domain/validate'
import { MENU_ICONS } from '../../../storage/defaults'
import { newId } from '../../../storage/ids'
import { useStore } from '../../store'

function MenuEditor({ item, onClose, onSaved }: { item: MenuItem; onClose: () => void; onSaved: () => Promise<void> }) {
  const { repo, snap } = useStore()
  const [label, setLabel] = useState(item.label)
  const [icon, setIcon] = useState(item.icon)
  const [points, setPoints] = useState(String(item.points))
  const [childIds, setChildIds] = useState(item.childIds)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const parsed = parsePoints(points)
  const valid = label.trim() !== '' && parsed !== null && childIds.length > 0
  const exists = snap.menuItems.some((m) => m.id === item.id)
  const toggle = (id: string) => setChildIds(childIds.includes(id) ? childIds.filter((x) => x !== id) : [...childIds, id])

  return (
    <div className="card">
      <label>
        なまえ
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <div className="field-label">アイコン</div>
      <div className="choice-row">
        {MENU_ICONS.map((i) => (
          <button type="button" key={i} className={i === icon ? 'choice on' : 'choice'} onClick={() => setIcon(i)}>
            {i}
          </button>
        ))}
      </div>
      <label>
        ポイント
        <input inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} />
      </label>
      <div className="field-label">だれ向け</div>
      <div className="choice-row">
        {snap.children.map((c) => (
          <button type="button" key={c.id} className={childIds.includes(c.id) ? 'choice wide on' : 'choice wide'} onClick={() => toggle(c.id)}>
            {c.avatar} {c.name}
          </button>
        ))}
      </div>
      <div className="row">
        <button className="btn" onClick={onClose}>
          キャンセル
        </button>
        <button
          className="btn primary"
          disabled={!valid}
          onClick={async () => {
            if (parsed === null) return
            await repo.saveMenuItem({ ...item, label: label.trim(), icon, points: parsed, childIds })
            await onSaved()
          }}
        >
          保存
        </button>
        {exists &&
          (confirmDelete ? (
            <button
              className="btn danger"
              onClick={async () => {
                await repo.deleteMenuItem(item.id)
                await onSaved()
              }}
            >
              ほんとうに消す
            </button>
          ) : (
            <button className="btn danger" onClick={() => setConfirmDelete(true)}>
              消す
            </button>
          ))}
      </div>
    </div>
  )
}

export function MenuSettings() {
  const { snap, reload } = useStore()
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const childName = (id: string) => snap.children.find((c) => c.id === id)?.name

  return (
    <section>
      <h2>ていばんメニュー</h2>
      <ul className="menu-list">
        {snap.menuItems.map((m) => (
          <li key={m.id}>
            <span>
              {m.icon} {m.label}（{m.points}pt）・{m.childIds.map(childName).filter(Boolean).join('、')}
            </span>
            <button className="btn small" onClick={() => setEditing(m)}>
              編集
            </button>
          </li>
        ))}
      </ul>
      <button
        className="btn"
        onClick={() =>
          setEditing({ id: newId(), label: '', icon: MENU_ICONS[0], points: 1, childIds: snap.children.map((c) => c.id), order: snap.menuItems.length })
        }
      >
        ＋ 追加
      </button>
      {editing && (
        <MenuEditor
          key={editing.id}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await reload()
            setEditing(null)
          }}
        />
      )}
    </section>
  )
}
