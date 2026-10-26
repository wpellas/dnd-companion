import { useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { api } from './api'

/**
 * Background music from the shared library on the server (`MusicController`, table `tracks`): every signed-in account sees every uploaded track and uses it in
 * its own scenes. The audio is streamed from `/api/music/<id>/stream`; nothing is stored in the browser. Scenes (a name + track ids) are a small campaign record,
 * kv `music`, so they follow the DM between devices. The player lives here, outside React, so it keeps playing when the tab or the language changes (`Root`
 * re-creates the whole tree). Music only ever plays on the DM's device; nothing is sent to the players.
 */

export interface Scene {
  id: string
  name: string
  /** Track ids in the shared library (older scenes may still hold folder paths from the first version; `sceneTracks` ignores those) */
  tracks: number[]
  shuffle?: boolean
}
export interface MusicSettings {
  scenes: Scene[]
  /** Starts by itself when a fight starts, and the music from before comes back when it ends. A single track (combatTrackId) or a scene (combatSceneId): setting one clears the other */
  combatSceneId?: string
  combatTrackId?: number
}
export interface TrackInfo {
  id: number
  name: string
  size: number
  /** Account name of whoever uploaded it */
  uploader: string | null
  /** The uploader or an administrator may rename and delete it */
  can_edit: boolean
}

const KEY = 'music'
const VOLUME_KEY = 'dnd-companion:music-volume'
const FADE_MS = 1500
const EMPTY: MusicSettings = { scenes: [] }

const readMusic = async () => ((await db.kv.get(KEY))?.value as MusicSettings | undefined) ?? EMPTY
export const useMusicSettings = (): MusicSettings => useLiveQuery(readMusic, []) ?? EMPTY
export const saveMusicSettings = (m: MusicSettings) => db.kv.put({ key: KEY, value: m })
export const sceneTracks = (s: Scene) => s.tracks.filter((t): t is number => typeof t === 'number')

/* ---------------------------------------------------------------- state (for the UI) */

export interface MusicState {
  library: 'loading' | 'ready' | 'error'
  tracks: TrackInfo[]
  sceneId?: string
  track?: number
  playing: boolean
  /** Why nothing is playing: the library could not be loaded, no playable track in the scene, or the browser wants a click first */
  error?: 'library' | 'empty' | 'blocked'
  volume: number
}

function readVolume() {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY))
    return v > 0 && v <= 1 ? v : 0.6
  } catch {
    return 0.6
  }
}

let state: MusicState = { library: 'loading', tracks: [], playing: false, volume: readVolume() }
const listeners = new Set<() => void>()
const set = (patch: Partial<MusicState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
export const useMusic = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => state,
  )

/* ---------------------------------------------------------------- the library */

/** Fetch the shared track list (also after every upload, rename and delete, and when a library error needs another try). */
export async function loadLibrary() {
  try {
    const { tracks } = await api.get<{ tracks: TrackInfo[] }>('/music')
    set({ library: 'ready', tracks, error: state.error === 'library' ? undefined : state.error })
  } catch {
    if (state.library !== 'ready') set({ library: 'error' })
  }
}

export async function uploadTrack(file: File) {
  const form = new FormData()
  form.append('file', file)
  await api.post('/music', form)
}
export const renameTrack = async (id: number, name: string) => {
  await api.patch(`/music/${id}`, { name })
  await loadLibrary()
}
export const deleteTrack = async (id: number) => {
  await api.delete(`/music/${id}`)
  await loadLibrary()
}

/* ---------------------------------------------------------------- the player */

// Two audio elements so one track can fade out while the next fades in.
const audios: HTMLAudioElement[] = []
let active = 0
let ramp: number | undefined
let queue: number[] = []
let qi = 0
/** Bumped by every new request, so a slow start of an older request never takes over */
let seq = 0

function audio(i: number) {
  if (!audios[i]) {
    const a = new Audio()
    a.addEventListener('ended', () => {
      if (audios[active] === a) void advance()
    })
    audios[i] = a
  }
  return audios[i]
}

function crossfade(from: HTMLAudioElement, to: HTMLAudioElement) {
  const t0 = performance.now()
  const v0 = from.paused ? 0 : from.volume
  ramp = window.setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / FADE_MS)
    to.volume = state.volume * k
    from.volume = v0 * (1 - k)
    if (k === 1) {
      clearInterval(ramp)
      from.pause()
    }
  }, 50)
}

type Result = 'ok' | 'missing' | 'blocked' | 'stale'

async function playTrackId(id: number): Promise<Result> {
  const my = ++seq
  clearInterval(ramp)
  const prevI = active
  const nextI = 1 - active
  const prev = audio(prevI)
  const next = audio(nextI)
  next.src = `/api/music/${id}/stream`
  next.loop = queue.length === 1
  next.volume = 0
  try {
    await next.play()
  } catch (e) {
    if (my !== seq) return 'stale'
    // a deleted track, or a session that ran out, cannot be loaded: skip it
    if ((e as DOMException).name !== 'NotAllowedError') return 'missing'
    // the browser blocks sound until the page has had a click: keep the track ready, the play button starts it
    active = nextI
    prev.pause()
    next.volume = state.volume
    set({ track: id, playing: false, error: 'blocked' })
    return 'blocked'
  }
  if (my !== seq) return 'stale'
  active = nextI
  crossfade(prev, next)
  set({ track: id, playing: true, error: undefined })
  return 'ok'
}

