import { Combobox, type ComboOption } from './Combobox'
import { NumberField } from './NumberField'
import { Section } from './Section'
import { featureById, featuresFor, resourceFromFeature, type FeatureCtx } from '../data/classFeatures'
import type { AbilityScores, ClassIndex, Recharge, Resource } from '../types'

interface Props {
  resources: Resource[]
  onChange: (resources: Resource[]) => void
  /** The character, so the official list can be filtered to their class/level and counts worked out */
  owner: { classIndex?: ClassIndex; level: number; abilities: AbilityScores; table?: Record<string, unknown> }
}

const RECHARGE_LABEL: Record<Recharge, string> = {
  short: 'Short or long rest (all uses)',
  'short-one': 'Short rest: 1 use, long rest: all',
  long: 'Long rest only',
}
const RECHARGE_SHORT: Record<Recharge, string> = { short: 'short rest', 'short-one': '1/short rest', long: 'long rest' }

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
        return { value: f.id, label: f.name, group: f.subclass ?? 'Class features', hint: `${f.uses(ctx)} · ${RECHARGE_SHORT[rc]}` }
      }),
    { value: CUSTOM, label: 'Custom feature (type your own)', group: 'Manual' },
  ]

  const add = (value: string | undefined) => {
    if (!value) return
    if (value === CUSTOM) {
      onChange([...resources, { id: crypto.randomUUID(), name: '', max: 1, used: 0, recharge: 'long' }])
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
      title="Class features & limited uses"
      action={
        <Combobox
          className="add-feature"
          placeholder={owner.classIndex ? 'Add a feature…' : 'Pick a class to see its features…'}
          options={options}
          onChange={add}
        />
      }
    >
      {resources.length === 0 && (
        <p className="muted empty-note">
          {owner.classIndex
            ? 'Add limited-use features like Second Wind or Rage from the official list, or create your own. Rests recharge them.'
            : 'Choose a class above to get its official feature list, or add a custom feature.'}
        </p>
      )}
      {resources.map((r) => {
        const official = featureById(r.featureId)
        return (
          <div className="item-card" key={r.id}>
            <div className="item-top">
              <label className="field grow">
                <span>
                  Name {official && <span className="tag">SRD</span>}
                </span>
                <input value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} placeholder="Second Wind" />
              </label>
              <NumberField label="Uses" value={r.max} min={1} onChange={(n) => patch(r.id, { max: Math.max(1, Math.floor(n)) })} />
              <label className="field">
                <span>Recharges</span>
                <select value={r.recharge} onChange={(e) => patch(r.id, { recharge: e.target.value as Recharge })}>
                  {(Object.keys(RECHARGE_LABEL) as Recharge[]).map((k) => (
                    <option key={k} value={k}>
                      {RECHARGE_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              {official && !r.auto && (
                <button title="Go back to the official count and recharge, and follow level-ups again" onClick={() => reset(r)}>
                  ↺ Official
                </button>
              )}
              <button className="danger icon-btn" title="Remove" onClick={() => onChange(resources.filter((x) => x.id !== r.id))}>
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
