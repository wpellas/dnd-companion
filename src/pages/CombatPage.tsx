import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { InitiativeInput } from '../components/InitiativeInput'
import { Portrait } from '../components/Portrait'
import { Rich } from '../components/Rich'
import { RewardBanner } from '../components/RewardBanner'
import { EffectsMenu } from '../components/EffectsEditor'
import { Window } from '../components/Window'
import { WildShape } from '../components/WildShape'
import { HazardPanel } from '../components/HazardPanel'
import { SpellFinder } from '../components/SpellFinder'
import { normalizeCharacter } from '../lib/character'
import { RollsTray } from '../components/RollsTray'
import { effectLine } from '../lib/effects'
import { TurnPanel } from '../components/TurnPanel'
import { rateEncounter, encounterXp, entriesFromCombat } from '../lib/encounters'
import { useSrdMonsters, useCustomMonsters } from '../lib/monsterLibrary'
import {
  addEffect,
  advanceTurn,
  damageRow,
  endCombat,
  endEffect,
  healRow,
  lairCombatant,
  mutateCombat,
  pcCombatant,
  rollAllMonsterInitiative,
  setDeathSaves,
  setConcentrating,
  announce,
  applyDeathSave,
  conditionNote,
  enterForm,
  leaveForm,
  deathOutcome,
  setAlly,
  setController,
  setExhaustion,
  settleConcentration,
  settleEffectSave,
  settleRecharge,
  shareInitiative,
  sortCombatants,
  startCombat,
  toggleSurprised,
  undoCombat,
} from '../lib/combat'
import { formatMod, rollDie, rollInitiative } from '../lib/dice'
import { t, tAbility, tCondition, tDamage } from '../lib/i18n'
import { canAppRoll, updateSettings, useSettings, type Settings } from '../lib/settings'
import { pictureFor, useAvatars } from '../lib/avatars'
import { useSentRoll } from '../lib/rolls'
import { askConfirm, askText } from '../lib/ask'
import { updateCharacter } from '../lib/store'
import { combatPick, endCombatMusic, playPick, prepareCombatMusic, startCombatMusic, useMusic, useMusicSettings } from '../lib/music'
import { MusicPicker } from '../components/MusicPicker'
import { saveBonus } from '../lib/resolve'
import { effectiveAc, exhaustionLevel } from '../lib/conditionRules'
import { isEnemy } from '../lib/sides'
import { conditionTone } from '../lib/tones'
import { CONDITIONS, type Character, type Combatant, type Condition, type Prompt, type TurnUsed } from '../types'

