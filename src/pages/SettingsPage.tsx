import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import QRCode from 'qrcode'
import { db } from '../db'
import { CheckField, Section } from '../components/Section'
import { BACKUP_KEY, download, exportBackup, importBackup } from '../lib/backup'
import { useHubStatus } from '../lib/hub'
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
    setMsg({ ok: true, text: `Saved ${filename}: ${counts.characters} characters, ${counts.monsters} custom monsters, ${counts.encounters} encounters, ${counts.journal} journal entries.` })
  }

  const restore = async (f: File) => {
    if (!confirm('Restore this backup? It REPLACES your current characters, custom monsters, encounters, journal and the current fight.')) return
    try {
      const c = await importBackup(f)
      setMsg({ ok: true, text: `Restored ${c.characters} characters, ${c.monsters} custom monsters, ${c.encounters} encounters and ${c.journal} journal entries.` })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    }
    if (file.current) file.current.value = ''
  }

  return (
    <div className="page">
      <div className="toolbar">
        <h2>Settings</h2>
      </div>

      <div className="form settings">
        <Section title="Dice">
          <CheckField
            label="Let the app roll dice for player characters"
            title="Off: players roll their own dice and tell you the number"
            checked={settings.allowPlayerAppRolls}
            onChange={(v) => updateSettings({ allowPlayerAppRolls: v })}
          />
          <p className="muted note-line">
            {settings.allowPlayerAppRolls
              ? 'On: roll buttons also appear for player characters (attacks, damage, saves, initiative, hit dice).'
              : 'Off (recommended): players always throw their own dice. The app only shows their bonuses and DCs, and you type in the number they rolled. Monsters are yours, so their dice can always be rolled in the app.'}
          </p>
        </Section>

        <Section title="Backup & restore">
          <p className="muted note-line">
            Everything lives in this browser. A backup is one file with your characters (with portraits), custom monsters, saved encounters and campaign
            progress. Keep a copy somewhere safe.
          </p>
          <div className="row gap wrap">
            <button className="primary" onClick={backup}>
              ⬇ Download backup
            </button>
            <label className="file-button">
              <input ref={file} type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
              ⬆ Restore from a backup…
            </label>
            {days !== undefined && (
              <span className={days === null || days > 7 ? 'warn' : 'muted'}>
                {days === null ? 'You have never made a backup.' : days === 0 ? 'Last backup: today.' : `Last backup: ${days} day${days === 1 ? '' : 's'} ago.`}
              </span>
            )}
          </div>
          {msg && <p className={msg.ok ? 'adv-text' : 'warn'}>{msg.text}</p>}
        </Section>

        <Section title="Live view on phones & TV">
          {hub.state === 'off' && hub.urls.length === 0 ? (
            <p className="muted note-line">
              The live relay isn't available here. Start the app with <code>pnpm dev</code> (or <code>pnpm live</code> for a faster, built copy) on the computer you run
              the game from and open it in your browser.
            </p>
          ) : (
            <>
              <p className="muted note-line">
                Anyone on the same Wi-Fi who opens the address below sees the player view live: the turn order, the party's HP, the
                monsters' status (never their exact HP or AC), conditions, and short announcements like "Goblin 1 hits Xaroz".
              </p>
              <div className="live-box">
                <div>
                  <div className={`live-state ${hub.state}`}>
                    {hub.state === 'live' ? '● Live' : hub.state === 'connecting' ? '… Connecting' : '○ Not connected'} ·{' '}
                    {hub.viewers} viewer{hub.viewers === 1 ? '' : 's'} connected
                  </div>
                  {hub.urls.length > 1 && (
                    <label className="inline-field">
                      Network
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
                      Open <strong className="live-url">{url}</strong> on a phone, tablet or TV connected to the same Wi-Fi.
                    </p>
                  )}
                  <p className="muted note-line">
                    If a device can't connect, allow Node.js through the Windows firewall for private networks. There is no password: only use this on a network you trust.
                  </p>
                </div>
                {qr && <img className="qr" src={qr} alt={`QR code for ${url}`} />}
              </div>
            </>
          )}
        </Section>

        <Section title="Reference library">
          <p className="muted note-line">
            {library
              ? `Saved on this device: ${library.spells ?? 0} spells, ${library.monsters ?? 0} monsters, every class table and the condition rules. It works offline.`
              : 'Downloading the spell, monster and class library in the background (first launch only)…'}
          </p>
        </Section>
      </div>
    </div>
  )
}
