import { useState } from 'react'
import { usePromise } from '../hooks'
import { t } from '../lib/i18n'
import { levelLabel, levelName } from '../lib/spells'
import { getAllSpellRefs, getClassSpells, getSpell, type SrdSpellRef } from '../lib/srdApi'
import type { ClassIndex, KnownSpell } from '../types'

interface Props {
  classIndex?: ClassIndex
  mode: 'cantrip' | 'spell'
  /** Highest spell level the character has slots for (spells above it are hidden unless "Higher levels" is ticked) */
  maxLevel: number
  have: KnownSpell[]
  /** The list is at its limit: spells can still be browsed but not added */
  full: boolean
  onAdd: (spell: KnownSpell) => void
  onClose: () => void
}

export function SpellPicker({ classIndex, mode, maxLevel, have, full, onAdd, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [allClasses, setAllClasses] = useState(!classIndex)
  const [higher, setHigher] = useState(false)
  const [open, setOpen] = useState<string>()

  const list = usePromise<SrdSpellRef[]>(
    () => (allClasses || !classIndex ? getAllSpellRefs() : getClassSpells(classIndex)),
    [allClasses, classIndex],
  )
  const haveIds = new Set(have.map((s) => s.index))
  const cap = Math.max(1, maxLevel)
  const shown = (list.data ?? [])
    .filter((s) => (mode === 'cantrip' ? s.level === 0 : s.level >= 1 && (higher || s.level <= cap)))
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))

  return (
    <div className="card spell-picker">
      <div className="row gap wrap">
        <strong>{mode === 'cantrip' ? t('sp.addCantrip') : t('sp.addSpell')}</strong>
        <input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        {classIndex && (
          <label className="row gap">
            <input type="checkbox" checked={allClasses} onChange={(e) => setAllClasses(e.target.checked)} /> {t('sp.allClasses')}
          </label>
        )}
        {mode === 'spell' && (
          <label className="row gap">
            <input type="checkbox" checked={higher} onChange={(e) => setHigher(e.target.checked)} /> {t('sp.higher')}
          </label>
        )}
        <button className="grow-gap" onClick={onClose}>
          {t('common.done')}
        </button>
      </div>
      {full && <p className="warn">{t('sp.full')}</p>}
      {list.loading && <p className="muted">{t('sp.loading')}</p>}
      {list.error && <p className="warn">{t('sp.error', { err: list.error })}</p>}
      <ul className="spell-list">
        {shown.map((s) => (
          <li key={s.index}>
            <div className="row gap">
              <span className="spell-name">{s.name}</span>
              <span className="muted">{levelLabel(s.level)}</span>
              <button onClick={() => setOpen(open === s.index ? undefined : s.index)}>{open === s.index ? t('sp.hide') : t('sp.info')}</button>
              <button
                className="primary"
                disabled={full || haveIds.has(s.index)}
                onClick={() => onAdd({ index: s.index, name: s.name, level: s.level })}
              >
                {haveIds.has(s.index) ? t('sp.added') : t('sp.add')}
              </button>
            </div>
            {open === s.index && <SpellInfo index={s.index} />}
          </li>
        ))}
        {!list.loading && !list.error && shown.length === 0 && <li className="muted">{t('sp.noMatch')}</li>}
      </ul>
    </div>
  )
}

export function SpellInfo({ index }: { index: string }) {
  const spell = usePromise(() => getSpell(index), [index])
  if (spell.loading) return <p className="muted">{t('common.loading')}</p>
  if (!spell.data) return <p className="warn">{t('sp.loadFail')}</p>
  const s = spell.data
  return (
    <div className="spell-info">
      <div className="muted">
        {levelName(s.level)}
        {s.school && ` · ${s.school.name}`} · {s.casting_time} · {s.range} · {s.duration}
        {s.concentration && ` · ${t('sp.concentration')}`}
        {s.ritual && ` · ${t('sp.ritual')}`} · {s.components.join(', ')}
      </div>
      <p>{s.description}</p>
      {s.higher_level && <p>{s.higher_level}</p>}
    </div>
  )
}
