import type { Ability, Action, Combatant } from '../types'
import { t } from './i18n'

/** The two Unarmed Strike options of the 2024 rules that make the target save instead of the attacker rolling (the target chooses Strength or Dexterity). */
export function unarmedActions(c: Combatant): Action[] {
  if (c.unarmedDc === undefined) return []
  const base: Omit<Action, 'id' | 'name'> = { kind: 'save', saveAbility: 'str', saveChoice: ['str', 'dex'] as Ability[], saveDc: c.unarmedDc, timing: 'action' }
  return [
    { ...base, id: 'unarmed-grapple', name: t('unarmed.grapple'), condition: 'Grappled', desc: t('unarmed.grappleDesc') },
    { ...base, id: 'unarmed-shove', name: t('unarmed.shove'), condition: 'Prone', desc: t('unarmed.shoveDesc') },
  ]
}