export function CombatPage({ goTo }: { goTo?: (tab: 'encounters') => void }) {
  useSingleOpenMenu()
  const settings = useSettings()
  const music = useMusicSettings()
  const library = useMusic()
  const combat = useLiveQuery(() => db.combat.get('current'), [])
  const characters = useLiveQuery(() => db.characters.toArray(), [])
  const { monsters: srd } = useSrdMonsters()
  const custom = useCustomMonsters()
  const combatants = combat?.combatants ?? []
  const started = combat?.started ?? false
  const avatars = useAvatars()
  const imageFor = (c: Combatant) => (c.kind === 'pc' ? characters?.find((ch) => ch.id === c.characterId)?.image : pictureFor(c, combatants, avatars)?.blob)
  const lastUndo = combat?.history?.at(-1)

  const addParty = () =>
    mutateCombat((s) => {
      const present = new Set(s.combatants.map((c) => c.characterId))
      characters?.filter((ch) => !present.has(ch.id)).forEach((ch) => s.combatants.push(pcCombatant(ch)))
      if (s.started) sortCombatants(s)
    }, t('lbl.addedParty'))

  const saveEncounter = async () => {
    const entries = entriesFromCombat(combatants)
    if (!entries.length) return alert(t('combat.addMonstersFirst'))
    const name = await askText({ title: t('combat.namePrompt'), value: t('combat.newEncounter'), confirm: t('common.save') })
    if (name) await db.encounters.add({ name, notes: '', entries, music: combatPick(music) }) // keeps the music prepared for this fight
  }

  const allSet = combatants.length > 0 && combatants.every((c) => c.initiative !== null)
  const monsters = combatants.filter(isEnemy)
  const partyLevels = (characters ?? []).filter((ch) => combatants.some((c) => c.characterId === ch.id)).map((ch) => ch.level)
  const xp = encounterXp(entriesFromCombat(combatants), srd, custom)
  const rating = monsters.length && partyLevels.length ? rateEncounter(xp, partyLevels) : null

  return (
    <div className="page">
      <div className="toolbar">
        <h2>
          {t('combat.title')} {started && <span className="muted">{t('combat.round', { n: combat?.round ?? 0 })}</span>}
        </h2>
        <button onClick={addParty}>{t('combat.addParty')}</button>
        <button onClick={() => mutateCombat((s) => rollAllMonsterInitiative(s, settings.groupInitiative), t('lbl.rolledInit'))}>{t('combat.rollMonsters')}</button>
        {!started ? (
          <button className="primary" disabled={!allSet} onClick={() => {
              void startCombatMusic() // first: the click is what lets the browser play sound and reopen the music folder
              void mutateCombat(startCombat, t('lbl.started'))
            }}>
            {t('combat.start')}
          </button>
        ) : (
          <>
            <button className="primary" onClick={() => mutateCombat(advanceTurn, t('lbl.nextTurn'))}>
              {t('combat.next')}
            </button>
            <button className="danger" onClick={async () => (await askConfirm(t('combat.endConfirm'), t('combat.end'))) && void endCombat().then(endCombatMusic)}>
              {t('combat.end')}
            </button>
          </>
        )}
        <button disabled={!lastUndo} title={lastUndo ? t('combat.undoTitle', { label: lastUndo.label }) : t('combat.nothingUndo')} onClick={() => undoCombat()}>
          {t('combat.undo')}
        </button>
        <button onClick={() => window.open('#player', 'dnd-player-view')}>{t('combat.openPlayer')}</button>
      </div>

      <div className="toolbar sub">
        <button onClick={() => mutateCombat((s) => { if (!s.combatants.some((c) => c.kind === 'lair')) { s.combatants.push(lairCombatant()); if (s.started) sortCombatants(s) } }, t('lbl.addedLair'))}>
          {t('combat.lair')}
        </button>
        <button onClick={saveEncounter} disabled={!monsters.length}>
          {t('combat.saveEncounter')}
        </button>
        {goTo && <button onClick={() => goTo('encounters')}>{t('combat.savedEncounters')}</button>}
        {(music.scenes.length > 0 || library.tracks.length > 0) && (
          <>
            {/* what starts with the fight: set it before pressing Start (it takes over from whatever plays, or starts if nothing does) */}
            <label className="row gap" title={t('music.combatTitle')}>
              <span className="muted">{t('music.combat')}</span>
              <MusicPicker
                value={combatPick(music)}
                placeholder={t('music.combatNone')}
                clearLabel={t('music.combatNone')}
                onChange={(pick) => {
                  void prepareCombatMusic(pick)
                  if (started && pick) void playPick(pick, music.scenes) // mid-fight: switch right now
                }}
              />
            </label>
            {/* a quick change at any time, in or out of a fight */}
            <label className="row gap" title={t('music.playNowTitle')}>
              <span className="muted">{t('music.playNow')}</span>
              <MusicPicker placeholder={t('music.playNowPlaceholder')} onChange={(pick) => pick && void playPick(pick, music.scenes)} />
            </label>
          </>
        )}
        <label className="check small" title={t('combat.groupTitle')}>
          <input type="checkbox" checked={settings.groupInitiative} onChange={(e) => updateSettings({ groupInitiative: e.target.checked })} />
          <span>{t('combat.group')}</span>
        </label>
        {rating && (
          <span className="difficulty" title={t('combat.budgetTitle', { xp, low: rating.budget.low, mod: rating.budget.moderate, high: rating.budget.high })}>
            {xp} XP · <strong className={`diff ${rating.difficulty?.replace(' ', '-').toLowerCase()}`}>{rating.difficulty ? t(`diff.${rating.difficulty}`) : ''}</strong> {t('combat.forParty')}
          </span>
        )}
      </div>

      {!!characters?.length && <SpellFinder characters={characters.map(normalizeCharacter)} />}
      {combatants.length > 0 && <HazardPanel combatants={combatants} settings={settings} />}

      {!started && <RewardBanner />}

      <RollsTray names={new Map(combatants.filter((c) => c.characterId !== undefined).map((c) => [String(c.characterId), c.name]))} />

      {(combat?.prompts ?? []).map((p) => (
        <PromptBanner key={p.id} prompt={p} combatants={combatants} settings={settings} />
      ))}

      {!started && combatants.length > 0 && !allSet && <p className="muted">{t('combat.needInit')}</p>}
      {combatants.length === 0 && <p className="muted">{t('combat.emptyHint')}</p>}

      {started && combat && <TurnPanel key={`${combat.round}-${combat.turnIndex}-${combat.combatants[combat.turnIndex]?.id}`} combat={combat} />}

      <div className="combatants">
        {combatants.map((c, i) => (
          <CombatantRow key={c.id} c={c} all={combatants} active={started && i === combat?.turnIndex} started={started} image={imageFor(c)} settings={settings} character={c.characterId !== undefined ? characters?.find((ch) => ch.id === c.characterId) : undefined} />
        ))}
      </div>
    </div>
  )
}

