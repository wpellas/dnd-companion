import { CheckField, Section } from './Section'
import { NumberField } from './NumberField'
import { newId } from '../lib/id'
import { deriveAction, proficiencyBonus } from '../lib/character'
import { formatMod } from '../lib/dice'
import {
  ABILITIES,
  CONDITIONS,
  DAMAGE_TYPES,
  type Ability,
  type AbilityScores,
  type Action,
  type ActionKind,
  type Condition,
} from '../types'

interface Props {
  actions: Action[]
  onChange: (actions: Action[]) => void
  /**
   * Pass for characters: lets actions be derived from their stats (ability + proficiency) instead of typed flat.
   * Omit for monsters, whose stat blocks list the final numbers.
   */
  owner?: { level: number; abilities: AbilityScores }
}

const KIND_LABEL: Record<ActionKind, string> = {
  attack: 'Attack roll',
  save: 'Saving throw',
  heal: 'Healing',
  other: 'Other (rules note)',
}

const newAction = (): Action => ({
  id: newId(),
  name: '',
  kind: 'attack',
  attackBonus: 0,
  damage: '1d6',
  damageType: 'slashing',
})

const abilityOptions = ABILITIES.map((ab) => (
  <option key={ab} value={ab}>
    {ab.toUpperCase()}
  </option>
))

