import { Window } from './Window'
import { useState } from 'react'
import { usePromise } from '../hooks'
import { proficiencyBonus } from '../lib/character'
import { rollDie } from '../lib/dice'
import { t, tAbility } from '../lib/i18n'
import { addEntry } from '../lib/journal'
import { asiText, asiValid, averageRoll, grantsAsi, levelUp, MAX_ABILITY, type AsiChoice } from '../lib/levelup'
import { useSession } from '../lib/session'
import { useSettings } from '../lib/settings'
import { getClass, getClassLevel } from '../lib/srdApi'
import { levelForXp } from '../lib/inventory'
import { updateCharacter } from '../lib/store'
import { ABILITIES, type Ability, type Character } from '../types'

/** Guided level-up: what the new level brings (from the class table), hit points (average or the player's roll), and the ability score improvement. */
export function LevelUpPanel({ c, onClose }: { c: Character; onClose: () => void }) {
  const settings = useSettings()
  const isDm = useSession().campaign?.role === 'dm'
  const next = c.level + 1
  const loaded = usePromise(() => Promise.all([getClass(c.classIndex!), getClassLevel(c.classIndex!, next)]).then(([cls, row]) => ({ cls, row })), [c.id, next])
  const [useRoll, setUseRoll] = useState(false)
  const [rolled, setRolled] = useState('')
  const [kind, setKind] = useState<AsiChoice['kind']>('two')
  const [abilities, setAbilities] = useState<Ability[]>(['str', 'dex'])
  const [feat, setFeat] = useState('')
  const [busy, setBusy] = useState(false)

  if (loaded.error) return <Frame c={c} onClose={onClose}><p className="warn">{t('lvl.failed')}</p></Frame>
  if (!loaded.data) return <Frame c={c} onClose={onClose}><p className="muted">{t('lvl.loading')}</p></Frame>
  const { cls, row } = loaded.data

  const features = (row.features ?? []).map((f) => f.name)
  const needsAsi = grantsAsi(features)
  const asi: AsiChoice | undefined = needsAsi ? { kind, abilities: kind === 'two' ? abilities.slice(0, 1) : abilities, feat } : undefined
  const roll = useRoll ? Math.floor(Number(rolled)) : undefined
  const rollOk = !useRoll || (Number.isFinite(roll) && roll! >= 1 && roll! <= cls.hit_die)
  const asiOk = !asi || asiValid(c.abilities, asi)
  const ready = rollOk && asiOk
  const preview = levelUp(c, { cls, row, hpRoll: useRoll && rollOk ? roll : undefined, asi: asi && asiOk ? asi : undefined })
  const pb = proficiencyBonus(next)
  const xpLevel = levelForXp(c.xp ?? 0)

  const setAbility = (i: number, a: Ability) => setAbilities((cur) => cur.map((x, j) => (j === i ? a : x)))

  const apply = async () => {
    if (!ready) return
    setBusy(true)
    await updateCharacter(c.id!, preview.character)
    if (isDm) {
      // a note for the DM's journal; a player's device does not keep one (the journal belongs to the DM)
      const parts = [
        t('lvl.jHp', { n: preview.hpGain }),
        asi && asi.kind !== 'feat' ? t('lvl.jAsi', { text: asiText(asi) }) : '',
        asi?.kind === 'feat' ? t('lvl.jFeat', { name: feat.trim() }) : '',
        features.length ? t('lvl.jNew', { names: features.join(', ') }) : '',
      ].filter(Boolean)
      await addEntry('note', t('lvl.journalTitle', { name: c.name, n: next }), parts.join(' '))
    }
    onClose()
  }

  return (
    <Frame
      c={c}
      onClose={onClose}
      actions={
        <>
          <button onClick={onClose}>{t('common.cancel')}</button>
          <button className="primary" disabled={!ready || busy} onClick={() => void apply()}>
            {t('lvl.apply')}
          </button>
        </>
      }
    >
      <div className="lu-hero">
        <div className="lu-levels" aria-label={t('lvl.from', { from: c.level, to: next })}>
          <span className="lu-lv">{c.level}</span>
          <span className="lu-arrow" aria-hidden="true">
            →
          </span>
          <span className="lu-lv next">{next}</span>
        </div>
        <div className="lu-notes">
          {pb !== proficiencyBonus(c.level) && <span className="lu-chip">{t('lvl.pbRises', { n: `+${pb}` })}</span>}
          {xpLevel < next && (c.xp ?? 0) > 0 && <span className="lu-chip warn">{t('lvl.notReady', { n: xpLevel })}</span>}
        </div>
      </div>

      <section className="lu-card">
        <h4>
          <span aria-hidden="true">✨</span> {t('lvl.features')}
        </h4>
        {features.length ? (
          <ul className="lu-features">
            {features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('lvl.noFeatures')}</p>
        )}
      </section>

      <section className="lu-card">
        <h4>
          <span aria-hidden="true">❤</span> {t('lvl.hp')}
        </h4>
        <div className="lu-choices">
          <label className="lu-choice">
            <input type="radio" name={`hp-${c.id}`} checked={!useRoll} onChange={() => setUseRoll(false)} />
            <strong>{t('lvl.hpAverage', { n: averageRoll(cls.hit_die) })}</strong>
          </label>
          <label className="lu-choice">
            <input type="radio" name={`hp-${c.id}`} checked={useRoll} onChange={() => setUseRoll(true)} />
            <strong>{t('lvl.hpRoll', { die: cls.hit_die })}</strong>
          </label>
        </div>
        {useRoll && (
          <div className="lu-pickers">
            <input className="narrow" type="number" min={1} max={cls.hit_die} value={rolled} placeholder={t('lvl.hpRollHint', { die: cls.hit_die })} aria-label={t('lvl.hpRoll', { die: cls.hit_die })} onChange={(e) => setRolled(e.target.value)} />
            {settings.allowPlayerAppRolls && <button onClick={() => setRolled(String(rollDie(cls.hit_die)))}>🎲</button>}
          </div>
        )}
        {ready && (
          <p className="lu-result">
            ❤ {t('lvl.hpResult', { n: preview.hpGain, max: preview.character.maxHp })}
            {preview.conRetro > 0 && ` ${t('lvl.conRetro', { n: preview.conRetro })}`}
          </p>
        )}
      </section>

      {needsAsi && (
        <section className="lu-card">
          <h4>
            <span aria-hidden="true">📈</span> {t('lvl.asi')}
          </h4>
          <div className="lu-choices">
            {(['two', 'split', 'feat'] as const).map((k) => (
              <label key={k} className="lu-choice">
                <input type="radio" name={`asi-${c.id}`} checked={kind === k} onChange={() => setKind(k)} />
                <strong>{t(k === 'two' ? 'lvl.asiTwo' : k === 'split' ? 'lvl.asiSplit' : 'lvl.asiFeat')}</strong>
              </label>
            ))}
          </div>
          {kind !== 'feat' && (
            <div className="lu-pickers">
              {abilities.slice(0, kind === 'two' ? 1 : 2).map((a, i) => (
                <label key={i} className="inline-field">
                  {t('lvl.ability')}
                  <select value={a} onChange={(e) => setAbility(i, e.target.value as Ability)}>
                    {ABILITIES.map((x) => (
                      <option key={x} value={x} disabled={c.abilities[x] + (kind === 'two' ? 2 : 1) > MAX_ABILITY}>
                        {tAbility(x)} {c.abilities[x]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          {kind === 'feat' && (
            <label className="field">
              <span>{t('lvl.featName')}</span>
              <input value={feat} onChange={(e) => setFeat(e.target.value)} />
            </label>
          )}
          <p className="muted note-line">{t('lvl.asiMax')}</p>
        </section>
      )}

      <p className="muted note-line">{t('lvl.after')}</p>
    </Frame>
  )
}

function Frame({ c, onClose, actions, children }: { c: Character; onClose: () => void; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Window large bodyClass="levelup" title={t('lvl.title', { name: c.name })} onClose={onClose} actions={actions ?? <button onClick={onClose}>{t('common.cancel')}</button>}>
      {children}
    </Window>
  )
}
