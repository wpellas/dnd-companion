import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAsk, type Pending } from '../lib/ask'
import { t } from '../lib/i18n'

/** The one dialog behind `askText`. A native <dialog>: it sits above everything, traps focus, and Escape or a click on the dimmed area cancels. */
export function AskDialog() {
  const ask = useAsk()
  return ask ? <AskBox key={ask.id} ask={ask} /> : null
}

function AskBox({ ask }: { ask: Pending }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(ask.value ?? '')
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
    input.current?.select()
  }, [])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim()) ask.resolve(text)
  }
  return (
    <dialog
      ref={dialog}
      className="ask"
      aria-labelledby="ask-title"
      onCancel={(e) => {
        e.preventDefault()
        ask.resolve(null)
      }}
      // the form fills the whole dialog, so a click that lands on the dialog itself is a click on the dimmed area
      onClick={(e) => e.target === dialog.current && ask.resolve(null)}
    >
      <form onSubmit={submit}>
        <h3 id="ask-title">{ask.title}</h3>
        <input ref={input} value={text} placeholder={ask.placeholder} maxLength={80} aria-labelledby="ask-title" onChange={(e) => setText(e.target.value)} />
        <div className="ask-actions">
          <button type="button" onClick={() => ask.resolve(null)}>
            {t('common.cancel')}
          </button>
          <button className="primary" disabled={!text.trim()}>
            {ask.confirm}
          </button>
        </div>
      </form>
    </dialog>
  )
}
