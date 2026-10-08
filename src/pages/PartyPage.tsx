import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { ActionsEditor } from '../components/ActionsEditor'
import { NumberField } from '../components/NumberField'
import { Portrait } from '../components/Portrait'
import { DamageTypeList } from '../components/DamageTypeList'
import { RestPanel } from '../components/RestPanel'
import { CheckField, Section } from '../components/Section'
import { ResourcesEditor } from '../components/ResourcesEditor'
import { SpellcastingEditor } from '../components/SpellcastingEditor'
import { UsePips } from '../components/UsePips'
import { refreshResources } from '../data/classFeatures'
import { className, CLASS_SAVES } from '../lib/classes'
import { mergeClassTable, normalizeCharacter, proficiencyBonus } from '../lib/character'
import { abilityMod, defaultAbilities, formatMod } from '../lib/dice'
import { hitDiceRemaining } from '../lib/rest'
import { levelLabel } from '../lib/spells'
import { getClass, getClassLevel } from '../lib/srdApi'
import { getCampaign } from '../lib/store'
import { ABILITIES, CLASSES, type Character, type ClassIndex } from '../types'

const RECHARGE_ICON = { short: '☾', 'short-one': '☾¹', long: '☀' } as const
const RECHARGE_TITLE = {
  short: 'All uses back on a short or long rest',
  'short-one': '1 use back on a short rest, all on a long rest',
  long: 'Long rest',
} as const

const blank = (): Character => ({
  name: '',
  playerName: '',
  subclass: '',
  className: '',
  level: 1,
  ac: 10,
  maxHp: 10,
  currentHp: 10,
  speed: 30,
  initiativeBonus: 0,
  passivePerception: 10,
  abilities: defaultAbilities(),
  actions: [],
  hitDie: 8,
  hitDiceUsed: 0,
  resources: [],
  saveProficiencies: [],
  resistances: [],
  immunities: [],
  vulnerabilities: [],
})

export function PartyPage() {
  const characters = useLiveQuery(() => db.characters.toArray(), [])
  const combat = useLiveQuery(() => db.combat.get('current'), [])
  const campaign = useLiveQuery(getCampaign, [])
  const [editing, setEditing] = useState<Character | null>(null)
  const [resting, setResting] = useState<'short' | 'long'>()
  const inCombat = combat?.started ?? false

  return (
    <div className="page">
      <div className="toolbar">
        <h2>Party</h2>
        {campaign && (
          <span className="campaign-badge" title="A long rest advances the day">
            Day {campaign.day} · {campaign.shortRestsSinceLong} short rest{campaign.shortRestsSinceLong === 1 ? '' : 's'} since last long rest
          </span>
        )}
        <button
          disabled={inCombat || !characters?.length}
          title={inCombat ? 'Finish the fight first' : undefined}
          onClick={() => setResting('short')}
        >
          ☾ Short rest
        </button>
        <button
          disabled={inCombat || !characters?.length}
          title={inCombat ? 'Finish the fight first' : undefined}
          onClick={() => setResting('long')}
        >
          ☀ Long rest
        </button>
        <button className="primary" onClick={() => setEditing(blank())}>
          + New character
        </button>
      </div>

      {resting && characters && <RestPanel kind={resting} characters={characters.map(normalizeCharacter)} onClose={() => setResting(undefined)} />}
      {editing && <CharacterForm initial={editing} onClose={() => setEditing(null)} />}

      <div className="card-grid">
        {characters?.map(normalizeCharacter).map((c) => (
          <CharacterCard key={c.id} c={c} onEdit={() => setEditing(c)} />
        ))}
        {characters?.length === 0 && <p className="muted">No characters yet. Add your party to get started.</p>}
      </div>
    </div>
  )
}

