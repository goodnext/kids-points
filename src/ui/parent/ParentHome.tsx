import { useState } from 'react'
import { needsBackupReminder } from '../../storage/backup'
import { useStore } from '../store'
import { DemoTab } from './DemoTab'
import { MoneyTab } from './MoneyTab'
import { SettingsTab } from './settings/SettingsTab'
import { StampTab } from './StampTab'
import { UndoTab } from './UndoTab'

type Tab = 'stamp' | 'spend' | 'withdraw' | 'undo' | 'settings' | 'demo'

const TABS: { id: Tab; label: string }[] = [
  { id: 'stamp', label: 'スタンプ' },
  { id: 'spend', label: 'つかう' },
  { id: 'withdraw', label: 'ひきだす' },
  { id: 'undo', label: 'とりけし' },
  { id: 'settings', label: 'せってい' },
  { id: 'demo', label: 'デモ' },
]

export function ParentHome({
  onExit,
  onShowChild,
}: {
  onExit: () => void
  onShowChild: (childId: string, celebrateTxId?: string) => void
}) {
  const { snap, repo, mode } = useStore()
  const [tab, setTab] = useState<Tab>('stamp')
  const [childId, setChildId] = useState(snap.children[0]?.id ?? '')
  const needsChild = tab === 'stamp' || tab === 'spend' || tab === 'withdraw'

  return (
    <div className="screen">
      <header className="parent-header">
        <h1>おやの メニュー</h1>
        <button className="btn" onClick={onExit}>
          🔒 とじる
        </button>
      </header>
      {mode === 'real' && needsBackupReminder(snap.settings, repo.now()) && (
        <p className="banner">最後のバックアップから30日以上たっています。「せってい」→「バックアップ」から書き出してください。</p>
      )}
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'tab on' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      {needsChild && (
        <div className="choice-row">
          {snap.children.map((c) => (
            <button key={c.id} className={c.id === childId ? 'choice wide on' : 'choice wide'} onClick={() => setChildId(c.id)}>
              {c.avatar} {c.name}
            </button>
          ))}
        </div>
      )}
      {tab === 'stamp' && <StampTab childId={childId} onStamped={onShowChild} />}
      {tab === 'spend' && <MoneyTab key={`spend-${childId}`} childId={childId} type="spend" />}
      {tab === 'withdraw' && <MoneyTab key={`withdraw-${childId}`} childId={childId} type="withdraw" />}
      {tab === 'undo' && <UndoTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'demo' && <DemoTab onExit={onExit} onShowChild={(id) => onShowChild(id)} />}
    </div>
  )
}
