import { ArrowLeftRight, ArrowUp, Backpack, Pencil, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
  itemsGp,
  levelForXp,
  moveItems,
  totalGp,
  weaponActions,
  xpForNextLevel,
} from '../lib/inventory'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { addNotice, loadParty, sendGift, type PartyMember } from '../lib/gifts'
import { useSession } from '../lib/session'
import { transferItem } from '../lib/store'
import { buildItem, useCustomItems, useItemCatalog, type CatalogEntry } from '../lib/itemCatalog'
import { COIN_TYPES, DAMAGE_TYPES, type ArmorDex, type Character, type Item } from '../types'
import { Combobox } from './Combobox'
import { NumberField } from './NumberField'
import { UsePips } from './UsePips'
import { CheckField } from './Section'

interface Props {
  c: Character
  /** Called with the fields that changed (items, coins, xp, acFromGear); the caller saves them and keeps Armor Class in step */
  onChange: (patch: Partial<Character>) => void
  /** Offer "give to another character" (only for a saved character that is edited live, not in the form's draft) */
  transferable?: boolean
}

/** Who an item can be handed to: `local` = a character on this device (moved directly), otherwise another account's (left as a gift for their device to collect). */
export interface Recipient {
  key: string
  label: string
  local: boolean
}

const KINDS: Item['kind'][] = ['weapon', 'armor', 'shield', 'gear', 'magic', 'treasure']
const DEX_KEY = { full: 'inv.dex.full', max2: 'inv.dex.max2', none: 'inv.dex.none' } as const
const GROUP_KEY = { weapons: 'catalog.weapons', armor: 'catalog.armor', gear: 'catalog.gear', magic: 'catalog.magic', custom: 'catalog.custom' } as const
const MAX_ATTUNED = 3

/** The picker's small right-hand text: damage dice and type, armor class, cost or rarity. */
const entryHint = (e: CatalogEntry) => (e.group === 'weapons' && e.damageType ? `${e.hint} ${tDamage(e.damageType)}` : e.hint)

/**
 * Coins, experience and the item list of a character. Picking an item from the SRD list fills in its numbers; weapons that are
 * equipped become attacks in combat, and equipped armor and shields can set Armor Class.
 */
