import { useState } from 'react'
import { applyResolution, mutateCombat, type TargetOutcome } from '../lib/combat'
import { parseDice } from '../lib/dice'
import { t, tAbility, tDamage } from '../lib/i18n'
import { adjustForTarget } from '../lib/resolve'
import { canAppRoll, type Settings } from '../lib/settings'
import { ABILITIES, DAMAGE_TYPES, type Ability, type Action, type Combatant } from '../types'
import { DamageEntry } from './turn/DamageEntry'
import { SaveResolver } from './turn/SaveResolver'
import { useDamageEntry } from './turn/useDamageEntry'

type Preset = 'falling' | 'burning' | 'custom'

/**
 * Environmental damage that no creature deals: a fall, fire, acid... (2024 rules: Falling is 1d6 Bludgeoning per 10 feet fallen, at most 20d6, and the
 * creature lands Prone; Burning is 1d4 Fire). The DM may roll these dice (the environment's); players still type their own saves.
 */
export function HazardPanel({ combatants, settings }: { combatants: Combatant[]; settings: Settings }) {
  const [preset, setPreset] = useState<Preset>('falling')
  const [feet, setFeet] = useState('20')
  const [name, setName] = useState('')
  const [dice, setDice] = useState('2d6')
  const [type, setType] = useState('fire')
  const [save, setSave] = useState(false)
  const [ability, setAbility] = useState<Ability>('dex')
  const [dc, setDc] = useState('13')
  const [half, setHalf] = useState(true)
  const [picked, setPicked] = useState<string[]>([])
  const [go, setGo] = useState(false)

  const fallDice = Math.min(20, Math.floor((Number(feet) || 0) / 10))
  const action: Action | undefined =
    preset === 'falling'
      ? fallDice > 0
        ? { id: 'hazard', name: t('haz.falling'), kind: 'other', damage: `${fallDice}d6`, damageType: 'bludgeoning', condition: 'Prone' }
        : undefined
      : preset === 'burning'
        ? { id: 'hazard', name: t('haz.burning'), kind: 'other', damage: '1d4', damageType: 'fire' }
        : parseDice(dice) && name.trim()
          ? {
              id: 'hazard',
              name: name.trim(),
              kind: save ? 'save' : 'other',
              damage: dice,
              damageType: type,
              saveAbility: save ? ability : undefined,
              saveDc: save ? Number(dc) || 10 : undefined,
              halfOnSave: save ? half : undefined,
            }
          : undefined
  const targets = combatants.filter((c) => c.kind !== 'lair' && picked.includes(c.id))
  const ready = !!action && targets.length > 0
  const pseudo = { ...(combatants[0] as Combatant), name: action?.name ?? '' }

  const apply = (outcomes: TargetOutcome[], detail: string) => {
    if (!action) return
    void mutateCombat((s) => applyResolution(s, { attackerId: '', source: action.name, action, targets: outcomes, detail }), action.name)
    setGo(false)
    setPicked([])
  }

  return (
    <details className="card hazard-panel">
      <summary>{t('haz.title')}</summary>
      <div className="row gap wrap">
        <label className="inline-field">
          {t('haz.kind')}
          <select value={preset} onChange={(e) => { setPreset(e.target.value as Preset); setGo(false) }}>
            <option value="falling">{t('haz.falling')}</option>
            <option value="burning">{t('haz.burning')}</option>
            <option value="custom">{t('haz.custom')}</option>
          </select>
        </label>
        {preset === 'falling' && (
          <label className="inline-field">
            {t('haz.feet')}
            <input className="narrow" type="number" min={0} step={10} value={feet} onChange={(e) => { setFeet(e.target.value); setGo(false) }} />
          </label>
        )}
        {preset === 'custom' && (
          <>
            <label className="inline-field">
              {t('haz.name')}
              <input value={name} onChange={(e) => { setName(e.target.value); setGo(false) }} />
            </label>
            <label className="inline-field">
              {t('haz.dice')}
              <input className="narrow" value={dice} onChange={(e) => { setDice(e.target.value); setGo(false) }} />
            </label>
            <label className="inline-field">
              {t('haz.type')}
              <select value={type} onChange={(e) => { setType(e.target.value); setGo(false) }}>
                {DAMAGE_TYPES.map((d) => <option key={d} value={d}>{tDamage(d)}</option>)}
              </select>
            </label>
            <label className="check small">
              <input type="checkbox" checked={save} onChange={(e) => { setSave(e.target.checked); setGo(false) }} />
              <span>{t('haz.save')}</span>
            </label>
            {save && (
              <>
                <select value={ability} onChange={(e) => { setAbility(e.target.value as Ability); setGo(false) }} aria-label={t('haz.save')}>
                  {ABILITIES.map((a) => <option key={a} value={a}>{tAbility(a)}</option>)}
                </select>
                <label className="inline-field">
                  DC
                  <input className="narrow" type="number" min={1} value={dc} onChange={(e) => { setDc(e.target.value); setGo(false) }} />
                </label>
                <label className="check small">
                  <input type="checkbox" checked={half} onChange={(e) => { setHalf(e.target.checked); setGo(false) }} />
                  <span>{t('haz.half')}</span>
                </label>
              </>
            )}
          </>
        )}
      </div>
      {preset === 'falling' && !action && <p className="muted note-line">{t('haz.noFall')}</p>}

      <div className="row gap wrap haz-targets">
        {combatants.filter((c) => c.kind !== 'lair').map((c) => (
          <label key={c.id} className="check small">
            <input
              type="checkbox"
              checked={picked.includes(c.id)}
              onChange={(e) => { setPicked((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id))); setGo(false) }}
            />
            <span>{c.name}</span>
          </label>
        ))}
      </div>

      {!go ? (
        <button className="primary" disabled={!ready} onClick={() => setGo(true)}>
          {t('haz.resolve')}
        </button>
      ) : (
        ready &&
        (action.kind === 'save' ? (
          <SaveResolver
            key={`${action.name}-${action.damage}-${targets.map((x) => x.id).join()}`}
            attacker={pseudo}
            action={action}
            targets={targets}
            canRollFor={(c) => canAppRoll(c.kind, settings)}
            canRollDamage
            onApply={apply}
          />
        ) : (
          <HazardDamage key={`${action.name}-${action.damage}-${targets.map((x) => x.id).join()}`} action={action} targets={targets} onApply={apply} />
        ))
      )}
    </details>
  )
}

/** No save: everyone picked takes the same roll, less their resistances. */
function HazardDamage({ action, targets, onApply }: { action: Action; targets: Combatant[]; onApply: (o: TargetOutcome[], detail: string) => void }) {
  const entry = useDamageEntry(action, { crit: false, advantage: false })
  return (
    <div className="resolve">
      <DamageEntry entry={entry} label={t('act.damage')} canRoll />
      <button
        className="primary"
        disabled={!entry.complete}
        onClick={() =>
          onApply(
            targets.map((c): TargetOutcome => {
              const adj = adjustForTarget(entry.out, c)
              return { targetId: c.id, result: 'hit', parts: adj.parts, applyCondition: true, notes: adj.notes }
            }),
            entry.detail,
          )
        }
      >
        {t('haz.apply')}
      </button>
    </div>
  )
}
