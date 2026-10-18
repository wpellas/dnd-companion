import { usePromise } from '../hooks'
import { api } from './api'
import { useSession } from './session'

export interface Member {
  id: number
  name: string
  role: 'dm' | 'player'
}

/** Who is at the open campaign's table (empty while loading). */
export function useMembers(): Member[] {
  const { campaign } = useSession()
  const loaded = usePromise(() => (campaign ? api.get<{ members: Member[] }>(`/campaigns/${campaign.id}`).then((c) => c.members) : Promise.resolve([] as Member[])), [campaign?.id])
  return loaded.data ?? []
}
