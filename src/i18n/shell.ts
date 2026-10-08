import type { Msg } from './types'

/** Navigation, footer, shared button words and the Settings page. */
export const shell = {
  // shared words
  'common.cancel': ['Cancel', 'Avbryt'],
  'common.save': ['Save', 'Spara'],
  'common.delete': ['Delete', 'Radera'],
  'common.edit': ['Edit', 'Redigera'],
  'common.remove': ['Remove', 'Ta bort'],
  'common.done': ['Done', 'Klar'],
  'common.ok': ['OK', 'OK'],
  'common.dismiss': ['Dismiss', 'Avfärda'],
  'common.clear': ['Clear', 'Rensa'],
  'common.add': ['Add', 'Lägg till'],
  'common.name': ['Name', 'Namn'],
  'common.notes': ['Notes', 'Anteckningar'],
  'common.none': ['- none -', '- ingen -'],
  'common.noMatches': ['No matches', 'Inga träffar'],
  'common.search': ['Search…', 'Sök…'],
  'common.undo': ['undo', 'ångra'],
  'common.untitled': ['Untitled', 'Namnlös'],
  'common.unnamed': ['Unnamed', 'Namnlös'],

  // top bar and footer
  'app.brand': ["Dungeon Master's Companion", 'Dungeon Masterns följeslagare'],
  'app.logoAlt': ['D&D Companion', 'D&D Companion'],
  'nav.combat': ['⚔ Combat', '⚔ Strid'],
  'nav.party': ['🛡 Party', '🛡 Sällskap'],
  'nav.bestiary': ['🐉 Bestiary', '🐉 Bestiarium'],
  'nav.encounters': ['📜 Encounters', '📜 Möten'],
  'nav.journal': ['📖 Journal', '📖 Dagbok'],
  'nav.settings': ['⚙ Settings', '⚙ Inställningar'],
  'nav.watching': ['📡 {n} watching', '📡 {n} tittar'],
  'nav.watchingTitle': ['Live view: click for the address and QR code', 'Livevy: klicka för adressen och QR-koden'],
  'footer.dataFrom': ['Class, spell and monster data from the ', 'Klass-, besvärjelse- och monsterdata från '],
  'footer.api': ['5e SRD API', '5e SRD API'],
  'footer.legal': [
    '. This work includes material from the System Reference Document 5.2 by Wizards of the Coast LLC, available at dndbeyond.com/srd and licensed under ',
    '. This work includes material from the System Reference Document 5.2 by Wizards of the Coast LLC, available at dndbeyond.com/srd and licensed under ',
  ],
  'footer.license': ['CC BY 4.0', 'CC BY 4.0'],

  // reference library status (footer)
  'lib.savedSpells': ['Spell and class library saved offline ({spells} spells).', 'Besvärjelse- och klassbiblioteket är sparat offline ({spells} besvärjelser).'],
  'lib.saved.plain': ['Spell and class library saved offline.', 'Besvärjelse- och klassbiblioteket är sparat offline.'],
  'lib.failed': [
    "Spell and class library not downloaded yet (offline?). It will retry when you're back online.",
    'Besvärjelse- och klassbiblioteket är inte nedladdat än (offline?). Det försöker igen när du är online.',
  ],
  'lib.downloading': ['Downloading the spell and class library… {pct}%', 'Laddar ner besvärjelse- och klassbiblioteket… {pct}%'],
  'lib.preparing': ['Preparing the spell and class library…', 'Förbereder besvärjelse- och klassbiblioteket…'],

  // Settings
  'settings.title': ['Settings', 'Inställningar'],
  'settings.language': ['Language', 'Språk'],
  'settings.languageLabel': ['Interface language', 'Språk i gränssnittet'],
  'settings.languageNote': [
    "Everyone sees this language, including the players' screens. Spell, monster and item names are not translated.",
    'Alla ser det här språket, även spelarnas skärmar. Namn på besvärjelser, monster och föremål översätts inte.',
  ],
  'settings.dice': ['Dice', 'Tärningar'],
  'settings.diceLabel': ['Let the app roll dice for player characters', 'Låt appen slå tärningar för spelarkaraktärer'],
  'settings.diceTitle': ['Off: players roll their own dice and tell you the number', 'Av: spelarna slår sina egna tärningar och säger vilket tal det blev'],
  'settings.diceOn': [
    'On: roll buttons also appear for player characters (attacks, damage, saves, initiative, hit dice).',
    'På: slåknappar visas även för spelarkaraktärer (attacker, skada, rädda, initiativ, träffpoängstärningar).',
  ],
  'settings.diceOff': [
    'Off (recommended): players always throw their own dice. The app only shows their bonuses and DCs, and you type in the number they rolled. Monsters are yours, so their dice can always be rolled in the app.',
    'Av (rekommenderas): spelarna slår alltid sina egna tärningar. Appen visar bara deras bonusar och svårigheter, och du skriver in talet de slog. Monstren är dina, så deras tärningar kan alltid slås i appen.',
  ],
  'settings.backup': ['Backup & restore', 'Säkerhetskopia och återställning'],
  'settings.backupNote': [
    'Everything lives in this browser. A backup is one file with your characters (with portraits), custom monsters, saved encounters and campaign progress. Keep a copy somewhere safe.',
    'Allt finns i den här webbläsaren. En säkerhetskopia är en enda fil med dina karaktärer (med porträtt), egna monster, sparade möten och kampanjens framsteg. Spara en kopia på ett säkert ställe.',
  ],
  'settings.download': ['⬇ Download backup', '⬇ Ladda ner säkerhetskopia'],
  'settings.restore': ['⬆ Restore from a backup…', '⬆ Återställ från en säkerhetskopia…'],
  'settings.neverBackedUp': ['You have never made a backup.', 'Du har aldrig gjort en säkerhetskopia.'],
  'settings.backupToday': ['Last backup: today.', 'Senaste säkerhetskopia: idag.'],
  'settings.backupDays.one': ['Last backup: {count} day ago.', 'Senaste säkerhetskopia: för {count} dag sedan.'],
  'settings.backupDays.other': ['Last backup: {count} days ago.', 'Senaste säkerhetskopia: för {count} dagar sedan.'],
  'settings.saved': [
    'Saved {file}: {characters} characters, {monsters} custom monsters, {encounters} encounters, {journal} journal entries.',
    'Sparade {file}: {characters} karaktärer, {monsters} egna monster, {encounters} möten, {journal} dagboksinlägg.',
  ],
  'settings.restoreConfirm': [
    'Restore this backup? It REPLACES your current characters, custom monsters, encounters, journal and the current fight.',
    'Återställa den här säkerhetskopian? Den ERSÄTTER dina nuvarande karaktärer, egna monster, möten, dagbok och den pågående striden.',
  ],
  'settings.restored': [
    'Restored {characters} characters, {monsters} custom monsters, {encounters} encounters and {journal} journal entries.',
    'Återställde {characters} karaktärer, {monsters} egna monster, {encounters} möten och {journal} dagboksinlägg.',
  ],
  'settings.badJson': ["That file isn't valid JSON.", 'Filen är inte giltig JSON.'],
  'settings.notBackup': ["That doesn't look like a D&D Companion backup file.", 'Det där ser inte ut som en säkerhetskopia från D&D Companion.'],
  'settings.newerBackup': ['This backup was made by a newer version of the app.', 'Säkerhetskopian är gjord av en nyare version av appen.'],
  'settings.live': ['Live view on phones & TV', 'Livevy på mobiler och TV'],
  'settings.liveOff': [
    "The live relay isn't available here. Start the app with {dev} (or {live} for a faster, built copy) on the computer you run the game from and open it in your browser.",
    'Live-reläet finns inte här. Starta appen med {dev} (eller {live} för en snabbare, byggd kopia) på datorn du spelar från och öppna den i webbläsaren.',
  ],
  'settings.liveNote': [
    'Anyone on the same Wi-Fi who opens the address below sees the player view live: the turn order, the party\'s HP, the monsters\' status (never their exact HP or AC), conditions, and short announcements like "Goblin 1 hits Xaroz".',
    'Alla på samma Wi-Fi som öppnar adressen nedan ser spelarvyn live: turordningen, sällskapets HP, monstrens status (aldrig exakt HP eller AC), tillstånd och korta meddelanden som "Goblin 1 träffar Xaroz".',
  ],
  'settings.liveOn': ['● Live', '● Live'],
  'settings.liveConnecting': ['… Connecting', '… Ansluter'],
  'settings.liveNot': ['○ Not connected', '○ Inte ansluten'],
  'settings.viewers.one': ['{count} viewer connected', '{count} tittare ansluten'],
  'settings.viewers.other': ['{count} viewers connected', '{count} tittare anslutna'],
  'settings.network': ['Network', 'Nätverk'],
  'settings.openUrl': ['Open {url} on a phone, tablet or TV connected to the same Wi-Fi.', 'Öppna {url} på en mobil, surfplatta eller TV på samma Wi-Fi.'],
  'settings.firewall': [
    "If a device can't connect, allow Node.js through the Windows firewall for private networks. There is no password: only use this on a network you trust.",
    'Om en enhet inte kan ansluta, tillåt Node.js genom Windows brandvägg för privata nätverk. Det finns inget lösenord: använd bara detta på ett nätverk du litar på.',
  ],
  'settings.qrAlt': ['QR code for {url}', 'QR-kod för {url}'],
  'settings.library': ['Reference library', 'Referensbibliotek'],
  'settings.libraryStored': [
    'Saved on this device: {spells} spells, {monsters} monsters, every class table and the condition rules. It works offline.',
    'Sparat på den här enheten: {spells} besvärjelser, {monsters} monster, alla klasstabeller och tillståndsreglerna. Det fungerar offline.',
  ],
  'settings.libraryLoading': [
    'Downloading the spell, monster and class library in the background (first launch only)…',
    'Laddar ner besvärjelse-, monster- och klassbiblioteket i bakgrunden (bara vid första start)…',
  ],
} as const satisfies Record<string, Msg>