/** Something to resolve: a concentration save, or a recharge roll. Players' d20s are typed in; monsters' can be rolled. */
function PromptBanner({ prompt, combatants, settings }: { prompt: Prompt; combatants: Combatant[]; settings: Settings }) {
  const c = combatants.find((x) => x.id === prompt.combatantId)
  const [d, setD] = useState('')
  // a player's save typed on their phone fills the box
  const sent = useSentRoll(c?.characterId, 'save')
  const wantsSave = prompt.kind === 'concentration' || prompt.kind === 'effectSave'
  useEffect(() => {
    if (wantsSave && sent.roll && d === '') {
      setD(String(sent.roll.value)) // eslint-disable-line react-hooks/set-state-in-effect
      sent.take()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent.roll?.id])
  if (!c) return null
  const roll = d === '' ? undefined : Number(d)
  const canRoll = canAppRoll(c.kind, settings)

  if (prompt.kind === 'concentration') {
    const bonus = saveBonus(c, 'con')
    const total = roll === undefined ? undefined : roll + bonus
    const pass = total === undefined ? undefined : total >= prompt.dc
    return (
      <div className="prompt-banner">
        <Rich text={t('prompt.conc', { dc: prompt.dc, bonus: formatMod(bonus) })} parts={{ name: <strong>{c.name}</strong> }} />
        <input className="narrow" type="number" placeholder="d20" value={d} onChange={(e) => setD(e.target.value)} aria-label="d20" />
        {canRoll && <button onClick={() => setD(String(rollDie(20)))}>🎲</button>}
        {total !== undefined && <span className={pass ? 'adv' : 'dis'}>{total} → {pass ? t('prompt.keeps') : t('prompt.loses')}</span>}
        <button className="primary" disabled={pass === undefined} onClick={() => mutateCombat((s) => settleConcentration(s, prompt.id, !!pass), t('lbl.concCheck', { name: c.name }))}>
          {t('prompt.apply')}
        </button>
        <button title={t('prompt.passedTitle')} onClick={() => mutateCombat((s) => settleConcentration(s, prompt.id, true), t('lbl.concKept', { name: c.name }))}>{t('prompt.passed')}</button>
        <button className="danger" onClick={() => mutateCombat((s) => settleConcentration(s, prompt.id, false), t('lbl.concLost', { name: c.name }))}>{t('prompt.failed')}</button>
      </div>
    )
  }
  if (prompt.kind === 'effectSave') {
    const effect = c.effects?.find((e) => e.id === prompt.effectId)
    if (!effect?.save) return null
    const bonus = saveBonus(c, effect.save.ability)
    const total = roll === undefined ? undefined : roll + bonus
    const pass = total === undefined ? undefined : total >= effect.save.dc
    const settle = (ok: boolean) => mutateCombat((s) => settleEffectSave(s, prompt.id, ok), t('lbl.effectSave', { who: c.name, effect: effect.name }))
    return (
      <div className="prompt-banner">
        <Rich
          text={t('prompt.effectSave', { ability: tAbility(effect.save.ability), effect: effect.name, dc: effect.save.dc, bonus: formatMod(bonus) })}
          parts={{ name: <strong>{c.name}</strong> }}
        />
        <input className="narrow" type="number" placeholder="d20" value={d} onChange={(e) => setD(e.target.value)} aria-label="d20" />
        {canRoll && <button onClick={() => setD(String(rollDie(20)))}>🎲</button>}
        {total !== undefined && <span className={pass ? 'adv' : 'dis'}>{total} → {pass ? t('eff.saved') : t('eff.notSaved')}</span>}
        <button className="primary" disabled={pass === undefined} onClick={() => settle(!!pass)}>
          {t('prompt.apply')}
        </button>
        <button onClick={() => settle(true)}>{t('prompt.effectEnded')}</button>
        <button onClick={() => settle(false)}>{t('prompt.effectKept')}</button>
      </div>
    )
  }
  const action = c.actions.find((a) => a.id === prompt.actionId)
  return (
    <div className="prompt-banner">
      <Rich
        text={t('prompt.recharge', { range: `${prompt.min}${prompt.min < 6 ? '-6' : ''}` })}
        parts={{ name: <strong>{c.name}</strong>, action: <strong>{action?.name}</strong> }}
      />
      <input className="narrow" type="number" min={1} max={6} placeholder="d6" value={d} onChange={(e) => setD(e.target.value)} aria-label="d6" />
      <button onClick={() => setD(String(rollDie(6)))}>🎲</button>
      <button className="primary" disabled={roll === undefined} onClick={() => mutateCombat((s) => settleRecharge(s, prompt.id, roll!), t('lbl.recharge', { name: c.name }))}>
        {t('prompt.apply')}
      </button>
      <button onClick={() => mutateCombat((s) => { s.prompts = (s.prompts ?? []).filter((x) => x.id !== prompt.id) }, t('lbl.skippedRecharge'))}>{t('prompt.skip')}</button>
    </div>
  )
}

const ECON: { key: keyof TurnUsed; letter: 'econ.aLetter' | 'econ.bLetter' | 'econ.rLetter'; title: 'econ.action' | 'econ.bonus' | 'econ.reaction' }[] = [
  { key: 'action', letter: 'econ.aLetter', title: 'econ.action' },
  { key: 'bonus', letter: 'econ.bLetter', title: 'econ.bonus' },
  { key: 'reaction', letter: 'econ.rLetter', title: 'econ.reaction' },
]

/** Only one row menu (effects, Wild Shape, conditions) is open at a time; a click anywhere else closes it. */
function useSingleOpenMenu() {
  useEffect(() => {
    const menus = () => [...document.querySelectorAll<HTMLDetailsElement>('.row-menus > details')]
    const onToggle = (e: Event) => {
      const el = e.target as HTMLDetailsElement
      if (el.open && el.matches?.('.row-menus > details')) menus().forEach((d) => d !== el && (d.open = false))
    }
    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.('.row-menus')) menus().forEach((d) => (d.open = false))
    }
    document.addEventListener('toggle', onToggle, true)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('toggle', onToggle, true)
      document.removeEventListener('click', onClick)
    }
  }, [])
}

