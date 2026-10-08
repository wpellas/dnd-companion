import { useState } from 'react'
import logo from './assets/images/logo-128.png'
import { SpellLibraryStatus } from './components/SpellLibraryStatus'
import { useHash } from './hooks'
import { LiveHost, useHubStatus } from './lib/hub'
import { BestiaryPage } from './pages/BestiaryPage'
import { CombatPage } from './pages/CombatPage'
import { EncountersPage } from './pages/EncountersPage'
import { JournalPage } from './pages/JournalPage'
import { PartyPage } from './pages/PartyPage'
import { PlayerView } from './pages/PlayerView'
import { SettingsPage } from './pages/SettingsPage'

type Tab = 'combat' | 'party' | 'bestiary' | 'encounters' | 'journal' | 'settings'

const TAB_LABEL: Record<Tab, string> = {
  combat: '⚔ Combat',
  party: '🛡 Party',
  bestiary: '🐉 Bestiary',
  encounters: '📜 Encounters',
  journal: '📖 Journal',
  settings: '⚙ Settings',
}

export default function App() {
  const hash = useHash()
  const [tab, setTab] = useState<Tab>('combat')
  const hub = useHubStatus()

  if (hash === '#player') return <PlayerView />

  return (
    <>
      <LiveHost />
      <nav>
        <img className="nav-logo" src={logo} alt="D&D Companion" />
        <span className="brand">Dungeon Master's Companion</span>
        {hub.state === 'live' && (
          <button className="live-badge" onClick={() => setTab('settings')} title="Live view: click for the address and QR code">
            📡 {hub.viewers} watching
          </button>
        )}
        <div className="tabs">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button key={t} className={t === tab ? 'selected' : ''} onClick={() => setTab(t)}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      </nav>
      {tab === 'combat' && <CombatPage goTo={(t) => setTab(t)} />}
      {tab === 'party' && <PartyPage />}
      {tab === 'bestiary' && <BestiaryPage />}
      {tab === 'encounters' && <EncountersPage goTo={(t) => setTab(t)} />}
      {tab === 'journal' && <JournalPage />}
      {tab === 'settings' && <SettingsPage />}
      <footer className="attribution">
        <div className="sync-status">
          <SpellLibraryStatus />
        </div>
        Class, spell and monster data from the{' '}
        <a href="https://www.dnd5eapi.co" target="_blank" rel="noreferrer">
          5e SRD API
        </a>
        . This work includes material from the System Reference Document 5.2 by Wizards of the Coast LLC, available at
        dndbeyond.com/srd and licensed under{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
          CC BY 4.0
        </a>
        .
      </footer>
    </>
  )
}
