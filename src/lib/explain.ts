import type { Condition } from '../types'
import { modsLine, presetFor } from './effects'
import { t, tCondition } from './i18n'

/**
 * Plain-language help for the player screen: what a condition or effect badge means, and the terms themselves. Generic rules only (nothing about a
 * particular monster), so it is safe for the table to see. The condition texts are the same ones the DM gets as reminders.
 */
const DICE_TERMS = /Advantage|Disadvantage|fördel|nackdel/i

const withTerms = (text: string) => (DICE_TERMS.test(text) ? `${text} ${t('gloss.diceHint')}` : text)

export const explainCondition = (c: Condition) => withTerms(`${tCondition(c)}: ${t(`remind.${c}`)}`)

export function explainEffect(name: string) {
  const preset = presetFor(name)
  const body = preset ? modsLine(preset.mods) || preset.condition && t(`remind.${preset.condition}`) : ''
  return withTerms(`${name}: ${body || t('gloss.effectUnknown')}`)
}

/** The first clause of a condition's text: what to remember about it in one breath ("Disadvantage on attack rolls and ability checks"). */
export const shortCondition = (c: Condition) => t(`remind.${c}`).split(/[;.]/)[0]

export const GLOSSARY = ['advantage', 'disadvantage', 'resistance', 'vulnerability', 'immunity', 'concentration', 'tempHp', 'deathSaves', 'inspiration', 'bloodied'] as const
