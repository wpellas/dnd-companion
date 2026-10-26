import { useState } from 'react'
import { possessive, t } from '../lib/i18n'
import { toPublicSheet } from '../lib/publicState'
import type { Character } from '../types'
import { InventoryPanel } from './CharacterSheetView'
import { InventoryEditor } from './InventoryEditor'
import { Window } from './Window'

/**
 * A character's whole inventory in its own window over a dimmed page, instead of growing the party card. It opens as a read-only summary (the same
 * gold / XP / carrying tiles and item cards the players see on a showcased sheet), so the DM can check what someone has without touching anything;
 * "Edit" switches to the editor. The editor saves as you go (there is no draft), so Escape, Done and a click on the dimmed area all just close it.
 * An item's own editor opens a second window on top of this one.
 */
export function InventoryDialog({ c, onChange, onClose }: { c: Character; onChange: (patch: Partial<Character>) => void; onClose: () => void }) {
  const [editing, setEditing] = useState(false)
  const inv = toPublicSheet(c, undefined, { inventory: true }).inventory
  return (
    <Window
      large
      title={t('inv.windowTitle', { who: possessive(c.name) })}
      onClose={onClose}
      dismissOnBackdrop
      headerExtra={
        <button aria-pressed={editing} onClick={() => setEditing((on) => !on)}>
          {editing ? t('inv.viewMode') : t('inv.editMode')}
        </button>
      }
      actions={
        <button className="primary" onClick={onClose}>
          {t('inv.done')}
        </button>
      }
    >
      {editing ? <InventoryEditor c={c} transferable onChange={onChange} /> : inv && <InventoryPanel inv={inv} bare />}
    </Window>
  )
}
