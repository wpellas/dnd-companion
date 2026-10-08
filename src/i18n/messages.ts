import { bestiary } from './bestiary'
import { combatui } from './combatui'
import { editors } from './editors'
import { journal } from './journal'
import { loot } from './loot'
import { log } from './log'
import { party } from './party'
import { player } from './player'
import { resolve } from './resolve'
import { rest } from './rest'
import { rules } from './rules'
import { shell } from './shell'
import { turn } from './turn'
import { spells } from './spells'
import { ui } from './ui'
import { vocab } from './vocab'

/** Every message of the app in every language, keyed by name. Each module holds one area of the UI. */
export const MESSAGES = {
  ...vocab,
  ...shell,
  ...bestiary,
  ...combatui,
  ...editors,
  ...journal,
  ...loot,
  ...log,
  ...party,
  ...player,
  ...resolve,
  ...rest,
  ...rules,
  ...spells,
  ...turn,
  ...ui,
}

export type MessageKey = keyof typeof MESSAGES
