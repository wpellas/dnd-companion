import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { NumberField } from '../components/NumberField'
import { addEntry, deleteEntry, KIND_LABEL, updateEntry } from '../lib/journal'
import { getCampaign } from '../lib/store'
import type { JournalEntry } from '../types'

type Filter = 'all' | JournalEntry['kind']
const FILTERS: Filter[] = ['all', 'note', 'session', 'combat']
const FILTER_LABEL: Record<Filter, string> = { all: 'Everything', note: 'Notes', session: 'Sessions', combat: 'Combats' }

/** The DM's campaign journal: free notes, session recaps, and an automatic summary of every fight that ends. Never shown to players. */
export function JournalPage() {
  const entries = useLiveQuery(() => db.journal.toArray(), [])
  const campaign = useLiveQuery(getCampaign, [])
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<JournalEntry | null>(null)

  const q = query.trim().toLowerCase()
  const shown = (entries ?? [])
    .filter((e) => (filter === 'all' || e.kind === filter) && (!q || `${e.title}\n${e.body}`.toLowerCase().includes(q)))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt - a.createdAt)
  const sessions = (entries ?? []).filter((e) => e.kind === 'session').length

  const blank = (kind: JournalEntry['kind']): JournalEntry => ({
    kind,
    title: kind === 'session' ? `Session ${sessions + 1}` : '',
    body: '',
    day: campaign?.day ?? 1,
    createdAt: 0,
    updatedAt: 0,
  })

  return (
    <div className="page">
      <div className="toolbar">
        <h2>Journal</h2>
        <button onClick={() => setEditing(blank('session'))}>📖 New session recap</button>
        <button className="primary" onClick={() => setEditing(blank('note'))}>
          + New note
        </button>
      </div>

      {editing && <EntryForm key={editing.id ?? 'new'} initial={editing} onClose={() => setEditing(null)} />}

      <div className="filter-bar">
        <input className="grow" type="search" placeholder="Search the journal…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the journal" />
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? 'selected' : ''}`} onClick={() => setFilter(f)}>
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="journal">
        {shown.map((e) => (
          <JournalCard key={e.id} e={e} onEdit={() => setEditing(e)} />
        ))}
        {entries && shown.length === 0 && (
          <p className="muted">
            {entries.length === 0
              ? 'Nothing here yet. Write a note or a session recap; every fight you end is added automatically.'
              : 'No entries match.'}
          </p>
        )}
      </div>
    </div>
  )
}

function JournalCard({ e, onEdit }: { e: JournalEntry; onEdit: () => void }) {
  // a combat summary is long: show the result, tuck the log away
  const [head, ...rest] = e.kind === 'combat' ? e.body.split('\n\nCombat log:\n') : [e.body]
  const log = rest.join('')
  return (
    <article className={`card journal-card ${e.kind}`}>
      <div className="row gap wrap journal-head">
        <span className={`kind-badge ${e.kind}`}>{KIND_LABEL[e.kind]}</span>
        <strong className="journal-title">{e.title || 'Untitled'}</strong>
        <span className="muted">
          Day {e.day} · {new Date(e.createdAt).toLocaleDateString()}
        </span>
        <span className="grow" />
        <button title={e.pinned ? 'Unpin' : 'Pin to the top'} aria-label={e.pinned ? 'Unpin' : 'Pin'} className={e.pinned ? 'selected' : ''} onClick={() => updateEntry(e.id!, { pinned: !e.pinned })}>
          📌
        </button>
        <button onClick={onEdit}>Edit</button>
        <button className="danger" onClick={() => confirm(`Delete "${e.title || 'this entry'}"?`) && deleteEntry(e.id!)}>
          Delete
        </button>
      </div>
      {head && <p className="journal-body">{head}</p>}
      {log && (
        <details>
          <summary>Combat log</summary>
          <p className="journal-body">{log}</p>
        </details>
      )}
    </article>
  )
}

function EntryForm({ initial, onClose }: { initial: JournalEntry; onClose: () => void }) {
  const [e, setE] = useState(initial)
  const set = <K extends keyof JournalEntry>(k: K, v: JournalEntry[K]) => setE((x) => ({ ...x, [k]: v }))

  const save = async () => {
    if (e.id === undefined) {
      const id = await addEntry(e.kind, e.title.trim(), e.body)
      await updateEntry(id, { day: e.day })
    } else {
      await updateEntry(e.id, { kind: e.kind, title: e.title.trim(), body: e.body, day: e.day })
    }
    onClose()
  }

  return (
    <div className="card form">
      <div className="field-grid">
        <label className="field span-2">
          <span>Title</span>
          <input autoFocus value={e.title} placeholder="What happened?" onChange={(ev) => set('title', ev.target.value)} />
        </label>
        <label className="field">
          <span>Type</span>
          <select value={e.kind} disabled={e.kind === 'combat'} onChange={(ev) => set('kind', ev.target.value as JournalEntry['kind'])}>
            <option value="note">Note</option>
            <option value="session">Session recap</option>
            {e.kind === 'combat' && <option value="combat">Combat</option>}
          </select>
        </label>
        <NumberField label="Campaign day" value={e.day} min={1} onChange={(n) => set('day', Math.max(1, Math.floor(n)))} />
      </div>
      <label className="field">
        <span>Notes</span>
        <textarea rows={10} value={e.body} placeholder="NPCs met, clues, loot, hooks for next time…" onChange={(ev) => set('body', ev.target.value)} />
      </label>
      <div className="form-actions">
        <button className="primary" disabled={!e.title.trim() && !e.body.trim()} onClick={save}>
          Save
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
