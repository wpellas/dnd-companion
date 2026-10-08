import os from 'node:os'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Plugin } from 'vite'
import { WebSocketServer, type WebSocket } from 'ws'

/**
 * A tiny relay that lets other devices on the same Wi-Fi watch the fight live.
 *
 * - The DM's browser connects as the `host` (`/hub?role=host`) and pushes the player-safe combat state and the
 *   portraits whenever they change.
 * - Phones, tablets and TVs open `/#player`, connect as `viewer`s and receive the latest state immediately, then every update.
 *
 * It keeps only the most recent state in memory (nothing is written to disk) and never sees monster HP or AC: the host
 * already strips that before sending. It runs inside the Vite dev server and the preview server, so there is nothing
 * extra to start. There is no login: anyone on the same network who opens the address can watch.
 */
type Role = 'host' | 'viewer'
const PATH = '/hub'

const lanAddresses = () =>
  Object.values(os.networkInterfaces())
    .flatMap((list) => list ?? [])
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)

function attach(httpServer: Server | null) {
  if (!httpServer) return
  const wss = new WebSocketServer({ noServer: true })
  const clients = new Map<WebSocket, Role>()
  // latest payload per message type, replayed to anyone who connects later
  const latest = new Map<string, string>()

  const ofRole = (role: Role) => [...clients].filter(([, r]) => r === role).map(([ws]) => ws)
  const send = (ws: WebSocket, msg: unknown) => ws.readyState === ws.OPEN && ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg))
  const tellHosts = () => {
    const port = (httpServer.address() as AddressInfo | null)?.port
    const urls = port ? lanAddresses().map((ip) => `http://${ip}:${port}/#player`) : []
    for (const h of ofRole('host')) send(h, { type: 'info', urls, viewers: ofRole('viewer').length })
  }
  const tellViewers = () => {
    for (const v of ofRole('viewer')) send(v, { type: 'host', connected: ofRole('host').length > 0 })
  }

  httpServer.on('upgrade', (req, socket, head) => {
    // only our path: Vite's own hot-reload socket must keep working
    if (!req.url?.startsWith(PATH)) return
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  })

  wss.on('connection', (ws, req) => {
    const role: Role = new URL(req.url ?? PATH, 'http://hub').searchParams.get('role') === 'host' ? 'host' : 'viewer'
    clients.set(ws, role)
    if (role === 'viewer') {
      for (const payload of latest.values()) send(ws, payload)
      send(ws, { type: 'host', connected: ofRole('host').length > 0 })
    }
    tellHosts()
    tellViewers()

    ws.on('message', (raw) => {
      if (role !== 'host') return
      let msg: { type?: string }
      try {
        msg = JSON.parse(String(raw))
      } catch {
        return
      }
      if (msg.type !== 'combat' && msg.type !== 'portraits') return
      const payload = String(raw)
      latest.set(msg.type, payload)
      for (const v of ofRole('viewer')) send(v, payload)
    })
    ws.on('close', () => {
      clients.delete(ws)
      tellHosts()
      tellViewers()
    })
  })
}

export function hubPlugin(): Plugin {
  return {
    name: 'dnd-companion-hub',
    configureServer: (server) => attach(server.httpServer as Server | null),
    configurePreviewServer: (server) => attach(server.httpServer as Server | null),
  }
}
