import type { DisplayMode } from '../../domain/types'
import { AVATARS, COLORS } from '../../storage/defaults'

export interface ChildDraft {
  name: string
  avatar: string
  color: string
  displayMode: DisplayMode
  opening: string
}

export function ChildForm({
  label,
  value,
  onChange,
  showOpening,
}: {
  label: string
  value: ChildDraft
  onChange: (next: ChildDraft) => void
  showOpening: boolean
}) {
  const set = (patch: Partial<ChildDraft>) => onChange({ ...value, ...patch })
  return (
    <fieldset className="card">
      <legend>{label}</legend>
      <label>
        なまえ（ニックネーム）
        <input value={value.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <div className="field-label">アバター</div>
      <div className="choice-row">
        {AVATARS.map((a) => (
          <button type="button" key={a} className={a === value.avatar ? 'choice on' : 'choice'} onClick={() => set({ avatar: a })}>
            {a}
          </button>
        ))}
      </div>
      <div className="field-label">いろ</div>
      <div className="choice-row">
        {COLORS.map((c) => (
          <button
            type="button"
            key={c}
            aria-label={`いろ ${c}`}
            className={c === value.color ? 'choice swatch on' : 'choice swatch'}
            style={{ background: c }}
            onClick={() => set({ color: c })}
          />
        ))}
      </div>
      <div className="field-label">ひょうじ</div>
      <div className="choice-row">
        <button type="button" className={value.displayMode === 'young' ? 'choice wide on' : 'choice wide'} onClick={() => set({ displayMode: 'young' })}>
          おさない（アイコン中心）
        </button>
        <button type="button" className={value.displayMode === 'older' ? 'choice wide on' : 'choice wide'} onClick={() => set({ displayMode: 'older' })}>
          おおきい（数字も表示）
        </button>
      </div>
      {showOpening && (
        <label>
          いま貯まっているポイント
          <input inputMode="numeric" value={value.opening} onChange={(e) => set({ opening: e.target.value })} />
        </label>
      )}
    </fieldset>
  )
}
