import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { usePromise } from '../hooks'
import { api } from '../lib/api'
import { t } from '../lib/i18n'
import { importLegacy, legacyCharacterCount } from '../lib/legacy'
import { chooseCampaign, logout, useSession } from '../lib/session'
import { useSyncStatus } from '../lib/sync'
import { Section } from './Section'
import { SignInDetails } from './SignInDetails'

interface Detail {
  members: { id: number; name: string; role: 'dm' | 'player' }[]
}
interface Invite {
  code: string
  max_uses: number
  expires_at: string
}

/** Who you are, the open campaign and who is at its table, invite codes, sync status, and moving this browser's pre-account data into the campaign. */
export function AccountSection() {
  const { user, campaign } = useSession()
  const sync = useSyncStatus()
  const [invite, setInvite] = useState<Invite>()
  const [imported, setImported] = useState<number>()
  const detail = usePromise(() => (campaign ? api.get<Detail>(`/campaigns/${campaign.id}`) : Promise.resolve(undefined)), [campaign?.id])
  const legacy = useLiveQuery(legacyCharacterCount, [])
  const here = useLiveQuery(() => db.characters.count(), [])
  if (!user || !campaign) return null

  const makeInvite = async () => setInvite(await api.post<Invite>(`/campaigns/${campaign.id}/invites`, {}))

  return (
    <Section title={t('acct.title')}>
      <p>{t('camp.signedIn', { name: user.name })}</p>
      <p className="muted note-line">
        {t('acct.campaign', { name: campaign.name, role: t(campaign.role === 'dm' ? 'camp.dm' : 'camp.player') })}
        {detail.data && ` · ${t('acct.members', { names: detail.data.members.map((m) => m.name).join(', ') })}`}
      </p>
      <p className={sync.state === 'offline' ? 'warn' : 'muted'}>
        {sync.state === 'offline' ? t('acct.syncOffline', { n: sync.pending }) : sync.state === 'syncing' && sync.pending > 0 ? t('acct.syncing') : t('acct.syncOk')}
      </p>
      <div className="row gap wrap">
        {campaign.role === 'dm' && <button onClick={() => void makeInvite()}>{t('acct.invite')}</button>}
        <button onClick={() => void chooseCampaign(undefined)}>{t('camp.switch')}</button>
        {user.is_admin && <button onClick={() => (location.hash = '#admin')}>{t('admin.link')}</button>}
        <button onClick={() => void logout()}>{t('camp.logout')}</button>
      </div>
      <SignInDetails />
      {invite && <p className="adv-text">{t('acct.inviteMade', { code: invite.code, n: invite.max_uses, date: new Date(invite.expires_at).toLocaleDateString() })}</p>}
      {campaign.role === 'dm' && !!legacy && here === 0 && imported === undefined && (
        <div className="import-box">
          <strong>{t('acct.importTitle')}</strong>
          <p className="muted note-line">{t('acct.importBody', { n: legacy })}</p>
          <button className="primary" onClick={async () => setImported(await importLegacy())}>
            {t('acct.importGo')}
          </button>
        </div>
      )}
      {imported !== undefined && <p className="adv-text">{t('acct.importDone', { n: imported })}</p>}
    </Section>
  )
}
