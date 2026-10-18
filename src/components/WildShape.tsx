import { useState } from 'react'
import { t } from '../lib/i18n'
import { useCustomMonsters, useSrdMonsters } from '../lib/monsterLibrary'
import type { Combatant, MonsterTemplate } from '../types'
import { Combobox } from './Combobox'

/** A druid's Wild Shape (2024): pick one of the beasts in the bestiary and the combat row takes its AC, Speed and actions until the DM reverts it. */
export function WildShape({ c, level, onEnter, onLeave }: { c: Combatant; level: number; onEnter: (beast: MonsterTemplate) => void; onLeave: () => void }) {
  const { monsters } = useSrdMonsters()
  const custom = useCustomMonsters()
  const [pick, setPick] = useState<string>()
  const beasts = [...monsters, ...custom].filter((m) => m.type?.toLowerCase() === 'beast')
  const beast = beasts.find((m) => (m.srdIndex ?? `custom-${m.id}`) === pick)

  return (
    <details className="conditions">
      <summary>{c.form ? t('form.summaryIn', { form: c.form.name }) : t('form.summary')}</summary>
      <div className="popover">
        <Combobox
          placeholder={t('form.pick')}
          options={beasts.map((m) => ({ value: m.srdIndex ?? `custom-${m.id}`, label: m.name, hint: `CR ${m.cr}` }))}
          value={pick}
          onChange={setPick}
        />
        <div className="row gap">
          <button className="primary" disabled={!beast} onClick={() => beast && onEnter(beast)}>
            {t('form.take')}
          </button>
          {c.form && <button onClick={onLeave}>{t('form.leave')}</button>}
        </div>
        <p className="muted note-line">{t('form.note', { n: level })}</p>
      </div>
    </details>
  )
}
