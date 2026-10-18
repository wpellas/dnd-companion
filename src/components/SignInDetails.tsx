import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { t } from '../lib/i18n'

/** One small form per change (new value + the current password, which the server insists on). `send` returns the success message. */
function ChangeForm({ type, label, button, send }: { type: 'email' | 'password'; label: string; button: string; send: (current: string, value: string) => Promise<string> }) {
  const [current, setCurrent] = useState('')
  const [value, setValue] = useState('')
  const [result, setResult] = useState<{ ok: boolean; text: string }>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setResult({ ok: true, text: await send(current, value) })
      setCurrent('')
      setValue('')
    } catch (err) {
      const text = err instanceof ApiError ? (err.status === 0 ? t('auth.offline') : (Object.values(err.fields)[0] ?? err.message)) : String(err)
      setResult({ ok: false, text })
    }
  }

  return (
    <form className="field-grid" onSubmit={submit}>
      <label className="field">
        <span>{label}</span>
        <input type={type} value={value} onChange={(e) => setValue(e.target.value)} required minLength={type === 'password' ? 8 : undefined} autoComplete={type === 'password' ? 'new-password' : 'email'} />
      </label>
      <label className="field">
        <span>{t('acct.currentPassword')}</span>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
      </label>
      <div className="row gap span-2">
        <button>{button}</button>
        {result && <span className={result.ok ? 'adv-text' : 'warn'}>{result.text}</span>}
      </div>
    </form>
  )
}

/** Change the e-mail address or the password (Settings). */
export function SignInDetails() {
  return (
    <details className="inv-details account-details">
      <summary>{t('acct.security')}</summary>
      <ChangeForm
        type="email"
        label={t('acct.newEmail')}
        button={t('acct.changeEmail')}
        send={async (current, email) => {
          const { pending } = await api.patch<{ pending: string }>('/me/email', { current_password: current, email })
          return t('acct.emailPending', { email: pending })
        }}
      />
      <ChangeForm
        type="password"
        label={t('acct.newPassword')}
        button={t('acct.changePassword')}
        send={async (current, password) => {
          await api.patch('/me/password', { current_password: current, password })
          return t('acct.passwordChanged')
        }}
      />
    </details>
  )
}
