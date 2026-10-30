import { Hourglass, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { effectLine, PRESETS, presetFor } from '../lib/effects'
import { newId } from '../lib/id'
import { t, tAbility, tCondition } from '../lib/i18n'
import { ABILITIES, CONDITIONS, type Ability, type Combatant, type Condition, type Effect } from '../types'
import { CheckField } from './Section'
import { Window } from './Window'

type Props = { c: Combatant; all: Combatant[]; onAdd: (e: Effect) => void; onRemove: (id: string) => void }

/** The "Effects" button on a combat row; it opens a window with that creature's effects and the form to add one. */
export function EffectsMenu(props: Props) {
  const [open, setOpen] = useState(false)
  const { c } = props
  return (
    <>
      <button className="row-menu-btn" onClick={() => setOpen(true)}>
        {c.effects?.length ? t('eff.summary', { n: c.effects.length }) : t('eff.summaryNone')}
      </button>
      {open && (
        <Window
          title={t('eff.titleOf', { name: c.name })}
          onClose={() => setOpen(false)}
          actions={
            <button className="primary" onClick={() => setOpen(false)}>
              {t('common.done')}
            </button>
          }
        >
          <EffectsEditor {...props} />
        </Window>
      )}
    </>
  )
}

/** The effects on one creature, and a form to add another (from a spell preset or by hand). Both stay in view, so several can be added in a row. */
function EffectsEditor({ c, all, onAdd, onRemove }: Props) {
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
    setAt(p?.at ?? (p?.ticks === 'caster' ? 'start' : 'end'))
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
      mods: presetFor(name.trim())?.mods,
    })
    pick('')
    setDc('')
    setCasterId('')
  }

  return (
    <div className="effects-editor">
      <section className="win-card">
        <h4>
          <Hourglass aria-hidden="true" /> {t('eff.active')}
        </h4>
        {c.effects?.length ? (
          <ul className="effect-list">
            {c.effects.map((e) => (
              <li key={e.id}>
                <div>
                  <strong>{e.name}</strong>
                  <span className="muted"> {effectLine(e, all)}</span>
                </div>
                <button className="danger" title={t('eff.remove')} aria-label={t('eff.remove')} onClick={() => onRemove(e.id)}>
                  <X />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('eff.none')}</p>
        )}
      </section>

      <section className="win-card">
        <h4>
          <Sparkles aria-hidden="true" /> {t('eff.addTitle')}
        </h4>
        <div className="field-grid">
          <label className="field span-2">
            <span>{t('eff.preset')}</span>
            <select value={presetFor(name)?.name ?? ''} onChange={(e) => pick(e.target.value)}>
              <option value="">{t('eff.custom')}</option>
              {PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field span-2">
            <span>{t('eff.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('eff.condition')}</span>
            <select value={condition} onChange={(e) => setCondition(e.target.value as Condition | '')}>
              <option value="">{t('eff.conditionNone')}</option>
              {CONDITIONS.filter((x) => x !== 'Exhaustion').map((x) => (
                <option key={x} value={x}>
                  {tCondition(x)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('eff.castBy')}</span>
            <select value={casterId} onChange={(e) => setCasterId(e.target.value)}>
              <option value="">{t('eff.noCaster')}</option>
              {all.filter((x) => x.kind !== 'lair').map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          {casterId && <CheckField label={t('eff.concentration')} checked={concentration} onChange={setConcentration} />}
          <label className="field">
            <span>{t('eff.roundsLabel')}</span>
            <input type="number" min={1} value={rounds} placeholder={t('eff.roundsHint')} onChange={(e) => setRounds(e.target.value)} />
          </label>
          {rounds !== '' && (
            <>
              <label className="field">
                <span>{t('eff.countAt')}</span>
                <select value={at} onChange={(e) => setAt(e.target.value as 'start' | 'end')}>
                  <option value="start">{t('eff.start')}</option>
                  <option value="end">{t('eff.end')}</option>
                </select>
              </label>
              <label className="field">
                <span>{t('eff.countWhose')}</span>
                <select value={ofCaster && casterId ? 'caster' : 'target'} onChange={(e) => setOfCaster(e.target.value === 'caster')}>
                  <option value="target">{t('eff.ofTarget')}</option>
                  {casterId && <option value="caster">{t('eff.ofCaster')}</option>}
                </select>
              </label>
            </>
          )}
          <label className="field">
            <span>{t('eff.repeatSave')}</span>
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
              <label className="field">
                <span>{t('eff.dc')}</span>
                <input type="number" min={1} value={dc} onChange={(e) => setDc(e.target.value)} />
              </label>
              <label className="field">
                <span>{t('eff.saveAt')}</span>
                <select value={saveAt} onChange={(e) => setSaveAt(e.target.value as 'start' | 'end')}>
                  <option value="start">{t('eff.start')}</option>
                  <option value="end">{t('eff.end')}</option>
                </select>
              </label>
            </>
          )}
        </div>
        <div className="win-pickers">
          <button className="primary" disabled={!valid} onClick={add}>
            {t('eff.addGo')}
          </button>
        </div>
      </section>
    </div>
  )
}
