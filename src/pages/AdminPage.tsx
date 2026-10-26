import { useEffect, useState } from 'react'
import { Section } from '../components/Section'
import { api, ApiError } from '../lib/api'
import { t } from '../lib/i18n'
import { useSession } from '../lib/session'

interface AdminInvite {
  id: number
  code: string
  max_uses: number
  used_count: number
  expires_at: string | null
}
interface AdminUser {
  id: number
  name: string
  email: string
  is_admin: boolean
  can_dm: boolean
  disabled: boolean
  campaigns: number
}
interface AdminCampaign {
  id: number
  name: string
  members: number
  dms: string[]
}

/** A list from the server that is fetched again whenever `reload` changes; the old rows stay on screen meanwhile (no blank flash after every click). */
function useList<T>(path: string, reload: number): T | undefined {
  const [data, setData] = useState<T>()
  useEffect(() => {
    let off = false
    api.get<T>(path).then((d) => !off && setData(d)).catch(() => undefined)
    return () => {
      off = true
    }
  }, [path, reload])
  return data
}

interface LogEntry {
  id: number
  admin: string
  action: string
  subject: string
  at: string
}

const ACTION_KEYS = {
  'invite.create': 'admin.act.inviteCreate',
  'invite.revoke': 'admin.act.inviteRevoke',
  'user.lock': 'admin.act.userLock',
  'user.unlock': 'admin.act.userUnlock',
  'user.admin_grant': 'admin.act.adminGrant',
  'user.admin_revoke': 'admin.act.adminRevoke',
  'user.dm_grant': 'admin.act.dmGrant',
  'user.dm_revoke': 'admin.act.dmRevoke',
  'user.reset_link': 'admin.act.resetLink',
  'user.delete': 'admin.act.userDelete',
  'campaign.delete': 'admin.act.campaignDelete',
} as const

/** The admin log, newest first: the first page is fetched again whenever `reload` changes, older pages are added by `more()`. */
function useLog(reload: number) {
  const [entries, setEntries] = useState<LogEntry[]>()
  const [hasMore, setHasMore] = useState(false)
  useEffect(() => {
    let off = false
    api.get<{ entries: LogEntry[]; more: boolean }>('/admin/log')
      .then((r) => {
        if (off) return
        setEntries(r.entries)
        setHasMore(r.more)
      })
      .catch(() => undefined)
    return () => {
      off = true
    }
  }, [reload])
  const more = async () => {
    const last = entries?.at(-1)
    if (!last) return
    const r = await api.get<{ entries: LogEntry[]; more: boolean }>(`/admin/log?before=${last.id}`)
    setEntries((e) => [...(e ?? []), ...r.entries])
    setHasMore(r.more)
  }
  return { entries, hasMore, more }
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '')

