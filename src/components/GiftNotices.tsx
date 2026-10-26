import { t } from '../lib/i18n'
import { dismissNotice, useNotices } from '../lib/gifts'

/** A short note when an item arrives from, or leaves for, another character. Fades by itself; the ✕ closes it sooner. */
export function GiftNotices() {
  const notices = useNotices()
  if (!notices.length) return null
  return (
    <div className="gift-notices" role="status">
      {notices.map((n) => (
        <div key={n.id} className="gift-notice">
          <span>🎁 {n.text}</span>
          <button className="chip-x" title={t('roll.dismiss')} aria-label={t('roll.dismiss')} onClick={() => dismissNotice(n.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
