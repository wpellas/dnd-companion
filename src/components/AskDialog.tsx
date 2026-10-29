import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAsk, type Pending } from '../lib/ask'
import { t } from '../lib/i18n'

/** The one dialog behind `askText`. A native <dialog>: it sits above everything, traps focus, and only the Cancel button closes it. */
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
  const confirmOnly = ask.mode === 'confirm'
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (confirmOnly) ask.resolve('yes')
    else if (text.trim()) ask.resolve(text)
  }
  return (
    <dialog
      ref={dialog}
      className="ask"
      aria-labelledby="ask-title"
      // Escape and a click on the dimmed area do nothing: only the Cancel button closes it (a stray key must not lose typing)
      onCancel={(e) => e.preventDefault()}
    >
      <form onSubmit={submit}>
        <h3 id="ask-title">{confirmOnly ? t('ask.confirmTitle') : ask.title}</h3>
        {confirmOnly ? (
          <p className="ask-message">{ask.title}</p>
        ) : (
          <input ref={input} value={text} placeholder={ask.placeholder} maxLength={80} aria-labelledby="ask-title" onChange={(e) => setText(e.target.value)} />
        )}
        <div className="ask-actions">
          <button type="button" onClick={() => ask.resolve(null)}>
            {t('common.cancel')}
          </button>
          <button className="primary" disabled={!confirmOnly && !text.trim()}>
            {ask.confirm}
          </button>
        </div>
      </form>
    </dialog>
  )
}
