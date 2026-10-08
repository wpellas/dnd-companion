import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Combobox } from '../components/Combobox'
import { NumberField } from '../components/NumberField'
import { Section } from '../components/Section'
import { t } from '../lib/i18n'
import { loadEncounter, encounterXp, rateEncounter, templateFor } from '../lib/encounters'
import { useCustomMonsters, useSrdMonsters } from '../lib/monsterLibrary'
import type { Encounter, EncounterEntry } from '../types'

const blank = (): Encounter => ({ name: '', notes: '', entries: [] })

/** Difficulty summary line for an encounter against the party. */
function Rating({ xp, levels }: { xp: number; levels: number[] }) {
  if (!levels.length) return <span className="muted">{t('enc.ratingNone', { xp })}</span>
  const { budget, difficulty } = rateEncounter(xp, levels)
  return (
    <span title={t('enc.budgetTitle', { low: budget.low, mod: budget.moderate, high: budget.high })}>
      {xp} XP · <strong className={`diff ${difficulty?.replace(' ', '-').toLowerCase()}`}>{difficulty ? t(`diff.${difficulty}`) : ''}</strong>
      <span className="muted">{t('enc.budgetNote', { low: budget.low, mod: budget.moderate, high: budget.high })}</span>
    </span>
  )
}

export function EncountersPage({ goTo }: { goTo: (tab: 'combat') => void }) {
  const encounters = useLiveQuery(() => db.encounters.orderBy('name').toArray(), [])
  const characters = useLiveQuery(() => db.characters.toArray(), [])
  const { monsters: srd } = useSrdMonsters()
  const custom = useCustomMonsters()
  const [editing, setEditing] = useState<Encounter | null>(null)
  const [message, setMessage] = useState<string>()
  const levels = (characters ?? []).map((c) => c.level)

  const load = async (enc: Encounter) => {
    const missing = await loadEncounter(enc, srd, custom)
    if (missing.length) setMessage(t('enc.missing', { names: missing.join(', ') }))
    else goTo('combat')
  }

  return (
    <div className="page">
      <div className="toolbar">
        <h2>{t('enc.title')}</h2>
        <button className="primary" onClick={() => setEditing(blank())}>
          {t('enc.new')}
        </button>
      </div>
      {message && <p className="warn">{message}</p>}

      {editing && <EncounterForm initial={editing} srd={srd} custom={custom} levels={levels} onClose={() => setEditing(null)} />}

      <div className="card-grid">
        {encounters?.map((enc) => (
          <div className="card" key={enc.id}>
            <strong>{enc.name}</strong>
            <ul className="enc-list">
              {enc.entries.map((e, i) => (
                <li key={i}>
                  {e.count} × {e.name}
                  {!templateFor(e, srd, custom) && <span className="warn">{t('enc.notFound')}</span>}
                </li>
              ))}
            </ul>
            {enc.notes && <p className="muted">{enc.notes}</p>}
            <div className="enc-rating">
              <Rating xp={encounterXp(enc.entries, srd, custom)} levels={levels} />
            </div>
            <div className="row gap wrap">
              <button className="primary" onClick={() => load(enc)}>
                {t('enc.load')}
              </button>
              <button onClick={() => setEditing(enc)}>{t('common.edit')}</button>
              <button onClick={() => db.encounters.add({ ...enc, id: undefined, name: `${enc.name} (${t('enc.copySuffix')})` })}>{t('enc.duplicate')}</button>
              <button className="danger" onClick={() => confirm(t('enc.deleteConfirm', { name: enc.name })) && db.encounters.delete(enc.id!)}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
        {encounters?.length === 0 && (
          <p className="muted">{t('enc.empty')}</p>
        )}
      </div>
    </div>
  )
}

function EncounterForm({ initial, srd, custom, levels, onClose }: { initial: Encounter; srd: ReturnType<typeof useSrdMonsters>['monsters']; custom: ReturnType<typeof useCustomMonsters>; levels: number[]; onClose: () => void }) {
  const [enc, setEnc] = useState<Encounter>(structuredClone(initial))
  const options = useMemo(
    () => [
      ...custom.map((m) => ({ value: `c:${m.id}`, label: m.name, group: t('enc.groupCustom'), hint: t('enc.cr', { cr: m.cr }) })),
      ...srd.map((m) => ({ value: `s:${m.srdIndex}`, label: m.name, group: t('enc.groupSrd'), hint: t('enc.cr', { cr: m.cr }) })),
    ],
    [srd, custom],
  )
  const setEntries = (entries: EncounterEntry[]) => setEnc((e) => ({ ...e, entries }))

  const add = (v: string | undefined) => {
    if (!v) return
    const [kind, id] = [v.slice(0, 1), v.slice(2)]
    const tmpl = kind === 's' ? srd.find((m) => m.srdIndex === id) : custom.find((m) => String(m.id) === id)
    if (!tmpl) return
    const same = enc.entries.findIndex((e) => (kind === 's' ? e.srdIndex === id : e.templateId === tmpl.id))
    if (same >= 0) setEntries(enc.entries.map((e, i) => (i === same ? { ...e, count: e.count + 1 } : e)))
    else setEntries([...enc.entries, { srdIndex: kind === 's' ? id : undefined, templateId: kind === 'c' ? tmpl.id : undefined, name: tmpl.name, count: 1 }])
  }

  const save = async () => {
    if (!enc.name.trim()) return
    const clean = { ...enc, name: enc.name.trim() }
    if (clean.id === undefined) await db.encounters.add(clean)
    else await db.encounters.put(clean)
    onClose()
  }

  return (
    <div className="card form">
      <Section title={initial.id === undefined ? t('enc.formNew') : t('enc.formEdit')}>
        <div className="field-grid">
          <label className="field span-2">
            <span>{t('common.name')}</span>
            <input value={enc.name} onChange={(e) => setEnc({ ...enc, name: e.target.value })} autoFocus placeholder={t('enc.namePlaceholder')} />
          </label>
          <label className="field span-2">
            <span>{t('common.notes')}</span>
            <input value={enc.notes} onChange={(e) => setEnc({ ...enc, notes: e.target.value })} placeholder={t('enc.notesPlaceholder')} />
          </label>
        </div>
      </Section>
      <Section
        title={t('enc.monsters')}
        action={<Combobox className="add-feature" placeholder={t('enc.addMonster')} options={options} onChange={add} />}
      >
        {enc.entries.length === 0 && <p className="muted empty-note">{t('enc.emptyForm')}</p>}
        {enc.entries.map((e, i) => (
          <div className="item-card" key={`${e.srdIndex}${e.templateId}${i}`}>
            <div className="item-top">
              <div className="field grow">
                <span>{t('enc.monster')}</span>
                <strong className="static-value">{e.name}</strong>
              </div>
              <NumberField label={t('enc.count')} value={e.count} min={1} onChange={(n) => setEntries(enc.entries.map((x, j) => (j === i ? { ...x, count: Math.max(1, Math.floor(n)) } : x)))} />
              <button className="danger icon-btn" onClick={() => setEntries(enc.entries.filter((_, j) => j !== i))} title={t('common.remove')}>
                ✕
              </button>
            </div>
          </div>
        ))}
        <div className="enc-rating">
          <Rating xp={encounterXp(enc.entries, srd, custom)} levels={levels} />
        </div>
      </Section>
      <div className="form-actions">
        <button className="primary" onClick={save} disabled={!enc.name.trim()}>
          {t('enc.save')}
        </button>
        <button onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}
