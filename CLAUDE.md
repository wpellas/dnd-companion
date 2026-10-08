# CLAUDE.md

Guidance for Claude Code when working in this repo. Keep it current as the project evolves.

## What this is

A DM companion web app for running D&D 5e (**2024 rules**) combat at the table. The DM enters the party, adds monsters from the
SRD bestiary, and runs initiative / turns / HP / conditions / spells / rests. A read-only **player view** goes on the table's TV
or on players' phones over the local network.

**Dice policy (important):** players always roll their own dice. The app supplies bonuses, DCs, resistances and bookkeeping and
the DM *types in* the number a player rolled. App dice buttons exist only for monsters (the DM's dice). Rolling for player
characters is a setting (`allowPlayerAppRolls`, default **off**); respect it everywhere a die could be rolled (use
`canAppRoll(kind, settings)` from `lib/settings.ts`). "Automatic" features must stay rules assistance (advantage hints, auto-fail
saves, bonuses), never rolling for a player.

Scope is combat-relevant stats, not full character sheets. Longer-term (not built yet): level-up helper, battle map with tokens, players logging in as their characters.

## Commands

Package manager is **pnpm** (not npm).

- `pnpm dev` - dev server (listens on the LAN; includes the live-view relay)
- `pnpm build` - `tsc -b` + production build (use this to type-check; also type-checks `server/`)
- `pnpm lint` - oxlint
- `pnpm live` - build then `vite preview --port 4173` (also includes the relay)

## Stack

Vite + React 19 + TypeScript (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly` - use `import type`, no enums or constructor
parameter properties). Dexie (IndexedDB) for storage. Plain CSS in `src/index.css`. No router, no state library. The only server
code is `server/hubPlugin.ts` (a Vite plugin: WebSocket relay for the live view, uses `ws`). `qrcode` renders the Settings QR.

## Architecture

### Data and storage
- `src/types.ts` - all data models. `src/db.ts` - Dexie schema (**v5**; inventory fields live on `Character` and need no migration). Tables: `characters`, `monsters` (custom monsters only),
  `combat` (one record, id `'current'`), `kv` (key/value: `api:*` = cached SRD API responses, plus `settings`, `campaign`,
  `lastBackup`), `encounters`, `journal` (DM-only notes, session recaps, combat summaries).
- **Migrations:** schema/data changes need a new `this.version(n)` with `.upgrade()` (v2 actions, v3 class/hit dice/resources + `kv`,
  v4 encounters + save proficiencies + resistances, SRD monsters dropped from the table, v5 journal). Stored records can predate new fields:
  read optional fields defensively (`?? []`) and use `normalizeCharacter` / `normalize()` in `mutateCombat`.
- Live queries only see writes made through Dexie in the same tab; raw `indexedDB` writes (test scripts) need a page reload.

### Reference library (SRD API)
- `src/lib/srdApi.ts` - cache-first client for `https://www.dnd5eapi.co/api/2024` (CORS open, no key). Responses are cached forever in
  `kv` under `api:*`. `ensureLibrary()` downloads everything once in the background after launch (339 spells, 12 classes + spell lists,
  240 class level tables, 341 monsters, 15 conditions, 182 equipment entries, 262 magic items) and writes the `api:sync:library-v4` flag, after which the app makes no API
  requests. Started by `SpellLibraryStatus` (footer), Web-Lock guarded across tabs, retries on `online`. Bump the key's version to
  force a re-download when more data is added.
- `src/lib/monsters.ts` - `srdToTemplate()` turns an SRD monster into a `MonsterTemplate` (actions with attack/save/DC/area/range, `multiattack` rows from the structured
  Multiattack list incl. its "choose one of" extras, `spells` + `casting` (DC / attack bonus) from the Spellcasting action,
  multi-type damage via `extraDamage`, optional extras for "if the attack roll had Advantage" and rider saves, recharge / per-day
  `limited`, legendary actions, traits with counters, saves, resistances). Tested on all 341 monsters. `monsterLibrary.ts` has the hooks
  (`useSrdMonsters`, `useCustomMonsters`).
- SRD content is CC-BY-4.0: keep the attribution footer in `App.tsx`.

### Combat engine (pure-ish; no React)
- `src/lib/combat.ts` - everything that changes a fight, as functions on a `CombatState` run inside `mutateCombat(fn, label?)`
  (read-modify-write transaction that also records an **undo** step). Key pieces: `pcCombatant` / `monsterCombatants` / `lairCombatant`,
  `startCombat` / `advanceTurn` (resets the next creature's action/bonus/reaction trackers and legendary uses, queues recharge
  prompts), `dealDamage` (temp HP, death-save failures, Unconscious, massive damage, concentration prompts), `healTarget`,
  `applyResolution` / `resolveAction` (multi-target, logs one line, public announcements, trackers, limited-use bookkeeping),
  `settleConcentration` / `settleRecharge`, `undoCombat`, `endCombat` (writes PC HP and Exhaustion back to characters and writes the journal
  summary). Turn-order extras: `rollAllMonsterInitiative(s, grouped)` / `shareInitiative` (group initiative; kind = `templateRef.name`),
  `toggleSurprised` (Disadvantage on the initiative roll; cleared at `startCombat`), `delayTurn` (moves the active creature behind a later one by
  giving it that initiative and a `tieRank` between neighbours; `sortCombatants` breaks ties by `tieRank ?? -initiativeBonus`), `setExhaustion`.
  `TargetOutcome.action` lets one resolution carry several different attacks (Multiattack, rays) with their own names/conditions;
  `cast.monsterSpell` counts a monster's per-day casts in `spent['spell:<index>']`.
- **Undo snapshots are deep copies** (`structuredClone`), with `actions` stripped to stay small (restored from the live combatant, or from
  `restoreActions` for combatants a change removed). A shallow snapshot shares nested objects with live state and silently breaks undo.
  Spell casts store a slot `refund`.
- `src/lib/resolve.ts` - pure: damage by type adjusted for resistance / immunity / vulnerability (`adjustForTarget`: save-half first, then
  resistances; both resistance and vulnerability = halve then double), `saveBonus`, `buildSaves`, `actionDamageParts`.
- `src/lib/volley.ts` + `components/turn/AttackSequence.tsx` - several separate attacks (Scorching Ray, Magic Missile, Eldritch Blast via the
  `VOLLEYS` table in `spells.ts`, and monster Multiattack): `Step`s -> per-row `evaluateRow` (outcome, damage after defences, Exhaustion
  penalty), one `TargetOutcome` per attack. `Action.volley` / `Action.multiattack` drive it from `TurnPanel`.
- `src/lib/conditionRules.ts` - pure: effects of the 15 conditions taken from the official condition texts (advantage hints
  `attackAdvice`, `autoFailsSave`, crit-within-5-ft, Petrified = resist all, reminders) plus Exhaustion (`exhaustionPenalty` = 2 per level, applied by
  `saveBonus` and the attack resolvers). Never rolls.
- `src/lib/rules.ts`, `dice.ts` - attack outcome (nat 1/20), d20 rolling with adv/dis, dice expression parse/roll (crit doubles dice only).
- `src/lib/spells.ts` - `spellToAction()` (API `attack_type` / `damage_at_slot_level`; save ability, half-on-save, healing, condition read
  from the description), cantrip / upcast scaling, slot helpers. Unreadable spells become `kind: 'other'`.
- `src/lib/character.ts` - proficiency bonus, `deriveAction` (actions "from my stats"), `mergeClassTable` (class table -> slots / limits, only
  while `spellcasting.auto`), `castingSnapshot`. `rest.ts` + `store.ts` - rest rules and DB mutations (`spendSlot`, rests, campaign counters). `shortRestRecoveries` / `RecoveryChoice`:
  Arcane Recovery, Natural Recovery (slots, budget = half level rounded up, max 5th) and Sorcerous Restoration (points, half level rounded down);
  a long rest takes one Exhaustion level off. After a rest `store.ts` refreshes the idle fight's PC entries (combatants are snapshots).
- `src/lib/journal.ts` + `pages/JournalPage.tsx` - the DM journal (kinds note / session / combat / loot); `addCombatSummary` runs from `endCombat`. Never sent to the player view.
- `src/lib/inventory.ts` (pure) - `Item` rules: `armorClass(c)` (best body armor + shield + AC magic items, unarmored 10 + Dex, Barbarian / Monk Unarmored Defense),
  `withGearAc` (keeps `ac` in step when `Character.acFromGear`), `weaponActions(c)` (equipped weapons -> attack actions with `ability` / `proficient` /
  `magicBonus`, so `deriveAction` resolves them; `resolveCharacterActions` appends them), coins, carry weight, XP table (`levelForXp`, `canLevelUp`), `splitEvenly`,
  `itemFromEquipment` / `itemFromMagicItem` (SRD -> `Item`). `itemCatalog.ts` = picker entries from the cached SRD library. Saves that change gear go
  through `store.updateCharacter` (re-derives AC); the character form's `update` does the same.
- `src/lib/rewards.ts` - `endCombat` stores the finished fight's XP in `kv.lastFight`; `RewardBanner` (Combat + Party pages) hands it out via `awardLastFight`;
  `AwardPanel` / `awardRewards` split XP and gold evenly and write a `loot` journal entry. `components/InventoryEditor.tsx` is shared by the card and the form.
- `src/lib/id.ts` - `newId()`: use it instead of `crypto.randomUUID()`, which doesn't exist on plain-http LAN addresses (the DM often opens the app that way).
- `src/lib/encounters.ts` + `src/data/encounterBudget.ts` - 2024 XP budgets (verified against the published table) and difficulty rating;
  CR -> XP table (defaults for custom monsters). `src/data/classFeatures.ts` - catalog of limited-use SRD class features.
- `src/lib/settings.ts`, `backup.ts` (whole-app JSON export/import, journal included; the SRD library is not included; restore keeps `api:*` and `lastBackup`).

### Live view (`server/hubPlugin.ts`, `lib/hub.ts`, `lib/publicState.ts`)
The DM's browser (`LiveHost`, rendered in `App`) pushes `toPublic(combat)` and shrunken portraits over a WebSocket (`/hub?role=host`) to the
Vite relay, which keeps the latest of each in memory and forwards to viewers (`/hub?role=viewer`, used by `PlayerView` via `useRemoteView`).
**`toPublic()` is the privacy boundary:** monsters carry only a status (Healthy / Bloodied / Defeated) - never HP, AC, saves, actions, the DM
log, prompts or undo history. Add fields there deliberately. The relay ignores any URL but `/hub` so Vite's own HMR socket keeps working.
`PlayerView` prefers relay data and falls back to the local database (the DM's second window).

### UI
- Pages: `CombatPage`, `PartyPage`, `BestiaryPage`, `EncountersPage`, `JournalPage`, `SettingsPage`, `PlayerView`.
- `TurnPanel` (+ `components/turn/AttackResolver`, `SaveResolver`, `DamageEntry`, `useDamageEntry`) - action -> target(s) -> d20s -> damage ->
  `resolveAction`. Mounted with `key={round-turnIndex-activeId}` (the id matters because a delay changes who is up without changing the index) so local state resets each turn; inner resolvers are re-keyed per action/target.
- Others: `Combobox` (searchable grouped dropdown with keyboard support: use it instead of `<select>` for long lists), `Section` / `CheckField`
  (form building blocks), `ActionsEditor`, `SpellcastingEditor`, `SpellPicker`, `ResourcesEditor`, `RestPanel`, `UsePips`, `DamageTypeList`,
  `Portrait`, `NumberField`, `InitiativeInput`, `SpellLibraryStatus`.

## Key design decisions

- **Combat state lives in Dexie, not React state.** Views use `useLiveQuery`; Dexie syncs tabs, which keeps the second-window player view live.
- **Combatants are snapshots**: joining a fight copies stats / actions / saves / resistances; later edits to a character or template don't change a
  running fight. Spell slots and class-feature uses live on the `Character` (they persist across fights and rests).
- Defeated monsters are skipped in turn order; PCs at 0 HP are not (death saves). Rests are only allowed outside a fight.
- Editing an SRD monster saves a custom copy; the SRD library is never modified.
- Resolution helpers return log text AND player-safe "events" (`announce`): public lines mention damage numbers only for PC targets.

## Look & feel

RPG theme from `src/assets/images/logo.png` (don't import the 2.3 MB original; use `logo-128.png` / `logo-360.png`, `public/favicon.png`). Palette
is CSS variables at the top of `src/index.css`: dragon red, parchment, gold, leather brown on dark wood.
- DM screens are a parchment `.page`; the player view is the inverse (parchment cards on wood) for TV readability and phones (it has a mobile layout).
- Fonts are bundled via `@fontsource` (Cinzel, Alegreya) so the app works offline. No CDN fonts.
- Reuse classes (`.card`, `.chip`, `.primary`, `.danger`, `.field`) rather than one-off colours. Inside `.card`, `<strong>` is coloured dark red:
  badges need an explicit rule (see `strong.diff`).
- **Forms:** `Section` + `.field-grid` (`span-2` to widen) + `CheckField` for checkboxes (a bare checkbox inside `.field` is stretched). Repeating rows are
  `.item-card`s with `.item-top`. Save/Cancel is `.form-actions` (sticky).
- `.chips > .muted:first-child` is the fixed-width row label in the turn panel; other muted text there needs its own class (see `.area-hint`).

## Gotchas / conventions

- **Number inputs:** never bind `valueAsNumber` straight into persisted state (`NaN` while typing). Use `NumberField` (text draft, new outside values win) and
  `InitiativeInput` (commits on blur/Enter).
- Hooks must run before early returns in components (`TurnPanel` computes everything before `if (!active) return`).
- Image blobs are stored on `Character.image`; show them with `useBlobUrl` / `Portrait`.
- Match the style: no semicolons, single quotes, small focused components, comments that explain *why*.

## Testing

No test framework is installed; checks were done with throwaway scripts: pure logic via `pnpm dlx tsx file.mts` (importing from `src/lib/*.ts` with
`file:///` URLs; avoid importing `db`-touching modules where possible), and the UI by driving headless Edge over the DevTools protocol against
`pnpm preview` (seed IndexedDB, click through, assert on the DOM / database / relay messages). If a test framework is added, port those checks
(monster parser on all 341 monsters incl. Multiattack and spell lists, class-table merge, rests and slot recovery, damage / resistance / condition rules,
volleys, delay and group initiative, Exhaustion, undo, relay privacy). Headless Edge launched for these tests outlives `proc.kill()`: kill leftover
`msedge.exe` processes whose command line has your throwaway profile before the next run, or the debugging port will refuse.

## TODO / ideas

- Longer-term (agreed): level-up helper, battle map with tokens, players logging in as their own characters. (Session notes, equipment,
  inventory, gold and XP are built: Journal tab, 🎒 Items on the party card.)
- Riders that need a second save as a flow; monster spells the API can't describe (Shield...).
- Subclass-granted spells, ritual casting, non-SRD content import, Speed tracking (Exhaustion's speed penalty is only a reminder).
- More per-attack multi-hit spells can be added to `VOLLEYS` in `spells.ts` (hexblade, Spiritual Weapon etc. aren't).
