import { askConfirm } from '../lib/ask'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { api } from '../lib/api'
import { t } from '../lib/i18n'
import { useSession } from '../lib/session'
import { Section } from './Section'

/** The secret link (and QR code) for the table's TV: it shows the live view without a login. The DM can replace it if it leaks. */
export function TableLink() {
  const { campaign } = useSession()
  const [token, setToken] = useState<string>()
  const [qr, setQr] = useState<string>()
  const id = campaign?.id
  const url = token ? `${location.origin}/#table/${token}` : undefined

  useEffect(() => {
    let off = false
    if (id !== undefined) api.get<{ view_token: string | null }>(`/campaigns/${id}`).then((c) => !off && setToken(c.view_token ?? undefined)).catch(() => undefined)
    return () => {
      off = true
    }
  }, [id])

  useEffect(() => {
    let off = false
    if (url) QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#2a1a0d', light: '#f4e9c6' } }).then((d) => !off && setQr(d))
    return () => {
      off = true
    }
  }, [url])

  if (campaign?.role !== 'dm') return null

  const renew = async () => {
    if (!(await askConfirm(t('table.newConfirm')))) return
    setToken((await api.post<{ view_token: string }>(`/campaigns/${campaign.id}/live-link`)).view_token)
  }

  return (
    <Section title={t('settings.live')}>
      <p className="muted note-line">{t('table.note')}</p>
      <div className="live-box">
        <div>
          <p>{url ? <strong className="live-url">{url}</strong> : t('table.loading')}</p>
          <p className="muted note-line">{t('table.warn')}</p>
          <button onClick={() => void renew()}>{t('table.new')}</button>
        </div>
        {qr && <img className="qr" src={qr} alt={t('settings.qrAlt', { url: url ?? '' })} />}
      </div>
    </Section>
  )
}
