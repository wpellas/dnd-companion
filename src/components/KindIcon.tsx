import { Dices, Shield, Skull, Swords, Zap } from 'lucide-react'
import type { RollKind } from '../lib/rolls'

/** The small icon in front of a kind of roll a player can send. */
export const RollKindIcon = ({ kind }: { kind: RollKind }) => ({ initiative: <Zap />, attack: <Swords />, save: <Shield />, death: <Skull />, check: <Dices /> })[kind]
