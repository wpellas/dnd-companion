import type { PublicSheet } from '../lib/publicState'
import { formatMod } from '../lib/dice'
import { t, tCondition } from '../lib/i18n'
import { levelName } from '../lib/spells'
import { COIN_TYPES } from '../types'
import { Portrait } from './Portrait'

const pips = (max: number, used: number) => '●'.repeat(Math.max(0, max - used)) + '○'.repeat(Math.min(max, used))

/** The sheet the DM chose to show on the players' screens: one character, everything a player knows about them. */
export function CharacterSheetView({ sheet, src, image }: { sheet: PublicSheet; src?: string; image?: Blob }) {
  const pct = sheet.maxHp ? Math.round((sheet.hp / sheet.maxHp) * 100) : 0
  const sc = sheet.spellcasting
  const inv = sheet.inventory
  const coins = inv ? COIN_TYPES.filter((k) => (inv.coins[k] ?? 0) > 0) : []
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
          <div><span>{t('sheet.ac')}</span><strong>{sheet.ac}</strong></div>
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
            <h2>{t('sheet.attacks')}</h2>
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
            <h2>{t('sheet.spellcasting')}</h2>
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
            <h2>{t('sheet.features')}</h2>
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
            <h2>{t('sheet.defences')}</h2>
            {defences.map(([label, list]) =>
              list.length ? (
                <p key={label}>
                  <strong>{label}:</strong> {list.join(', ')}
                </p>
              ) : null,
            )}
          </section>
        )}

        {inv && (
          <section className="sheet-panel wide">
            <h2>{t('sheet.inventory')}</h2>
            <p className="sheet-note">
              {coins.length ? coins.map((k) => `${inv.coins[k]} ${k}`).join(' · ') : t('sheet.noCoins')}
              {inv.nextXp !== undefined ? t('sheet.xpNext', { xp: inv.xp.toLocaleString(), next: inv.nextXp.toLocaleString() }) : t('sheet.xp', { xp: inv.xp.toLocaleString() })}
              {t('sheet.carrying', { w: Math.round(inv.weight * 10) / 10, cap: inv.capacity })}
            </p>
            {inv.items.length === 0 ? (
              <p className="sheet-note">{t('sheet.nothing')}</p>
            ) : (
              <ul className="sheet-items">
                {inv.items.map((i, k) => (
                  <li key={k} className={i.equipped ? 'equipped' : ''}>
                    <strong>
                      {i.name}
                      {i.qty > 1 && ` ×${i.qty}`}
                    </strong>
                    <span>{[i.equipped ? t('sheet.equipped') : '', i.attuned ? t('sheet.attuned') : '', i.notes].filter(Boolean).join(' · ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
