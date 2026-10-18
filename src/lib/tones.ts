import type { Condition } from '../types'

/**
 * The colour of a condition, on the DM's rows and the players' screen: red = it can't act (Paralyzed, Stunned, Unconscious, Petrified, Incapacitated), orange = hindered
 * (Blinded, Frightened, Poisoned, Prone, Restrained...), blue = Invisible (it is the one that helps). Always shown next to the word, never colour alone.
 */
export type Tone = 'control' | 'impair' | 'cover'

const CONTROL: Condition[] = ['Paralyzed', 'Stunned', 'Unconscious', 'Petrified', 'Incapacitated']

export const conditionTone = (c: Condition): Tone => (CONTROL.includes(c) ? 'control' : c === 'Invisible' ? 'cover' : 'impair')
