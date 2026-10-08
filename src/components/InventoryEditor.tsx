import { useState } from 'react'
import { deriveAction } from '../lib/character'
import { formatMod } from '../lib/dice'
import { t, tDamage } from '../lib/i18n'
import {
  armorClass,
  attunedCount,
  blankItem,
  canLevelUp,
  carriedWeight,
  carryingCapacity,
  levelForXp,
  totalGp,
  weaponActions,
  xpForNextLevel,
} from '../lib/inventory'
import { buildItem, useItemCatalog, type CatalogEntry } from '../lib/itemCatalog'
import { COIN_TYPES, DAMAGE_TYPES, type ArmorDex, type Character, type Item } from '../types'
import { Combobox } from './Combobox'
import { NumberField } from './NumberField'
import { CheckField } from './Section'

interface Props {
  c: Character
  /** Called with the fields that changed (items, coins, xp, acFromGear); the caller saves them and keeps Armor Class in step */
  onChange: (patch: Partial<Character>) => void
}

const KINDS: Item['kind'][] = ['weapon', 'armor', 'shield', 'gear', 'magic', 'treasure']
const DEX_KEY = { full: 'inv.dex.full', max2: 'inv.dex.max2', none: 'inv.dex.none' } as const
const GROUP_KEY = { weapons: 'catalog.weapons', armor: 'catalog.armor', gear: 'catalog.gear', magic: 'catalog.magic' } as const
const MAX_ATTUNED = 3

/** The picker's small right-hand text: damage dice and type, armor class, cost or rarity. */
const entryHint = (e: CatalogEntry) => (e.group === 'weapons' && e.damageType ? `${e.hint} ${tDamage(e.damageType)}` : e.hint)

/**
 * Coins, experience and the item list of a character. Picking an item from the SRD list fills in its numbers; weapons that are
 * equipped become attacks in combat, and equipped armor and shields can set Armor Class.
 */
export function InventoryEditor({ c, onChange }: Props) {
  const items = c.items ?? []
  const catalog = useItemCatalog()
  const [adding, setAdding] = useState(false)
  const ac = armorClass(c)
  const attuned = attunedCount(items)
  const weight = carriedWeight(c)
  const capacity = carryingCapacity(c)
  const xp = c.xp ?? 0
  const next = xpForNextLevel(c.level)

  const setItems = (list: Item[]) => onChange({ items: list })
  const patchItem = (id: string, patch: Partial<Item>) => setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  /** Only one suit of body armor and one shield count at a time, so equipping a second swaps the first out. */
  const setEquipped = (item: Item, on: boolean) =>
    setItems(items.map((i) => (i.id === item.id ? { ...i, equipped: on } : on && (item.kind === 'armor' || item.kind === 'shield') && i.kind === item.kind ? { ...i, equipped: false } : i)))

  const addFromCatalog = async (value: string | undefined) => {
    const entry = catalog.find((e) => `${e.source}:${e.index}` === value)
    if (!entry) return
    setAdding(true)
    try {
      const built = await buildItem(entry)
      // the same thing again is one more of it, not a second row
      const same = built.srd && items.find((i) => i.srd?.index === built.srd!.index && i.srd?.source === built.srd!.source)
      setItems(same ? items.map((i) => (i === same ? { ...i, qty: i.qty + 1 } : i)) : [...items, built])
    } catch {
      alert(t('inv.loadFail'))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="inventory">
      <div className="inv-top">
        <div className="coin-grid" title={t('inv.coinsTitle')}>
          {COIN_TYPES.map((k) => (
            <NumberField key={k} label={k.toUpperCase()} value={c.coins?.[k] ?? 0} min={0} onChange={(n) => onChange({ coins: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, ...c.coins, [k]: Math.max(0, Math.floor(n)) } })} />
          ))}
          <span className="muted coin-total">≈ {Math.floor(totalGp(c.coins)).toLocaleString()} gp</span>
        </div>
        <div className="xp-box">
          <NumberField label={t('inv.xpLabel')} value={xp} min={0} onChange={(n) => onChange({ xp: Math.max(0, Math.floor(n)) })} />
          <span className="muted">
            {t('inv.level', { n: c.level })}
            {next !== undefined ? t('inv.nextAt', { xp: next.toLocaleString() }) : t('inv.maxLevel')}
            {levelForXp(xp) !== c.level && xp > 0 ? t('inv.xpSays', { n: levelForXp(xp) }) : ''}
          </span>
          {canLevelUp(c) && <span className="levelup-badge">{t('inv.ready', { n: levelForXp(xp) })}</span>}
        </div>
      </div>

      <div className="inv-add">
        <Combobox
          className="target-select"
          placeholder={catalog.length ? t('inv.pick') : t('inv.pickLoading')}
          options={catalog.map((e) => ({ value: `${e.source}:${e.index}`, label: e.name, group: t(GROUP_KEY[e.group]), hint: entryHint(e) }))}
          onChange={addFromCatalog}
        />
        {adding && <span className="muted">{t('inv.adding')}</span>}
        <button onClick={() => setItems([...items, blankItem('gear')])}>{t('inv.addItem')}</button>
        <button onClick={() => setItems([...items, { ...blankItem('weapon'), weapon: { damage: '1d6', damageType: 'slashing', proficient: true } }])}>{t('inv.addWeapon')}</button>
        <button onClick={() => setItems([...items, { ...blankItem('armor'), armor: { base: 11, dex: 'full' } }])}>{t('inv.addArmor')}</button>
      </div>

      {items.length === 0 && <p className="muted">{t('inv.nothing')}</p>}
      <div className="inv-list">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} c={c} attunementFull={attuned >= MAX_ATTUNED} onChange={(p) => patchItem(item.id, p)} onEquip={(on) => setEquipped(item, on)} onRemove={() => setItems(items.filter((i) => i.id !== item.id))} />
        ))}
      </div>

      <div className="inv-foot">
        <span className={weight > capacity ? 'warn' : 'muted'} title={t('inv.carryingTitle')}>
          {t('inv.carrying', { w: Math.round(weight * 10) / 10, cap: capacity })}
        </span>
        <span className={attuned > MAX_ATTUNED ? 'warn' : 'muted'}>{t('inv.attunedCount', { n: attuned, max: MAX_ATTUNED })}</span>
        <CheckField label={t('inv.acFromGear')} title={t('inv.acFromGearTitle')} checked={!!c.acFromGear} onChange={(on) => onChange({ acFromGear: on })} />
        <span className="muted">
          {ac.parts.join(' + ')} = <strong>{ac.ac}</strong>
          {c.acFromGear && c.ac !== ac.ac ? t('inv.updating') : ''}
          {!c.acFromGear && c.ac !== ac.ac ? t('inv.sheetSays', { n: c.ac }) : ''}
        </span>
        {ac.warning && <span className="warn">{ac.warning}</span>}
      </div>
    </div>
  )
}

