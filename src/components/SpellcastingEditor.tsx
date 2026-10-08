import { useState } from 'react'
import { NumberField } from './NumberField'
import { CheckField, Section } from './Section'
import { SpellInfo, SpellPicker } from './SpellPicker'
import { UsePips } from './UsePips'
import { castingSnapshot, emptySlots } from '../lib/character'
import { className } from '../lib/classes'
import { formatMod } from '../lib/dice'
import { highestSlotLevel, levelLabel } from '../lib/spells'
import { ABILITIES, type Ability, type Character, type KnownSpell, type Spellcasting } from '../types'

interface Props {
  c: Character
  setC: (update: (prev: Character) => Character) => void
}

/** Spell slots, limits and the cantrip / prepared-spell lists for one character. */
export function SpellcastingEditor({ c, setC }: Props) {
  const sc = c.spellcasting
  const [picking, setPicking] = useState<'cantrip' | 'spell'>()
  const [info, setInfo] = useState<string>()

  const patchSc = (p: Partial<Spellcasting>) =>
    setC((prev) => (prev.spellcasting ? { ...prev, spellcasting: { ...prev.spellcasting, ...p } } : prev))

  if (!sc) {
    const who = className(c.classIndex)
    return (
      <Section
        title="Spellcasting"
        action={
          <button
            onClick={() =>
              setC((p) => ({
                ...p,
                spellcasting: { ability: 'int', slots: emptySlots(), cantripLimit: 0, preparedLimit: 0, cantrips: [], prepared: [], auto: false },
              }))
            }
          >
            Enable manually
          </button>
        }
      >
        <p className="muted empty-note">
          {who ? `${who}s don't cast spells by default.` : 'Pick a class to fill in spellcasting automatically.'} For a casting
          subclass (Eldritch Knight, Arcane Trickster...) or a multiclass, enable it and set the slots by hand.
        </p>
      </Section>
    )
  }

  const snap = castingSnapshot(c)
  const hiSlot = highestSlotLevel(sc)
  const spellsChosen = sc.cantrips.length + sc.prepared.length
  const setSlotMax = (i: number, max: number) =>
    patchSc({ auto: false, slots: sc.slots.map((s, j) => (j === i ? { max, used: Math.min(s.used, max) } : s)) })
  const addSpell = (s: KnownSpell, key: 'cantrips' | 'prepared') => {
    if (!sc[key].some((x) => x.index === s.index)) patchSc({ [key]: [...sc[key], s] })
  }
  const removeSpell = (index: string, key: 'cantrips' | 'prepared') => patchSc({ [key]: sc[key].filter((x) => x.index !== index) })
  const byLevel = [...sc.prepared].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  // Following the class table, only the slot levels the character actually has are worth showing.
  const slotLevels = sc.slots.map((s, i) => ({ s, i })).filter(({ s }) => !sc.auto || s.max > 0)

  return (
    <Section
      title="Spellcasting"
      action={
        <>
          <CheckField
            label="Follow class table"
            title="Slot counts and spell limits follow the class table for this level. Editing them by hand turns this off."
            checked={sc.auto}
            onChange={(auto) => patchSc({ auto })}
          />
          {!sc.auto && (
            <button
              className="danger"
              onClick={() => (spellsChosen === 0 || confirm('Remove spellcasting and the spells chosen?')) && setC((p) => ({ ...p, spellcasting: undefined }))}
            >
              Remove
            </button>
          )}
        </>
      }
    >
      <div className="field-grid">
        <label className="field">
          <span>Spellcasting ability</span>
          <select value={sc.ability} onChange={(e) => patchSc({ ability: e.target.value as Ability })}>
            {ABILITIES.map((a) => (
              <option key={a} value={a}>
                {a.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        {snap && (
          <div className="field">
            <span>Spell save DC</span>
            <strong className="static-value">{snap.saveDc}</strong>
          </div>
        )}
        {snap && (
          <div className="field">
            <span>Spell attack</span>
            <strong className="static-value">{formatMod(snap.attackBonus)}</strong>
          </div>
        )}
      </div>

      <div className="subhead">Spell slots</div>
      {slotLevels.length === 0 ? (
        <p className="muted empty-note">No spell slots at this level.</p>
      ) : (
        <div className="slot-grid">
          {slotLevels.map(({ s, i }) => (
            <div key={i} className="slot-cell">
              <span className="muted">{levelLabel(i + 1)}</span>
              <input
                type="number"
                min={0}
                max={9}
                value={s.max}
                aria-label={`${levelLabel(i + 1)} level slots`}
                onChange={(e) => setSlotMax(i, Math.max(0, Math.min(9, Math.floor(e.target.valueAsNumber) || 0)))}
              />
              <UsePips
                max={s.max}
                used={s.used}
                label={`${levelLabel(i + 1)} slots`}
                onChange={(used) => patchSc({ slots: sc.slots.map((x, j) => (j === i ? { ...x, used } : x)) })}
              />
            </div>
          ))}
        </div>
      )}

      <div className="spell-columns">
        <SpellList
          title="Cantrips"
          spells={sc.cantrips}
          limit={sc.cantripLimit}
          onLimit={(n) => patchSc({ cantripLimit: n, auto: false })}
          onAdd={() => setPicking('cantrip')}
          onRemove={(i) => removeSpell(i, 'cantrips')}
          onInfo={setInfo}
        />
        <SpellList
          title="Prepared spells"
          spells={byLevel}
          limit={sc.preparedLimit}
          onLimit={(n) => patchSc({ preparedLimit: n, auto: false })}
          onAdd={() => setPicking('spell')}
          onRemove={(i) => removeSpell(i, 'prepared')}
          onInfo={setInfo}
          showLevel
        />
      </div>

      {info && (
        <div className="spell-info-box">
          <SpellInfo index={info} />
          <button onClick={() => setInfo(undefined)}>Close</button>
        </div>
      )}

      {picking && (
        <SpellPicker
          classIndex={c.classIndex}
          mode={picking}
          maxLevel={hiSlot}
          have={picking === 'cantrip' ? sc.cantrips : sc.prepared}
          full={picking === 'cantrip' ? sc.cantrips.length >= sc.cantripLimit : sc.prepared.length >= sc.preparedLimit}
          onAdd={(s) => addSpell(s, picking === 'cantrip' ? 'cantrips' : 'prepared')}
          onClose={() => setPicking(undefined)}
        />
      )}
    </Section>
  )
}

function SpellList({
  title,
  spells,
  limit,
  onLimit,
  onAdd,
  onRemove,
  onInfo,
  showLevel,
}: {
  title: string
  spells: KnownSpell[]
  limit: number
  onLimit: (n: number) => void
  onAdd: () => void
  onRemove: (index: string) => void
  onInfo: (index: string) => void
  showLevel?: boolean
}) {
  const over = spells.length > limit
  return (
    <div className="spell-col">
      <div className="spell-col-head">
        <div className="subhead">
          {title} <span className={over ? 'warn' : 'muted'}>{spells.length} / {limit}</span>
        </div>
        <NumberField label="Limit" value={limit} min={0} onChange={(n) => onLimit(Math.max(0, Math.floor(n)))} />
        <button onClick={onAdd}>+ Add</button>
      </div>
      {spells.length === 0 ? (
        <p className="muted empty-note">None chosen.</p>
      ) : (
        <div className="spell-chips">
          {spells.map((s) => (
            <span className="spell-chip" key={s.index}>
              <button className="link" onClick={() => onInfo(s.index)} title="Show spell text">
                {s.name}
              </button>
              {showLevel && <small>{levelLabel(s.level)}</small>}
              <button className="x" onClick={() => onRemove(s.index)} aria-label={`Remove ${s.name}`}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
