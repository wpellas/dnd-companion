import { ArrowUp, Backpack, Coins, Moon, Sparkles, Star, Sun, Tv } from 'lucide-react'
import { askConfirm } from '../lib/ask'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { ActionsEditor } from '../components/ActionsEditor'
import { AwardPanel } from '../components/AwardPanel'
import { InventoryDialog } from '../components/InventoryDialog'
import { Window } from '../components/Window'
import { useSettings } from '../lib/settings'
import { InventoryEditor } from '../components/InventoryEditor'
import { LevelUpPanel } from '../components/LevelUpPanel'
import { RewardBanner } from '../components/RewardBanner'
import { NumberField } from '../components/NumberField'
import { Portrait } from '../components/Portrait'
import { ChecksPanel } from '../components/ChecksPanel'
import { TimePanel } from '../components/TimePanel'
import { SpellFinder } from '../components/SpellFinder'
import { CharacterResources } from '../components/CharacterResources'
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
import { canLevelUp, itemsGp, levelForXp, totalGp, withGearAc, XP_FOR_LEVEL, xpForNextLevel } from '../lib/inventory'
import { hitDiceRemaining } from '../lib/rest'
import { levelLabel } from '../lib/spells'
import { getClass, getClassLevel } from '../lib/srdApi'
import { showToPlayers, stopShowing, useSpotlight } from '../lib/spotlight'
import { useMembers } from '../lib/members'
import { useSession } from '../lib/session'
import { getCampaign, updateCharacter } from '../lib/store'
import { ABILITIES, CLASSES, type Character, type ClassIndex } from '../types'


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
  const { trackTime } = useSettings() // off: no "Light and time" panel on this page
  const [editing, setEditing] = useState<Character | null>(null)
  const [resting, setResting] = useState<'short' | 'long'>()
  const [awarding, setAwarding] = useState(false)
  const [levelling, setLevelling] = useState<Character | null>(null)
  const inCombat = combat?.started ?? false
  const isDm = useSession().campaign?.role === 'dm' // a player sees and edits only their own characters

  return (
    <div className="page">
      <div className="toolbar">
        <h2>{t('party.title')}</h2>
        {isDm && campaign && (
          <span className="campaign-badge" title={t('party.campaignTitle')}>
            {tn('party.campaign', campaign.shortRestsSinceLong, { day: campaign.day })}
          </span>
        )}
        {isDm && (
          <>
            <button
              disabled={inCombat || !characters?.length}
              title={inCombat ? t('party.finishFirst') : undefined}
              onClick={() => setResting('short')}
            >
              <Moon /> {t('rest.short')}
            </button>
            <button
              disabled={inCombat || !characters?.length}
              title={inCombat ? t('party.finishFirst') : undefined}
              onClick={() => setResting('long')}
            >
              <Sun /> {t('rest.long')}
            </button>
            <button disabled={!characters?.length} onClick={() => setAwarding(true)}>
              <Sparkles /> {t('award.button')}
            </button>
          </>
        )}
        <button className="primary" onClick={() => setEditing(blank())}>
          {t('party.new')}
        </button>
      </div>

      {isDm && <RewardBanner />}
      {isDm && !!characters?.length && <SpellFinder characters={characters.map(normalizeCharacter)} />}
      {isDm && trackTime && <TimePanel />}
      {isDm && !!characters?.length && <ChecksPanel characters={characters.map(normalizeCharacter)} />}
      {awarding && characters && <AwardPanel characters={characters.map(normalizeCharacter)} onClose={() => setAwarding(false)} />}

      {resting && characters && <RestPanel kind={resting} characters={characters.map(normalizeCharacter)} onClose={() => setResting(undefined)} />}
      {levelling && <LevelUpPanel c={levelling} onClose={() => setLevelling(null)} />}
      {editing && <CharacterForm initial={editing} onClose={() => setEditing(null)} />}

      <div className="card-grid still">
        {characters?.map(normalizeCharacter).map((c) => (
          <CharacterCard key={c.id} c={c} onEdit={() => setEditing(c)} onLevelUp={() => setLevelling(c)} />
        ))}
        {characters?.length === 0 && <p className="muted">{t('party.empty')}</p>}
      </div>
    </div>
  )
}

