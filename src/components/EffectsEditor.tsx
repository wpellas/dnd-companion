import { useState } from 'react'
import { effectLine, PRESETS, presetFor } from '../lib/effects'
import { newId } from '../lib/id'
import { t, tAbility, tCondition } from '../lib/i18n'
import { ABILITIES, CONDITIONS, type Ability, type Combatant, type Condition, type Effect } from '../types'

/** The effects on one creature, with a small form to add another (from a spell preset or by hand). */
export function EffectsEditor({ c, all, onAdd, onRemove }: { c: Combatant; all: Combatant[]; onAdd: (e: Effect) => void; onRemove: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [condition, setCondition] = useState<Condition | ''>('')
  const [rounds, setRounds] = useState('')
  const [at, setAt] = useState<'start' | 'end'>('start')
  const [ofCaster, setOfCaster] = useState(true)
  const [saveAbility, setSaveAbility] = useState<Ability | ''>('')
  const [dc, setDc] = useState('')
  const [saveAt, setSaveAt] = useState<'start' | 'end'>('end')
  const [casterId, setCasterId] = useState('')
  const [concentration, setConcentration] = useState(false)

  const pick = (preset: string) => {
    const p = presetFor(preset)
    setName(p?.name ?? '')
    setCondition(p?.condition ?? '')
    setRounds(p?.rounds !== undefined ? String(p.rounds) : '')
    setAt(p?.ticks === 'caster' ? 'start' : 'end')
    setOfCaster(p?.ticks === 'caster')
    setSaveAbility(p?.save ?? '')
    setSaveAt('end')
    setConcentration(!!p?.concentration)
  }

  const days = Number(rounds)
  const valid = name.trim() !== '' && (rounds === '' || (Number.isInteger(days) && days > 0)) && (!saveAbility || Number(dc) > 0)
  const add = () => {
    const caster = casterId || undefined
    const byCaster = ofCaster && !!caster
    onAdd({
      id: newId(),
      name: name.trim(),
      condition: condition || undefined,
      rounds: rounds === '' ? undefined : days,
      at,
      whose: byCaster ? caster! : c.id,
      save: saveAbility ? { ability: saveAbility, dc: Number(dc), at: saveAt } : undefined,
      sourceId: caster,
      concentration: !!caster && concentration,
    })
    setOpen(false)
    pick('')
    setDc('')
    setCasterId('')
  }

  return (
    <div className="effects-editor">
      {c.effects?.length ? (
        <ul>
          {c.effects.map((e) => (
            <li key={e.id}>
              <strong>{e.name}</strong>
              <span className="muted"> {effectLine(e, all)}</span>
              <button className="danger" title={t('eff.remove')} aria-label={t('eff.remove')} onClick={() => onRemove(e.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{t('eff.none')}</p>
      )}
      {!open ? (
        <button onClick={() => setOpen(true)}>{t('eff.add')}</button>
      ) : (
        <div className="effect-form">
          <label className="inline-field">
            {t('eff.preset')}
            <select value={presetFor(name)?.name ?? ''} onChange={(e) => pick(e.target.value)}>
              <option value="">{t('eff.custom')}</option>
              {PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            {t('eff.name')}
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="inline-field">
            {t('eff.condition')}
            <select value={condition} onChange={(e) => setCondition(e.target.value as Condition | '')}>
              <option value="">{t('eff.conditionNone')}</option>
              {CONDITIONS.filter((x) => x !== 'Exhaustion').map((x) => (
                <option key={x} value={x}>
                  {tCondition(x)}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            {t('eff.castBy')}
            <select value={casterId} onChange={(e) => setCasterId(e.target.value)}>
              <option value="">{t('eff.noCaster')}</option>
              {all.filter((x) => x.kind !== 'lair').map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          {casterId && (
            <label className="check small">
              <input type="checkbox" checked={concentration} onChange={(e) => setConcentration(e.target.checked)} />
              <span>{t('eff.concentration')}</span>
            </label>
          )}
          <div className="row gap wrap">
            <label className="inline-field">
              {t('eff.roundsLabel')}
              <input className="narrow" type="number" min={1} value={rounds} placeholder={t('eff.roundsHint')} onChange={(e) => setRounds(e.target.value)} />
            </label>
            {rounds !== '' && (
              <>
                <label className="inline-field">
                  {t('eff.countAt')}
                  <select value={at} onChange={(e) => setAt(e.target.value as 'start' | 'end')}>
                    <option value="start">{t('eff.start')}</option>
                    <option value="end">{t('eff.end')}</option>
                  </select>
                </label>
                <select value={ofCaster && casterId ? 'caster' : 'target'} onChange={(e) => setOfCaster(e.target.value === 'caster')} aria-label={t('eff.countAt')}>
                  <option value="target">{t('eff.ofTarget')}</option>
                  {casterId && <option value="caster">{t('eff.ofCaster')}</option>}
                </select>
              </>
            )}
          </div>
          <div className="row gap wrap">
            <label className="inline-field">
              {t('eff.repeatSave')}
              <select value={saveAbility} onChange={(e) => setSaveAbility(e.target.value as Ability | '')}>
                <option value="">{t('eff.noSave')}</option>
                {ABILITIES.map((a) => (
                  <option key={a} value={a}>
                    {tAbility(a)}
                  </option>
                ))}
              </select>
            </label>
            {saveAbility && (
              <>
                <label className="inline-field">
                  {t('eff.dc')}
                  <input className="narrow" type="number" min={1} value={dc} onChange={(e) => setDc(e.target.value)} />
                </label>
                <label className="inline-field">
                  {t('eff.saveAt')}
                  <select value={saveAt} onChange={(e) => setSaveAt(e.target.value as 'start' | 'end')}>
                    <option value="start">{t('eff.start')}</option>
                    <option value="end">{t('eff.end')}</option>
                  </select>
                </label>
              </>
            )}
          </div>
          <div className="row gap">
            <button className="primary" disabled={!valid} onClick={add}>
              {t('eff.addGo')}
            </button>
            <button onClick={() => setOpen(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
