import type { ReactNode } from 'react'

interface Props {
  title: string
  /** Buttons / status shown on the right of the heading */
  action?: ReactNode
  children?: ReactNode
}

/** A titled block of a form, so every part of the character / monster editor looks and behaves the same. */
export function Section({ title, action, children }: Props) {
  return (
    <section className="section">
      <header className="section-head">
        <h4>{title}</h4>
        {action && <div className="section-actions">{action}</div>}
      </header>
      {children}
    </section>
  )
}

/** Labelled checkbox that sits on the same baseline as the labelled inputs around it. */
export function CheckField({
  label,
  checked,
  onChange,
  title,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  title?: string
}) {
  return (
    <label className="check" title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
