import { useEffect, useState } from 'react'
import App from './App.tsx'
import { useHash } from './hooks'
import { useLang } from './lib/i18n'
import { openRememberedCampaign, refresh, useSession } from './lib/session'
import { useSyncStatus } from './lib/sync'
import { AdminPage } from './pages/AdminPage'
import { AuthPage } from './pages/AuthPage'
import { ConfirmEmailPage } from './pages/ConfirmEmailPage'
import { CampaignLoading, CampaignsPage } from './pages/CampaignsPage'
import { PlayerHome } from './pages/PlayerHome'
import { PlayerView } from './pages/PlayerView'

/**
 * Decides what to show: sign-in, the campaign list, or the app itself. Also re-creates the whole UI when the language changes, so every
 * translated string is looked up again. Two routes never ask for a sign-in: `#table/<secret>` (the table's TV, which reads the live view
 * with the secret link) and `#player` (the DM's own second window, which reads the campaign this browser last used).
 */
export default function Root() {
  const lang = useLang()
  const hash = useHash()
  const session = useSession()
  const sync = useSyncStatus()
  const isPlayerView = hash === '#player'
  const confirmToken = hash.startsWith('#confirm-email?') ? new URLSearchParams(hash.slice('#confirm-email?'.length)).get('token') : null
  const table = hash.startsWith('#table/') ? decodeURIComponent(hash.slice('#table/'.length)) : undefined

  // before the first render, so the live view reads the right local database
  useState(() => {
    if (isPlayerView) openRememberedCampaign()
  })
  useEffect(() => {
    if (!isPlayerView && !table) void refresh()
  }, [isPlayerView, table])

  if (confirmToken) return <ConfirmEmailPage key={confirmToken} token={confirmToken} />
  if (table) return <PlayerView key={`${lang}-${table}`} source={{ token: table }} />
  if (isPlayerView) return <App key={lang} />
  if (session.status === 'loading') return <div className="player empty" />
  if (session.status === 'anon') return <AuthPage key={lang} />
  if (hash === '#admin' && session.user?.is_admin) return <AdminPage key={lang} />
  if (!session.campaign) return <CampaignsPage key={lang} />
  if (!sync.ready) return <CampaignLoading key={lang} />
  if (session.campaign.role === 'player') return <PlayerHome key={`${session.campaign.id}-${lang}`} campaign={session.campaign} />
  return <App key={`${session.campaign.id}-${lang}`} />
}