function CharacterCard({ c, onEdit }: { c: Character; onEdit: () => void }) {
  const sc = c.spellcasting
  const slotRows = sc?.slots.map((s, i) => ({ ...s, level: i + 1 })).filter((s) => s.max > 0) ?? []
  const update = (patch: Partial<Character>) => db.characters.update(c.id!, patch)

  return (
    <div className="card">
      <div className="row gap-lg">
        <Portrait name={c.name} image={c.image} size={72} />
        <div>
          <strong>{c.name}</strong>
          <div className="muted">
            {className(c.classIndex) ?? c.className} {c.level}
            {c.subclass && ` (${c.subclass})`}
            {c.playerName && ` · ${c.playerName}`}
          </div>
        </div>
      </div>
      <div className="stats">
        <span>AC {c.ac}</span>
        <span>
          HP {c.currentHp}/{c.maxHp}
        </span>
        <span>Prof {formatMod(proficiencyBonus(c.level))}</span>
        <span>Init {formatMod(c.initiativeBonus)}</span>
        <span>PP {c.passivePerception}</span>
        <span title="Hit dice remaining">
          HD {hitDiceRemaining(c)}/{c.level} d{c.hitDie}
        </span>
      </div>

      {slotRows.length > 0 && (
        <div className="slot-rows" title="Click a pip to spend or recover a slot">
          {slotRows.map((s) => (
            <div key={s.level} className="slot-row">
              <span className="muted">{levelLabel(s.level)}</span>
              <UsePips
                max={s.max}
                used={s.used}
                label={`${levelLabel(s.level)} slots`}
                onChange={(used) =>
                  update({ spellcasting: { ...sc!, slots: sc!.slots.map((x, i) => (i === s.level - 1 ? { ...x, used } : x)) } })
                }
              />
            </div>
          ))}
        </div>
      )}
      {sc && (
        <div className="muted spell-count">
          Spells: {sc.cantrips.length}/{sc.cantripLimit} cantrips · {sc.prepared.length}/{sc.preparedLimit} prepared
        </div>
      )}

      {c.resources.length > 0 && (
        <div className="slot-rows">
          {c.resources.map((r) => (
            <div key={r.id} className="slot-row">
              <span className="muted" title={RECHARGE_TITLE[r.recharge]}>
                {r.name || 'Feature'} {RECHARGE_ICON[r.recharge]}
              </span>
              <UsePips
                max={r.max}
                used={r.used}
                label={r.name}
                onChange={(used) => update({ resources: c.resources.map((x) => (x.id === r.id ? { ...x, used } : x)) })}
              />
            </div>
          ))}
        </div>
      )}

      <div className="row gap">
        <button onClick={onEdit}>Edit</button>
        <button className="danger" onClick={() => confirm(`Delete ${c.name}?`) && db.characters.delete(c.id!)}>
          Delete
        </button>
      </div>
    </div>
  )
}

