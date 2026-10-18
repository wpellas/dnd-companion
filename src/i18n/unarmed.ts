import type { Msg } from './types'

/** Grapple and Shove from the Unarmed Strike rules. */
export const unarmed = {
  'unarmed.grapple': ['Grapple', 'Grepp'],
  'unarmed.shove': ['Shove', 'Knuff'],
  'unarmed.grappleDesc': [
    'Unarmed Strike: the target must be no more than one size larger and you need a free hand. It saves with Strength or Dexterity (its choice) against DC 8 + your Strength modifier + Proficiency Bonus; on a failure it is Grappled (escape: an Athletics or Acrobatics check against that DC).',
    'Obeväpnad attack: målet får vara högst en storlek större och du behöver en fri hand. Det räddar med Strength eller Dexterity (dess val) mot DC 8 + din Strength-modifierare + färdighetsbonus; vid misslyckande blir det Gripet (att ta sig loss: ett Athletics- eller Acrobatics-slag mot samma DC).',
  ],
  'unarmed.shoveDesc': [
    'Unarmed Strike: the target must be no more than one size larger. It saves with Strength or Dexterity (its choice) against DC 8 + your Strength modifier + Proficiency Bonus; on a failure you either knock it Prone or push it 5 feet away (untick Prone to push).',
    'Obeväpnad attack: målet får vara högst en storlek större. Det räddar med Strength eller Dexterity (dess val) mot DC 8 + din Strength-modifierare + färdighetsbonus; vid misslyckande välter du det (Liggande) eller knuffar det 5 fot bort (avmarkera Liggande för att knuffa).',
  ],
  'save.choiceAbility': ['Saves with', 'Räddar med'],
} as const satisfies Record<string, Msg>
