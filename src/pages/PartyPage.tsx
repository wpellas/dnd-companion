import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { ActionsEditor } from '../components/ActionsEditor'
import { AwardPanel } from '../components/AwardPanel'
import { InventoryEditor } from '../components/InventoryEditor'
import { RewardBanner } from '../components/RewardBanner'
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
import { t, tAbility, tClass, tn } from '../lib/i18n'
import { mergeClassTable, normalizeCharacter, proficiencyBonus } from '../lib/character'
import { abilityMod, defaultAbilities, formatMod } from '../lib/dice'
import { canLevelUp, levelForXp, totalGp, withGearAc, xpForNextLevel } from '../lib/inventory'
import { hitDiceRemaining } from '../lib/rest'
import { levelLabel } from '../lib/spells'
import { getClass, getClassLevel } from '../lib/srdApi'
import { showToPlayers, stopShowing, useSpotlight } from '../lib/spotlight'
import { getCampaign, updateCharacter } from '../lib/store'
import { ABILITIES, CLASSES, type Character, type ClassIndex } from '../types'

const RECHARGE_ICON = { short: '☾', 'short-one': '☾¹', long: '☀' } as const
const RECHARGE_TITLE = { short: 'party.rt.short', 'short-one': 'party.rt.shortOne', long: 'party.rt.long' } as const

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
  const [awarding, setAwarding] = useState(false)
  const inCombat = combat?.started ?? false

  return (
    <div className="page">
      <div className="toolbar">
        <h2>{t('party.title')}</h2>
        {campaign && (
          <span className="campaign-badge" title={t('party.campaignTitle')}>
            {tn('party.campaign', campaign.shortRestsSinceLong, { day: campaign.day })}
          </span>
        )}
        <button
          disabled={inCombat || !characters?.length}
          title={inCombat ? t('party.finishFirst') : undefined}
          onClick={() => setResting('short')}
        >
          {t('rest.short')}
        </button>
        <button
          disabled={inCombat || !characters?.length}
          title={inCombat ? t('party.finishFirst') : undefined}
          onClick={() => setResting('long')}
        >
          {t('rest.long')}
        </button>
        <button disabled={!characters?.length} onClick={() => setAwarding(true)}>
          {t('award.button')}
        </button>
        <button className="primary" onClick={() => setEditing(blank())}>
          {t('party.new')}
        </button>
      </div>

      <RewardBanner />
      {awarding && characters && <AwardPanel characters={characters.map(normalizeCharacter)} onClose={() => setAwarding(false)} />}

      {resting && characters && <RestPanel kind={resting} characters={characters.map(normalizeCharacter)} onClose={() => setResting(undefined)} />}
      {editing && <CharacterForm initial={editing} onClose={() => setEditing(null)} />}

      <div className="card-grid">
        {characters?.map(normalizeCharacter).map((c) => (
          <CharacterCard key={c.id} c={c} onEdit={() => setEditing(c)} />
        ))}
        {characters?.length === 0 && <p className="muted">{t('party.empty')}</p>}
      </div>
    </div>
  )
}

