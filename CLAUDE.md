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

Scope is combat-relevant stats, not full character sheets. Longer-term (not built yet): a battle map with tokens, loot generation after a fight.

## Commands

Package manager is **pnpm** (not npm).

- `pnpm dev` - Vite dev server (listens on the LAN; proxies `/api` to the backend)
- `pnpm build` - `tsc -b` + production build (use this to type-check; also type-checks `server/`)
- `pnpm lint` - oxlint
- `pnpm build` also puts the app in `backend/public`, which the Herd site serves (see Backend). `pnpm api` - optional `artisan serve` on port 8000 instead of Herd (set `API_URL` for `pnpm dev`)

## Stack

Vite + React 19 + TypeScript (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly` - use `import type`, no enums or constructor
parameter properties). Dexie (IndexedDB) for storage. Plain CSS in `src/index.css`. No router, no state library. There is no Node server: the only server
code is the Laravel backend in `backend/`. `qrcode` renders the Settings QR.

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

### Live view (`lib/hub.ts`, `lib/publicState.ts`, `backend/app/Http/Controllers/LiveController.php`)
The DM's browser (`LiveHost`, rendered in `App`) uploads parts to the server with `POST /campaigns/{id}/live` (`combat` = `toPublic(combat)`, `portraits` = shrunken data URLs, `sheet`, `lang`,
and a `ping` heartbeat every 20 s that drives "DM offline"); a part is re-sent only when its JSON changed, and a failed upload is retried on the next change or heartbeat. Viewers poll
`GET .../live?combat=3&lang=1` (every 1.5 s) with the versions they already have and get back only the parts that changed (`useRemoteView(source)`). Two sources: a signed-in member
(`{ campaignId }`, `PlayerHome`) and the TV's secret link (`{ token }`, route `#table/<token>`, `GET /table/{token}/live`, no login; `campaigns.view_token`, replaced by "Make a new link").
**`toPublic()` is the privacy boundary:** monsters carry only a status (Healthy / Bloodied / Defeated) - never HP, AC, saves, actions, the DM
log, prompts or undo history. Add fields there deliberately: the server stores the parts untouched and never strips anything.
`PlayerView` without a source (the DM's own `#player` window) reads the local database instead.
**Spotlight** (`lib/spotlight.ts`, kv `spotlight`): the DM can show one character's `PublicSheet` (`toPublicSheet` in `publicState.ts` - also part of the privacy
boundary: a player's own numbers only, inventory optional) as the `sheet` part; `PlayerView` renders `CharacterSheetView` instead of the feed while it is set.
It never touches combat state. `SpotlightBar` (in `App`) keeps a reminder on every DM tab.

### Effects, phone rolls, level-up, 2024 details
- **Effects with durations** (`types.ts` `Effect`, `Combatant.effects`; engine in `combat.ts`: `addEffect` / `endEffect` / `tickEffects` / `settleEffectSave` / `setConcentrating` /
  `endConcentrationEffects`; presets in `lib/effects.ts`; UI `components/EffectsEditor.tsx` in each combat row). A timer counts rounds down at the start or end of a chosen creature's turn (a minute = 10 rounds of the
  *caster's* turns); the optional repeat save queues an `effectSave` prompt at the affected creature's turn; ending an effect removes the condition it gave (unless another effect still gives it). `advanceTurn` ticks the end of the
  turn that finishes, `beginTurn` the start of the next. An effect added during the turn that would end it skips that turn's end. A concentration effect (`sourceId` + `concentration`) ends when the caster loses concentration,
  goes down, or starts another concentration spell (not the one that very cast made: `madeHere`). `applyResolution` creates the effect by itself when a spell named in `PRESETS` applies its condition (the DC is the action's save DC). Public:
  `PublicCombatant.effects` (names; rounds left only for PCs).
- **Players typing their d20** (`lib/rolls.ts`, `components/RollSender.tsx` / `RollsTray.tsx`, backend `RollController` + `player_rolls`): a player sends `initiative` (a total) / `attack` / `save` (the d20) for a character they own; the DM's
  sync pull carries them (`rolls`); `useSentRoll(characterId, kind)` fills the matching field (attack panel, save rows, concentration and effect-save prompts, initiative input) and consumes the roll. **Optional by design: nothing ever waits for it**
  (rolls older than 2 hours are dropped; the DM can always type the number). The app never rolls for a player here.
- **Spectator vs interactive** (`pages/PlayerHome.tsx`): a player's phone is a pure spectator screen by default (only the "It's your turn!" / "You're up next" banner from `PlayerView`, which needs no action). The "Interactive" switch (localStorage
  `dnd-companion:interactive`) adds My characters, the roll sender and a buzz on their turn. **Never make anything for players required.**
- **Level-up helper** (`lib/levelup.ts` pure + `components/LevelUpPanel.tsx`): from the SRD class level row (`features` names; an "Ability Score Improvement" / "Epic Boon" feature turns on the improvement step): hit points (average = die/2+1, or the
  player's roll) + Constitution modifier (at least 1), plus a retroactive amount for every earlier level when an improvement raises the Constitution modifier; initiative and Passive Perception follow Dexterity and Wisdom; slots, spell limits and class
  feature uses via `mergeClassTable` / `refreshResources`. A feat or boon is only noted (a journal entry for the DM), its rules are not applied.
- **2024 details:** Heroic Inspiration (`Character.heroicInspiration`, copied to `Combatant.inspired` by `useFightSync`, shown to the table); Weapon Mastery (`Item.weapon.masteryKnown` makes `weaponActions` set `Action.mastery`; `lib/mastery.ts` +
  `AttackResolver` show the property's effect on a hit, Graze also on a miss); cover (+2 / +5 AC) on the attack panel.

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

## Backend (`backend/`, Laravel 13, PHP 8.3, MySQL) and sync

Accounts + a server database, to be hosted on a PHP web hotel (Inleed: no Node, no WebSockets, so the live view **polls**). Phases: (1) accounts, campaigns,
invites **done**; (2) data on the server **done** (below); (3) live view by polling, player page and table-screen link **done**;
(4) players own and edit their characters **done**; (5) administration **done**.
- **Decisions:** the combat engine stays in the DM's browser; the DM client uploads the already-stripped `toPublic()` snapshot and players only read that (privacy
  boundary stays client-side). A character belongs to one campaign and one player account; players edit their own, the DM any in the campaign. Registration is **invite-only**.
  Any account can be DM of its own campaign (`campaign_user.role` = `dm` | `player`); `users.is_admin` marks the administrator.
- **API:** `routes/web.php` under `/api` (session cookie + CSRF, no Sanctum; `src/lib/api.ts` sends `X-XSRF-TOKEN` from the cookie), controllers in `app/Http/Controllers`,
  models `User` / `Campaign` / `Invite` / `Document`. Strangers get 404 for campaigns they are not in. Reset-password links open `APP_URL/#reset?token=..&email=..`.
- **The data is a mirror, not API calls.** The app still reads and writes Dexie everywhere. `src/db.ts`: `db` is a Proxy to the open campaign's local database
  (`dnd-companion-u<user>-c<campaign>`); `srdDb` is the old `dnd-companion` database, now only the SRD library cache (`api:*`) plus the user's pre-account data (see `lib/legacy.ts`).
  `src/lib/sync.ts` (one `Engine` per open campaign) marks records dirty with Dexie hooks, pushes them as JSON in chunks, polls `GET /sync?since=<rev>` every 2.5 s and applies
  what changed (skipping records with unsent local changes). Last write wins per record. Record equality (`sent` map) makes echoes harmless, so keep `toServer` / `fromServer`
  stable: a portrait Blob travels inside the character as `imageData` (360 px JPEG data URL) and the Blob built from it remembers that string. Local-only kv keys (`sync:*`, `api:*`,
  `lastBackup`) never sync. The combat record is synced **without its undo stack** (`history`: 25 snapshots, 5x the rest of a fight): undo stays on the device that made the changes, and a fight applied from the server starts with an empty stack. Offline edits wait in the dirty set, kept (with the cursor) in `kv['sync:state']`. After a restore/import call `resyncAll()` (pushes differences, then prunes
  what is gone on the server).
- **Ids:** records are created in the browser, so `prime()` moves each user's auto-increment counters to `userId * 1e9` (no collisions between people); imported records keep their old small ids.
- **Server:** `documents` (campaign, collection, key, owner, `data` = the JSON string stored untouched, tombstone flag, `rev`) and `campaigns.rev` (a counter every accepted push raises).
  `SyncController`: DM reads/writes everything; a player only their own `characters` (and `pull` tells a player which keys are theirs, `owned`, so a character the DM hands to someone else disappears
  from their device). Never decode `data` in PHP (`{}` would become `[]`).
- **Owners:** `documents.owner_id` is the account that owns a character (the pusher when it is created; only the DM can change it, to a member, by sending `owner_id`). Locally it is `Character.ownerId`,
  set from the server on every pull and **not part of the record JSON**; the sync signature (`sigOf` in `sync.ts`) is JSON + owner, so handing a character over counts as a change. The DM's character form
  has a "Player account" select (and fills `playerName` from the account); `PlayerHome` -> "My characters" is `PartyPage` in player mode (`campaign.role !== 'dm'` hides rests, awards, the reward banner, showcase).
- **Session / UI:** `lib/session.ts` (login, campaign choice, opens the local db and starts sync), `Root.tsx` decides auth page / campaign list / loading / app / player home;
  `#player` skips sign-in and opens the campaign this browser used last (`dnd-companion:who`). Server validation messages are English; the UI around them is translated.
- **Local setup:** Herd (PHP 8.3, MySQL), database `private_dnd_companion` (`utf8mb4_unicode_ci`), `backend/.env` (not committed; mail goes to Herd's mail service on port 2525).
  `cd backend && composer install && php artisan migrate --seed` (the seeder creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`). Link `backend/` as a Herd site (`APP_URL` in `.env` must match its address).
  **`pnpm build` writes the frontend into `backend/public`** (`vite.config.ts` `outDir`; the script first clears `public/assets`, and the build files are gitignored), and `routes/web.php` serves `index.html`
  at `/`: so Herd (and later Inleed) serves app and API from one place, no other process. `pnpm dev` also works: Vite proxies `/api` to `API_URL`, or by default to `APP_URL` from `backend/.env` (the Herd site; use
  `API_URL=http://127.0.0.1:8000` with `pnpm api` for artisan serve). Tests: `php artisan test` (in-memory SQLite, does not touch MySQL). Use `config('app.admin_email')`, never `env()`, outside `config/` (cached in production).
- **Changing e-mail or password** (Settings, `SignInDetails`): both need the current password. A new e-mail is *pending*: `PATCH /me/email` stores it in `email_changes` (one per user, secret stored as sha256, 60 minutes) and mails a link to the NEW address
  (`#confirm-email?token=..`, `ConfirmEmailPage`); `POST /confirm-email` (public, the secret is the only credential, so it works in another browser) applies it, re-checks that the address is still free and mails the OLD address a notice
  (`EmailChanged`). The mails are English only (Laravel's), like the reset mail.
- **Administration** (`pages/AdminPage.tsx`, route `#admin`, only for `users.is_admin`; linked from the campaign list and the Settings account card; `AdminController`, every route behind the `admin` middleware): site invites
  (make / list / revoke), accounts (send a reset link, lock = `users.disabled_at`, make or remove admin, delete), campaigns (delete) and the **admin log** (`admin_logs`: who, what, to whom; every change is written by `AdminController::log`, newest first, 50 per page). A locked account is signed out on its next request (`EnsureActive`, on every
  authenticated route) and cannot log in (`Auth::attempt` requires `disabled_at` null; the error is the same as a wrong password). The admin cannot lock, demote or delete themselves, and an account that is the
  only DM of a campaign cannot be deleted. The first administrator comes from the seeder.
- **Not done yet:** a player-only view of character sheets on the live table, an audit log, paging (the admin lists are not paged).
  On Inleed the web root is `/web` while Laravel's is `public/`: point the host at `public/` (or rename it) when deploying.

## Languages (i18n)

English and Swedish. The DM picks the language in Settings (`settings.language`, kv) and **everyone sees it**: `LiveHost` uploads a `lang` part
and `useRemoteView` / `PlayerView` apply it (a phone has no saved settings; the DM's own second window reads the saved one).
- `src/lib/i18n.ts` - `t(key, params)` (reads the current language at call time, so it also works in the combat engine), `tn(base, count)`
  (`.one` / `.other` keys), `possessive(name)` ("Merlin's" / "Merlins", no extra s after s/x/z), and `tCondition` / `tAbility` / `tClass` /
  `tDamage` / `tMonsterType` / `tSize` for rules vocabulary (the stored values stay English; these give the words shown).
- Messages live in `src/i18n/*.ts`, one file per area, as `'key': [english, swedish]` tuples merged in `messages.ts`. `{name}` marks a value;
  use `<Rich text={t(...)} parts={{ name: <strong>..</strong> }} />` when a sentence contains an element. Keys are type-checked, and
  `pnpm dlx tsx` the dictionary checks (every key has both languages, same placeholders, no orphans) before committing.
- **Never put English text straight into the UI, the log or an announcement**: add a key. Do not call `t()` at module load (constants must hold
  keys, not text) because the language can change; `Root` re-creates the whole tree when it does, which re-runs every `t()`.
- **Not translated on purpose:** spell, monster, item and class-feature names and rules text (from the SRD), action names, `HP` / `AC` / `DC`.
- Log lines, announcements and journal entries are written in the language that is active when they happen; they are not re-translated later.
- To add a language: add it to `LANGUAGES` and `INDEX` in `i18n.ts`, extend the `Msg` tuple type, and fill every entry (TypeScript lists the gaps).

## Look & feel

RPG theme from `src/assets/images/logo.png` (don't import the 2.3 MB original; use `logo-128.png` / `logo-360.png`, `public/favicon.png`). Palette
is CSS variables at the top of `src/index.css`: dragon red, parchment, gold, leather brown on dark wood.
- DM screens are a parchment `.page`; the player view is the inverse (parchment cards on wood) for TV readability and phones (it has a mobile layout).
- Fonts are bundled via `@fontsource` (Cinzel, Alegreya) so the app works offline. No CDN fonts (their Latin subset covers å ä ö).
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
`pnpm preview` (seed IndexedDB, click through, assert on the DOM / database / server tables). If a test framework is added, port those checks
(monster parser on all 341 monsters incl. Multiattack and spell lists, class-table merge, rests and slot recovery, damage / resistance / condition rules,
volleys, delay and group initiative, Exhaustion, undo, live-view privacy). Headless Edge launched for these tests outlives `proc.kill()`: kill leftover
`msedge.exe` processes whose command line has your throwaway profile before the next run, or the debugging port will refuse.

## TODO / ideas

- Longer-term (agreed, waiting): battle map with tokens, loot generation. (Session notes, equipment, inventory, gold and XP, players with their own accounts, effects with durations and the level-up helper are built.)
- Effects: more presets (`PRESETS` in `lib/effects.ts`), and an effect that ends when the target takes damage; monster spells the API can't describe (Shield...).
- The throwaway browser test scripts live outside the repo (see Testing): port them into an `e2e/` folder.
- Subclass-granted spells, ritual casting, non-SRD content import, Speed tracking (Exhaustion's speed penalty is only a reminder).
- More per-attack multi-hit spells can be added to `VOLLEYS` in `spells.ts` (hexblade, Spiritual Weapon etc. aren't).