export function InventoryEditor({ c, onChange, transferable }: Props) {
  const items = c.items ?? []
  const catalog = useItemCatalog()
  const custom = useCustomItems()
  const others = useLiveQuery(async () => (transferable ? (await db.characters.toArray()).filter((o) => o.id !== c.id) : []), [transferable, c.id]) ?? []
  const { campaign } = useSession()
  // a player's device only holds their own characters: the rest of the table comes from the server
  const [party, setParty] = useState<PartyMember[]>([])
  const asPlayer = !!campaign && campaign.role !== 'dm'
  useEffect(() => {
    if (!transferable || !campaign || !asPlayer) return
    let off = false
    loadParty(campaign.id)
      .then((p) => !off && setParty(p))
      .catch(() => {}) // offline: the characters on this device are still there to give to
    return () => {
      off = true
    }
  }, [transferable, campaign, asPlayer])
  const localKeys = new Set(others.map((o) => String(o.id)))
  const recipients: Recipient[] =
    asPlayer && party.length
      ? party.filter((p) => p.key !== String(c.id)).map((p) => ({ key: p.key, label: p.owner ? `${p.name} (${p.owner})` : p.name, local: localKeys.has(p.key) }))
      : others.map((o) => ({ key: String(o.id), label: o.name, local: true }))
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState('')
  const [fresh, setFresh] = useState<string>()
  const ac = armorClass(c)
  const attuned = attunedCount(items)
  const weight = carriedWeight(c)
  const capacity = carryingCapacity(c)
  const xp = c.xp ?? 0
  const next = xpForNextLevel(c.level)

  const setItems = (list: Item[]) => onChange({ items: list })
  /** A new custom item starts with a name and its details open, so there is something to edit right away and never a nameless row. */
  const addNew = (item: Item) => {
    setFresh(item.id)
    setItems([...items, item])
  }
  /** Hand `qty` of an item over. A character on this device is moved directly; another account's is left as a gift on the server first (its owner's device adds it), and only then does it leave this inventory. */
  const give = async (item: Item, toKey: string, qty: number) => {
    const to = recipients.find((r) => r.key === toKey)
    if (!to) return
    if (to.local) return void transferItem(c.id!, Number(toKey), item.id, qty)
    const moved = moveItems(items, [], item.id, qty)
    if (!moved || !campaign) return
    try {
      await sendGift(campaign.id, String(c.id), toKey, moved.to[0])
    } catch {
      alert(t('inv.giftFail'))
      return
    }
    onChange({ items: moved.from })
    addNotice(t('gift.sent', { qty: moved.to[0].qty, name: item.name, to: to.label }))
  }
  const patchItem = (id: string, patch: Partial<Item>) => setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  /** Only one suit of body armor and one shield count at a time, so equipping a second swaps the first out. */
  const setEquipped = (item: Item, on: boolean) =>
    setItems(items.map((i) => (i.id === item.id ? { ...i, equipped: on } : on && (item.kind === 'armor' || item.kind === 'shield') && i.kind === item.kind ? { ...i, equipped: false } : i)))

  const addFromCatalog = async (value: string | undefined) => {
    const entry = catalog.find((e) => `${e.source}:${e.index}` === value)
    if (!entry) return
    setAdding(true)
    try {
      const built = await buildItem(entry, custom)
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
            <NumberField key={k} label={k.toUpperCase()} value={c.coins?.[k] ?? 0} min={0} integer onChange={(n) => onChange({ coins: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, ...c.coins, [k]: Math.max(0, Math.floor(n)) } })} />
          ))}
          <span className="muted coin-total">≈ {Math.floor(totalGp(c.coins)).toLocaleString()} gp</span>
          <span className="muted coin-total" title={t('inv.itemsWorthTitle')}>
            <Backpack /> {t('inv.itemsWorth', { n: itemsGp(c).toLocaleString() })}
          </span>
        </div>
        <div className="xp-box">
          <NumberField label={t('inv.xpLabel')} value={xp} min={0} onChange={(n) => onChange({ xp: Math.max(0, Math.floor(n)) })} />
          <span className="muted">
            {t('inv.level', { n: c.level })}
            {next !== undefined ? t('inv.nextAt', { xp: next.toLocaleString() }) : t('inv.maxLevel')}
            {levelForXp(xp) !== c.level && xp > 0 ? t('inv.xpSays', { n: levelForXp(xp) }) : ''}
          </span>
          {canLevelUp(c) && <span className="levelup-badge"><ArrowUp /> {t('inv.ready', { n: levelForXp(xp) })}</span>}
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
        <button onClick={() => addNew(blankItem('gear', t('inv.newItem')))}>{t('inv.addItem')}</button>
        <button onClick={() => addNew({ ...blankItem('weapon', t('inv.newWeapon')), weapon: { damage: '1d6', damageType: 'slashing', proficient: true } })}>{t('inv.addWeapon')}</button>
        <button onClick={() => addNew({ ...blankItem('armor', t('inv.newArmor')), armor: { base: 11, dex: 'full' } })}>{t('inv.addArmor')}</button>
      </div>

      {items.length === 0 && <p className="muted">{t('inv.nothing')}</p>}
      {items.length > 8 && <input className="inv-filter" type="search" value={filter} placeholder={t('inv.filter')} onChange={(e) => setFilter(e.target.value)} />}
      <div className="inv-list">
        {items.filter((i) => i.name.toLowerCase().includes(filter.trim().toLowerCase())).map((item) => (
          <ItemRow key={item.id} item={item} c={c} attunementFull={attuned >= MAX_ATTUNED} startEditing={item.id === fresh} others={recipients} onTransfer={(toKey, n) => void give(item, toKey, n)} onChange={(p) => patchItem(item.id, p)} onEquip={(on) => setEquipped(item, on)} onRemove={() => setItems(items.filter((i) => i.id !== item.id))} />
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

/** Pick who gets it and how many; handing over fewer than all leaves the rest with the giver. */
function TransferPanel({ item, others, onMove, onClose }: { item: Item; others: Recipient[]; onMove: (toKey: string, qty: number) => void; onClose: () => void }) {
  const [to, setTo] = useState(others[0].key)
  const [qty, setQty] = useState(item.qty)
  return (
    <div className="inv-sub row gap wrap">
      <label className="field">
        <span>{t('inv.transferTo')}</span>
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          {others.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <NumberField label={t('inv.transferQty', { n: item.qty })} value={qty} min={1} onChange={setQty} />
      <button className="primary" onClick={() => onMove(to, Math.min(item.qty, Math.max(1, Math.floor(qty))))}>
        {t('inv.transferGo')}
      </button>
      <button onClick={onClose}>{t('common.cancel')}</button>
    </div>
  )
}

/**
 * One item. Without a character (the DM's item list) there is nothing to wield, attune or transfer, only the item's own numbers.
 * "Edit" opens the item in its own window (ItemEditDialog); Done saves, Cancel throws the changes away (for a freshly added item, Cancel also
 * takes the item back out). The quick controls in the top line (count, wielded, attuned, charges) stay live.
 */
export function ItemRow({
  item: saved,
  c,
  attunementFull = false,
  startEditing = false,
  others = [],
  onChange: commit,
  onEquip = () => {},
  onTransfer,
  onRemove,
}: {
  item: Item
  c?: Character
  attunementFull?: boolean
  /** Open the editor from the start (a freshly added item) */
  startEditing?: boolean
  /** Who it could be handed to */
  others?: Recipient[]
  onChange: (patch: Partial<Item>) => void
  onEquip?: (on: boolean) => void
  onTransfer?: (toKey: string, qty: number) => void
  onRemove: () => void
}) {
  const [moving, setMoving] = useState(false)
  const [editing, setEditing] = useState(startEditing)
  const [isNew, setIsNew] = useState(startEditing)
  const item = saved
  const onChange = commit
  const startEdit = () => setEditing(true)
  const cancel = () => {
    setEditing(false)
    if (isNew) onRemove()
  }
  const w = item.weapon
  const equippable = !!c && (item.kind === 'weapon' || item.kind === 'armor' || item.kind === 'shield' || item.kind === 'magic')
  // what the equipped weapon would roll with this character's stats
  const attacks = c && w ? weaponActions({ abilities: c.abilities, items: [{ ...item, equipped: true }] }).map((a) => deriveAction(a, c)) : []

  return (
    <div className={`item-card inv-item ${item.equipped ? 'equipped' : ''}`}>
      <div className="inv-line">
        <span className="kind-tag">{t(`kind.${item.kind}`)}</span>
        <label className="field grow">
          <span>{t('inv.name')}</span>
          <input value={item.name} placeholder={t('inv.namePlaceholder')} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <NumberField label={t('inv.qty')} value={item.qty} min={0} onChange={(n) => onChange({ qty: Math.max(0, Math.floor(n)) })} />
        {equippable && <CheckField label={item.kind === 'weapon' ? t('inv.wielded') : t('inv.equipped')} checked={!!item.equipped} onChange={onEquip} />}
        {c && (item.requiresAttunement || item.kind === 'magic') && (
          <CheckField
            label={t('inv.attuned')}
            title={attunementFull && !item.attuned ? t('inv.attunedFull') : t('inv.attunedTitle')}
            checked={!!item.attuned}
            onChange={(on) => commit({ attuned: on })}
          />
        )}
        <button title={t('inv.edit')} aria-label={t('inv.editItem', { name: item.name || t('common.unnamed') })} onClick={startEdit}>
          <Pencil />
        </button>
        {onTransfer && others.length > 0 && saved.qty >= 1 && (
          <button title={t('inv.transfer')} aria-label={t('inv.transferItem', { name: item.name || t('common.unnamed') })} aria-expanded={moving} onClick={() => setMoving(!moving)}>
            <ArrowLeftRight />
          </button>
        )}
        <button className="danger" title={t('inv.remove')} aria-label={t('inv.removeItem', { name: item.name || t('common.unnamed') })} onClick={onRemove}>
          <X />
        </button>
      </div>
      {moving && onTransfer && (
        <TransferPanel
          item={saved}
          others={others}
          onMove={(toKey, qty) => {
            onTransfer(toKey, qty)
            setMoving(false)
          }}
          onClose={() => setMoving(false)}
        />
      )}
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
      {item.charges && item.charges.max > 0 && (
        <div className="inv-sub row gap">
          <span className="muted">{t('inv.charges')}</span>
          <UsePips max={item.charges.max} used={item.charges.used} label={item.name} onChange={(used) => onChange({ charges: { ...item.charges!, used } })} />
          {item.charges.dawn && item.charges.dawn !== 'all' && <span className="muted small">{t('inv.dawnDice', { dice: item.charges.dawn })}</span>}
        </div>
      )}
      {item.notes && !item.desc && <div className="muted inv-sub">{item.notes}</div>}

      {editing && (
        <ItemEditDialog
          saved={saved}
          c={c}
          onDone={(next) => {
            commit(next)
            setEditing(false)
            setIsNew(false)
          }}
          onCancel={cancel}
        />
      )}
    </div>
  )
}

/**
 * The editor for one item: its own window over a dimmed page (a native <dialog>), so nothing unfolds in the middle of the list. The fields change a
 * draft; Done hands it back, Cancel or Escape drops it. Clicking the dimmed area does nothing, so a stray click cannot lose the edits.
 */
function ItemEditDialog({ saved, c, onDone, onCancel }: { saved: Item; c?: Character; onDone: (item: Item) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [item, setDraft] = useState<Item>(saved)
  const onChange = (p: Partial<Item>) => setDraft((d) => ({ ...d, ...p }))
  const w = item.weapon
  const setWeapon = (p: Partial<NonNullable<Item['weapon']>>) => onChange({ weapon: { damage: '1d6', damageType: 'slashing', proficient: true, ...w, ...p } })
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="item-edit"
      aria-labelledby="item-edit-title"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <div className="item-edit-card">
        <h3 id="item-edit-title">{t('inv.editTitle')}</h3>
        <div className="item-edit-body">
          <div className="field-grid">
            <label className="field span-2">
              <span>{t('inv.name')}</span>
              <input value={item.name} placeholder={t('inv.namePlaceholder')} autoFocus onChange={(e) => onChange({ name: e.target.value })} />
            </label>
            <NumberField label={t('inv.qty')} value={item.qty} min={0} onChange={(n) => onChange({ qty: Math.max(0, Math.floor(n)) })} />
          </div>
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
          <NumberField label={t('inv.value')} value={item.value ?? 0} min={0} integer onChange={(n) => onChange({ value: n || undefined })} />
          {(item.kind === 'weapon' || item.kind === 'armor' || item.kind === 'shield') && (
            <NumberField label={item.kind === 'weapon' ? t('inv.magicWeapon') : t('inv.magicArmor')} value={item.magicBonus ?? 0} onChange={(n) => onChange({ magicBonus: n || undefined })} />
          )}
          <NumberField label={t('inv.chargesMax')} value={item.charges?.max ?? 0} min={0} onChange={(n) => onChange({ charges: n > 0 ? { used: 0, ...item.charges, max: Math.floor(n) } : undefined })} />
          {item.charges && <CheckField label={t('inv.dawnAll')} title={t('inv.dawnAllTitle')} checked={item.charges.dawn === 'all'} onChange={(on) => onChange({ charges: { ...item.charges!, dawn: on ? 'all' : undefined } })} />}
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
            <CheckField label={t('inv.ammunition')} title={t('inv.ammunitionTitle')} checked={!!w?.ammunition} onChange={(on) => setWeapon({ ammunition: on || undefined })} />
            {w?.ammunition && (
              <label className="field">
                <span>{t('inv.ammoItem')}</span>
                <select value={w.ammoId ?? ''} onChange={(e) => setWeapon({ ammoId: e.target.value || undefined })}>
                  <option value="">{t('inv.ammoAuto')}</option>
                  {(c?.items ?? []).filter((i) => i.kind !== 'weapon' && i.id !== item.id).map((i) => <option key={i.id} value={i.id}>{i.name || t('common.unnamed')}</option>)}
                </select>
              </label>
            )}
            <label className="field">
              <span>{t('inv.mastery')}</span>
              <input value={w?.mastery ?? ''} onChange={(e) => setWeapon({ mastery: e.target.value || undefined })} />
            </label>
            <CheckField label={t('inv.masteryKnown')} title={t('inv.masteryKnownTitle')} checked={!!w?.masteryKnown} onChange={(on) => setWeapon({ masteryKnown: on })} />
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
        </div>
        <div className="inv-done">
          <button onClick={onCancel}>{t('common.cancel')}</button>
          <button className="primary" onClick={() => onDone({ ...item, name: item.name.trim() || saved.name || t('inv.newItem') })}>
            {t('inv.done')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
