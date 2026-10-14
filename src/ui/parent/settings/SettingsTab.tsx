import { BackupSettings } from './BackupSettings'
import { ChildrenSettings } from './ChildrenSettings'
import { GeneralSettings } from './GeneralSettings'
import { MenuSettings } from './MenuSettings'

export function SettingsTab() {
  return (
    <div>
      <ChildrenSettings />
      <MenuSettings />
      <GeneralSettings />
      <BackupSettings />
    </div>
  )
}
