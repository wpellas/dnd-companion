import { useState } from 'react'
import { t, tn } from '../lib/i18n'
import type { Character } from '../types'
import { Combobox } from './Combobox'

/**
 * For the DM: who at the table can cast a spell right now ("who has Shield?", "can anyone Counterspell?"), and every character's spell list with the slots left.
 * Prepared spells need a free slot of the spell's level or higher; cantrips are always ready.
 */
export function SpellFinder({ characters }: { characters: Character[] }) {
  const [pick, setPick] = useState<string>()
  const casters = characters.filter((c) => c.spellcasting)
  const names = new Map<string, { name: string; level: number }>()
  for (const c of casters) for (const s of [...c.spellcasting!.cantrips, ...c.spellcasting!.prepared]) names.set(s.index, { name: s.name, level: s.level })
  const options = [...names].map(([value, s]) => ({ value, label: s.name, hint: s.level === 0 ? t('spellfind.cantrip') : t('spellfind.level', { n: s.level }) })).sort((a, b) => a.label.localeCompare(b.label))
  const spell = pick ? names.get(pick) : undefined

  const who = (c: Character) => {
    const sc = c.spellcasting!
    const has = [...sc.cantrips, ...sc.prepared].find((s) => s.index === pick)
    if (!has) return undefined
    const free = has.level === 0 ? Infinity : sc.slots.slice(has.level - 1).reduce((n, s) => n + Math.max(0, s.max - s.used), 0)
    return { c, has, free }
  }
  const found = pick ? casters.map(who).filter((x) => !!x) : []

  return (
    <details className="card spell-finder">
      <summary>{t('spellfind.title')}</summary>
      {casters.length === 0 ? (
        <p className="muted">{t('spellfind.none')}</p>
      ) : (
        <>
          <Combobox className="target-select" options={options} value={pick} onChange={setPick} placeholder={t('spellfind.search')} clearLabel={t('spellfind.clear')} />
          {spell && (
            <p>
              {found.length === 0 ? (
                <span className="muted">{t('spellfind.nobody', { spell: spell.name })}</span>
              ) : (
                found.map((f) => (
                  <span key={f.c.id} className={`chip ${f.free === 0 ? 'unavailable' : ''}`}>
                    {f.c.name}
                    <small> {f.free === Infinity ? t('spellfind.always') : f.free === 0 ? t('spellfind.noSlot') : tn('spellfind.slots', f.free)}</small>
                  </span>
                ))
              )}
            </p>
          )}
          <div className="spell-lists">
            {casters.map((c) => {
              const sc = c.spellcasting!
              const slots = sc.slots.map((s, i) => ({ ...s, level: i + 1 })).filter((s) => s.max > 0)
              return (
                <div key={c.id} className="spell-list">
                  <strong>{c.name}</strong>{' '}
                  <span className="muted small">{slots.map((s) => `${s.level}: ${s.max - s.used}/${s.max}`).join(' · ')}</span>
                  <div className="small">
                    {sc.cantrips.length > 0 && <div><span className="muted">{t('spellfind.cantrips')}</span> {sc.cantrips.map((s) => s.name).join(', ')}</div>}
                    {[...new Set(sc.prepared.map((s) => s.level))].sort((a, b) => a - b).map((lv) => (
                      <div key={lv}>
                        <span className="muted">{t('spellfind.level', { n: lv })}</span> {sc.prepared.filter((s) => s.level === lv).map((s) => s.name).join(', ')}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </details>
  )
}
