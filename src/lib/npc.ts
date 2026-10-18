import { t } from './i18n'

/**
 * Quick NPCs: a name, a species, a trade and three hooks to roleplay with, rolled from small tables. The tables hold message keys (translated when picked,
 * like every other text); names and species are the SRD's and stay as they are. The DM's own random picks: nothing here involves a player's dice.
 */
export interface Npc {
  name: string
  species: string
  job: string
  look: string
  trait: string
  want: string
  voice: string
}

const FIRST = ['Alda', 'Bram', 'Cedric', 'Dara', 'Edda', 'Finn', 'Garrick', 'Hilda', 'Ivo', 'Jora', 'Kellan', 'Lyra', 'Marek', 'Nessa', 'Orin', 'Petra', 'Quill', 'Rowan', 'Sela', 'Tobin', 'Ulla', 'Varek', 'Wren', 'Yara', 'Zeb', 'Mirela', 'Dunstan', 'Pip', 'Thessaly', 'Borin']
const LAST = ['Ashdown', 'Brightwater', 'Copperkettle', 'Dunmere', 'Elmstead', 'Fairweather', 'Greywick', 'Hollowbrook', 'Ironhand', 'Juniper', 'Kettleby', 'Longfield', 'Marsh', 'Nettle', 'Oakshield', 'Penhallow', 'Quickfoot', 'Redmane', 'Stonebridge', 'Thorne', 'Underhill', 'Vale', 'Whitlock', 'Yarrow']
const SPECIES = ['Human', 'Human', 'Human', 'Elf', 'Dwarf', 'Halfling', 'Gnome', 'Orc', 'Tiefling', 'Dragonborn', 'Goliath', 'Aasimar']
const JOBS = ['innkeeper', 'blacksmith', 'guard', 'merchant', 'farmer', 'priest', 'scribe', 'sailor', 'hunter', 'healer', 'beggar', 'noble', 'thief', 'miller', 'fisher', 'baker'] as const
const LOOKS = ['scar', 'tattoo', 'patched', 'tall', 'tiny', 'jewelry', 'ink', 'limp', 'bald', 'braids', 'eyepatch', 'muddy'] as const
const TRAITS = ['friendly', 'suspicious', 'nervous', 'boastful', 'gloomy', 'curious', 'greedy', 'devout', 'lazy', 'brave', 'gossip', 'polite'] as const
const WANTS = ['debt', 'lost', 'revenge', 'fame', 'safe', 'cure', 'secret', 'rich', 'love', 'escape', 'proof', 'peace'] as const
const VOICES = ['whisper', 'loud', 'slow', 'fast', 'rhyme', 'stutter', 'formal', 'hum', 'laugh', 'sigh', 'question', 'accent'] as const

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]

export const NPC_FIELDS = ['name', 'species', 'job', 'look', 'trait', 'want', 'voice'] as const
export type NpcField = (typeof NPC_FIELDS)[number]

/** One field, rolled again. */
export function rollNpcField(field: NpcField): string {
  switch (field) {
    case 'name':
      return `${pick(FIRST)} ${pick(LAST)}`
    case 'species':
      return pick(SPECIES)
    case 'job':
      return t(`npc.job.${pick(JOBS)}`)
    case 'look':
      return t(`npc.look.${pick(LOOKS)}`)
    case 'trait':
      return t(`npc.trait.${pick(TRAITS)}`)
    case 'want':
      return t(`npc.want.${pick(WANTS)}`)
    case 'voice':
      return t(`npc.voice.${pick(VOICES)}`)
  }
}

export const rollNpc = (): Npc => Object.fromEntries(NPC_FIELDS.map((f) => [f, rollNpcField(f)])) as unknown as Npc

/** The journal text of an NPC. */
export const npcBody = (n: Npc) =>
  [t('npc.line.who', { species: n.species, job: n.job }), t('npc.line.look', { v: n.look }), t('npc.line.trait', { v: n.trait }), t('npc.line.want', { v: n.want }), t('npc.line.voice', { v: n.voice })].join('\n')
