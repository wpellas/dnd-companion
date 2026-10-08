import { useState } from 'react'
import { deriveAction } from '../lib/character'
import { formatMod } from '../lib/dice'
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
import { buildItem, useItemCatalog } from '../lib/itemCatalog'
import { COIN_TYPES, DAMAGE_TYPES, type ArmorDex, type Character, type Item } from '../types'
import { Combobox } from './Combobox'
import { NumberField } from './NumberField'
import { CheckField } from './Section'

interface Props {
  c: Character
  /** Called with the fields that changed (items, coins, xp, acFromGear); the caller saves them and keeps Armor Class in step */
  onChange: (patch: Partial<Character>) => void
}

const KIND_LABEL: Record<Item['kind'], string> = { weapon: 'Weapon', armor: 'Armor', shield: 'Shield', gear: 'Gear', magic: 'Magic item', treasure: 'Treasure' }
const DEX_LABEL: Record<ArmorDex, string> = { full: 'Full Dexterity modifier', max2: 'Dexterity, max +2', none: 'No Dexterity' }
const MAX_ATTUNED = 3

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
      alert("Couldn't load that item (offline and not downloaded yet). Add it as a custom item instead.")
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="inventory">
      <div className="inv-top">
        <div className="coin-grid" title="Coins carried (50 coins weigh a pound)">
          {COIN_TYPES.map((k) => (
            <NumberField key={k} label={k.toUpperCase()} value={c.coins?.[k] ?? 0} min={0} onChange={(n) => onChange({ coins: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, ...c.coins, [k]: Math.max(0, Math.floor(n)) } })} />
          ))}
          <span className="muted coin-total">≈ {Math.floor(totalGp(c.coins)).toLocaleString()} gp</span>
        </div>
        <div className="xp-box">
          <NumberField label="Experience (XP)" value={xp} min={0} onChange={(n) => onChange({ xp: Math.max(0, Math.floor(n)) })} />
          <span className="muted">
            Level {c.level}
            {next !== undefined ? ` · next at ${next.toLocaleString()} XP` : ' (maximum)'}
            {levelForXp(xp) !== c.level && xp > 0 ? ` · XP says ${levelForXp(xp)}` : ''}
          </span>
          {canLevelUp(c) && <span className="levelup-badge">⬆ Ready for level {levelForXp(xp)}</span>}
        </div>
      </div>

      <div className="inv-add">
        <Combobox
          className="target-select"
          placeholder={catalog.length ? 'Add from the SRD list: weapons, armor, gear, magic items…' : 'SRD item list still downloading… add custom items meanwhile'}
          options={catalog.map((e) => ({ value: `${e.source}:${e.index}`, label: e.name, group: e.group, hint: e.hint }))}
          onChange={addFromCatalog}
        />
        {adding && <span className="muted">Adding…</span>}
        <button onClick={() => setItems([...items, blankItem('gear')])}>+ Custom item</button>
        <button onClick={() => setItems([...items, { ...blankItem('weapon'), weapon: { damage: '1d6', damageType: 'slashing', proficient: true } }])}>+ Custom weapon</button>
        <button onClick={() => setItems([...items, { ...blankItem('armor'), armor: { base: 11, dex: 'full' } }])}>+ Custom armor</button>
      </div>

      {items.length === 0 && <p className="muted">Nothing carried yet.</p>}
      <div className="inv-list">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} c={c} attunementFull={attuned >= MAX_ATTUNED} onChange={(p) => patchItem(item.id, p)} onEquip={(on) => setEquipped(item, on)} onRemove={() => setItems(items.filter((i) => i.id !== item.id))} />
        ))}
      </div>

      <div className="inv-foot">
        <span className={weight > capacity ? 'warn' : 'muted'} title="Carrying capacity is 15 pounds per point of Strength">
          Carrying {Math.round(weight * 10) / 10} / {capacity} lb
        </span>
        <span className={attuned > MAX_ATTUNED ? 'warn' : 'muted'}>
          Attuned {attuned}/{MAX_ATTUNED}
        </span>
        <CheckField
          label="Armor Class from equipment"
          title="Armor Class is worked out from the equipped armor, shield and magic items instead of typed by hand"
          checked={!!c.acFromGear}
          onChange={(on) => onChange({ acFromGear: on })}
        />
        <span className="muted">
          {ac.parts.join(' + ')} = <strong>{ac.ac}</strong>
          {c.acFromGear && c.ac !== ac.ac ? ' (updating…)' : ''}
          {!c.acFromGear && c.ac !== ac.ac ? ` (sheet says ${c.ac})` : ''}
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
          <span>{KIND_LABEL[item.kind]}</span>
          <input value={item.name} placeholder="Name" onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <NumberField label="Qty" value={item.qty} min={0} onChange={(n) => onChange({ qty: Math.max(0, Math.floor(n)) })} />
        {equippable && <CheckField label={item.kind === 'weapon' ? 'Wielded' : 'Equipped'} checked={!!item.equipped} onChange={onEquip} />}
        {(item.requiresAttunement || item.kind === 'magic') && (
          <CheckField
            label="Attuned"
            title={attunementFull && !item.attuned ? 'Three items are already attuned' : 'Attuned to this item'}
            checked={!!item.attuned}
            onChange={(on) => onChange({ attuned: on })}
          />
        )}
        <button className="danger" title="Remove" aria-label={`Remove ${item.name || 'item'}`} onClick={onRemove}>
          ✕
        </button>
      </div>
      {w && item.equipped && attacks[0] && (
        <div className="muted inv-sub">
          {attacks.map((a) => `${a.name}: ${formatMod(a.attackBonus ?? 0)} to hit, ${a.damage} ${a.damageType}`).join(' · ')} (shows up as an attack in combat)
        </div>
      )}
      {item.armor && item.equipped && <div className="muted inv-sub">{item.kind === 'shield' ? `Adds +${item.armor.base + (item.magicBonus ?? 0)} to Armor Class` : `Armor Class ${item.armor.base + (item.magicBonus ?? 0)}, ${DEX_LABEL[item.armor.dex].toLowerCase()}`}</div>}
      {item.notes && !item.desc && <div className="muted inv-sub">{item.notes}</div>}

      <details className="inv-details">
        <summary>Details</summary>
        <div className="field-grid">
          <label className="field">
            <span>Kind</span>
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
              {(Object.keys(KIND_LABEL) as Item['kind'][]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <NumberField label="Weight each (lb)" value={item.weight ?? 0} min={0} onChange={(n) => onChange({ weight: n || undefined })} />
          {(item.kind === 'weapon' || item.kind === 'armor' || item.kind === 'shield') && (
            <NumberField label={item.kind === 'weapon' ? 'Magic bonus (+hit, +damage)' : 'Magic bonus (+AC)'} value={item.magicBonus ?? 0} onChange={(n) => onChange({ magicBonus: n || undefined })} />
          )}
          {item.kind === 'magic' && <NumberField label="AC bonus when equipped" value={item.magicBonus ?? 0} onChange={(n) => onChange({ magicBonus: n || undefined })} />}
          {item.kind === 'magic' && <CheckField label="Requires attunement" checked={!!item.requiresAttunement} onChange={(on) => onChange({ requiresAttunement: on || undefined })} />}
          <label className="field span-2">
            <span>Notes</span>
            <input value={item.notes ?? ''} onChange={(e) => onChange({ notes: e.target.value || undefined })} />
          </label>
        </div>

        {item.kind === 'weapon' && (
          <div className="field-grid">
            <label className="field">
              <span>Damage</span>
              <input className="dice" value={w?.damage ?? ''} placeholder="1d8" onChange={(e) => setWeapon({ damage: e.target.value })} />
            </label>
            <label className="field">
              <span>Damage type</span>
              <select value={w?.damageType ?? 'slashing'} onChange={(e) => setWeapon({ damageType: e.target.value })}>
                {DAMAGE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Two-handed damage</span>
              <input className="dice" value={w?.versatile ?? ''} placeholder="Versatile only" onChange={(e) => setWeapon({ versatile: e.target.value || undefined })} />
            </label>
            <label className="field">
              <span>Range</span>
              <input value={w?.range ?? ''} placeholder="reach 5 ft." onChange={(e) => setWeapon({ range: e.target.value || undefined })} />
            </label>
            <CheckField label="Ranged (uses Dexterity)" checked={!!w?.ranged} onChange={(on) => setWeapon({ ranged: on })} />
            <CheckField label="Finesse (Str or Dex)" checked={!!w?.finesse} onChange={(on) => setWeapon({ finesse: on })} />
            <CheckField label="Proficient" checked={w?.proficient ?? true} onChange={(on) => setWeapon({ proficient: on })} />
            <label className="field">
              <span>Mastery</span>
              <input value={w?.mastery ?? ''} onChange={(e) => setWeapon({ mastery: e.target.value || undefined })} />
            </label>
          </div>
        )}

        {(item.kind === 'armor' || item.kind === 'shield') && (
          <div className="field-grid">
            <NumberField
              label={item.kind === 'shield' ? 'AC bonus' : 'Base AC'}
              value={item.armor?.base ?? 0}
              onChange={(n) => onChange({ armor: { dex: 'none', ...item.armor, base: n } })}
            />
            {item.kind === 'armor' && (
              <label className="field span-2">
                <span>Dexterity</span>
                <select value={item.armor?.dex ?? 'full'} onChange={(e) => onChange({ armor: { base: item.armor?.base ?? 10, dex: e.target.value as ArmorDex } })}>
                  {(Object.keys(DEX_LABEL) as ArmorDex[]).map((k) => (
                    <option key={k} value={k}>{DEX_LABEL[k]}</option>
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
