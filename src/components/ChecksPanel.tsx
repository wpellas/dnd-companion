import { Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'
import { useSentRoll } from '../lib/rolls'
import type { Character } from '../types'

/**
 * A group check or a "who notices?" for the DM: set a DC, see each character's Passive Perception against it, and type the totals the players rolled
 * (or take them from their phones). The 2024 group check succeeds when at least half of the group does. The app never rolls here.
 */
export function ChecksPanel({ characters }: { characters: Character[] }) {
  const [dc, setDc] = useState('')
  const [totals, setTotals] = useState<Record<number, string>>({})
  const need = Number(dc)
  const known = dc !== '' && need > 0
  const typed = characters.filter((c) => totals[c.id!] !== undefined && totals[c.id!] !== '')
  const passed = typed.filter((c) => Number(totals[c.id!]) >= need)

  return (
    <details className="card checks-panel">
      <summary>{t('checks.title')}</summary>
      <div className="row gap wrap">
        <label className="inline-field">
          DC
          <input className="narrow" type="number" min={1} value={dc} onChange={(e) => setDc(e.target.value)} />
        </label>
        <button onClick={() => setTotals({})}>{t('checks.clear')}</button>
      </div>
      <table className="save-table">
        <thead>
          <tr>
            <th>{t('checks.who')}</th>
            <th>{t('checks.passive')}</th>
            <th>{t('checks.investigation')}</th>
            <th>{t('checks.insight')}</th>
            <th>{t('checks.total')}</th>
            <th>{t('checks.result')}</th>
          </tr>
        </thead>
        <tbody>
          {characters.map((c) => (
            <CheckRow key={c.id} c={c} need={known ? need : undefined} value={totals[c.id!] ?? ''} onChange={(v) => setTotals((s) => ({ ...s, [c.id!]: v }))} />
          ))}
        </tbody>
      </table>
      {known && typed.length > 0 && (
        <p>
          <strong>{t('checks.group', { ok: passed.length, n: typed.length })}</strong>{' '}
          <span className={passed.length * 2 >= typed.length ? 'adv-text' : 'warn'}>{passed.length * 2 >= typed.length ? t('checks.groupPass') : t('checks.groupFail')}</span>
        </p>
      )}
      <p className="muted note-line">{t('checks.note')}</p>
    </details>
  )
}

function CheckRow({ c, need, value, onChange }: { c: Character; need?: number; value: string; onChange: (v: string) => void }) {
  const sent = useSentRoll(c.id, 'check')
  useEffect(() => {
    if (sent.roll && value === '') {
      onChange(String(sent.roll.value))
      sent.take()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent.roll?.id])
  const n = value === '' ? undefined : Number(value)
  return (
    <tr>
      <td>
        <strong>{c.name}</strong>
      </td>
      {[c.passivePerception, c.passiveInvestigation, c.passiveInsight].map((p, i) => (
        <td key={i}>
          {p ?? '-'}
          {need !== undefined && p !== undefined && <span className={p >= need ? 'adv-text' : 'muted'}> {p >= need ? '✓' : '✗'}</span>}
        </td>
      ))}
      <td>
        <input className="narrow" type="number" value={value} aria-label={t('checks.total')} onChange={(e) => onChange(e.target.value)} />
        {sent.roll && value !== '' && Number(value) !== sent.roll.value && (
          <button className="tiny-button" title={t('roll.useTitle')} onClick={() => { onChange(String(sent.roll!.value)); sent.take() }}>
            <Smartphone /> {sent.roll.value}
          </button>
        )}
      </td>
      <td>{n === undefined || need === undefined ? <span className="muted">-</span> : <span className={`save-result ${n >= need ? 'saved' : 'failed'}`}>{n >= need ? t('checks.pass') : t('checks.fail')}</span>}</td>
    </tr>
  )
}
