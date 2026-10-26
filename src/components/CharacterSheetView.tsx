import type { PublicSheet } from '../lib/publicState'
import { formatMod } from '../lib/dice'
import { t, tCondition } from '../lib/i18n'
import { levelName } from '../lib/spells'
import { COIN_TYPES, type CoinType, type Item } from '../types'
import { Portrait } from './Portrait'

const pips = (max: number, used: number) => '●'.repeat(Math.max(0, max - used)) + '○'.repeat(Math.min(max, used))

const KIND_ICON: Record<Item['kind'], string> = { weapon: '⚔', armor: '🛡', shield: '🛡', magic: '✨', gear: '🎒', treasure: '💎' }
const KIND_ORDER: Item['kind'][] = ['weapon', 'armor', 'shield', 'magic', 'gear', 'treasure']
const COIN_LABEL: Record<CoinType, string> = { pp: 'pp', gp: 'gp', ep: 'ep', sp: 'sp', cp: 'cp' }

type Inventory = NonNullable<PublicSheet['inventory']>

/** The sheet the DM chose to show on the players' screens: one character, everything a player knows about them. */
export function CharacterSheetView({ sheet, src, image }: { sheet: PublicSheet; src?: string; image?: Blob }) {
  const pct = sheet.maxHp ? Math.round((sheet.hp / sheet.maxHp) * 100) : 0
  const sc = sheet.spellcasting
  const inv = sheet.inventory
  const defences = [
    [t('sheet.resistant'), sheet.defences.resistances],
    [t('sheet.immune'), sheet.defences.immunities],
    [t('sheet.vulnerable'), sheet.defences.vulnerabilities],
  ] as const

  return (
    <div className="player sheet-view">
      <div className="sheet-hero">
        <Portrait name={sheet.name} src={src} image={image} size={150} />
        <div className="sheet-id">
          <h1>{sheet.name}</h1>
          <div className="sheet-sub">
            {sheet.classLine}
            {sheet.playerName && ` · ${sheet.playerName}`}
          </div>
          <div className="bar big">
            <div className="fill" style={{ width: `${pct}%` }} data-low={pct <= 50} />
          </div>
          <div className="hp-text">
            {t('sheet.hp', { hp: sheet.hp, max: sheet.maxHp })}
            {sheet.tempHp > 0 && <em>{t('sheet.temp', { n: sheet.tempHp })}</em>}
          </div>
          {(sheet.conditions.length > 0 || sheet.concentrating) && (
            <div className="badges">
              {sheet.concentrating && <span className="badge">{t('player.concentrating')}</span>}
              {sheet.conditions.map((c) => (
                <span className="badge" key={c}>
                  {c === 'Exhaustion' && sheet.exhaustion ? `${tCondition('Exhaustion')} ${sheet.exhaustion}` : tCondition(c)}
                </span>
              ))}
            </div>
          )}
          {sheet.deathSaves && (
            <div className="death-saves">
              {t('player.deathSaves')} <span className="ok">{'✓'.repeat(sheet.deathSaves.successes) || '·'}</span> <span className="bad">{'✗'.repeat(sheet.deathSaves.failures) || '·'}</span>
            </div>
          )}
        </div>
        <div className="sheet-stats">
          <div className="ac"><span>{t('sheet.ac')}</span><strong>{sheet.ac}</strong></div>
          <div><span>{t('sheet.speed')}</span><strong>{sheet.speed}</strong></div>
          <div><span>{t('sheet.initiative')}</span><strong>{formatMod(sheet.initiativeBonus)}</strong></div>
          <div><span>{t('sheet.proficiency')}</span><strong>{formatMod(sheet.proficiencyBonus)}</strong></div>
          <div><span>{t('sheet.passive')}</span><strong>{sheet.passivePerception}</strong></div>
          <div><span>{t('sheet.hitDice')}</span><strong>{sheet.hitDiceLeft} {sheet.hitDie}</strong></div>
        </div>
      </div>

      <div className="sheet-abilities">
        {sheet.abilities.map((a) => (
          <div key={a.key} className="sheet-ability">
            <span>{a.key}</span>
            <strong>{formatMod(a.mod)}</strong>
            <small>{a.score}</small>
            <em className={a.proficient ? 'prof' : ''}>
              {t('sheet.save', { n: formatMod(a.save) })}
              {a.proficient ? ' ●' : ''}
            </em>
          </div>
        ))}
      </div>

      <div className="sheet-grid">
        {sheet.attacks.length > 0 && (
          <section className="sheet-panel">
            <h2><span aria-hidden="true">⚔</span> {t('sheet.attacks')}</h2>
            <ul>
              {sheet.attacks.map((a, i) => (
                <li key={i}>
                  <strong>{a.name}</strong>
                  {a.detail && <span>{a.detail}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {sc && (
          <section className="sheet-panel">
            <h2><span aria-hidden="true">✨</span> {t('sheet.spellcasting')}</h2>
            <p className="sheet-note">{t('sheet.spellLine', { ability: sc.ability, dc: sc.saveDc, atk: formatMod(sc.attackBonus) })}</p>
            <ul>
              {sc.slots.map((s) => (
                <li key={s.level}>
                  <strong>{levelName(s.level)}</strong>
                  <span className="sheet-pips">{pips(s.max, s.used)}</span>
                </li>
              ))}
            </ul>
            {sc.cantrips.length > 0 && (
              <p>
                <strong>{t('sheet.cantrips')}</strong> {sc.cantrips.join(', ')}
              </p>
            )}
            {sc.prepared.map((g) => (
              <p key={g.level}>
                <strong>{levelName(g.level)}:</strong> {g.names.join(', ')}
              </p>
            ))}
          </section>
        )}

        {sheet.features.length > 0 && (
          <section className="sheet-panel">
            <h2><span aria-hidden="true">🌀</span> {t('sheet.features')}</h2>
            <ul>
              {sheet.features.map((f, i) => (
                <li key={i}>
                  <strong>{f.name}</strong>
                  <span className="sheet-pips">{f.max <= 12 ? pips(f.max, f.used) : `${f.max - f.used} / ${f.max}`}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {defences.some(([, list]) => list.length > 0) && (
          <section className="sheet-panel">
            <h2><span aria-hidden="true">🛡</span> {t('sheet.defences')}</h2>
            {defences.map(([label, list]) =>
              list.length ? (
                <p key={label}>
                  <strong>{label}:</strong> {list.join(', ')}
                </p>
              ) : null,
            )}
          </section>
        )}

        {inv && <InventoryPanel inv={inv} />}
      </div>
    </div>
  )
}

/**
 * Gold, experience and what is being carried as three framed tiles (in the colours the DM's party card uses), then the items as cards.
 * `bare` drops the panel frame and heading, for use inside the DM's own inventory window.
 */
export function InventoryPanel({ inv, bare }: { inv: Inventory; bare?: boolean }) {
  const coins = COIN_TYPES.filter((k) => (inv.coins[k] ?? 0) > 0)
  const coinGp = inv.coinGp ?? 0
  const xpFrom = inv.xpFrom ?? 0
  const xpPct = inv.nextXp === undefined ? 100 : Math.round(100 * Math.min(1, Math.max(0, (inv.xp - xpFrom) / Math.max(1, inv.nextXp - xpFrom))))
  const load = inv.capacity ? inv.weight / inv.capacity : 0
  const loadState = load > 1 ? 'over' : load > 0.75 ? 'heavy' : 'ok'
  const items = [...inv.items].sort(
    (a, b) => Number(b.equipped) - Number(a.equipped) || KIND_ORDER.indexOf(a.kind ?? 'gear') - KIND_ORDER.indexOf(b.kind ?? 'gear') || a.name.localeCompare(b.name),
  )

  return (
    <section className={`sheet-panel wide ${bare ? 'bare' : ''}`}>
      {!bare && <h2><span aria-hidden="true">🎒</span> {t('sheet.inventory')}</h2>}

      <div className="sheet-wealth">
        <div className="wealth-card gold">
          <span className="wc-label">💰 {t('sheet.gold')}</span>
          <strong className="wc-big">
            ≈ {coinGp.toLocaleString()} <small>gp</small>
          </strong>
          <div className="wc-coins">
            {coins.length ? (
              coins.map((k) => (
                <span key={k} className={`coin coin-${k}`}>
                  <b>{inv.coins[k]}</b> {COIN_LABEL[k]}
                </span>
              ))
            ) : (
              <span className="wc-sub">{t('sheet.noCoins')}</span>
            )}
          </div>
          {(inv.itemsGp ?? 0) > 0 && <span className="wc-sub">🎒 {t('inv.itemsWorth', { n: (inv.itemsGp ?? 0).toLocaleString() })}</span>}
        </div>

        <div className="wealth-card xp">
          <span className="wc-label">⭐ {t('sheet.experience')}</span>
          <strong className="wc-big">
            {inv.xp.toLocaleString()}
            {inv.nextXp !== undefined && <small> / {inv.nextXp.toLocaleString()}</small>}
          </strong>
          <div className="wc-bar" role="presentation">
            <i style={{ width: `${xpPct}%` }} />
          </div>
          <span className="wc-sub">
            {inv.levelReady ? <b className="wc-ready">⬆ {t('sheet.levelReady', { n: inv.levelReady })}</b> : inv.nextXp !== undefined ? t('sheet.xpToNext', { n: (inv.nextXp - inv.xp).toLocaleString(), level: inv.nextLevel ?? '' }) : t('sheet.maxLevel')}
          </span>
        </div>

        <div className={`wealth-card load ${loadState}`}>
          <span className="wc-label">⚖ {t('sheet.carry')}</span>
          <strong className="wc-big">
            {Math.round(inv.weight * 10) / 10} <small>/ {inv.capacity} lb</small>
          </strong>
          <div className="wc-bar" role="presentation">
            <i style={{ width: `${Math.min(100, Math.round(load * 100))}%` }} />
          </div>
          <span className="wc-sub">{loadState === 'over' ? t('sheet.carryOver') : t('sheet.carryPct', { n: Math.round(load * 100) })}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="sheet-note">{t('sheet.nothing')}</p>
      ) : (
        <ul className="sheet-items">
          {items.map((i, k) => (
            <li key={k} className={`item-tile ${i.equipped ? 'equipped' : ''}`}>
              <span className="it-icon" aria-hidden="true">
                {KIND_ICON[i.kind ?? 'gear']}
              </span>
              <div className="it-main">
                <strong>{i.name}</strong>
                {(i.equipped || i.attuned || i.notes) && (
                  <span className="it-tags">
                    {i.equipped && <span className="it-chip on">{t('sheet.equipped')}</span>}
                    {i.attuned && <span className="it-chip att">{t('sheet.attuned')}</span>}
                    {i.notes && <span className="it-note">{i.notes}</span>}
                  </span>
                )}
              </div>
              <div className="it-side">
                {i.qty > 1 && <span className="it-qty">×{i.qty}</span>}
                {i.value ? <small>{t('sheet.itemValue', { n: i.value.toLocaleString() })}</small> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
