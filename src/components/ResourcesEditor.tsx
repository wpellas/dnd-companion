import { Combobox, type ComboOption } from './Combobox'
import { NumberField } from './NumberField'
import { newId } from '../lib/id'
import { t } from '../lib/i18n'
import { Section } from './Section'
import { featureById, featuresFor, resourceFromFeature, type FeatureCtx } from '../data/classFeatures'
import type { AbilityScores, ClassIndex, Recharge, Resource } from '../types'

interface Props {
  resources: Resource[]
  onChange: (resources: Resource[]) => void
  /** The character, so the official list can be filtered to their class/level and counts worked out */
  owner: { classIndex?: ClassIndex; level: number; abilities: AbilityScores; table?: Record<string, unknown> }
}

const RECHARGE_LABEL = { short: 'res.rechargeAll', 'short-one': 'res.rechargeOne', long: 'res.rechargeLong' } as const
const RECHARGE_SHORT = { short: 'res.hintShort', 'short-one': 'res.hintOne', long: 'res.hintLong' } as const

const CUSTOM = '__custom'

/**
 * Limited-use features that rests restore. Pick from the official SRD list for the character's class and level (use
 * counts and recharge are worked out and kept up to date), or add a custom one and type everything yourself.
 */
export function ResourcesEditor({ resources, onChange, owner }: Props) {
  const ctx: FeatureCtx = { level: owner.level, abilities: owner.abilities, table: owner.table }
  const have = new Set(resources.map((r) => r.featureId))

  const options: ComboOption[] = [
    ...featuresFor(owner.classIndex, owner.level)
      .filter((f) => !have.has(f.id))
      .map((f): ComboOption => {
        const rc = typeof f.recharge === 'function' ? f.recharge(ctx) : f.recharge
        return { value: f.id, label: f.name, group: f.subclass ?? t('res.classFeatures'), hint: `${f.uses(ctx)} · ${t(RECHARGE_SHORT[rc])}` }
      }),
    { value: CUSTOM, label: t('res.custom'), group: t('res.manual') },
  ]

  const add = (value: string | undefined) => {
    if (!value) return
    if (value === CUSTOM) {
      onChange([...resources, { id: newId(), name: '', max: 1, used: 0, recharge: 'long' }])
      return
    }
    const f = featureById(value)
    if (f) onChange([...resources, resourceFromFeature(f, ctx)])
  }

  /** Hand-editing the numbers of an official feature stops it following level-ups. */
  const patch = (id: string, p: Partial<Resource>) =>
    onChange(
      resources.map((r) => {
        if (r.id !== id) return r
        const edited = 'max' in p || 'recharge' in p
        const next = { ...r, ...p, auto: edited ? false : r.auto }
        return { ...next, used: Math.min(next.max, next.used) }
      }),
    )

  const reset = (r: Resource) => {
    const f = featureById(r.featureId)
    if (f) onChange(resources.map((x) => (x.id === r.id ? { ...resourceFromFeature(f, ctx), id: r.id, name: r.name, used: Math.min(r.used, f.uses(ctx)) } : x)))
  }

  return (
    <Section
      title={t('res.title')}
      action={
        <Combobox
          className="add-feature"
          placeholder={owner.classIndex ? t('res.addPlaceholder') : t('res.pickClass')}
          options={options}
          onChange={add}
        />
      }
    >
      {resources.length === 0 && (
        <p className="muted empty-note">
          {owner.classIndex ? t('res.emptyClass') : t('res.emptyNoClass')}
        </p>
      )}
      {resources.map((r) => {
        const official = featureById(r.featureId)
        return (
          <div className="item-card" key={r.id}>
            <div className="item-top">
              <label className="field grow">
                <span>
                  {t('common.name')} {official && <span className="tag">SRD</span>}
                </span>
                <input value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} placeholder="Second Wind" />
              </label>
              <NumberField label={t('res.uses')} value={r.max} min={1} onChange={(n) => patch(r.id, { max: Math.max(1, Math.floor(n)) })} />
              <label className="field">
                <span>{t('res.recharges')}</span>
                <select value={r.recharge} onChange={(e) => patch(r.id, { recharge: e.target.value as Recharge })}>
                  {(Object.keys(RECHARGE_LABEL) as Recharge[]).map((k) => (
                    <option key={k} value={k}>
                      {t(RECHARGE_LABEL[k])}
                    </option>
                  ))}
                </select>
              </label>
              {official && !r.auto && (
                <button title={t('res.officialTitle')} onClick={() => reset(r)}>
                  {t('res.official')}
                </button>
              )}
              <button className="danger icon-btn" title={t('common.remove')} onClick={() => onChange(resources.filter((x) => x.id !== r.id))}>
                ✕
              </button>
            </div>
            {official?.note && <p className="muted note-line">{official.note}</p>}
          </div>
        )
      })}
    </Section>
  )
}
