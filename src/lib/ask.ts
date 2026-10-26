import { useSyncExternalStore } from 'react'
import { t } from './i18n'

/**
 * Ask for a line of text in the app's own dialog (`components/AskDialog.tsx`, mounted once in main.tsx) instead of the browser's `prompt()`.
 * `await askText({...})` gives the trimmed text, or null when the user cancels or leaves it empty. `await askConfirm(message)` is the same dialog as a yes / no
 * question (instead of `confirm()`): true when accepted, false on Cancel, Escape or a click outside.
 */
export interface AskOptions {
  /** The question, shown as the dialog's heading ("Name of the scene") */
  title: string
  /** What the field starts with (selected, so typing replaces it) */
  value?: string
  /** The button that accepts it ("Save", "Add") */
  confirm: string
  placeholder?: string
}
export interface Pending extends AskOptions {
  id: number
  /** 'confirm' = a question with no text field: `title` holds the message */
  mode: 'text' | 'confirm'
  resolve: (text: string | null) => void
}

let pending: Pending | null = null
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function askText(options: AskOptions): Promise<string | null> {
  pending?.resolve(null) // a second question replaces the first
  return new Promise((resolve) => {
    const self: Pending = {
      ...options,
      mode: 'text',
      id: nextId++,
      resolve: (text) => {
        if (pending === self) {
          pending = null
          emit()
        }
        resolve(text?.trim() || null)
      },
    }
    pending = self
    emit()
  })
}

export function askConfirm(message: string, confirm: string = t('common.ok')): Promise<boolean> {
  pending?.resolve(null)
  return new Promise((resolve) => {
    const self: Pending = {
      title: message,
      confirm,
      mode: 'confirm',
      id: nextId++,
      resolve: (answer) => {
        if (pending === self) {
          pending = null
          emit()
        }
        resolve(answer !== null)
      },
    }
    pending = self
    emit()
  })
}

export const useAsk = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => pending,
  )
