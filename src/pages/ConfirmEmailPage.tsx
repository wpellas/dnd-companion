import { useEffect, useState } from 'react'
import logo from '../assets/images/logo-360.png'
import { api, ApiError } from '../lib/api'
import { t } from '../lib/i18n'
import { refresh } from '../lib/session'

/** One request per link, even though React runs effects twice in development: the second would find the link already used. */
const attempts = new Map<string, Promise<void>>()

/** Where the link in the confirmation e-mail lands (`#confirm-email?token=..`). The secret in the link is enough, so no login is needed (it may be opened on another device). */
export function ConfirmEmailPage({ token }: { token: string }) {
  const [state, setState] = useState<{ done: boolean; error?: string }>({ done: false })

  useEffect(() => {
    let attempt = attempts.get(token)
    if (!attempt) attempts.set(token, (attempt = api.post('/confirm-email', { token }).then(() => undefined)))
    let off = false
    attempt
      .then(() => !off && setState({ done: true }))
      .catch((e) => !off && setState({ done: false, error: e instanceof ApiError && e.status === 0 ? t('auth.offline') : e instanceof ApiError ? (Object.values(e.fields)[0] ?? e.message) : String(e) }))
    return () => {
      off = true
    }
  }, [token])

  const leave = () => {
    location.hash = ''
    void refresh() // a signed-in browser shows the new address
  }

  return (
    <div className="page auth-page">
      <img src={logo} alt={t('app.logoAlt')} />
      <div className="card form">
        <h2>{t('confirm.title')}</h2>
        {state.error ? <p className="warn">{state.error}</p> : <p>{state.done ? t('confirm.done') : t('confirm.working')}</p>}
        <button className="primary" onClick={leave}>
          {t('confirm.continue')}
        </button>
      </div>
    </div>
  )
}
