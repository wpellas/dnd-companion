import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import QRCode from 'qrcode'
import { db } from '../db'
import { Rich } from '../components/Rich'
import { CheckField, Section } from '../components/Section'
import { BACKUP_KEY, download, exportBackup, importBackup } from '../lib/backup'
import { useHubStatus } from '../lib/hub'
import { getLang, LANGUAGES, setLang, t, tn, type Lang } from '../lib/i18n'
import { updateSettings, useSettings } from '../lib/settings'
import { LIBRARY_SYNC_KEY } from '../lib/srdApi'

const DAY = 86400000

export function SettingsPage() {
  const settings = useSettings()
  const hub = useHubStatus()
  // days since the last backup: null = never, undefined = still loading
  const days = useLiveQuery(async () => {
    const at = (await db.kv.get(BACKUP_KEY))?.value as number | undefined
    return at === undefined ? null : Math.floor((Date.now() - at) / DAY)
  }, [])
  const library = useLiveQuery(async () => (await db.kv.get(LIBRARY_SYNC_KEY))?.value as { spells?: number; monsters?: number } | undefined, [])
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>()
  const file = useRef<HTMLInputElement>(null)
  const [qr, setQr] = useState<string>()
  const [urlIndex, setUrlIndex] = useState(0)
  const url = hub.urls[Math.min(urlIndex, hub.urls.length - 1)]

  useEffect(() => {
    let off = false
    if (!url) return
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#2a1a0d', light: '#f4e9c6' } }).then((d) => !off && setQr(d))
    return () => {
      off = true
    }
  }, [url])

  const backup = async () => {
    const { blob, filename, counts } = await exportBackup()
    download(blob, filename)
    setMsg({ ok: true, text: t('settings.saved', { file: filename, ...counts }) })
  }

  const restore = async (f: File) => {
    if (!confirm(t('settings.restoreConfirm'))) return
    try {
      const c = await importBackup(f)
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

        <Section title={t('settings.live')}>
          {hub.state === 'off' && hub.urls.length === 0 ? (
            <p className="muted note-line">
              <Rich text={t('settings.liveOff')} parts={{ dev: <code>pnpm dev</code>, live: <code>pnpm live</code> }} />
            </p>
          ) : (
            <>
              <p className="muted note-line">{t('settings.liveNote')}</p>
              <div className="live-box">
                <div>
                  <div className={`live-state ${hub.state}`}>
                    {hub.state === 'live' ? t('settings.liveOn') : hub.state === 'connecting' ? t('settings.liveConnecting') : t('settings.liveNot')} ·{' '}
                    {tn('settings.viewers', hub.viewers)}
                  </div>
                  {hub.urls.length > 1 && (
                    <label className="inline-field">
                      {t('settings.network')}
                      <select value={urlIndex} onChange={(e) => setUrlIndex(Number(e.target.value))}>
                        {hub.urls.map((u, i) => (
                          <option key={u} value={i}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {url && (
                    <p>
                      <Rich text={t('settings.openUrl')} parts={{ url: <strong className="live-url">{url}</strong> }} />
                    </p>
                  )}
                  <p className="muted note-line">{t('settings.firewall')}</p>
                </div>
                {qr && <img className="qr" src={qr} alt={t('settings.qrAlt', { url: url ?? '' })} />}
              </div>
            </>
          )}
        </Section>

        <Section title={t('settings.library')}>
          <p className="muted note-line">
            {library ? t('settings.libraryStored', { spells: library.spells ?? 0, monsters: library.monsters ?? 0 }) : t('settings.libraryLoading')}
          </p>
        </Section>
      </div>
    </div>
  )
}