export function ActionsEditor({ actions, onChange, owner }: Props) {
  const patch = (id: string, p: Partial<Action>) => onChange(actions.map((a) => (a.id === id ? { ...a, ...p } : a)))

  /** Switch an action between "from character stats" and flat numbers, keeping the current numbers when going flat. */
  const setDerived = (a: Action, on: boolean) => {
    if (on) {
      patch(a.id, {
        ability: a.kind === 'attack' ? 'str' : 'wis',
        proficient: a.kind === 'attack',
        magicBonus: 0,
        damage: a.damage?.replace(/\s/g, '').replace(/[+-]\d+$/, ''), // dice only; the modifier is added for you
      })
    } else if (owner) {
      const flat = deriveAction(a, owner)
      patch(a.id, {
        ability: undefined,
        proficient: undefined,
        magicBonus: undefined,
        attackBonus: flat.attackBonus,
        saveDc: flat.saveDc,
        damage: flat.damage,
      })
    }
  }

  return (
    <Section title="Actions" action={<button onClick={() => onChange([...actions, newAction()])}>+ Add action</button>}>
      {actions.length === 0 && <p className="muted empty-note">No actions yet. Add attacks, save effects or healing.</p>}
      {actions.map((a) => {
        const derived = owner && a.ability ? deriveAction(a, owner) : null
        return (
          <div className="item-card" key={a.id}>
            <div className="item-top">
              <label className="field grow">
                <span>Name</span>
                <input value={a.name} onChange={(e) => patch(a.id, { name: e.target.value })} placeholder="Longsword" />
              </label>
              <label className="field">
                <span>Type</span>
                <select value={a.kind} onChange={(e) => patch(a.id, { kind: e.target.value as ActionKind })}>
                  {Object.entries(KIND_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {owner && (
                <CheckField
                  label="From my stats"
                  title="Work out the numbers from this character's ability scores and proficiency"
                  checked={!!a.ability}
                  onChange={(on) => setDerived(a, on)}
                />
              )}
              <button className="danger icon-btn" title="Remove action" onClick={() => onChange(actions.filter((x) => x.id !== a.id))}>
                ✕
              </button>
            </div>

            <div className="field-grid">
              {a.ability ? (
                <>
                  <label className="field">
                    <span>{a.kind === 'attack' ? 'Attack ability' : 'Spell ability'}</span>
                    <select value={a.ability} onChange={(e) => patch(a.id, { ability: e.target.value as Ability })}>
                      {abilityOptions}
                    </select>
                  </label>
                  {a.kind === 'attack' && (
                    <>
                      <CheckField label="Proficient" checked={a.proficient ?? false} onChange={(v) => patch(a.id, { proficient: v })} />
                      <NumberField label="Magic bonus" value={a.magicBonus ?? 0} onChange={(n) => patch(a.id, { magicBonus: n })} />
                    </>
                  )}
                </>
              ) : (
                <>
                  {a.kind === 'attack' && (
                    <NumberField label="Attack bonus" value={a.attackBonus ?? 0} onChange={(n) => patch(a.id, { attackBonus: n })} />
                  )}
                  {a.kind === 'save' && <NumberField label="Save DC" value={a.saveDc ?? 10} onChange={(n) => patch(a.id, { saveDc: n })} />}
                </>
              )}

              {a.kind === 'save' && (
                <>
                  <label className="field">
                    <span>Target saves with</span>
                    <select value={a.saveAbility ?? 'dex'} onChange={(e) => patch(a.id, { saveAbility: e.target.value as Ability })}>
                      {abilityOptions}
                    </select>
                  </label>
                  <CheckField label="Half on save" checked={a.halfOnSave ?? false} onChange={(v) => patch(a.id, { halfOnSave: v })} />
                </>
              )}

              {a.kind !== 'other' && (
              <label className="field">
                <span>{a.kind === 'heal' ? 'Healing' : 'Damage'}</span>
                <input
                  value={a.damage ?? ''}
                  onChange={(e) => patch(a.id, { damage: e.target.value })}
                  onBlur={(e) => {
                    // Accept sheet-style "2d6 + 2 slashing": move a trailing damage type into the dropdown.
                    const m = e.target.value.trim().match(/^(.*\d)\s*([a-z]+)$/i)
                    const type = m?.[2].toLowerCase()
                    if (m && type && a.kind !== 'heal' && (DAMAGE_TYPES as readonly string[]).includes(type)) {
                      patch(a.id, { damage: m[1].trim(), damageType: type })
                    }
                  }}
                  placeholder={a.ability ? '2d6 (modifier added)' : '2d6+2 slashing'}
                />
              </label>
              )}

              {a.kind !== 'heal' && a.kind !== 'other' && (
                <>
                  <label className="field">
                    <span>Damage type</span>
                    <select value={a.damageType ?? ''} onChange={(e) => patch(a.id, { damageType: e.target.value })}>
                      <option value="">-</option>
                      {/* keep any older free-text value selectable so it isn't silently lost */}
                      {a.damageType && !(DAMAGE_TYPES as readonly string[]).includes(a.damageType) && (
                        <option value={a.damageType}>{a.damageType}</option>
                      )}
                      {DAMAGE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Applies condition</span>
                    <select
                      value={a.condition ?? ''}
                      onChange={(e) => patch(a.id, { condition: (e.target.value || undefined) as Condition | undefined })}
                    >
                      <option value="">None</option>
                      {CONDITIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>

            {(a.kind === 'attack' || a.kind === 'save') && (
              <div className="extra-damage">
                {(a.extraDamage ?? []).map((p, i) => (
                  <div className="extra-part" key={i}>
                    <label className="field">
                      <span>Extra damage</span>
                      <input
                        value={p.dice}
                        placeholder="2d4"
                        onChange={(e) => patch(a.id, { extraDamage: (a.extraDamage ?? []).map((x, j) => (j === i ? { ...x, dice: e.target.value } : x)) })}
                      />
                    </label>
                    <label className="field">
                      <span>Type</span>
                      <select
                        value={p.type}
                        onChange={(e) => patch(a.id, { extraDamage: (a.extraDamage ?? []).map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })}
                      >
                        <option value="">-</option>
                        {DAMAGE_TYPES.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field grow">
                      <span>Only if (optional)</span>
                      <input
                        value={p.note ?? ''}
                        placeholder="e.g. the attack roll had Advantage"
                        onChange={(e) => patch(a.id, { extraDamage: (a.extraDamage ?? []).map((x, j) => (j === i ? { ...x, note: e.target.value || undefined } : x)) })}
                      />
                    </label>
                    <button className="danger icon-btn" title="Remove" onClick={() => patch(a.id, { extraDamage: (a.extraDamage ?? []).filter((_, j) => j !== i) })}>
                      ✕
                    </button>
                  </div>
                ))}
                <button className="link-btn" onClick={() => patch(a.id, { extraDamage: [...(a.extraDamage ?? []), { dice: '1d6', type: 'fire' }] })}>
                  + Extra damage type
                </button>
              </div>
            )}

            <label className="field">
              <span>{a.kind === 'other' ? 'Description' : 'Notes (optional)'}</span>
              <textarea
                rows={a.kind === 'other' ? 3 : 1}
                value={a.desc ?? ''}
                placeholder={a.kind === 'other' ? 'What it does, as written in the stat block' : 'Rider effects or reminders shown on the turn panel'}
                onChange={(e) => patch(a.id, { desc: e.target.value || undefined })}
              />
            </label>

            {derived && owner && (
              <div className="derived">
                {a.kind === 'attack' && <>To hit <strong>{formatMod(derived.attackBonus ?? 0)}</strong> · </>}
                {a.kind === 'save' && <>Save DC <strong>{derived.saveDc}</strong> · </>}
                {derived.damage && <>{a.kind === 'heal' ? 'Heals' : 'Damage'} <strong>{derived.damage}</strong></>}
                <span className="muted"> (proficiency {formatMod(proficiencyBonus(owner.level))} at level {owner.level})</span>
              </div>
            )}
          </div>
        )
      })}
    </Section>
  )
}
