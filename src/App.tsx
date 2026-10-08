import { useEffect, useState } from 'react'
import logo from './assets/images/logo-128.png'
import { SpellLibraryStatus } from './components/SpellLibraryStatus'
import { SpotlightBar } from './components/SpotlightBar'
import { useHash } from './hooks'
import { LiveHost, useHubStatus } from './lib/hub'
import { setLang, t } from './lib/i18n'
import { useStoredLanguage } from './lib/settings'
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
  const [tab, setTabState] = useState<Tab>(lastTab)
  const setTab = (next: Tab) => {
    lastTab = next
    setTabState(next)
  }
  const hub = useHubStatus()
  // the DM's saved language (the live view follows the DM through the relay instead; see PlayerView)
  const stored = useStoredLanguage()
  useEffect(() => {
    if (stored && hash !== '#player') setLang(stored)
  }, [stored, hash])

  if (hash === '#player') return <PlayerView />

  return (
    <>
      <LiveHost />
      <nav>
        <img className="nav-logo" src={logo} alt={t('app.logoAlt')} />
        <span className="brand">{t('app.brand')}</span>
        {hub.state === 'live' && (
          <button className="live-badge" onClick={() => setTab('settings')} title={t('nav.watchingTitle')}>
            {t('nav.watching', { n: hub.viewers })}
          </button>
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
