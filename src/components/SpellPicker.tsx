import { useState } from 'react'
import { usePromise } from '../hooks'
import { levelLabel } from '../lib/spells'
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
        <strong>{mode === 'cantrip' ? 'Add a cantrip' : 'Add a spell'}</strong>
        <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        {classIndex && (
          <label className="row gap">
            <input type="checkbox" checked={allClasses} onChange={(e) => setAllClasses(e.target.checked)} /> All classes
          </label>
        )}
        {mode === 'spell' && (
          <label className="row gap">
            <input type="checkbox" checked={higher} onChange={(e) => setHigher(e.target.checked)} /> Higher levels
          </label>
        )}
        <button className="grow-gap" onClick={onClose}>
          Done
        </button>
      </div>
      {full && <p className="warn">List is full. Remove a spell, or raise the limit, to add more.</p>}
      {list.loading && <p className="muted">Loading spells from the SRD…</p>}
      {list.error && <p className="warn">Couldn't load spells ({list.error}). The spell library downloads once in the background when the app first opens online.</p>}
      <ul className="spell-list">
        {shown.map((s) => (
          <li key={s.index}>
            <div className="row gap">
              <span className="spell-name">{s.name}</span>
              <span className="muted">{levelLabel(s.level)}</span>
              <button onClick={() => setOpen(open === s.index ? undefined : s.index)}>{open === s.index ? 'Hide' : 'Info'}</button>
              <button
                className="primary"
                disabled={full || haveIds.has(s.index)}
                onClick={() => onAdd({ index: s.index, name: s.name, level: s.level })}
              >
                {haveIds.has(s.index) ? 'Added' : 'Add'}
              </button>
            </div>
            {open === s.index && <SpellInfo index={s.index} />}
          </li>
        ))}
        {!list.loading && !list.error && shown.length === 0 && <li className="muted">No matching spells.</li>}
      </ul>
    </div>
  )
}

export function SpellInfo({ index }: { index: string }) {
  const spell = usePromise(() => getSpell(index), [index])
  if (spell.loading) return <p className="muted">Loading…</p>
  if (!spell.data) return <p className="warn">Couldn't load this spell.</p>
  const s = spell.data
  return (
    <div className="spell-info">
      <div className="muted">
        {s.level === 0 ? 'Cantrip' : `${levelLabel(s.level)} level`}
        {s.school && ` · ${s.school.name}`} · {s.casting_time} · {s.range} · {s.duration}
        {s.concentration && ' · Concentration'}
        {s.ritual && ' · Ritual'} · {s.components.join(', ')}
      </div>
      <p>{s.description}</p>
      {s.higher_level && <p>{s.higher_level}</p>}
    </div>
  )
}