function CharacterForm({ initial, onClose }: { initial: Character; onClose: () => void }) {
  const [c, setC] = useState<Character>(() => normalizeCharacter(initial))
  const [syncError, setSyncError] = useState<string>()
  const [classTable, setClassTable] = useState<Record<string, unknown>>()
  const tableRef = useRef<Record<string, unknown>>(undefined)
  // Every edit goes through update(), which re-derives official class features (Rage uses, Lay On Hands pool...)
  // from the new level / ability scores and the class table row.
  const update = (fn: (prev: Character) => Character) =>
    setC((p) => {
      const n = fn(p)
      const resources = refreshResources(n.resources, { level: n.level, abilities: n.abilities, table: tableRef.current })
      return resources === n.resources ? n : { ...n, resources }
    })
  const set = <K extends keyof Character>(key: K, value: Character[K]) => update((p) => ({ ...p, [key]: value }))

  // Keep hit die, spell slots and spell limits in step with the class table for this class + level.
  // Debounced because the level field fires on every keystroke.
  const { classIndex, level } = c
  const auto = c.spellcasting?.auto
  useEffect(() => {
    if (!classIndex) return
    let cancelled = false
    const timer = setTimeout(() => {
      Promise.all([getClass(classIndex), getClassLevel(classIndex, level)])
        .then(([cls, row]) => {
          if (cancelled) return
          setSyncError(undefined)
          tableRef.current = row.class_specific
          setClassTable(row.class_specific)
          update((p) => (p.classIndex === classIndex ? mergeClassTable(p, cls, row) : p))
        })
        .catch(() => !cancelled && setSyncError("Couldn't reach the SRD API, so class slots weren't filled in. Set them by hand, or retry when online."))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [classIndex, level, auto])

  const save = async () => {
    if (!c.name.trim()) return
    const clean = { ...c, name: c.name.trim(), className: className(c.classIndex) ?? c.className }
    if (clean.id === undefined) await db.characters.add(clean)
    else await db.characters.put(clean)
    onClose()
  }

  return (
    <div className="card form">
      <Section title={initial.id === undefined ? 'New character' : 'Edit character'}>
        <div className="field-grid identity">
          <label className="field span-2">
            <span>Name</span>
            <input value={c.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </label>
          <label className="field span-2">
            <span>Player</span>
            <input value={c.playerName} onChange={(e) => set('playerName', e.target.value)} />
          </label>
          <label className="field">
            <span>Class</span>
            <select
              value={c.classIndex ?? ''}
              onChange={(e) => {
                const idx = (e.target.value || undefined) as ClassIndex | undefined
                update((p) => ({
                  ...p,
                  classIndex: idx,
                  className: className(idx) ?? '',
                  saveProficiencies: idx ? CLASS_SAVES[idx] : p.saveProficiencies,
                  spellcasting: p.spellcasting ? { ...p.spellcasting, auto: true } : p.spellcasting,
                }))
              }}
            >
              {!c.classIndex && <option value="">{c.className ? `${c.className} (pick a class)` : 'Choose a class…'}</option>}
              {CLASSES.map((k) => (
                <option key={k.index} value={k.index}>
                  {k.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field span-2">
            <span>Subclass</span>
            <input value={c.subclass} onChange={(e) => set('subclass', e.target.value)} placeholder="e.g. Battle Master" />
          </label>
        </div>
        {syncError && <p className="warn">{syncError}</p>}
      </Section>

      <Section title="Combat stats">
        <div className="field-grid">
          <NumberField label="Level" value={c.level} min={1} onChange={(n) => set('level', Math.min(20, Math.max(1, Math.floor(n))))} />
          <div className="field" title="Derived from level">
            <span>Proficiency</span>
            <strong className="static-value">{formatMod(proficiencyBonus(c.level))}</strong>
          </div>
          <div className="field" title="From the class">
            <span>Hit die</span>
            <strong className="static-value">d{c.hitDie}</strong>
          </div>
          <NumberField label="Armor class" value={c.ac} onChange={(n) => set('ac', n)} />
          <NumberField
            label="Max HP"
            value={c.maxHp}
            min={1}
            onChange={(n) => update((p) => ({ ...p, maxHp: n, currentHp: p.currentHp === p.maxHp ? n : p.currentHp }))}
          />
          <NumberField label="Current HP" value={c.currentHp} min={0} onChange={(n) => set('currentHp', n)} />
          <NumberField label="Speed" value={c.speed} onChange={(n) => set('speed', n)} />
          <NumberField label="Initiative bonus" value={c.initiativeBonus} onChange={(n) => set('initiativeBonus', n)} />
          <NumberField label="Passive Perception" value={c.passivePerception} onChange={(n) => set('passivePerception', n)} />
        </div>
      </Section>

      <Section title="Ability scores">
        <div className="ability-row">
          {ABILITIES.map((a) => (
            <div key={a} className="ability">
              <NumberField
                label={a.toUpperCase()}
                value={c.abilities[a]}
                onChange={(n) => update((p) => ({ ...p, abilities: { ...p.abilities, [a]: n } }))}
              />
              <span className="ability-mod">{formatMod(abilityMod(c.abilities[a] || 10))}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Saving throws & defences">
        <div className="field-grid saves-grid">
          {ABILITIES.map((a) => {
            const proficient = c.saveProficiencies.includes(a)
            const bonus = abilityMod(c.abilities[a] || 10) + (proficient ? proficiencyBonus(c.level) : 0)
            return (
              <CheckField
                key={a}
                label={`${a.toUpperCase()} save ${formatMod(bonus)}`}
                title="Tick the saves this character is proficient in (the class grants two)"
                checked={proficient}
                onChange={(on) => set('saveProficiencies', on ? [...c.saveProficiencies, a] : c.saveProficiencies.filter((x) => x !== a))}
              />
            )
          })}
        </div>
        <div className="defence-grid">
          <DamageTypeList label="Resistances" hint="Half damage from these types" value={c.resistances} onChange={(v) => set('resistances', v)} />
          <DamageTypeList label="Immunities" hint="No damage from these types" value={c.immunities} onChange={(v) => set('immunities', v)} />
          <DamageTypeList label="Vulnerabilities" hint="Double damage from these types" value={c.vulnerabilities} onChange={(v) => set('vulnerabilities', v)} />
        </div>
      </Section>

      <ActionsEditor actions={c.actions} onChange={(actions) => set('actions', actions)} owner={c} />
      <SpellcastingEditor c={c} setC={update} />
      <ResourcesEditor
        resources={c.resources}
        onChange={(resources) => set('resources', resources)}
        owner={{ classIndex: c.classIndex, level: c.level, abilities: c.abilities, table: classTable }}
      />

      <Section title="Portrait">
        <div className="row gap-lg">
          <Portrait name={c.name} image={c.image} size={72} />
          <label className="field grow">
            <span>Image file</span>
            <input type="file" accept="image/*" onChange={(e) => set('image', e.target.files?.[0] ?? c.image)} />
          </label>
          {c.image && <button onClick={() => set('image', undefined)}>Remove image</button>}
        </div>
      </Section>

      <div className="form-actions">
        <button className="primary" onClick={save} disabled={!c.name.trim()}>
          Save character
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
