import { useState } from 'react'
import { addMonsters, mutateCombat, sortCombatants } from '../lib/combat'
import { t } from '../lib/i18n'
import { addEntry } from '../lib/journal'
import { useCustomMonsters, useSrdMonsters } from '../lib/monsterLibrary'
import { npcBody, NPC_FIELDS, rollNpc, rollNpcField, type Npc, type NpcField } from '../lib/npc'
import { useSettings } from '../lib/settings'
import { Combobox } from './Combobox'

/** A quick NPC for the DM: rolled from small tables, every line editable and re-rollable, saved to the journal or dropped into the fight under a stat block. */
export function QuickNpc({ onClose }: { onClose: () => void }) {
  const [npc, setNpc] = useState<Npc>(rollNpc)
  const [block, setBlock] = useState<string>()
  const [saved, setSaved] = useState(false)
  const { monsters } = useSrdMonsters()
  const custom = useCustomMonsters()
  const settings = useSettings()
  const all = [...monsters, ...custom]
  const set = (f: NpcField, v: string) => {
    setNpc((n) => ({ ...n, [f]: v }))
    setSaved(false)
  }
  const template = all.find((m) => (m.srdIndex ?? `custom-${m.id}`) === block)

  return (
    <div className="card npc-card">
      <h3>{t('npc.title')}</h3>
      {NPC_FIELDS.map((f) => (
        <div key={f} className="npc-field">
          <label className="field grow">
            <span>{t(`npc.${f}`)}</span>
            <input value={npc[f]} onChange={(e) => set(f, e.target.value)} />
          </label>
          <button title={t('npc.reroll')} aria-label={t('npc.reroll')} onClick={() => set(f, rollNpcField(f))}>
            🎲
          </button>
        </div>
      ))}
      <div className="row gap wrap">
        <button onClick={() => { setNpc(rollNpc()); setSaved(false) }}>{t('npc.rollAll')}</button>
        <button
          className="primary"
          onClick={async () => {
            await addEntry('note', `${npc.name} (${npc.species}, ${npc.job})`, npcBody(npc))
            setSaved(true)
          }}
        >
          {t('npc.save')}
        </button>
        {saved && <span className="adv-text">{t('npc.saved')}</span>}
        <button onClick={onClose}>{t('npc.close')}</button>
      </div>
      <div className="row gap wrap">
        <Combobox className="target-select" options={all.map((m) => ({ value: m.srdIndex ?? `custom-${m.id}`, label: m.name, hint: `CR ${m.cr}` }))} value={block} onChange={setBlock} placeholder={t('npc.fight')} />
        <button
          disabled={!template}
          onClick={() =>
            template &&
            void mutateCombat((s) => {
              const [m] = addMonsters(s, template, 1, { rollHp: settings.rollMonsterHp })
              m.name = npc.name
              if (s.started) sortCombatants(s)
            }, npc.name)
          }
        >
          {t('npc.fightGo')}
        </button>
        <span className="muted small">{t('npc.fightNote')}</span>
      </div>
    </div>
  )
}