function CharacterCard({ c, onEdit, onLevelUp }: { c: Character; onEdit: () => void; onLevelUp: () => void }) {
  const [showItems, setShowItems] = useState(false)
  const spotlight = useSpotlight()
  const shown = spotlight?.characterId === c.id
  const sc = c.spellcasting
  const xp = c.xp ?? 0
  const nextXp = xpForNextLevel(c.level)
  const xpFrom = XP_FOR_LEVEL[Math.min(20, Math.max(1, c.level)) - 1]
  const xpPct = nextXp === undefined ? 100 : Math.round(100 * Math.min(1, Math.max(0, (xp - xpFrom) / (nextXp - xpFrom))))
  const slotRows = sc?.slots.map((s, i) => ({ ...s, level: i + 1 })).filter((s) => s.max > 0) ?? []
  const update = (patch: Partial<Character>) => db.characters.update(c.id!, patch)
  const isDm = useSession().campaign?.role === 'dm'

  return (
    <div className="card">
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
        <span className="gp" title={t('wealth.gpTitle')}>
          <Coins /> {Math.floor(totalGp(c.coins)).toLocaleString()} gp
        </span>
        {itemsGp(c) > 0 && (
          <span className="gp items" title={t('inv.itemsWorthTitle')}>
            <Backpack /> {itemsGp(c).toLocaleString()} gp
          </span>
        )}
        {/* the blue pill fills as the character gets closer to the next level */}
        <span className="xp" style={{ '--p': `${xpPct}%` } as CSSProperties} title={t('wealth.xpTitle')}>
          XP {xp.toLocaleString()}
          {nextXp !== undefined ? ` / ${nextXp.toLocaleString()}` : ''}
        </span>
        {canLevelUp(c) && <span className="levelup-badge"><ArrowUp /> {t('wealth.ready', { n: levelForXp(xp) })}</span>}
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

      <CharacterResources c={c} />

      {showItems && <InventoryDialog c={c} onChange={(patch) => updateCharacter(c.id!, patch)} onClose={() => setShowItems(false)} />}

      <div className="card-actions">
        {isDm && (
          <button
            className={shown ? 'selected' : ''}
            title={shown ? t('party.showTitleOn') : t('party.showTitle')}
            onClick={() => (shown ? stopShowing() : showToPlayers(c.id!))}
          >
            <Tv /> {shown ? t('party.showcasing') : t('party.showcase')}
          </button>
        )}
        <button className={c.heroicInspiration ? 'selected' : ''} title={t('insp.title')} aria-pressed={!!c.heroicInspiration} onClick={() => updateCharacter(c.id!, { heroicInspiration: !c.heroicInspiration })}>
          <Star /> {t('insp.button')}
        </button>
        <button onClick={() => setShowItems(true)}><Backpack /> {t('inv.items')}{(c.items ?? []).length ? ` (${(c.items ?? []).length})` : ''}</button>
        {c.classIndex && c.level < 20 && (
          <button className={canLevelUp(c) ? 'primary' : ''} title={t('lvl.buttonTitle')} onClick={onLevelUp}>
            <ArrowUp /> {t('lvl.button')}
          </button>
        )}
        <button onClick={onEdit}>{t('common.edit')}</button>
        <button className="danger" onClick={async () => (await askConfirm(t('party.deleteConfirm', { name: c.name }), t('common.delete'))) && db.characters.delete(c.id!)}>
          {t('common.delete')}
        </button>
      </div>
    </div>
  )
}

function CharacterForm({ initial, onClose }: { initial: Character; onClose: () => void }) {
  const [c, setC] = useState<Character>(() => normalizeCharacter(initial))
  const [syncError, setSyncError] = useState<string>()
  const members = useMembers()
  const me = useSession()
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
    // unsaved typing lives in this window, so a click on the dimmed area does not close it; Escape and Cancel do
    <Window
      large
      tall
      title={initial.id === undefined ? t('form.new') : t('form.edit')}
      onClose={onClose}
      actions={
        <>
          <button onClick={onClose}>{t('common.cancel')}</button>
          <button className="primary" onClick={save} disabled={!c.name.trim()}>
            {t('form.saveCharacter')}
          </button>
        </>
      }
    >
      <Section title={t('form.identity')}>
        <div className="field-grid identity">
          <label className="field span-2">
            <span>{t('common.name')}</span>
            <input value={c.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </label>
          <label className="field span-2">
            <span>{t('form.player')}</span>
            <input value={c.playerName} onChange={(e) => set('playerName', e.target.value)} />
          </label>
          {me.campaign?.role === 'dm' && members.length > 0 && (
            <label className="field span-2" title={t('form.ownerHint')}>
              <span>{t('form.owner')}</span>
              <select
                value={c.ownerId ?? me.user?.id ?? ''}
                onChange={(e) => {
                  const owner = members.find((m) => m.id === Number(e.target.value))
                  update((p) => ({ ...p, ownerId: owner?.id, playerName: p.playerName || (owner?.role === 'player' ? owner.name : '') }))
                }}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.role === 'dm' ? t('form.ownerDm') : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
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
          <NumberField label={t('form.passiveInv')} value={c.passiveInvestigation ?? 10} onChange={(n) => set('passiveInvestigation', n)} />
          <NumberField label={t('form.passiveInsight')} value={c.passiveInsight ?? 10} onChange={(n) => set('passiveInsight', n)} />
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

    </Window>
  )
}
