import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * A window over a dimmed page (a native <dialog>): a heading, a body that scrolls, and a footer with the buttons. Escape calls `onClose`; a click on
 * the dimmed area only does when `dismissOnBackdrop` is set (leave it off for forms that hold unsaved typing). Windows can be opened from windows.
 */
export function Window({
  title,
  large,
  headerExtra,
  actions,
  onClose,
  dismissOnBackdrop,
  bodyClass = '',
  children,
}: {
  title: string
  large?: boolean
  /** Shown on the right of the heading (a view / edit switch) */
  headerExtra?: ReactNode
  actions: ReactNode
  onClose: () => void
  dismissOnBackdrop?: boolean
  /** An extra class for the scrolling body, for styles that belong to what is inside */
  bodyClass?: string
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [])
  return (
    <dialog
      ref={dialog}
      className={`item-edit ${large ? 'window-lg' : ''}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // only a click on the dimmed area lands on the dialog itself; clicks inside (and in a window opened from here) have another target
      onClick={dismissOnBackdrop ? (e) => e.target === dialog.current && onClose() : undefined}
    >
      <div className="item-edit-card">
        <div className="window-head">
          <h3 id={titleId}>{title}</h3>
          {headerExtra}
        </div>
        <div className={`item-edit-body ${bodyClass}`}>{children}</div>
        <div className="inv-done">{actions}</div>
      </div>
    </dialog>
  )
}
