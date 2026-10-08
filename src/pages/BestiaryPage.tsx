import { useMemo, useState } from 'react'
import { db } from '../db'
import { ActionsEditor } from '../components/ActionsEditor'
import { DamageTypeList } from '../components/DamageTypeList'
import { NumberField } from '../components/NumberField'
import { Section } from '../components/Section'
import { XP_BY_CR } from '../data/encounterBudget'
import { monsterCombatants, mutateCombat, sortCombatants } from '../lib/combat'
import { abilityMod, defaultAbilities, formatMod } from '../lib/dice'
import { crValue } from '../lib/monsters'
import { useCustomMonsters, useSrdMonsters } from '../lib/monsterLibrary'
import { ABILITIES, type Action, type MonsterTemplate } from '../types'

const CR_OPTIONS = ['0', '1/8', '1/4', '1/2', ...Array.from({ length: 30 }, (_, i) => String(i + 1))]
const PAGE = 60

type SortKey = 'name' | 'cr' | 'ac' | 'hp'

const blank = (): MonsterTemplate => ({
  name: '',
  cr: '0',
  ac: 10,
  hp: 10,
  speed: 30,
  initiativeBonus: 0,
  abilities: defaultAbilities(),
  actions: [],
  source: 'custom',
})

export function BestiaryPage() {
  const { monsters: srd, ready } = useSrdMonsters()
  const custom = useCustomMonsters()
  const [search, setSearch] = useState('')
  const [crMin, setCrMin] = useState('0')
  const [crMax, setCrMax] = useState('30')
  const [type, setType] = useState('')
  const [size, setSize] = useState('')
  const [source, setSource] = useState<'all' | 'srd' | 'custom'>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 })
  const [limit, setLimit] = useState(PAGE)
  const [editing, setEditing] = useState<MonsterTemplate | null>(null)
  const [open, setOpen] = useState<string>()

  const all = useMemo(() => [...custom, ...srd], [custom, srd])
  const types = useMemo(() => [...new Set(srd.map((m) => m.type).filter(Boolean))].sort() as string[], [srd])
  const sizes = useMemo(() => [...new Set(srd.map((m) => m.size).filter(Boolean))] as string[], [srd])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    const lo = crValue(crMin)
    const hi = crValue(crMax)
    const list = all.filter(
      (m) =>
        (source === 'all' || m.source === source) &&
        (!q || m.name.toLowerCase().includes(q)) &&
        crValue(m.cr) >= lo &&
        crValue(m.cr) <= hi &&
        (!type || m.type === type) &&
        (!size || m.size === size),
    )
    const cmp: Record<SortKey, (a: MonsterTemplate, b: MonsterTemplate) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      cr: (a, b) => crValue(a.cr) - crValue(b.cr) || a.name.localeCompare(b.name),
      ac: (a, b) => a.ac - b.ac || a.name.localeCompare(b.name),
      hp: (a, b) => a.hp - b.hp || a.name.localeCompare(b.name),
    }
    return list.sort((a, b) => cmp[sort.key](a, b) * sort.dir)
  }, [all, search, crMin, crMax, type, size, source, sort])

  const keyOf = (m: MonsterTemplate) => m.srdIndex ?? `custom-${m.id}`
  const sortBy = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : '')
  const filtered = search || crMin !== '0' || crMax !== '30' || type || size || source !== 'all'

  return (
    <div className="page">
      <div className="toolbar">
        <h2>Bestiary</h2>
        <button className="primary" onClick={() => setEditing(blank())}>
          + Custom monster
        </button>
      </div>

      {editing && <MonsterForm initial={editing} onClose={() => setEditing(null)} />}

      <div className="filter-bar">
        <input
          className="grow"
          placeholder="Search monsters…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setLimit(PAGE)
          }}
        />
        <label className="inline-field">
          CR
          <select value={crMin} onChange={(e) => { setCrMin(e.target.value); setLimit(PAGE) }}>
            {CR_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
          to
          <select value={crMax} onChange={(e) => { setCrMax(e.target.value); setLimit(PAGE) }}>
            {CR_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <select value={type} onChange={(e) => { setType(e.target.value); setLimit(PAGE) }} aria-label="Type">
          <option value="">Any type</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={size} onChange={(e) => { setSize(e.target.value); setLimit(PAGE) }} aria-label="Size">
          <option value="">Any size</option>
          {sizes.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} aria-label="Source">
          <option value="all">SRD + custom</option>
          <option value="srd">SRD only</option>
          <option value="custom">Custom only</option>
        </select>
        {filtered && (
          <button onClick={() => { setSearch(''); setCrMin('0'); setCrMax('30'); setType(''); setSize(''); setSource('all') }}>Clear</button>
        )}
      </div>

      {!ready && (
        <p className="muted empty-note">
          The SRD monster library is still downloading in the background ({srd.length} so far). This only happens the first time.
        </p>
      )}
      <p className="muted count-line">
        {shown.length} monster{shown.length === 1 ? '' : 's'}
        {filtered ? ' match' : ''}
      </p>

      <table className="monster-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => sortBy('name')}>Name{arrow('name')}</th>
            <th className="sortable" onClick={() => sortBy('cr')}>CR{arrow('cr')}</th>
            <th>Type</th>
            <th className="sortable" onClick={() => sortBy('ac')}>AC{arrow('ac')}</th>
            <th className="sortable" onClick={() => sortBy('hp')}>HP{arrow('hp')}</th>
            <th>XP</th>
            <th>Add to combat</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {shown.slice(0, limit).map((m) => (
            <MonsterRow
              key={keyOf(m)}
              m={m}
              expanded={open === keyOf(m)}
              onToggle={() => setOpen(open === keyOf(m) ? undefined : keyOf(m))}
              onEdit={() => setEditing(m)}
            />
          ))}
        </tbody>
      </table>
      {shown.length > limit && (
        <div className="row gap" style={{ marginTop: 12 }}>
          <button onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</button>
          <span className="muted">
            {limit} of {shown.length} shown
          </span>
        </div>
      )}
    </div>
  )
}