function ItemRow({
  item,
  c,
  attunementFull,
  onChange,
  onEquip,
  onRemove,
}: {
  item: Item
  c: Character
  attunementFull: boolean
  onChange: (patch: Partial<Item>) => void
  onEquip: (on: boolean) => void
  onRemove: () => void
}) {
  const w = item.weapon
  const equippable = item.kind === 'weapon' || item.kind === 'armor' || item.kind === 'shield' || item.kind === 'magic'
  // what the equipped weapon would roll with this character's stats
  const attacks = w ? weaponActions({ abilities: c.abilities, items: [{ ...item, equipped: true }] }).map((a) => deriveAction(a, c)) : []
  const setWeapon = (p: Partial<NonNullable<Item['weapon']>>) => onChange({ weapon: { damage: '1d6', damageType: 'slashing', proficient: true, ...w, ...p } })

  return (
    <div className={`item-card inv-item ${item.equipped ? 'equipped' : ''}`}>
      <div className="inv-line">
        <label className="field grow">
          <span>{t(`kind.${item.kind}`)}</span>
          <input value={item.name} placeholder={t('inv.namePlaceholder')} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <NumberField label={t('inv.qty')} value={item.qty} min={0} onChange={(n) => onChange({ qty: Math.max(0, Math.floor(n)) })} />
        {equippable && <CheckField label={item.kind === 'weapon' ? t('inv.wielded') : t('inv.equipped')} checked={!!item.equipped} onChange={onEquip} />}
        {(item.requiresAttunement || item.kind === 'magic') && (
          <CheckField
            label={t('inv.attuned')}
            title={attunementFull && !item.attuned ? t('inv.attunedFull') : t('inv.attunedTitle')}
            checked={!!item.attuned}
            onChange={(on) => onChange({ attuned: on })}
          />
        )}
        <button className="danger" title={t('inv.remove')} aria-label={t('inv.removeItem', { name: item.name || t('common.unnamed') })} onClick={onRemove}>
          ✕
        </button>
      </div>
      {w && item.equipped && attacks[0] && (
        <div className="muted inv-sub">
          {attacks.map((a) => t('inv.attackLine', { name: a.name, hit: formatMod(a.attackBonus ?? 0), dmg: a.damage ?? '', type: tDamage(a.damageType ?? '') })).join(' · ')}
          {t('inv.attackNote')}
        </div>
      )}
      {item.armor && item.equipped && (
        <div className="muted inv-sub">
          {item.kind === 'shield'
            ? t('inv.shieldAc', { n: item.armor.base + (item.magicBonus ?? 0) })
            : t('inv.armorAc', { n: item.armor.base + (item.magicBonus ?? 0), dex: t(DEX_KEY[item.armor.dex]).toLowerCase() })}
        </div>
      )}
      {item.notes && !item.desc && <div className="muted inv-sub">{item.notes}</div>}

      <details className="inv-details">
        <summary>{t('inv.details')}</summary>
        <div className="field-grid">
          <label className="field">
            <span>{t('inv.kind')}</span>
            <select
              value={item.kind}
              onChange={(e) => {
                const kind = e.target.value as Item['kind']
                onChange({
                  kind,
                  weapon: kind === 'weapon' ? (w ?? { damage: '1d6', damageType: 'slashing', proficient: true }) : item.weapon,
                  armor: kind === 'armor' || kind === 'shield' ? (item.armor ?? { base: kind === 'shield' ? 2 : 11, dex: kind === 'shield' ? 'none' : 'full' }) : item.armor,
                })
              }}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`kind.${k}`)}
                </option>
              ))}
            </select>
          </label>
          <NumberField label={t('inv.weight')} value={item.weight ?? 0} min={0} onChange={(n) => onChange({ weight: n || undefined })} />
          {(item.kind === 'weapon' || item.kind === 'armor' || item.kind === 'shield') && (
            <NumberField label={item.kind === 'weapon' ? t('inv.magicWeapon') : t('inv.magicArmor')} value={item.magicBonus ?? 0} onChange={(n) => onChange({ magicBonus: n || undefined })} />
          )}
          {item.kind === 'magic' && <NumberField label={t('inv.acBonus')} value={item.magicBonus ?? 0} onChange={(n) => onChange({ magicBonus: n || undefined })} />}
          {item.kind === 'magic' && <CheckField label={t('inv.reqAttune')} checked={!!item.requiresAttunement} onChange={(on) => onChange({ requiresAttunement: on || undefined })} />}
          <label className="field span-2">
            <span>{t('common.notes')}</span>
            <input value={item.notes ?? ''} onChange={(e) => onChange({ notes: e.target.value || undefined })} />
          </label>
        </div>

        {item.kind === 'weapon' && (
          <div className="field-grid">
            <label className="field">
              <span>{t('inv.damage')}</span>
              <input className="dice" value={w?.damage ?? ''} placeholder="1d8" onChange={(e) => setWeapon({ damage: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('inv.damageType')}</span>
              <select value={w?.damageType ?? 'slashing'} onChange={(e) => setWeapon({ damageType: e.target.value })}>
                {DAMAGE_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {tDamage(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('inv.twoHanded')}</span>
              <input className="dice" value={w?.versatile ?? ''} placeholder={t('inv.versatileOnly')} onChange={(e) => setWeapon({ versatile: e.target.value || undefined })} />
            </label>
            <label className="field">
              <span>{t('inv.range')}</span>
              <input value={w?.range ?? ''} placeholder="reach 5 ft." onChange={(e) => setWeapon({ range: e.target.value || undefined })} />
            </label>
            <CheckField label={t('inv.ranged')} checked={!!w?.ranged} onChange={(on) => setWeapon({ ranged: on })} />
            <CheckField label={t('inv.finesse')} checked={!!w?.finesse} onChange={(on) => setWeapon({ finesse: on })} />
            <CheckField label={t('inv.proficient')} checked={w?.proficient ?? true} onChange={(on) => setWeapon({ proficient: on })} />
            <label className="field">
              <span>{t('inv.mastery')}</span>
              <input value={w?.mastery ?? ''} onChange={(e) => setWeapon({ mastery: e.target.value || undefined })} />
            </label>
          </div>
        )}

        {(item.kind === 'armor' || item.kind === 'shield') && (
          <div className="field-grid">
            <NumberField
              label={item.kind === 'shield' ? t('inv.acBonusShield') : t('inv.baseAc')}
              value={item.armor?.base ?? 0}
              onChange={(n) => onChange({ armor: { dex: 'none', ...item.armor, base: n } })}
            />
            {item.kind === 'armor' && (
              <label className="field span-2">
                <span>{t('inv.dexterity')}</span>
                <select value={item.armor?.dex ?? 'full'} onChange={(e) => onChange({ armor: { base: item.armor?.base ?? 10, dex: e.target.value as ArmorDex } })}>
                  {(Object.keys(DEX_KEY) as ArmorDex[]).map((k) => (
                    <option key={k} value={k}>
                      {t(DEX_KEY[k])}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
        {item.desc && <p className="rules-text-inline inv-desc">{item.desc}</p>}
      </details>
    </div>
  )
}
