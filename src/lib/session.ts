import { useSyncExternalStore } from 'react'
import { closeCampaignDb, openCampaignDb } from '../db'
import { api } from './api'
import { resetSyncStatus, startSync, stopSync } from './sync'

/** Who is signed in and which campaign is open. Opening a campaign points `db` at its local copy and starts syncing it. */

export interface User {
  id: number
  name: string
  email: string
  is_admin: boolean
}
export interface CampaignRef {
  id: number
  name: string
  role: 'dm' | 'player'
}
export interface Session {
  status: 'loading' | 'anon' | 'user'
  user?: User
  campaigns: CampaignRef[]
  campaign?: CampaignRef
}

const CAMPAIGN_KEY = 'dnd-companion:campaign'
/** The signed-in user and campaign, remembered so the DM's second window (`#player`, which never signs in) can open the same local copy. */
const WHO_KEY = 'dnd-companion:who'

let state: Session = { status: 'loading', campaigns: [] }
const listeners = new Set<() => void>()
const set = (next: Partial<Session>) => {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}
export const useSession = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* private mode: the choice is just not remembered */
  }
}

/** The local copy of the campaign this browser used last, for windows that do not sign in. Returns whether there was one. */
export function openRememberedCampaign(): boolean {
  try {
    const who = JSON.parse(read(WHO_KEY) ?? 'null') as { user: number; campaign: number } | null
    if (!who) return false
    openCampaignDb(who.user, who.campaign)
    return true
  } catch {
    return false
  }
}

async function open(campaign: CampaignRef | undefined) {
  const user = state.user
  if (!campaign || !user) {
    await stopSync()
    closeCampaignDb()
    write(CAMPAIGN_KEY, null)
    write(WHO_KEY, null)
    set({ campaign: undefined })
    return
  }
  const db = openCampaignDb(user.id, campaign.id) // before anything renders, so the pages read the right database
  resetSyncStatus() // the previous campaign was "ready", this one is not yet
  write(CAMPAIGN_KEY, String(campaign.id))
  write(WHO_KEY, JSON.stringify({ user: user.id, campaign: campaign.id }))
  set({ campaign })
  // signed out elsewhere, or removed from the campaign: ask the server again what is still true
  void startSync(db, campaign.id, user.id, () => void refresh())
}

/** Ask the server who we are; reopens the campaign used last time. */
export async function refresh() {
  try {
    const user = await api.get<User>('/me')
    const campaigns = await api.get<CampaignRef[]>('/campaigns')
    set({ status: 'user', user, campaigns })
    const wanted = Number(read(CAMPAIGN_KEY))
    await open(campaigns.find((c) => c.id === wanted) ?? (campaigns.length === 1 ? campaigns[0] : undefined))
  } catch {
    await open(undefined)
    set({ status: 'anon', user: undefined, campaigns: [] })
  }
}

async function enter(user: User) {
  set({ status: 'user', user })
  await refresh()
}

export const login = async (email: string, password: string) => enter(await api.post<User>('/login', { email, password }))
export const register = async (v: { name: string; email: string; password: string; invite: string }) => enter(await api.post<User>('/register', v))

export async function logout() {
  await stopSync()
  await api.post('/logout').catch(() => undefined)
  await open(undefined)
  set({ status: 'anon', user: undefined, campaigns: [] })
}

export const chooseCampaign = (id: number | undefined) => open(state.campaigns.find((c) => c.id === id))

export async function createCampaign(name: string) {
  const made = await api.post<CampaignRef>('/campaigns', { name })
  set({ campaigns: [...state.campaigns, made] })
  await open(made)
}

export async function joinCampaign(code: string) {
  const joined = await api.post<CampaignRef>('/campaigns/join', { code })
  set({ campaigns: [...state.campaigns.filter((c) => c.id !== joined.id), joined] })
  await open(joined)
}
