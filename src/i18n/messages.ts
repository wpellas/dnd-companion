import { account } from './account'
import { avatars } from './avatars'
import { admin } from './admin'
import { bestiary } from './bestiary'
import { combatui } from './combatui'
import { editors } from './editors'
import { effects } from './effects'
import { hazard } from './hazard'
import { time } from './time'
import { npc } from './npc'
import { ammo } from './ammo'
import { spellfind } from './spellfind'
import { checks } from './checks'
import { unarmed } from './unarmed'
import { maps } from './maps'
import { glossary } from './glossary'
import { movement } from './movement'
import { journal } from './journal'
import { levelup } from './levelup'
import { loot } from './loot'
import { log } from './log'
import { party } from './party'
import { player } from './player'
import { resolve } from './resolve'
import { rest } from './rest'
import { rolls } from './rolls'
import { rules } from './rules'
import { shell } from './shell'
import { turn } from './turn'
import { spells } from './spells'
import { ui } from './ui'
import { vocab } from './vocab'

/** Every message of the app in every language, keyed by name. Each module holds one area of the UI. */
export const MESSAGES = {
  ...vocab,
  ...account,
  ...avatars,
  ...admin,
  ...shell,
  ...bestiary,
  ...combatui,
  ...editors,
  ...effects,
  ...hazard,
  ...time,
  ...npc,
  ...ammo,
  ...spellfind,
  ...checks,
  ...unarmed,
  ...maps,
  ...glossary,
  ...movement,
  ...journal,
  ...levelup,
  ...loot,
  ...log,
  ...party,
  ...player,
  ...resolve,
  ...rest,
  ...rolls,
  ...rules,
  ...spells,
  ...turn,
  ...ui,
}

export type MessageKey = keyof typeof MESSAGES