function CombatantRow({ c, all, active, started, image, settings, character }: { c: Combatant; all: Combatant[]; active: boolean; started: boolean; image?: Blob; settings: Settings; character?: Character }) {
  const [amount, setAmount] = useState('')
  const [condOpen, setCondOpen] = useState(false)
  const update = (fn: (c: Combatant) => void, resort = false, label?: string) =>
    mutateCombat((s) => {
      const target = s.combatants.find((x) => x.id === c.id)
      if (!target) return
      fn(target)
      if (resort) sortCombatants(s)
    }, label ?? t('lbl.edit', { name: c.name }))
  const amt = Number(amount)
  const withState = (fn: (s: Parameters<Parameters<typeof mutateCombat>[0]>[0], who: Combatant) => void, label: string) =>
    mutateCombat((s) => {
      const who = s.combatants.find((x) => x.id === c.id)
      if (who) fn(s, who)
    }, label)

  // a player's initiative typed on their phone: set when none is set yet, offered (next to the name) when one is
  const sentDeath = useSentRoll(c.characterId, 'death')
  const sentInit = useSentRoll(c.characterId, 'initiative')
  const takePhoneInitiative = () => {
    withState((s, who) => { who.initiative = sentInit.roll!.value; if (settings.groupInitiative) shareInitiative(s, who); else sortCombatants(s) }, t('lbl.initFromPhone', { name: c.name }))
    sentInit.take()
  }
  useEffect(() => {
    if (sentInit.roll && c.initiative === null) takePhoneInitiative()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentInit.roll?.id, c.initiative])
  const toggleCondition = (cond: Condition) =>
    mutateCombat((s) => {
      const who = s.combatants.find((x) => x.id === c.id)
      if (!who) return
      const adding = !who.conditions.includes(cond)
      who.conditions = adding ? [...who.conditions, cond] : who.conditions.filter((x) => x !== cond)
      const note = adding ? conditionNote(who, cond) : ''
      if (note) announce(s, note)
    }, `${c.name}: ${tCondition(cond)}`)
  const pct = c.maxHp ? Math.round((c.hp / c.maxHp) * 100) : 0
  const down = c.kind !== 'lair' && c.hp === 0
  const none = '-'

  if (c.kind === 'lair') {
    return (
      <div className={`combatant lair ${active ? 'active' : ''}`}>
        <InitiativeInput value={c.initiative} onCommit={(n) => update((who) => (who.initiative = n), true, t('lbl.lairInit'))} />
        <span />
        <div className="portrait placeholder" style={{ width: 48, height: 48, fontSize: 22 }}>☗</div>
        <div className="who">
          <strong>{c.name}</strong>
          <span className="muted">{c.notes || t('row.lairNote')}</span>
        </div>
        <span />
        <span />
        <span />
        <button title={t('row.removeTitle')} onClick={() => mutateCombat((s) => void (s.combatants = s.combatants.filter((x) => x.id !== c.id)), t('lbl.removedLair'))}>✕</button>
      </div>
    )
  }

  return (
    <div className={`combatant ${c.kind} ${active ? 'active' : ''} ${down ? 'down' : ''}`}>
      <InitiativeInput value={c.initiative} onCommit={(n) => withState((s, who) => { who.initiative = n; if (settings.groupInitiative) shareInitiative(s, who); else sortCombatants(s) }, t('lbl.initiative', { name: c.name }))} />
      {canAppRoll(c.kind, settings) ? (
        <button title={c.surprised ? t('row.rollInitSurprised') : t('row.rollInit')} onClick={() => withState((s, who) => { who.initiative = rollInitiative(who.initiativeBonus, !!who.surprised); if (settings.groupInitiative) shareInitiative(s, who); else sortCombatants(s) }, t('lbl.rolledInitOne', { name: c.name }))}>
          🎲
        </button>
      ) : (
        <span title={t('row.playersRoll')} />
      )}
      <Portrait name={c.name} image={image} size={48} />
      <div className="who">
        <strong>{c.name}</strong>
        {sentInit.roll && c.initiative !== null && sentInit.roll.value !== c.initiative && (
          <button className="tiny-button" title={t('roll.useTitle')} onClick={takePhoneInitiative}>
            📱 {sentInit.roll.value}
          </button>
        )}
        <span className="muted">
          {t('row.ac', { n: effectiveAc(c) })}
          {(c.resistances?.length || c.immunities?.length || c.vulnerabilities?.length) ? (
            <span
              className="defences"
              title={t('row.defences', {
                r: (c.resistances ?? []).map(tDamage).join(', ') || none,
                i: (c.immunities ?? []).map(tDamage).join(', ') || none,
                v: (c.vulnerabilities ?? []).map(tDamage).join(', ') || none,
              })}
            >
              {' '}🛡{c.resistances?.length ? ` R${c.resistances.length}` : ''}{c.immunities?.length ? ` I${c.immunities.length}` : ''}{c.vulnerabilities?.length ? ` V${c.vulnerabilities.length}` : ''}
            </span>
          ) : null}
        </span>
        {!started && (
          <label className="check small surprised" title={t('row.surprisedTitle')}>
            <input type="checkbox" checked={!!c.surprised} onChange={() => withState((s, who) => toggleSurprised(s, who), t('lbl.surprised', { name: c.name }))} />
            <span>
              {t('row.surprised')}
              {c.surprised ? (canAppRoll(c.kind, settings) ? t('row.surprisedRolls') : t('row.surprisedPlayer')) : ''}
            </span>
          </label>
        )}
        {active && (
          <span className="econ">
            {ECON.map(({ key, letter, title }) => (
              <button
                key={key}
                className={`econ-pip ${c.turn?.[key] ? 'used' : ''}`}
                title={t('econ.title', { what: t(title), state: c.turn?.[key] ? t('econ.used') : t('econ.available') })}
                onClick={() => update((who) => (who.turn = { action: false, bonus: false, reaction: false, ...who.turn, [key]: !(who.turn?.[key] ?? false) }), false, `${c.name}: ${t(title)}`)}
              >
                {t(letter)}
              </button>
            ))}
          </span>
        )}
        {!!c.effects?.length && (
          <div className="effect-chips">
            {c.effects.map((e) => (
              <span key={e.id} className="chip" title={effectLine(e, all)}>
                ✦ {e.name}
                {e.rounds !== undefined && ` · ${e.rounds}`}
              </span>
            ))}
          </div>
        )}
        {c.legendary && <span className="muted tiny">{t('row.legendary', { left: c.legendary.max - c.legendary.used, max: c.legendary.max })}</span>}
        {c.kind === 'pc' && down && sentDeath.roll && (
          <button
            className="tiny-button"
            title={t('roll.deathUse', { value: sentDeath.roll.value, outcome: t(`roll.deathOutcome.${deathOutcome(sentDeath.roll.value)}`) })}
            onClick={() => {
              const v = sentDeath.roll!.value
              withState((s, who) => applyDeathSave(s, who, v), t('lbl.deathFromPhone', { name: c.name }))
              sentDeath.take()
            }}
          >
            📱 {sentDeath.roll.value}
          </button>
        )}
        {c.kind === 'pc' && down && (
          <div className="saves" title={t('row.deathSaves')}>
            <Pips label="✓" n={c.deathSaves.successes} onChange={(n) => withState((s, who) => setDeathSaves(s, who, 'successes', n), t('lbl.deathSave', { name: c.name }))} />
            <Pips label="✗" n={c.deathSaves.failures} onChange={(n) => withState((s, who) => setDeathSaves(s, who, 'failures', n), t('lbl.deathSave', { name: c.name }))} />
          </div>
        )}
      </div>

      <div className="hp">
        <div className="bar">
          <div className="fill" style={{ width: `${pct}%` }} data-low={pct <= 50} />
        </div>
        <span>
          {c.hp}/{c.maxHp}
          {c.tempHp > 0 && <em>{t('row.temp', { n: c.tempHp })}</em>}
        </span>
      </div>

      <div className="row gap amount">
        <input
          className="narrow"
          type="number"
          min={0}
          placeholder="±"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && amt > 0) {
              withState((s, who) => damageRow(s, who, amt), t('lbl.damage', { name: c.name }))
              setAmount('')
            }
          }}
        />
        <button className="danger" onClick={() => { if (amt > 0) withState((s, who) => damageRow(s, who, amt), t('lbl.damage', { name: c.name })); setAmount('') }}>
          {t('row.dmg')}
        </button>
        <button onClick={() => { if (amt > 0) withState((s, who) => healRow(s, who, amt), t('lbl.heal', { name: c.name })); setAmount('') }}>{t('row.heal')}</button>
        <button
          title={t('row.tempTitle')}
          onClick={() => {
            if (amt > 0) update((who) => (who.tempHp = Math.max(who.tempHp, amt)), false, t('lbl.tempHp', { name: c.name }))
            setAmount('')
          }}
        >
          {t('row.tempBtn')}
        </button>
      </div>

      <div className="row-menus">
      <EffectsMenu
        c={c}
        all={all}
        onAdd={(e) => withState((s, who) => addEffect(s, who, e), t('lbl.effectAdd', { who: c.name, effect: e.name }))}
        onRemove={(id) =>
          withState((s, who) => {
            const e = who.effects?.find((x) => x.id === id)
            if (e) endEffect(s, who, e, 'removed')
          }, t('lbl.effectEnd', { who: c.name, effect: c.effects?.find((x) => x.id === id)?.name ?? '' }))
        }
      />

      {character?.classIndex === 'druid' && (
        <WildShape
          c={c}
          level={character.level}
          onEnter={(beast) => withState((s, who) => enterForm(s, who, beast, character.level), t('lbl.form', { name: c.name }))}
          onLeave={() => withState((s, who) => leaveForm(s, who), t('lbl.form', { name: c.name }))}
        />
      )}

      <button
        className="row-menu-btn"
        title={[...c.conditions.map(tCondition), c.concentrating ? t('row.concentratingTitle') : ''].filter(Boolean).join(', ')}
        onClick={() => setCondOpen(true)}
      >
        {c.conditions.length
          ? c.conditions.map((x, i) => (
              <span key={x}>
                {i > 0 && ', '}
                <span className="cond" data-tone={conditionTone(x)}>{x === 'Exhaustion' ? `${tCondition('Exhaustion')} ${exhaustionLevel(c)}` : tCondition(x)}</span>
              </span>
            ))
          : t('row.conditions')}
        {c.concentrating && t('row.concentratingSummary')}
        {c.inspired && ' ★'}
      </button>
      {condOpen && (
        <Window
          title={t('row.conditionsOf', { name: c.name })}
          onClose={() => setCondOpen(false)}
          actions={
            <button className="primary" onClick={() => setCondOpen(false)}>
              {t('common.done')}
            </button>
          }
        >
          <section className="win-card">
            <h4>
              <span aria-hidden="true">🎯</span> {t('row.status')}
            </h4>
            <div className="choice-grid">
              <label className="choice-card">
                <input type="checkbox" checked={c.concentrating} onChange={(e) => withState((s, who) => setConcentrating(s, who, e.target.checked), t('lbl.concentration', { name: c.name }))} />
                <strong>{t('row.concentratingTitle')}</strong>
              </label>
              {c.kind === 'monster' && (
                <label className="choice-card" title={t('row.allyTitle')}>
                  <input type="checkbox" checked={!!c.ally} onChange={(e) => withState((s, who) => setAlly(s, who, e.target.checked), t('lbl.ally', { name: c.name }))} />
                  <strong>{t('row.ally')}</strong>
                </label>
              )}
              {c.kind === 'pc' && c.characterId !== undefined && (
                <label className="choice-card" title={t('insp.title')}>
                  <input
                    type="checkbox"
                    checked={!!c.inspired}
                    onChange={(e) => {
                      update((who) => (who.inspired = e.target.checked || undefined), false, t('lbl.inspiration', { name: c.name }))
                      void updateCharacter(c.characterId!, { heroicInspiration: e.target.checked })
                    }}
                  />
                  <strong>★ {t('insp.button')}</strong>
                </label>
              )}
            </div>
            {c.kind === 'monster' && c.ally && (
              <div className="win-pickers">
                <label className="inline-field">
                  {t('row.controlledBy')}
                  <select value={c.controlledBy ?? ''} onChange={(e) => withState((s, who) => setController(s, who, e.target.value || undefined), t('lbl.ally', { name: c.name }))}>
                    <option value="">{t('row.ownInitiative')}</option>
                    {all.filter((x) => x.kind !== 'lair' && x.id !== c.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </label>
              </div>
            )}
            <div className="exhaustion" title={t('row.exhaustionTitle')}>
              <span>{tCondition('Exhaustion')}</span>
              <button aria-label={t('row.lowerExhaustion')} disabled={exhaustionLevel(c) === 0} onClick={() => withState((s, who) => setExhaustion(s, who, exhaustionLevel(who) - 1), t('lbl.exhaustion', { name: c.name }))}>−</button>
              <strong>{exhaustionLevel(c)}</strong>
              <button aria-label={t('row.raiseExhaustion')} disabled={exhaustionLevel(c) >= 6} onClick={() => withState((s, who) => setExhaustion(s, who, exhaustionLevel(who) + 1), t('lbl.exhaustion', { name: c.name }))}>+</button>
            </div>
          </section>
          <section className="win-card">
            <h4>
              <span aria-hidden="true">⚠</span> {t('row.conditions')}
            </h4>
            <div className="choice-grid compact">
              {CONDITIONS.filter((cond) => cond !== 'Exhaustion').map((cond) => (
                <label key={cond} className="choice-card" data-tone={conditionTone(cond)}>
                  <input type="checkbox" checked={c.conditions.includes(cond)} onChange={() => toggleCondition(cond)} />
                  <strong>{tCondition(cond)}</strong>
                </label>
              ))}
            </div>
          </section>
        </Window>
      )}

      </div>

      <button title={t('row.removeTitle')} onClick={() => mutateCombat((s) => void (s.combatants = s.combatants.filter((x) => x.id !== c.id)), t('lbl.removed', { name: c.name }))}>
        ✕
      </button>
    </div>
  )
}

function Pips({ label, n, onChange }: { label: string; n: number; onChange: (n: number) => void }) {
  return (
    <span className="pips">
      {[1, 2, 3].map((i) => (
        <button key={i} className={n >= i ? 'on' : ''} onClick={() => onChange(n === i ? i - 1 : i)}>
          {label}
        </button>
      ))}
    </span>
  )
}
