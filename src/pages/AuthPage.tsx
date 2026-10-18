import { useState, type FormEvent } from 'react'
import logo from '../assets/images/logo-360.png'
import { useHash } from '../hooks'
import { api, ApiError } from '../lib/api'
import { t } from '../lib/i18n'
import { login, register } from '../lib/session'

type Mode = 'login' | 'register' | 'forgot' | 'reset'

/** Log in, create an account (invite code needed), ask for a reset link, or choose a new password (the link in the e-mail opens `#reset?token=..&email=..`). */
export function AuthPage() {
  const hash = useHash()
  const reset = hash.startsWith('#reset?') ? new URLSearchParams(hash.slice('#reset?'.length)) : null
  const [mode, setMode] = useState<Mode>(reset ? 'reset' : 'login')
  const [v, setV] = useState({ name: '', email: reset?.get('email') ?? '', password: '', invite: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [note, setNote] = useState<string>()
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })

  const go = (next: Mode) => {
    setMode(next)
    setError(undefined)
    setNote(undefined)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      if (mode === 'login') await login(v.email, v.password)
      else if (mode === 'register') await register(v)
      else if (mode === 'forgot') {
        await api.post('/forgot-password', { email: v.email })
        setNote(t('auth.linkSent'))
      } else {
        await api.post('/reset-password', { token: reset?.get('token') ?? '', email: v.email, password: v.password })
        history.replaceState(null, '', location.pathname)
        setNote(t('auth.resetDone'))
        setMode('login')
        setV({ ...v, password: '' })
      }
    } catch (err) {
      setError(err instanceof ApiError && err.status === 0 ? t('auth.offline') : err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : String(err))
    } finally {
      setBusy(false)
    }
  }

  const needsPassword = mode !== 'forgot'
  return (
    <div className="page auth-page">
      <img src={logo} alt={t('app.logoAlt')} />
      <form className="card form" onSubmit={submit}>
        <h2>{t(mode === 'register' ? 'auth.register' : mode === 'forgot' ? 'auth.forgot' : mode === 'reset' ? 'auth.newPassword' : 'auth.login')}</h2>
        {mode === 'register' && (
          <>
            <label className="field">
              <span>{t('auth.invite')}</span>
              <input value={v.invite} onChange={set('invite')} autoFocus required autoCapitalize="characters" />
            </label>
            <label className="field">
              <span>{t('auth.name')}</span>
              <input value={v.name} onChange={set('name')} required maxLength={60} />
            </label>
          </>
        )}
        <label className="field">
          <span>{t('auth.email')}</span>
          <input type="email" value={v.email} onChange={set('email')} required autoComplete="email" autoFocus={mode === 'login' || mode === 'forgot'} />
        </label>
        {needsPassword && (
          <label className="field">
            <span>{t(mode === 'reset' ? 'auth.newPassword' : 'auth.password')}</span>
            <input type="password" value={v.password} onChange={set('password')} required minLength={mode === 'login' ? undefined : 8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {mode !== 'login' && <small className="muted">{t('auth.passwordHint')}</small>}
          </label>
        )}
        {error && <p className="warn">{error}</p>}
        {note && <p className="muted">{note}</p>}
        <button className="primary" disabled={busy}>
          {t(mode === 'register' ? 'auth.register' : mode === 'forgot' ? 'auth.sendLink' : mode === 'reset' ? 'auth.resetGo' : 'auth.login')}
        </button>
        <div className="auth-links">
          {mode === 'login' && (
            <>
              <button type="button" className="link" onClick={() => go('register')}>
                {t('auth.toRegister')}
              </button>
              <button type="button" className="link" onClick={() => go('forgot')}>
                {t('auth.forgot')}
              </button>
            </>
          )}
          {mode !== 'login' && (
            <button type="button" className="link" onClick={() => go('login')}>
              {mode === 'register' ? t('auth.toLogin') : t('auth.back')}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