function MonsterRow({ m, expanded, onToggle, onEdit }: { m: MonsterTemplate; expanded: boolean; onToggle: () => void; onEdit: () => void }) {
  const [count, setCount] = useState('1')
  const add = () =>
    mutateCombat((s) => {
      s.combatants.push(...monsterCombatants(m, Math.max(1, Math.floor(Number(count)) || 1), s.combatants))
      if (s.started) sortCombatants(s)
    }, `Added ${m.name}`)
  const xp = m.xp ?? XP_BY_CR[m.cr]

  return (
    <>
      <tr className={expanded ? 'expanded' : ''}>
        <td>
          <button className="link-btn name-btn" onClick={onToggle} aria-expanded={expanded}>
            {expanded ? '▾' : '▸'} {m.name}
          </button>{' '}
          {m.source === 'custom' && <span className="tag">custom</span>}
          {m.legendaryUses ? <span className="tag legendary">legendary</span> : null}
        </td>
        <td>{m.cr}</td>
        <td className="muted">{m.type ?? '-'}</td>
        <td>{m.ac}</td>
        <td>{m.hp}</td>
        <td>{xp ?? '-'}</td>
        <td>
          <div className="row gap">
            <input className="narrow" type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} aria-label={`How many ${m.name}`} />
            <button onClick={add}>Add</button>
          </div>
        </td>
        <td>
          <div className="row gap">
            <button onClick={onEdit}>{m.source === 'srd' ? 'Copy' : 'Edit'}</button>
            {m.source === 'custom' && (
              <button className="danger" onClick={() => confirm(`Delete ${m.name}?`) && db.monsters.delete(m.id!)}>
                Delete
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="details-row">
          <td colSpan={8}>
            <MonsterDetails m={m} />
          </td>
        </tr>
      )}
    </>
  )
}

const GROUPS: { timing: NonNullable<Action['timing']>; title: string }[] = [
  { timing: 'action', title: 'Actions' },
  { timing: 'bonus', title: 'Bonus actions' },
  { timing: 'reaction', title: 'Reactions' },
  { timing: 'legendary', title: 'Legendary actions' },
]