/** Play from queue position `i`; a track that cannot be played is skipped. */
async function startAt(i: number) {
  for (let k = 0; k < queue.length; k++) {
    const idx = (i + k) % queue.length
    const r = await playTrackId(queue[idx])
    if (r === 'ok') {
      qi = idx
      return
    }
    if (r !== 'missing') return
  }
  set({ playing: false, error: 'empty' })
}

async function advance() {
  if (!queue.length) return
  qi = (qi + 1) % queue.length
  await startAt(qi)
}
export const nextTrack = advance

const shuffled = <T,>(list: T[]) => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function playScene(sceneId: string, scenes: Scene[]) {
  const scene = scenes.find((s) => s.id === sceneId)
  if (!scene) return
  if (state.library !== 'ready') await loadLibrary()
  if (state.library !== 'ready') {
    set({ sceneId, error: 'library' })
    return
  }
  const known = new Set(state.tracks.map((t) => t.id))
  const tracks = sceneTracks(scene).filter((id) => known.has(id))
  if (!tracks.length) {
    seq++
    set({ sceneId, track: undefined, playing: false, error: 'empty' })
    return
  }
  queue = scene.shuffle ? shuffled(tracks) : tracks
  qi = 0
  set({ sceneId })
  await startAt(0)
}

/** One track on its own (the preview button in the library). */
export async function playTrack(id: number) {
  queue = [id]
  qi = 0
  set({ sceneId: undefined })
  await startAt(0)
}

export async function togglePause() {
  const a = audios[active]
  if (!a?.src) return
  if (a.paused) {
    try {
      await a.play()
      a.volume = state.volume
      set({ playing: true, error: undefined })
    } catch {
      set({ error: 'blocked' })
    }
  } else {
    a.pause()
    set({ playing: false })
  }
}

/** Fade the music out and forget the scene. */
export function stopMusic() {
  seq++
  clearInterval(ramp)
  queue = []
  audios.forEach((x, i) => i !== active && x.pause())
  const a = audios[active]
  set({ sceneId: undefined, track: undefined, playing: false, error: undefined })
  if (!a) return
  const t0 = performance.now()
  const v0 = a.volume
  ramp = window.setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / FADE_MS)
    a.volume = v0 * (1 - k)
    if (k === 1) {
      clearInterval(ramp)
      a.pause()
    }
  }, 50)
}

export function setVolume(v: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(v))
  } catch {
    // not saved: back to the default next time
  }
  set({ volume: v })
  if (audios[active]) audios[active].volume = v
}

/* ---------------------------------------------------------------- combat */

/** What played before the fight: a scene, a single track, or nothing (then the music just fades out when the fight ends). */
let before: { sceneId?: string; trackId?: number } | null = null

/** A scene or a single track as one picker value ("scene:<id>" / "track:<id>"), played right away. */
export async function playPick(value: string, scenes: Scene[]) {
  const [kind, id] = [value.slice(0, value.indexOf(':')), value.slice(value.indexOf(':') + 1)]
  if (kind === 'scene') await playScene(id, scenes)
  else if (kind === 'track') await playTrack(Number(id))
}

/** Choose the combat music from a picker value (or none): it is what Start combat plays. Nothing plays now. */
export async function prepareCombatMusic(pick: string | undefined) {
  const [kind, id] = pick ? [pick.slice(0, pick.indexOf(':')), pick.slice(pick.indexOf(':') + 1)] : []
  await saveMusicSettings({ ...(await readMusic()), combatSceneId: kind === 'scene' ? id : undefined, combatTrackId: kind === 'track' ? Number(id) : undefined })
}

/** The scene or track chosen for the fight, as a picker value. */
export const combatPick = (m: MusicSettings) => (m.combatTrackId !== undefined ? `track:${m.combatTrackId}` : m.combatSceneId ? `scene:${m.combatSceneId}` : undefined)

/**
 * Start the chosen combat music: it takes over from whatever is playing, or starts if nothing is. Call it first in the click that starts the fight
 * (a click is what lets the browser play sound).
 */
export async function startCombatMusic() {
  const m = await readMusic()
  const pick = combatPick(m)
  if (!pick) return
  const alreadyOn = pick.startsWith('scene:') ? state.sceneId === m.combatSceneId : state.sceneId === undefined && state.track === m.combatTrackId
  if (alreadyOn && state.playing) return
  before = { sceneId: state.sceneId, trackId: state.sceneId === undefined && state.playing ? state.track : undefined }
  await playPick(pick, m.scenes)
}

/** Back to what played before the fight (or silence, if nothing did). */
export async function endCombatMusic() {
  if (!before) return
  const { sceneId, trackId } = before
  before = null
  if (sceneId) await playScene(sceneId, (await readMusic()).scenes)
  else if (trackId !== undefined) await playTrack(trackId)
  else stopMusic()
}