/** The administrator's page (`#admin`): site invites, accounts and campaigns. The server checks the rights on every call. */
export function AdminPage() {
  const me = useSession().user
  const [n, setN] = useState(0)
  const [uses, setUses] = useState(1)
  const [days, setDays] = useState(14)
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>()
  const invites = useList<AdminInvite[]>('/admin/invites', n)
  const users = useList<AdminUser[]>('/admin/users', n)
  const campaigns = useList<AdminCampaign[]>('/admin/campaigns', n)
  const log = useLog(n)

  /** Do something, show what happened, reload the lists. */
  const run = async (action: () => Promise<unknown>) => {
    try {
      const text = await action()
      setMsg(typeof text === 'string' ? { ok: true, text } : undefined) // only the actions that return a sentence have one to show
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? (Object.values(e.fields)[0] ?? e.message) : String(e) })
    }
    setN((x) => x + 1)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <h2>{t('admin.title')}</h2>
        <button onClick={() => (location.hash = '')}>{t('admin.back')}</button>
      </div>
      {msg && <p className={msg.ok ? 'adv-text' : 'warn'}>{msg.text}</p>}

      <div className="form settings">
        <Section title={t('admin.invites')}>
          <p className="muted note-line">{t('admin.invitesNote')}</p>
          <div className="row gap wrap">
            <label className="inline-field">
              {t('admin.uses')}
              <input type="number" min={1} max={50} value={uses} onChange={(e) => setUses(Number(e.target.value) || 1)} />
            </label>
            <label className="inline-field">
              {t('admin.days')}
              <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)} />
            </label>
            <button
              className="primary"
              onClick={() => run(async () => t('admin.inviteMade', { code: (await api.post<AdminInvite>('/admin/invites', { max_uses: uses, days })).code }))}
            >
              {t('admin.makeInvite')}
            </button>
          </div>
          {invites?.length === 0 && <p className="muted">{t('admin.noInvites')}</p>}
          {!!invites?.length && (
            <table className="admin-table">
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong className="live-url">{i.code}</strong>
                    </td>
                    <td>{t('admin.used', { used: i.used_count, max: i.max_uses })}</td>
                    <td>{t('admin.expires', { date: date(i.expires_at) })}</td>
                    <td>
                      <button onClick={() => run(() => api.delete(`/admin/invites/${i.id}`))}>{t('admin.revoke')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title={t('admin.users')}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.name')}</th>
                <th>{t('admin.email')}</th>
                <th>{t('admin.campaignCount')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className={u.disabled ? 'off' : ''}>
                  <td>
                    {u.name}
                    {u.is_admin && <span className="chip">{t('admin.badgeAdmin')}</span>}
                    {u.can_dm && !u.is_admin && <span className="chip">{t('admin.badgeDm')}</span>}
                    {u.disabled && <span className="chip">{t('admin.badgeDisabled')}</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>{u.campaigns}</td>
                  <td className="actions">
                    <button onClick={() => run(async () => { await api.post(`/admin/users/${u.id}/reset-link`); return t('admin.resetSent', { email: u.email }) })}>{t('admin.resetLink')}</button>
                    {u.id !== me?.id && (
                      <>
                        {!u.is_admin && <button title={t('admin.dmTitle')} onClick={() => run(() => api.patch(`/admin/users/${u.id}`, { can_dm: !u.can_dm }))}>{t(u.can_dm ? 'admin.removeDm' : 'admin.makeDm')}</button>}
                        <button onClick={() => run(() => api.patch(`/admin/users/${u.id}`, { is_admin: !u.is_admin }))}>{t(u.is_admin ? 'admin.removeAdmin' : 'admin.makeAdmin')}</button>
                        <button onClick={() => (u.disabled || confirm(t('admin.disableConfirm', { name: u.name }))) && run(() => api.patch(`/admin/users/${u.id}`, { disabled: !u.disabled }))}>
                          {t(u.disabled ? 'admin.enable' : 'admin.disable')}
                        </button>
                        <button className="danger" onClick={() => confirm(t('admin.deleteUserConfirm', { name: u.name })) && run(() => api.delete(`/admin/users/${u.id}`))}>
                          {t('admin.delete')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title={t('admin.log')}>
          {log.entries?.length === 0 && <p className="muted">{t('admin.logEmpty')}</p>}
          {!!log.entries?.length && (
            <table className="admin-table">
              <tbody>
                {log.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">{new Date(e.at).toLocaleString()}</td>
                    <td>{e.admin}</td>
                    <td>{e.action in ACTION_KEYS ? t(ACTION_KEYS[e.action as keyof typeof ACTION_KEYS]) : e.action}</td>
                    <td>{e.subject}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {log.hasMore && <button onClick={() => void log.more()}>{t('admin.logOlder')}</button>}
        </Section>

        <Section title={t('admin.campaigns')}>
          {campaigns?.length === 0 && <p className="muted">{t('admin.noCampaigns')}</p>}
          {!!campaigns?.length && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.name')}</th>
                  <th>{t('admin.dms')}</th>
                  <th>{t('admin.members')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.dms.join(', ')}</td>
                    <td>{c.members}</td>
                    <td className="actions">
                      <button className="danger" onClick={() => confirm(t('admin.deleteCampaignConfirm', { name: c.name })) && run(() => api.delete(`/admin/campaigns/${c.id}`))}>
                        {t('admin.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </div>
  )
}
