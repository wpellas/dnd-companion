import { useId, useRef, useState } from 'react'

export interface ComboOption {
  value: string
  label: string
  /** Options with the same group are listed together under a heading */
  group?: string
  /** Small right-aligned text, e.g. a spell level */
  hint?: string
}

interface Props {
  options: ComboOption[]
  value?: string
  onChange: (value: string | undefined) => void
  placeholder?: string
  className?: string
  /** Label of the "no selection" row shown at the top while something is selected */
  clearLabel?: string
}

/**
 * A searchable dropdown: click or focus to open, type to filter, arrow keys + Enter to pick, Esc to close.
 * Matches that start with the query rank above matches that merely contain it.
 */
export function Combobox({ options, value, onChange, placeholder = 'Search…', className = '', clearLabel = '- none -' }: Props) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const selected = options.find((o) => o.value === value)
  const q = query.trim().toLowerCase()
  const matches = options
    .map((o, i) => ({ o, i, rank: q === '' ? 0 : o.label.toLowerCase().startsWith(q) ? 0 : o.label.toLowerCase().includes(q) ? 1 : 2 }))
    .filter((m) => m.rank < 2)
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((m) => m.o)
  // "clear" row first (only when there is something to clear), then the matches
  const rows: (ComboOption | null)[] = [...(selected && q === '' ? [null] : []), ...matches]

  const close = () => {
    setOpen(false)
    setQuery('')
  }
  const pick = (opt: ComboOption | null) => {
    onChange(opt?.value)
    close()
    inputRef.current?.blur()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(rows.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      if (rows.length > 0) pick(rows[Math.min(active, rows.length - 1)])
    } else if (e.key === 'Escape') {
      close()
      inputRef.current?.blur()
    }
  }

  let lastGroup: string | undefined
  return (
    <div className={`combobox ${className}`}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        value={open ? query : (selected?.label ?? '')}
        placeholder={selected ? selected.label : placeholder}
        onFocus={() => {
          setOpen(true)
          setActive(0)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onBlur={close}
        onKeyDown={onKeyDown}
      />
      <span className="combobox-caret" aria-hidden>
        ▾
      </span>
      {open && (
        <ul className="combobox-list" id={listId} role="listbox">
          {rows.length === 0 && <li className="combobox-empty">No matches</li>}
          {rows.map((opt, i) => {
            const heading = opt && opt.group && opt.group !== lastGroup ? opt.group : undefined
            if (opt) lastGroup = opt.group
            return (
              <li key={opt?.value ?? '__clear'} role="presentation">
                {heading && <div className="combobox-group">{heading}</div>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={opt?.value === value}
                  className={`combobox-option ${i === active ? 'active' : ''} ${opt?.value === value ? 'chosen' : ''} ${opt ? '' : 'clear'}`}
                  // mousedown (not click) so the input's blur doesn't close the list before the pick lands
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(opt)
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span>{opt ? opt.label : clearLabel}</span>
                  {opt?.hint && <small>{opt.hint}</small>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
