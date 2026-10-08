import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { NumberField } from '../components/NumberField'
import { locale, t } from '../lib/i18n'
import { addEntry, deleteEntry, kindLabel, splitCombatLog, updateEntry } from '../lib/journal'
import { getCampaign } from '../lib/store'
import type { JournalEntry } from '../types'

type Filter = 'all' | JournalEntry['kind']
const FILTERS: Filter[] = ['all', 'note', 'session', 'combat', 'loot']
const FILTER_LABEL = { all: 'journal.filterAll', note: 'journal.filterNote', session: 'journal.filterSession', combat: 'journal.filterCombat', loot: 'journal.filterLoot' } as const

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
    title: kind === 'session' ? t('journal.sessionTitle', { n: sessions + 1 }) : '',
    body: '',
    day: campaign?.day ?? 1,
    createdAt: 0,
    updatedAt: 0,
  })

  return (
    <div className="page">
      <div className="toolbar">
        <h2>{t('journal.title')}</h2>
        <button onClick={() => setEditing(blank('session'))}>{t('journal.newSession')}</button>
        <button className="primary" onClick={() => setEditing(blank('note'))}>
          {t('journal.newNote')}
        </button>
      </div>

      {editing && <EntryForm key={editing.id ?? 'new'} initial={editing} onClose={() => setEditing(null)} />}

      <div className="filter-bar">
        <input className="grow" type="search" placeholder={t('journal.search')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('journal.search')} />
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? 'selected' : ''}`} onClick={() => setFilter(f)}>
            {t(FILTER_LABEL[f])}
          </button>
        ))}
      </div>

      <div className="journal">
        {shown.map((e) => (
          <JournalCard key={e.id} e={e} onEdit={() => setEditing(e)} />
        ))}
        {entries && shown.length === 0 && <p className="muted">{entries.length === 0 ? t('journal.empty') : t('journal.noMatch')}</p>}
      </div>
    </div>
  )
}

function JournalCard({ e, onEdit }: { e: JournalEntry; onEdit: () => void }) {
  // a combat summary is long: show the result, tuck the log away
  const [head, log] = e.kind === 'combat' ? splitCombatLog(e.body) : [e.body, '']
  return (
    <article className={`card journal-card ${e.kind}`}>
      <div className="row gap wrap journal-head">
        <span className={`kind-badge ${e.kind}`}>{kindLabel(e.kind)}</span>
        <strong className="journal-title">{e.title || t('common.untitled')}</strong>
        <span className="muted">{t('journal.dayDate', { day: e.day, date: new Date(e.createdAt).toLocaleDateString(locale()) })}</span>
        <span className="grow" />
        <button
          title={e.pinned ? t('journal.unpin') : t('journal.pinTitle')}
          aria-label={e.pinned ? t('journal.unpin') : t('journal.pin')}
          className={e.pinned ? 'selected' : ''}
          onClick={() => updateEntry(e.id!, { pinned: !e.pinned })}
        >
          📌
        </button>
        <button onClick={onEdit}>{t('common.edit')}</button>
        <button className="danger" onClick={() => confirm(t('journal.deleteConfirm', { title: e.title || t('journal.thisEntry') })) && deleteEntry(e.id!)}>
          {t('common.delete')}
        </button>
      </div>
      {head && <p className="journal-body">{head}</p>}
      {log && (
        <details>
          <summary>{t('journal.combatLog')}</summary>
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
          <span>{t('journal.formTitle')}</span>
          <input autoFocus value={e.title} placeholder={t('journal.titlePlaceholder')} onChange={(ev) => set('title', ev.target.value)} />
        </label>
        <label className="field">
          <span>{t('journal.type')}</span>
          <select value={e.kind} disabled={e.kind === 'combat' || e.kind === 'loot'} onChange={(ev) => set('kind', ev.target.value as JournalEntry['kind'])}>
            <option value="note">{kindLabel('note')}</option>
            <option value="session">{t('journal.typeSession')}</option>
            {e.kind === 'combat' && <option value="combat">{kindLabel('combat')}</option>}
            {e.kind === 'loot' && <option value="loot">{kindLabel('loot')}</option>}
          </select>
        </label>
        <NumberField label={t('journal.campaignDay')} value={e.day} min={1} onChange={(n) => set('day', Math.max(1, Math.floor(n)))} />
      </div>
      <label className="field">
        <span>{t('common.notes')}</span>
        <textarea rows={10} value={e.body} placeholder={t('journal.bodyPlaceholder')} onChange={(ev) => set('body', ev.target.value)} />
      </label>
      <div className="form-actions">
        <button className="primary" disabled={!e.title.trim() && !e.body.trim()} onClick={save}>
          {t('common.save')}
        </button>
        <button onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}
