import { Window } from './Window'
import { useState } from 'react'
import { t } from '../lib/i18n'
import { splitEvenly } from '../lib/inventory'
import { awardRewards, type AwardLine } from '../lib/rewards'
import type { Character } from '../types'

/** Hand out experience and gold: totals are split evenly between the characters ticked here. */
export function AwardPanel({ characters, onClose }: { characters: Character[]; onClose: () => void }) {
  const [picked, setPicked] = useState(() => new Set(characters.map((c) => c.id!)))
  const [xp, setXp] = useState('')
  const [gp, setGp] = useState('')
  const [note, setNote] = useState('')
  const [done, setDone] = useState<AwardLine[]>()

  const ids = characters.filter((c) => picked.has(c.id!)).map((c) => c.id!)
  const xpTotal = Math.max(0, Math.floor(Number(xp) || 0))
  const gpTotal = Math.max(0, Math.floor(Number(gp) || 0))
  const xpEach = splitEvenly(xpTotal, ids.length)
  const gpEach = splitEvenly(gpTotal, ids.length)
  const toggle = (id: number) =>
    setPicked((s) => {
      const n = new Set(s)
      if (!n.delete(id)) n.add(id)
      return n
    })

  if (done) {
    return (
      <Window
        title={t('award.done')}
        onClose={onClose}
        actions={
          <button className="primary" onClick={onClose}>
            {t('common.done')}
          </button>
        }
      >
        <ul>
          {done.map((l) => (
            <li key={l.id}>
              <strong>{l.name}</strong>: {[l.xp ? `${l.xp} XP` : '', l.gp ? `${l.gp} gp` : ''].filter(Boolean).join(', ') || t('journal.nothing')}
              {l.levelUp && <span className="levelup-badge">{t('award.canLevel')}</span>}
            </li>
          ))}
        </ul>
        <p className="muted">{t('award.journalNote')}</p>
      </Window>
    )
  }

  return (
    <Window
      title={t('award.title')}
      onClose={onClose}
      actions={
        <>
          <button onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="primary"
            disabled={ids.length === 0 || (xpTotal === 0 && gpTotal === 0)}
            onClick={async () => setDone(await awardRewards({ ids, xp: xpTotal, gp: gpTotal, note }))}
          >
            {t('award.go')}
          </button>
        </>
      }
    >
      <p className="muted">{t('award.note')}</p>
      <div className="field-grid">
        <label className="field">
          <span>{t('award.xp')}</span>
          <input type="number" min={0} value={xp} onChange={(e) => setXp(e.target.value)} aria-label={t('award.xpAria')} />
        </label>
        <label className="field">
          <span>{t('award.gold')}</span>
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={gp}
            // whole gold only: no decimal point or comma
            onKeyDown={(e) => ['.', ',', 'e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
            onChange={(e) => setGp(e.target.value.split(/[.,]/)[0].replace(/\D/g, ''))}
            aria-label={t('award.goldAria')}
          />
        </label>
        <label className="field span-2">
          <span>{t('award.what')}</span>
          <input value={note} placeholder={t('award.whatPlaceholder')} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <div className="award-list">
        {characters.map((c) => {
          const k = ids.indexOf(c.id!)
          return (
            <label key={c.id} className="check">
              <input type="checkbox" checked={picked.has(c.id!)} onChange={() => toggle(c.id!)} />
              <span>
                {c.name}
                {k >= 0 && (xpTotal > 0 || gpTotal > 0) && <small className="muted">{t('award.share', { xp: xpEach[k], gp: gpEach[k] })}</small>}
              </span>
            </label>
          )
        })}
      </div>
    </Window>
  )
}
