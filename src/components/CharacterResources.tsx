import { Crosshair, Moon, Sparkles, Sun } from 'lucide-react'
import { db } from '../db'
import { t } from '../lib/i18n'
import { ammoFor } from '../lib/inventory'
import type { Character } from '../types'
import { UsePips } from './UsePips'

const RECHARGE_ICON = { short: <Moon />, 'short-one': <><Moon />¹</>, long: <Sun /> }
const RECHARGE_TITLE = { short: 'party.rt.short', 'short-one': 'party.rt.shortOne', long: 'party.rt.long' } as const

/**
 * Everything a character spends: class features (Rage, Bardic Inspiration, Ki...), magic item charges and ammunition. Used on the party card (which a player
 * also uses on their own phone) and in the DM's turn panel, so a Rage or an arrow can be ticked off the moment it happens.
 */
export function CharacterResources({ c }: { c: Character }) {
  const update = (patch: Partial<Character>) => db.characters.update(c.id!, patch)
  const items = c.items ?? []
  const charged = items.filter((i) => i.charges && i.charges.max > 0)
  const ammo = [...new Set(items.filter((i) => i.equipped && i.weapon).map((i) => ammoFor(items, i)?.id))].map((id) => items.find((i) => i.id === id)).filter((i) => !!i)
  const resources = c.resources ?? []
  if (!resources.length && !charged.length && !ammo.length) return null
  const setItem = (id: string, patch: Partial<(typeof items)[number]>) => update({ items: items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })

  return (
    <div className="slot-rows">
      {resources.map((r) => (
        <div key={r.id} className="slot-row">
          <span className="muted" title={t(RECHARGE_TITLE[r.recharge])}>
            {r.name || t('party.feature')} {RECHARGE_ICON[r.recharge]}
          </span>
          <UsePips max={r.max} used={r.used} label={r.name} onChange={(used) => update({ resources: resources.map((x) => (x.id === r.id ? { ...x, used } : x)) })} />
        </div>
      ))}
      {charged.map((i) => (
        <div key={i.id} className="slot-row">
          <span className="muted"><Sparkles /> {i.name}</span>
          <UsePips max={i.charges!.max} used={i.charges!.used} label={i.name} onChange={(used) => setItem(i.id, { charges: { ...i.charges!, used } })} />
        </div>
      ))}
      {ammo.map((i) => (
        <div key={i.id} className="slot-row">
          <span className="muted"><Crosshair /> {i.name}</span>
          <span className={`ammo ${i.qty === 0 ? 'warn' : ''}`}>
            <button aria-label={t('ammo.less')} disabled={i.qty <= 0} onClick={() => setItem(i.id, { qty: i.qty - 1 })}>−</button>
            <strong>{i.qty}</strong>
            <button aria-label={t('ammo.more')} onClick={() => setItem(i.id, { qty: i.qty + 1 })}>+</button>
          </span>
        </div>
      ))}
    </div>
  )
}