/** A compact stat block. */
export function MonsterDetails({ m }: { m: MonsterTemplate }) {
  const line = (label: string, items?: string[]) => (items && items.length ? <div><strong>{label}</strong> {items.join(', ')}</div> : null)
  return (
    <div className="stat-block">
      <div className="muted">
        {[m.size, m.type].filter(Boolean).join(' ')} · CR {m.cr}
        {m.xp !== undefined && ` (${m.xp} XP${m.xpLair ? `, ${m.xpLair} in lair` : ''})`} · AC {m.ac} · HP {m.hp} · Speed {m.speed} ft · Initiative {formatMod(m.initiativeBonus)}
      </div>
      <div className="stat-abilities">
        {ABILITIES.map((a) => (
          <div key={a}>
            <strong>{a.toUpperCase()}</strong> {m.abilities[a]} ({formatMod(abilityMod(m.abilities[a]))})
          </div>
        ))}
      </div>
      {m.saves && <div><strong>Saves</strong> {Object.entries(m.saves).map(([k, v]) => `${k.toUpperCase()} ${formatMod(v)}`).join(', ')}</div>}
      {line('Resistances', m.resistances)}
      {line('Immunities', m.immunities)}
      {line('Vulnerabilities', m.vulnerabilities)}
      {line('Condition immunities', m.conditionImmunities)}
      {(m.traits ?? []).map((t) => (
        <p key={t.id}>
          <strong>{t.name}{t.uses ? ` (${t.uses}/day)` : ''}.</strong> {t.desc}
        </p>
      ))}
      {GROUPS.map(({ timing, title }) => {
        const list = m.actions.filter((a) => (a.timing ?? 'action') === timing)
        if (!list.length) return null
        return (
          <div key={timing}>
            <div className="subhead">{title}{timing === 'legendary' && m.legendaryUses ? ` (${m.legendaryUses} per round)` : ''}</div>
            {list.map((a) => (
              <p key={a.id}>
                <strong>
                  {a.name}
                  {a.limited?.kind === 'recharge' ? ` (Recharge ${a.limited.min}${a.limited.min < 6 ? '-6' : ''})` : ''}
                  {a.limited?.kind === 'day' ? ` (${a.limited.times}/day)` : ''}.
                </strong>{' '}
                {a.desc ?? ''}
              </p>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function MonsterForm({ initial, onClose }: { initial: MonsterTemplate; onClose: () => void }) {
  // Editing an SRD entry saves a custom copy rather than altering the original.
  const [m, setM] = useState<MonsterTemplate>(() => {
    const base = { ...initial, actions: structuredClone(initial.actions ?? []) }
    if (base.source !== 'srd') return base
    const copy: MonsterTemplate = { ...base, id: undefined, name: `${base.name} (copy)`, source: 'custom', actions: base.actions.map((a) => ({ ...a, id: crypto.randomUUID() })) }
    delete copy.srdIndex
    return copy
  })
  const set = <K extends keyof MonsterTemplate>(key: K, value: MonsterTemplate[K]) => setM((p) => ({ ...p, [key]: value }))

  const save = async () => {
    if (!m.name.trim()) return
    const clean = { ...m, name: m.name.trim(), xp: m.xp ?? XP_BY_CR[m.cr] }
    if (clean.id === undefined) await db.monsters.add(clean)
    else await db.monsters.put(clean)
    onClose()
  }

  return (
    <div className="card form">
      <Section title={initial.id === undefined && initial.source === 'custom' ? 'New monster' : 'Edit monster'}>
        <div className="field-grid">
          <label className="field span-2">
            <span>Name</span>
            <input value={m.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>Challenge rating</span>
            <select value={m.cr} onChange={(e) => setM((p) => ({ ...p, cr: e.target.value, xp: p.xp === XP_BY_CR[p.cr] ? undefined : p.xp }))}>
              {CR_OPTIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <NumberField label={`XP (default ${XP_BY_CR[m.cr] ?? '-'})`} value={m.xp ?? XP_BY_CR[m.cr] ?? 0} onChange={(n) => set('xp', n)} />
          <NumberField label="Armor class" value={m.ac} onChange={(n) => set('ac', n)} />
          <NumberField label="Hit points" value={m.hp} min={1} onChange={(n) => set('hp', n)} />
          <NumberField label="Speed" value={m.speed} onChange={(n) => set('speed', n)} />
          <NumberField label="Initiative bonus" value={m.initiativeBonus} onChange={(n) => set('initiativeBonus', n)} />
          <NumberField label="Legendary actions / round" value={m.legendaryUses ?? 0} min={0} onChange={(n) => set('legendaryUses', n > 0 ? Math.floor(n) : undefined)} />
        </div>
      </Section>

      <Section title="Ability scores">
        <div className="ability-row">
          {ABILITIES.map((a) => (
            <div key={a} className="ability">
              <NumberField
                label={a.toUpperCase()}
                value={m.abilities[a]}
                onChange={(n) => setM((p) => ({ ...p, abilities: { ...p.abilities, [a]: n } }))}
              />
              <span className="ability-mod">{formatMod(abilityMod(m.abilities[a] || 10))}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Defences">
        <div className="defence-grid">
          <DamageTypeList label="Resistances" value={m.resistances ?? []} onChange={(v) => set('resistances', v)} />
          <DamageTypeList label="Immunities" value={m.immunities ?? []} onChange={(v) => set('immunities', v)} />
          <DamageTypeList label="Vulnerabilities" value={m.vulnerabilities ?? []} onChange={(v) => set('vulnerabilities', v)} />
        </div>
      </Section>

      <ActionsEditor actions={m.actions} onChange={(actions) => set('actions', actions)} />

      <div className="form-actions">
        <button className="primary" onClick={save} disabled={!m.name.trim()}>
          Save monster
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
