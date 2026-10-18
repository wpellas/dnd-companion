import { useEffect, useState } from 'react'
import logo from './assets/images/logo-128.png'
import { SpellLibraryStatus } from './components/SpellLibraryStatus'
import { SpotlightBar } from './components/SpotlightBar'
import { useHash } from './hooks'
import { LiveHost } from './lib/hub'
import { setLang, t } from './lib/i18n'
import { useStoredLanguage } from './lib/settings'
import { useFightSync } from './lib/store'
import { useSyncStatus } from './lib/sync'
import { BestiaryPage } from './pages/BestiaryPage'
import { CombatPage } from './pages/CombatPage'
import { EncountersPage } from './pages/EncountersPage'
import { JournalPage } from './pages/JournalPage'
import { PartyPage } from './pages/PartyPage'
import { PlayerView } from './pages/PlayerView'
import { SettingsPage } from './pages/SettingsPage'

type Tab = 'combat' | 'party' | 'bestiary' | 'encounters' | 'journal' | 'settings'

const TABS: Tab[] = ['combat', 'party', 'bestiary', 'encounters', 'journal', 'settings']

/** Remembered outside the component: changing the language re-creates the UI, and you should stay on the Settings tab. */
let lastTab: Tab = 'combat'

export default function App() {
  const hash = useHash()
  const [tab, setTab] = useState<Tab>(lastTab)
  useEffect(() => {
    lastTab = tab
  }, [tab])
  const sync = useSyncStatus()
  // the DM's saved language (viewers get it with the live view instead; see PlayerView)
  const stored = useStoredLanguage()
  useEffect(() => {
    if (stored && hash !== '#player') setLang(stored)
  }, [stored, hash])

  useFightSync(hash !== '#player')

  if (hash === '#player') return <PlayerView />

  return (
    <>
      <LiveHost />
      <nav>
        <img className="nav-logo" src={logo} alt={t('app.logoAlt')} />
        <span className="brand">{t('app.brand')}</span>
        {sync.state === 'offline' && (
          <span className="sync-warn" title={t('acct.syncOffline', { n: sync.pending })}>
            ⚠
          </span>
        )}
        <div className="tabs">
          {TABS.map((id) => (
            <button key={id} className={id === tab ? 'selected' : ''} onClick={() => setTab(id)}>
              {t(`nav.${id}`)}
            </button>
          ))}
        </div>
      </nav>
      <SpotlightBar />
      {tab === 'combat' && <CombatPage goTo={(to) => setTab(to)} />}
      {tab === 'party' && <PartyPage />}
      {tab === 'bestiary' && <BestiaryPage />}
      {tab === 'encounters' && <EncountersPage goTo={(to) => setTab(to)} />}
      {tab === 'journal' && <JournalPage />}
      {tab === 'settings' && <SettingsPage />}
      <footer className="attribution">
        <div className="sync-status">
          <SpellLibraryStatus />
        </div>
        {t('footer.dataFrom')}
        <a href="https://www.dnd5eapi.co" target="_blank" rel="noreferrer">
          {t('footer.api')}
        </a>
        {t('footer.legal')}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
          {t('footer.license')}
        </a>
        .
      </footer>
    </>
  )
}
