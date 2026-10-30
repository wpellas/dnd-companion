import { useState } from 'react'
import { t } from '../lib/i18n'
import { Window } from './Window'

/** Pick the folder an item goes to: the top level and every folder, written as its path. Shared by the Maps / Images and Music pages. */
export function FolderMoveWindow({ name, folder, folders, root = t('maps.root'), onMove, onClose }: { name: string; root?: string; folder: string; folders: string[]; onMove: (folder: string) => Promise<unknown>; onClose: () => void }) {
  const [target, setTarget] = useState(folder)
  return (
    <Window
      title={t('maps.moveTitle', { name })}
      onClose={onClose}
      dismissOnBackdrop
      actions={
        <>
          <button onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="primary"
            onClick={async () => {
              await onMove(target)
              onClose()
            }}
          >
            {t('maps.move')}
          </button>
        </>
      }
    >
      <div className="choice-grid compact">
        {['', ...folders].map((f) => (
          <label className="choice-card" key={f}>
            <input type="radio" name="folder" checked={target === f} onChange={() => setTarget(f)} />
            <strong>{f ? f.split('/').join(' › ') : root}</strong>
          </label>
        ))}
      </div>
    </Window>
  )
}
