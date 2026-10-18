import { useState } from 'react'
import { t } from '../lib/i18n'
import { ROLL_MAX, sendRoll, type RollKind } from '../lib/rolls'
import type { Character } from '../types'

const KINDS: RollKind[] = ['attack', 'save', 'initiative', 'death', 'check']

/**
 * Interactive mode only: type what the physical die showed and it appears on the DM's screen, ready to use. Optional (the DM can always just
 * ask), and nothing in the app ever waits for it. The app never rolls for the player here.
 */
export function RollSender({ campaignId, characters }: { campaignId: number; characters: Character[] }) {
  const [open, setOpen] = useState(false)
  const [who, setWho] = useState<number | undefined>(undefined)
  const [kind, setKind] = useState<RollKind>('attack')
  const [value, setValue] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>()
  const character = characters.find((c) => c.id === who) ?? characters[0]
  const n = Number(value)
  const valid = Number.isInteger(n) && n >= 1 && n <= ROLL_MAX[kind]

  const send = async () => {
    if (!character || !valid) return
    try {
      await sendRoll(campaignId, character.id!, kind, n)
      setMsg({ ok: true, text: t('roll.sent', { value: n, kind: t(`roll.kind.${kind}`) }) })
      setValue('')
    } catch {
      setMsg({ ok: false, text: t('roll.failed') })
    }
  }

  if (!character) return null
  return (
    <div className="roll-dock">
      {!open ? (
        <button className="primary" onClick={() => setOpen(true)}>
          📱 {t('roll.send')}
        </button>
      ) : (
        <div className="card roll-card">
          {characters.length > 1 && (
            <label className="inline-field">
              {t('roll.character')}
              <select value={character.id} onChange={(e) => setWho(Number(e.target.value))}>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="row gap wrap">
            {KINDS.map((k) => (
              <button key={k} className={k === kind ? 'selected' : ''} aria-pressed={k === kind} onClick={() => setKind(k)}>
                {t(`roll.kind.${k}`)}
              </button>
            ))}
          </div>
          <label className="field">
            <span>{t('roll.number')}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={ROLL_MAX[kind]}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void send()}
              autoFocus
            />
          </label>
          <p className="muted note-line">{t(`roll.hint.${kind}`)}</p>
          {msg && <p className={msg.ok ? 'adv-text' : 'warn'}>{msg.text}</p>}
          <div className="row gap">
            <button className="primary" disabled={!valid} onClick={() => void send()}>
              {t('roll.sendGo')}
            </button>
            <button onClick={() => setOpen(false)}>{t('roll.close')}</button>
          </div>
          <p className="muted note-line">{t('roll.optional')}</p>
        </div>
      )}
    </div>
  )
}
