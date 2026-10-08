import { useMemo, useState } from 'react'
import { db } from '../db'
import { newId } from '../lib/id'
import { ActionsEditor } from '../components/ActionsEditor'
import { DamageTypeList } from '../components/DamageTypeList'
import { NumberField } from '../components/NumberField'
import { Section } from '../components/Section'
import { XP_BY_CR } from '../data/encounterBudget'
import { monsterCombatants, mutateCombat, sortCombatants } from '../lib/combat'
import { abilityMod, defaultAbilities, formatMod } from '../lib/dice'
import { t, tAbility, tCondition, tDamage, tMonsterType, tn, tSize } from '../lib/i18n'
import { crValue } from '../lib/monsters'
import { useCustomMonsters, useSrdMonsters } from '../lib/monsterLibrary'
import { ABILITIES, type Ability, type Action, type MonsterTemplate } from '../types'

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
        <h2>{t('bestiary.title')}</h2>
        <button className="primary" onClick={() => setEditing(blank())}>
          {t('bestiary.custom')}
        </button>
      </div>

      {editing && <MonsterForm initial={editing} onClose={() => setEditing(null)} />}

      <div className="filter-bar">
        <input
          className="grow"
          placeholder={t('bestiary.search')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setLimit(PAGE)
          }}
        />
        <label className="inline-field">
          {t('bestiary.cr')}
          <select value={crMin} onChange={(e) => { setCrMin(e.target.value); setLimit(PAGE) }}>
            {CR_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
          {t('bestiary.to')}
          <select value={crMax} onChange={(e) => { setCrMax(e.target.value); setLimit(PAGE) }}>
            {CR_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <select value={type} onChange={(e) => { setType(e.target.value); setLimit(PAGE) }} aria-label={t('bestiary.typeAria')}>
          <option value="">{t('bestiary.anyType')}</option>
          {types.map((ty) => <option key={ty} value={ty}>{tMonsterType(ty)}</option>)}
        </select>
        <select value={size} onChange={(e) => { setSize(e.target.value); setLimit(PAGE) }} aria-label={t('bestiary.sizeAria')}>
          <option value="">{t('bestiary.anySize')}</option>
          {sizes.map((sz) => <option key={sz} value={sz}>{tSize(sz)}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} aria-label={t('bestiary.sourceAria')}>
          <option value="all">{t('bestiary.srdCustom')}</option>
          <option value="srd">{t('bestiary.srdOnly')}</option>
          <option value="custom">{t('bestiary.customOnly')}</option>
        </select>
        {filtered && (
          <button onClick={() => { setSearch(''); setCrMin('0'); setCrMax('30'); setType(''); setSize(''); setSource('all') }}>{t('common.clear')}</button>
        )}
      </div>

      {!ready && (
        <p className="muted empty-note">
          {t('bestiary.downloading', { n: srd.length })}
        </p>
      )}
      <p className="muted count-line">
        {filtered ? tn('bestiary.countMatch', shown.length) : tn('bestiary.count', shown.length)}
      </p>

      <table className="monster-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => sortBy('name')}>{t('bestiary.colName')}{arrow('name')}</th>
            <th className="sortable" onClick={() => sortBy('cr')}>{t('bestiary.cr')}{arrow('cr')}</th>
            <th>{t('bestiary.colType')}</th>
            <th className="sortable" onClick={() => sortBy('ac')}>AC{arrow('ac')}</th>
            <th className="sortable" onClick={() => sortBy('hp')}>HP{arrow('hp')}</th>
            <th>XP</th>
            <th>{t('bestiary.colAdd')}</th>
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
          <button onClick={() => setLimit((l) => l + PAGE)}>{t('bestiary.showMore', { n: Math.min(PAGE, shown.length - limit) })}</button>
          <span className="muted">
            {t('bestiary.shown', { n: limit, total: shown.length })}
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
    }, t('bestiary.added', { name: m.name }))
  const xp = m.xp ?? XP_BY_CR[m.cr]

  return (
    <>
      <tr className={expanded ? 'expanded' : ''}>
        <td>
          <button className="link-btn name-btn" onClick={onToggle} aria-expanded={expanded}>
            {expanded ? '▾' : '▸'} {m.name}
          </button>{' '}
          {m.source === 'custom' && <span className="tag">{t('bestiary.tagCustom')}</span>}
          {m.legendaryUses ? <span className="tag legendary">{t('bestiary.tagLegendary')}</span> : null}
        </td>
        <td>{m.cr}</td>
        <td className="muted">{m.type ? tMonsterType(m.type) : '-'}</td>
        <td>{m.ac}</td>
        <td>{m.hp}</td>
        <td>{xp ?? '-'}</td>
        <td>
          <div className="row gap">
            <input className="narrow" type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} aria-label={t('bestiary.howMany', { name: m.name })} />
            <button onClick={add}>{t('common.add')}</button>
          </div>
        </td>
        <td>
          <div className="row gap">
            <button onClick={onEdit}>{m.source === 'srd' ? t('bestiary.copy') : t('common.edit')}</button>
            {m.source === 'custom' && (
              <button className="danger" onClick={() => confirm(t('bestiary.deleteConfirm', { name: m.name })) && db.monsters.delete(m.id!)}>
                {t('common.delete')}
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

const GROUPS: { timing: NonNullable<Action['timing']>; title: 'stat.group.action' | 'stat.group.bonus' | 'stat.group.reaction' | 'stat.group.legendary' }[] = [
  { timing: 'action', title: 'stat.group.action' },
  { timing: 'bonus', title: 'stat.group.bonus' },
  { timing: 'reaction', title: 'stat.group.reaction' },
  { timing: 'legendary', title: 'stat.group.legendary' },
]

/** A compact stat block. */
export function MonsterDetails({ m }: { m: MonsterTemplate }) {
  const line = (label: string, items?: string[]) => (items && items.length ? <div><strong>{label}</strong> {items.join(', ')}</div> : null)
  return (
    <div className="stat-block">
      <div className="muted">
        {t('stat.cr', { kind: [m.size ? tSize(m.size) : '', m.type ? tMonsterType(m.type) : ''].filter(Boolean).join(' '), cr: m.cr })}
        {m.xp !== undefined && (m.xpLair ? t('stat.xpLair', { xp: m.xp, lair: m.xpLair }) : t('stat.xp', { xp: m.xp }))}
        {t('stat.line', { ac: m.ac, hp: m.hp, speed: m.speed, init: formatMod(m.initiativeBonus) })}
      </div>
      <div className="stat-abilities">
        {ABILITIES.map((a) => (
          <div key={a}>
            <strong>{tAbility(a)}</strong> {m.abilities[a]} ({formatMod(abilityMod(m.abilities[a]))})
          </div>
        ))}
      </div>
      {m.saves && <div><strong>{t('stat.saves')}</strong> {Object.entries(m.saves).map(([k, v]) => `${tAbility(k as Ability)} ${formatMod(v)}`).join(', ')}</div>}
      {line(t('stat.resistances'), m.resistances?.map(tDamage))}
      {line(t('stat.immunities'), m.immunities?.map(tDamage))}
      {line(t('stat.vulnerabilities'), m.vulnerabilities?.map(tDamage))}
      {line(t('stat.conditionImmunities'), m.conditionImmunities?.map(tCondition))}
      {(m.traits ?? []).map((tr) => (
        <p key={tr.id}>
          <strong>{tr.name}{tr.uses ? t('stat.perDay', { n: tr.uses }) : ''}.</strong> {tr.desc}
        </p>
      ))}
      {GROUPS.map(({ timing, title }) => {
        const list = m.actions.filter((a) => (a.timing ?? 'action') === timing)
        if (!list.length) return null
        return (
          <div key={timing}>
            <div className="subhead">{t(title)}{timing === 'legendary' && m.legendaryUses ? t('stat.legendaryPerRound', { n: m.legendaryUses }) : ''}</div>
            {list.map((a) => (
              <p key={a.id}>
                <strong>
                  {a.name}
                  {a.limited?.kind === 'recharge' ? t('stat.recharge', { min: `${a.limited.min}${a.limited.min < 6 ? '-6' : ''}` }) : ''}
                  {a.limited?.kind === 'day' ? t('stat.perDay', { n: a.limited.times }) : ''}.
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
    const copy: MonsterTemplate = { ...base, id: undefined, name: `${base.name} (${t('bestiary.copySuffix')})`, source: 'custom', actions: base.actions.map((a) => ({ ...a, id: newId() })) }
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
      <Section title={initial.id === undefined && initial.source === 'custom' ? t('mform.new') : t('mform.edit')}>
        <div className="field-grid">
          <label className="field span-2">
            <span>{t('common.name')}</span>
            <input value={m.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>{t('mform.cr')}</span>
            <select value={m.cr} onChange={(e) => setM((p) => ({ ...p, cr: e.target.value, xp: p.xp === XP_BY_CR[p.cr] ? undefined : p.xp }))}>
              {CR_OPTIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <NumberField label={t('mform.xp', { n: XP_BY_CR[m.cr] ?? '-' })} value={m.xp ?? XP_BY_CR[m.cr] ?? 0} onChange={(n) => set('xp', n)} />
          <NumberField label={t('mform.ac')} value={m.ac} onChange={(n) => set('ac', n)} />
          <NumberField label={t('mform.hp')} value={m.hp} min={1} onChange={(n) => set('hp', n)} />
          <NumberField label={t('mform.speed')} value={m.speed} onChange={(n) => set('speed', n)} />
          <NumberField label={t('mform.init')} value={m.initiativeBonus} onChange={(n) => set('initiativeBonus', n)} />
          <NumberField label={t('mform.legendary')} value={m.legendaryUses ?? 0} min={0} onChange={(n) => set('legendaryUses', n > 0 ? Math.floor(n) : undefined)} />
        </div>
      </Section>

      <Section title={t('mform.abilities')}>
        <div className="ability-row">
          {ABILITIES.map((a) => (
            <div key={a} className="ability">
              <NumberField
                label={tAbility(a)}
                value={m.abilities[a]}
                onChange={(n) => setM((p) => ({ ...p, abilities: { ...p.abilities, [a]: n } }))}
              />
              <span className="ability-mod">{formatMod(abilityMod(m.abilities[a] || 10))}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('mform.defences')}>
        <div className="defence-grid">
          <DamageTypeList label={t('stat.resistances')} value={m.resistances ?? []} onChange={(v) => set('resistances', v)} />
          <DamageTypeList label={t('stat.immunities')} value={m.immunities ?? []} onChange={(v) => set('immunities', v)} />
          <DamageTypeList label={t('stat.vulnerabilities')} value={m.vulnerabilities ?? []} onChange={(v) => set('vulnerabilities', v)} />
        </div>
      </Section>

      <ActionsEditor actions={m.actions} onChange={(actions) => set('actions', actions)} />

      <div className="form-actions">
        <button className="primary" onClick={save} disabled={!m.name.trim()}>
          {t('mform.save')}
        </button>
        <button onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}
