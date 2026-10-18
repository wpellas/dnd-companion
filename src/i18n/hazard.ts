import type { Msg } from './types'

/** The hazard panel on the Combat page: damage from the environment. */
export const hazard = {
  'haz.title': ['Hazard (fall, fire, trap…)', 'Fara (fall, eld, fälla…)'],
  'haz.kind': ['Kind', 'Slag'],
  'haz.falling': ['Falling', 'Fall'],
  'haz.burning': ['Burning', 'Eld'],
  'haz.custom': ['Custom…', 'Egen…'],
  'haz.feet': ['Feet fallen', 'Fallhöjd (fot)'],
  'haz.noFall': ['Under 10 feet there is no fall damage.', 'Under 10 fot ger inget fallskada.'],
  'haz.name': ['Name', 'Namn'],
  'haz.dice': ['Damage dice', 'Skadetärningar'],
  'haz.type': ['Damage type', 'Skadetyp'],
  'haz.save': ['Saving throw', 'Räddningsslag'],
  'haz.half': ['half on success', 'hälften vid lyckat'],
  'haz.resolve': ['Resolve for the ticked creatures', 'Avgör för de markerade'],
  'haz.apply': ['Apply', 'Verkställ'],
} as const satisfies Record<string, Msg>