function CharacterCard({ c, onEdit }: { c: Character; onEdit: () => void }) {
  const [showItems, setShowItems] = useState(false)
  const spotlight = useSpotlight()
  const shown = spotlight?.characterId === c.id
  const sc = c.spellcasting
  const xp = c.xp ?? 0
  const nextXp = xpForNextLevel(c.level)
  const slotRows = sc?.slots.map((s, i) => ({ ...s, level: i + 1 })).filter((s) => s.max > 0) ?? []
  const update = (patch: Partial<Character>) => db.characters.update(c.id!, patch)

  return (
    <div className={`card ${showItems ? 'wide' : ''}`}>
      <div className="row gap-lg">
        <Portrait name={c.name} image={c.image} size={72} />
        <div>
          <strong>{c.name}</strong>
          <div className="muted">
            {tClass(c.classIndex) ?? c.className} {c.level}
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
        <span>{t('party.prof', { n: formatMod(proficiencyBonus(c.level)) })}</span>
        <span>{t('party.init', { n: formatMod(c.initiativeBonus) })}</span>
        <span>{t('party.pp', { n: c.passivePerception })}</span>
        {(c.exhaustion ?? 0) > 0 && <span title={t('party.exhaustionTitle')}>{t('party.exhaustion', { n: c.exhaustion ?? 0 })}</span>}
        <span title={t('party.hdTitle')}>{t('party.hd', { left: hitDiceRemaining(c), level: c.level, die: c.hitDie })}</span>
      </div>

      <div className="wealth">
        <span title={t('wealth.gpTitle')}>💰 {Math.floor(totalGp(c.coins)).toLocaleString()} gp</span>
        <span title={t('wealth.xpTitle')}>
          XP {xp.toLocaleString()}
          {nextXp !== undefined ? ` / ${nextXp.toLocaleString()}` : ''}
        </span>
        {canLevelUp(c) && <span className="levelup-badge">{t('wealth.ready', { n: levelForXp(xp) })}</span>}
      </div>

      {slotRows.length > 0 && (
        <div className="slot-rows" title={t('party.slotsTitle')}>
          {slotRows.map((s) => (
            <div key={s.level} className="slot-row">
              <span className="muted">{levelLabel(s.level)}</span>
              <UsePips
                max={s.max}
                used={s.used}
                label={t('spell.slots', { level: levelLabel(s.level) })}
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
          {t('party.spellCount', { c: sc.cantrips.length, cl: sc.cantripLimit, p: sc.prepared.length, pl: sc.preparedLimit })}
        </div>
      )}

      {c.resources.length > 0 && (
        <div className="slot-rows">
          {c.resources.map((r) => (
            <div key={r.id} className="slot-row">
              <span className="muted" title={t(RECHARGE_TITLE[r.recharge])}>
                {r.name || t('party.feature')} {RECHARGE_ICON[r.recharge]}
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

      {showItems && <InventoryEditor c={c} onChange={(patch) => updateCharacter(c.id!, patch)} />}

      <div className="card-actions">
        <button
          className={shown ? 'selected' : ''}
          title={shown ? t('party.showTitleOn') : t('party.showTitle')}
          onClick={() => (shown ? stopShowing() : showToPlayers(c.id!))}
        >
          📺 {shown ? t('party.showcasing') : t('party.showcase')}
        </button>
        <button onClick={() => setShowItems((v) => !v)}>{t('inv.items')}{(c.items ?? []).length ? ` (${(c.items ?? []).length})` : ''}</button>
        <button onClick={onEdit}>{t('common.edit')}</button>
        <button className="danger" onClick={() => confirm(t('party.deleteConfirm', { name: c.name })) && db.characters.delete(c.id!)}>
          {t('common.delete')}
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
      const n = withGearAc(fn(p))
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
        .catch(() => !cancelled && setSyncError(t('form.syncError')))
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
      <Section title={initial.id === undefined ? t('form.new') : t('form.edit')}>
        <div className="field-grid identity">
          <label className="field span-2">
            <span>{t('common.name')}</span>
            <input value={c.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </label>
          <label className="field span-2">
            <span>{t('form.player')}</span>
            <input value={c.playerName} onChange={(e) => set('playerName', e.target.value)} />
          </label>
          <label className="field">
            <span>{t('form.class')}</span>
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
              {!c.classIndex && <option value="">{c.className ? t('form.pickClass', { name: c.className }) : t('form.chooseClass')}</option>}
              {CLASSES.map((k) => (
                <option key={k.index} value={k.index}>
                  {tClass(k.index)}
                </option>
              ))}
            </select>
          </label>
          <label className="field span-2">
            <span>{t('form.subclass')}</span>
            <input value={c.subclass} onChange={(e) => set('subclass', e.target.value)} placeholder={t('form.subclassPlaceholder')} />
          </label>
        </div>
        {syncError && <p className="warn">{syncError}</p>}
      </Section>

      <Section title={t('form.combatStats')}>
        <div className="field-grid">
          <NumberField label={t('form.level')} value={c.level} min={1} onChange={(n) => set('level', Math.min(20, Math.max(1, Math.floor(n))))} />
          <div className="field" title={t('form.derivedLevel')}>
            <span>{t('form.proficiency')}</span>
            <strong className="static-value">{formatMod(proficiencyBonus(c.level))}</strong>
          </div>
          <div className="field" title={t('form.fromClass')}>
            <span>{t('form.hitDie')}</span>
            <strong className="static-value">d{c.hitDie}</strong>
          </div>
          {c.acFromGear ? (
            <div className="field" title={t('form.acFromGearTitle')}>
              <span>{t('form.ac')}</span>
              <strong className="static-value">{c.ac}</strong>
            </div>
          ) : (
            <NumberField label={t('form.ac')} value={c.ac} onChange={(n) => set('ac', n)} />
          )}
          <NumberField
            label={t('form.maxHp')}
            value={c.maxHp}
            min={1}
            onChange={(n) => update((p) => ({ ...p, maxHp: n, currentHp: p.currentHp === p.maxHp ? n : p.currentHp }))}
          />
          <NumberField label={t('form.currentHp')} value={c.currentHp} min={0} onChange={(n) => set('currentHp', n)} />
          <NumberField label={t('form.speed')} value={c.speed} onChange={(n) => set('speed', n)} />
          <NumberField label={t('form.initBonus')} value={c.initiativeBonus} onChange={(n) => set('initiativeBonus', n)} />
          <NumberField label={t('form.passive')} value={c.passivePerception} onChange={(n) => set('passivePerception', n)} />
          <NumberField label={t('form.exhaustion')} value={c.exhaustion ?? 0} min={0} onChange={(n) => set('exhaustion', Math.min(6, Math.max(0, Math.floor(n))))} />
        </div>
      </Section>

      <Section title={t('form.abilities')}>
        <div className="ability-row">
          {ABILITIES.map((a) => (
            <div key={a} className="ability">
              <NumberField
                label={tAbility(a)}
                value={c.abilities[a]}
                onChange={(n) => update((p) => ({ ...p, abilities: { ...p.abilities, [a]: n } }))}
              />
              <span className="ability-mod">{formatMod(abilityMod(c.abilities[a] || 10))}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('form.savesDefences')}>
        <div className="field-grid saves-grid">
          {ABILITIES.map((a) => {
            const proficient = c.saveProficiencies.includes(a)
            const bonus = abilityMod(c.abilities[a] || 10) + (proficient ? proficiencyBonus(c.level) : 0)
            return (
              <CheckField
                key={a}
                label={t('form.saveLabel', { abil: tAbility(a), n: formatMod(bonus) })}
                title={t('form.saveTitle')}
                checked={proficient}
                onChange={(on) => set('saveProficiencies', on ? [...c.saveProficiencies, a] : c.saveProficiencies.filter((x) => x !== a))}
              />
            )
          })}
        </div>
        <div className="defence-grid">
          <DamageTypeList label={t('form.resistances')} hint={t('form.resistancesHint')} value={c.resistances} onChange={(v) => set('resistances', v)} />
          <DamageTypeList label={t('form.immunities')} hint={t('form.immunitiesHint')} value={c.immunities} onChange={(v) => set('immunities', v)} />
          <DamageTypeList label={t('form.vulnerabilities')} hint={t('form.vulnerabilitiesHint')} value={c.vulnerabilities} onChange={(v) => set('vulnerabilities', v)} />
        </div>
      </Section>

      <ActionsEditor actions={c.actions} onChange={(actions) => set('actions', actions)} owner={c} />
      <SpellcastingEditor c={c} setC={update} />
      <ResourcesEditor
        resources={c.resources}
        onChange={(resources) => set('resources', resources)}
        owner={{ classIndex: c.classIndex, level: c.level, abilities: c.abilities, table: classTable }}
      />

      <Section title={t('form.equipment')}>
        <InventoryEditor c={c} onChange={(patch) => update((p) => ({ ...p, ...patch }))} />
      </Section>

      <Section title={t('form.portrait')}>
        <div className="row gap-lg">
          <Portrait name={c.name} image={c.image} size={72} />
          <label className="field grow">
            <span>{t('form.imageFile')}</span>
            <input type="file" accept="image/*" onChange={(e) => set('image', e.target.files?.[0] ?? c.image)} />
          </label>
          {c.image && <button onClick={() => set('image', undefined)}>{t('form.removeImage')}</button>}
        </div>
      </Section>

      <div className="form-actions">
        <button className="primary" onClick={save} disabled={!c.name.trim()}>
          {t('form.saveCharacter')}
        </button>
        <button onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}
