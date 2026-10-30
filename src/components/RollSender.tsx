import { Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'
import { RollKindIcon } from './KindIcon'
import { natOf, ROLL_MAX, sendRoll, type RollKind } from '../lib/rolls'
import type { Character } from '../types'
import { DieToken } from './DieToken'

const KINDS: RollKind[] = ['attack', 'save', 'initiative', 'death', 'check']

/**
 * Interactive mode only: type what the physical die showed and it appears on the DM's screen, ready to use. Optional (the DM can always just
 * ask), and nothing in the app ever waits for it. The app never rolls for the player here. Sending takes two steps (type, then confirm), and a
 * click outside the window or Escape closes it.
 */
export function RollSender({ campaignId, characters }: { campaignId: number; characters: Character[] }) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [who, setWho] = useState<number | undefined>(undefined)
  const [kind, setKind] = useState<RollKind>('attack')
  const [value, setValue] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>()
  const character = characters.find((c) => c.id === who) ?? characters[0]
  const n = Number(value)
  const valid = Number.isInteger(n) && n >= 1 && n <= ROLL_MAX[kind]
  const nat = valid ? natOf(kind, n) : undefined

  const close = () => {
    setOpen(false)
    setConfirming(false)
  }
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      setConfirming(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const send = async () => {
    if (!character || !valid) return
    try {
      await sendRoll(campaignId, character.id!, kind, n)
      setMsg({ ok: true, text: t('roll.sent', { value: n, kind: t(`roll.kind.${kind}`) }) })
      setValue('')
    } catch {
      setMsg({ ok: false, text: t('roll.failed') })
    }
    setConfirming(false)
  }

  if (!character) return null
  return (
    <div className="roll-dock">
      {!open ? (
        <button className="primary" onClick={() => setOpen(true)}>
          <Smartphone /> {t('roll.send')}
        </button>
      ) : (
        <>
          <div className="roll-backdrop" onClick={close} aria-hidden="true" />
          <div className="card roll-card" role="dialog" aria-label={t('roll.send')}>
            {confirming ? (
              <div className="roll-confirm">
                <DieToken value={n} kind={kind} large />
                <p className="roll-confirm-ask">{t('roll.confirmAsk', { kind: t(`roll.kind.${kind}`), name: character.name })}</p>
                {nat && <em className="roll-in-nat">{t(nat === 'nat20' ? 'roll.nat20' : 'roll.nat1')}</em>}
                <div className="row gap">
                  <button className="primary" autoFocus onClick={() => void send()}>
                    {t('roll.confirmYes')}
                  </button>
                  <button onClick={() => setConfirming(false)}>{t('roll.confirmBack')}</button>
                </div>
              </div>
            ) : (
              <>
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
                <div className="roll-kinds">
                  {KINDS.map((k) => (
                    <button key={k} className={k === kind ? 'selected' : ''} aria-pressed={k === kind} onClick={() => setKind(k)}>
                      <RollKindIcon kind={k} /> {t(`roll.kind.${k}`)}
                    </button>
                  ))}
                </div>
                <div className="roll-entry">
                  <input
                    className="roll-number"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={ROLL_MAX[kind]}
                    value={value}
                    aria-label={t('roll.number')}
                    placeholder={t('roll.number')}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      // the confirm button takes focus in this same moment: without this, the same Enter would press it and skip the question
                      e.preventDefault()
                      if (valid && !e.repeat) setConfirming(true)
                    }}
                    autoFocus
                  />
                  <DieToken value={valid ? n : undefined} kind={kind} large />
                </div>
                <p className="muted note-line">{t(`roll.hint.${kind}`)}</p>
                {msg && <p className={msg.ok ? 'roll-ok' : 'warn'}>{msg.ok ? '✓ ' : ''}{msg.text}</p>}
                <div className="row gap">
                  <button className="primary" disabled={!valid} onClick={() => setConfirming(true)}>
                    {t('roll.sendGo')}
                  </button>
                  <button onClick={close}>{t('roll.close')}</button>
                </div>
                <p className="muted note-line">{t('roll.optional')}</p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
