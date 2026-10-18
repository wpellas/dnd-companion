import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, srdDb } from '../db'
import { AccountSection } from '../components/AccountSection'
import { CheckField, Section } from '../components/Section'
import { TableLink } from '../components/TableLink'
import { BACKUP_KEY, download, exportBackup, importBackup } from '../lib/backup'
import { getLang, LANGUAGES, setLang, t, tn, type Lang } from '../lib/i18n'
import { updateSettings, useSettings } from '../lib/settings'
import { LIBRARY_SYNC_KEY } from '../lib/srdApi'
import { resyncAll } from '../lib/sync'

const DAY = 86400000

export function SettingsPage() {
  const settings = useSettings()
  // days since the last backup: null = never, undefined = still loading
  const days = useLiveQuery(async () => {
    const at = (await db.kv.get(BACKUP_KEY))?.value as number | undefined
    return at === undefined ? null : Math.floor((Date.now() - at) / DAY)
  }, [])
  const library = useLiveQuery(async () => (await srdDb.kv.get(LIBRARY_SYNC_KEY))?.value as { spells?: number; monsters?: number } | undefined, [])
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>()
  const file = useRef<HTMLInputElement>(null)

  const backup = async () => {
    const { blob, filename, counts } = await exportBackup()
    download(blob, filename)
    setMsg({ ok: true, text: t('settings.saved', { file: filename, ...counts }) })
  }

  const restore = async (f: File) => {
    if (!confirm(t('settings.restoreConfirm'))) return
    try {
      const c = await importBackup(f)
      await resyncAll() // the server follows the restored data, including what the backup no longer contains
      setMsg({ ok: true, text: t('settings.restored', { ...c }) })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    }
    if (file.current) file.current.value = ''
  }

  // saved first, then applied: the UI is rebuilt when the language changes and must find the new value already stored
  const chooseLanguage = async (code: Lang) => {
    await updateSettings({ language: code })
    setLang(code)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <h2>{t('settings.title')}</h2>
      </div>

      <div className="form settings">
        <AccountSection />

        <Section title={t('settings.language')}>
          <label className="inline-field">
            {t('settings.languageLabel')}
            <select value={getLang()} onChange={(e) => chooseLanguage(e.target.value as Lang)} aria-label={t('settings.languageLabel')}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <p className="muted note-line">{t('settings.languageNote')}</p>
        </Section>

        <Section title={t('settings.dice')}>
          <CheckField
            label={t('settings.diceLabel')}
            title={t('settings.diceTitle')}
            checked={settings.allowPlayerAppRolls}
            onChange={(v) => updateSettings({ allowPlayerAppRolls: v })}
          />
          <p className="muted note-line">{settings.allowPlayerAppRolls ? t('settings.diceOn') : t('settings.diceOff')}</p>
        </Section>

        <Section title={t('settings.backup')}>
          <p className="muted note-line">{t('settings.backupNote')}</p>
          <div className="row gap wrap">
            <button className="primary" onClick={backup}>
              {t('settings.download')}
            </button>
            <label className="file-button">
              <input ref={file} type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
              {t('settings.restore')}
            </label>
            {days !== undefined && (
              <span className={days === null || days > 7 ? 'warn' : 'muted'}>
                {days === null ? t('settings.neverBackedUp') : days === 0 ? t('settings.backupToday') : tn('settings.backupDays', days)}
              </span>
            )}
          </div>
          {msg && <p className={msg.ok ? 'adv-text' : 'warn'}>{msg.text}</p>}
        </Section>

        <TableLink />

        <Section title={t('settings.library')}>
          <p className="muted note-line">
            {library ? t('settings.libraryStored', { spells: library.spells ?? 0, monsters: library.monsters ?? 0 }) : t('settings.libraryLoading')}
          </p>
        </Section>
      </div>
    </div>
  )
}
