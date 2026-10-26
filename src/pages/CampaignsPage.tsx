import { useState, type FormEvent } from 'react'
import logo from '../assets/images/logo-360.png'
import { ApiError } from '../lib/api'
import { t } from '../lib/i18n'
import { chooseCampaign, createCampaign, joinCampaign, logout, useSession } from '../lib/session'
import { syncNow, useSyncStatus } from '../lib/sync'

/** Pick the campaign to open, make a new one (you are its DM), or join one with an invite code. */
export function CampaignsPage() {
  const { user, campaigns } = useSession()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()

  const run = (action: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault()
    setError(undefined)
    try {
      await action()
    } catch (err) {
      setError(err instanceof ApiError && err.status === 0 ? t('auth.offline') : err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : String(err))
    }
  }

  return (
    <div className="page auth-page">
      <img src={logo} alt={t('app.logoAlt')} />
      <div className="card form">
        <h2>{t('camp.title')}</h2>
        <p className="muted">{t('camp.signedIn', { name: user?.name ?? '' })}</p>
        {campaigns.length === 0 && <p className="muted">{t('camp.none')}</p>}
        {campaigns.map((c) => (
          <div key={c.id} className="campaign-row">
            <strong>{c.name}</strong>
            <span className="chip">{t(c.role === 'dm' ? 'camp.dm' : 'camp.player')}</span>
            <button className="primary" onClick={() => void chooseCampaign(c.id)}>
              {t('camp.open')}
            </button>
          </div>
        ))}
        {error && <p className="warn">{error}</p>}
        {user?.can_dm ? (
          <form className="campaign-form" onSubmit={run(() => createCampaign(name.trim()))}>
            <label className="field">
              <span>{t('camp.create')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('camp.namePlaceholder')} maxLength={80} required />
            </label>
            <button>{t('camp.createGo')}</button>
          </form>
        ) : (
          <p className="muted small">{t('camp.playerOnly')}</p>
        )}
        <form className="campaign-form" onSubmit={run(() => joinCampaign(code.trim()))}>
          <label className="field">
            <span>{t('camp.join')}</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" required />
          </label>
          <button>{t('camp.joinGo')}</button>
        </form>
        {user?.is_admin && (
          <a className="link" href="#admin">
            {t('admin.link')}
          </a>
        )}
        <button className="link" onClick={() => void logout()}>
          {t('camp.logout')}
        </button>
      </div>
    </div>
  )
}

/** Shown until the first copy of the campaign has arrived (or this device already had one). */
export function CampaignLoading() {
  const sync = useSyncStatus()
  return (
    <div className="page auth-page">
      <img src={logo} alt={t('app.logoAlt')} />
      <div className="card form">
        <p>{sync.state === 'offline' ? t('camp.loadFail') : t('camp.loading')}</p>
        {sync.state === 'offline' && <button onClick={() => void syncNow()}>{t('camp.retry')}</button>}
        <button className="link" onClick={() => void chooseCampaign(undefined)}>
          {t('camp.switch')}
        </button>
      </div>
    </div>
  )
}
