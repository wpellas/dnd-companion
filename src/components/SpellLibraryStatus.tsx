import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { t } from '../lib/i18n'
import { ensureLibrary, LIBRARY_SYNC_KEY } from '../lib/srdApi'

/**
 * Starts the one-time background download of the SRD reference library (spells, classes, class level tables) when
 * the app opens, if it isn't stored yet, and shows its status. Once stored, the app never fetches them again.
 */
export function SpellLibraryStatus() {
  // null = not downloaded yet, undefined = still reading the database
  const record = useLiveQuery(async () => (await db.kv.get(LIBRARY_SYNC_KEY)) ?? null, [])
  const [progress, setProgress] = useState<{ done: number; total: number }>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (record !== null) return
    let cancelled = false
    const start = () => {
      setFailed(false)
      ensureLibrary((done, total) => !cancelled && setProgress({ done, total })).catch(() => !cancelled && setFailed(true))
    }
    // Give the first paint a head start; also retry whenever the connection comes back.
    const timer = setTimeout(start, 1200)
    window.addEventListener('online', start)
    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener('online', start)
    }
  }, [record])

  if (record === undefined) return null
  if (record) {
    const spells = (record.value as { spells?: number }).spells
    return <span>{spells ? t('lib.savedSpells', { spells }) : t('lib.saved.plain')}</span>
  }
  if (failed) return <span className="warn-soft">{t('lib.failed')}</span>
  if (progress) return <span>{t('lib.downloading', { pct: Math.round((progress.done / progress.total) * 100) })}</span>
  return <span>{t('lib.preparing')}</span>
}
