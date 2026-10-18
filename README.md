<p align="center">
  <img src="https://raw.githubusercontent.com/wpellas/dnd-companion/refs/heads/main/src/assets/images/logo-360.png" alt="D&D Companion logo" width="260">
</p>

<h1 align="center">D&D Companion</h1>

<p align="center">
  <em>Roll for initiative, not for bookkeeping.</em><br>
  A DM's screen for running D&D 5e (2024 rules) combat, with a live view for the TV and the players' phones.
</p>

---

Ever lost track of whether the third goblin is at 4 HP or 7? Forgotten that the wizard is still concentrating on a spell while
a dragon bites them? This app does that remembering for you, so you can get on with doing the voices.

> 🎲 **The golden rule: players always roll their own dice.**
> The app brings the bonuses, DCs, resistances and bookkeeping. You type in the number the player rolled. It only rolls dice
> for monsters (the DM's dice), and for players only if you flip that switch in Settings. Real dice, real drama.

## 🚀 Quick start

The app has accounts: a PHP/Laravel backend (in `backend/`, MySQL) keeps every campaign and also serves the app itself, so there is nothing to
keep running. With [Laravel Herd](https://herd.laravel.com) (or any PHP host whose web root is `backend/public`):

```
pnpm install
cd backend && composer install && cp .env.example .env && php artisan key:generate   # then fill in DB_* and APP_URL (your Herd address)
php artisan migrate --seed    # creates the tables and the administrator (ADMIN_EMAIL / ADMIN_PASSWORD in .env)
cd .. && pnpm build           # puts the app into backend/public; now open your Herd site
```

Link the `backend` folder as the Herd site. While changing the frontend, `pnpm dev` gives hot reload and talks to the same backend.

Sign-in is **invite-only**: the administrator makes the first invite, and every DM can invite their own players from Settings. Anyone can run a
campaign of their own and be its DM; players join with a code. Everything is stored on the server and also kept in the browser, so a bad
connection only delays saving, it does not lose anything.

Other scripts: `pnpm build` (type-check + production build into the backend) and `pnpm lint`.

## 🧙 What's in the box

### The Party
Characters with a class dropdown, level, AC/HP, ability scores, saving-throw proficiencies, damage resistances, a portrait,
actions, spells and limited-use class features. Attack bonuses, damage and spell DCs can be worked out from the character's stats
("From my stats") and follow level-ups.

- **Level-up helper:** the ⬆ button on a character walks through the next level: what the class table gives (features, new spell slots and
  limits), hit points (the average, or the number the player rolled, plus Constitution), and the Ability Score Improvement where there is
  one (+2, +1/+1, or note a feat). A raised Constitution adds the extra hit points for every earlier level too. Players can level up their
  own characters, and it writes a note in your journal.

**Players have their own characters.** Every character belongs to one account. A player logs in on their phone, opens **My characters** and
creates and edits their own sheet (stats, actions, spells, items); they only ever see their own. You can edit every character, and hand one to a
player (or take it back) with the **Player account** field in the character form. Rests, XP awards and the showcase stay with the DM.

- **Spellcasting:** slots, cantrip and prepared-spell limits come from the official class tables. Pick spells from the class's SRD
  list (searchable, with the spell text). Slots are clickable pips.
- **Class features:** add limited-use features from the official SRD list (Second Wind, Rage, Action Surge, Channel Divinity, Lay
  On Hands...) or your own. Counts follow level-ups, and rests recharge them, including "one use back per short rest" features.
- **Equipment, gold and XP:** every character has coins (pp / gp / ep / sp / cp), experience points and an item list. Add things from
  the SRD list (all 38 weapons, 12 armors, the shield, adventuring gear and 262 magic items, searchable and stored offline) or make your
  own. A **wielded weapon becomes an attack in combat** with the right bonus and damage from the character's stats (finesse and ranged
  handled, a second attack for two-handed Versatile damage, +1 weapons supported). **Armor and shields can set Armor Class**
  ("Armor Class from equipment"; Barbarian and Monk Unarmored Defense included). Carrying weight against 15 x Strength and the
  three-item attunement limit are shown. Quick editing lives on the party card (the 🎒 Items button) and in the character form.
- **Awarding XP and gold:** after a fight a banner offers the fight's XP split evenly between the party; the "Award XP & gold" button
  hands out any XP and gold (also split evenly) and notes it in the Journal. Cards show XP towards the next level and a "ready to
  level up" badge (the level itself is still yours to change).
- **Rests:** a short rest (spend Hit Dice, type or roll the healing; short-rest features recharge; Warlocks regain slots) and a long
  rest (full HP, half your Hit Dice, all slots and features, and one Exhaustion level off). A day counter tracks the campaign.
- **Slot recovery on a short rest:** Arcane Recovery (Wizard), Natural Recovery (Circle of the Land Druid) and Sorcerous Restoration
  (Sorcerer) show up in the short-rest panel once per long rest, with a budget so you can't over-recover.

### The Bestiary 🐉
All 341 SRD monsters with search, CR / type / size filters, sortable columns and full stat blocks, plus custom monsters. Give any creature a **picture** (in the Bestiary: on its entry or while creating or editing it) and every one of that kind shows it, to you and to the players. Add several pictures (also while creating or editing a monster) and the 1st goblin of a fight gets the 1st picture, the 2nd the 2nd, and extra goblins a random one: the Goblin
Warrior finally has a face. Attacks,
saves, recharge, legendary actions, resistances and immunities are read from the official data, so the Adult Red Dragon actually
breathes fire.

### Combat ⚔️
- Initiative, turn order, rounds, damage / heal / temp HP, conditions, concentration, death saves.
- **Initiative extras:** optionally give every monster of the same kind one shared initiative (rolled once or typed once; they still
  take their turns one after another). Mark a creature **Surprised** before the fight and it rolls with Disadvantage (the app does it
  for monsters, and reminds you for players). **Delay** a turn to act later this round, just behind someone who hasn't gone yet.
- **Turn panel:** pick an action (grouped into actions, bonus actions, reactions and legendary) or cast a spell, pick the target(s),
  enter the d20s and damage, apply. Handles crits, multi-type damage ("slashing + fire"), optional extras ("plus 1d4 if
  Advantage"), half-on-save, and each target's resistances, immunities and vulnerabilities.
- **Several attacks at once:** Scorching Ray, Magic Missile and Eldritch Blast get a ray-by-ray table (each ray picks its own target, d20
  and damage; Magic Missile's darts always hit), and a monster's **Multiattack** becomes the same table with one row per attack, so a
  dragon's three Rends or a mage's three Arcane Bursts are one tidy click. Monsters can roll the whole thing for you.
- **Monster spellcasting:** the Mage, dragons, liches and friends have their spell list in the Spell dropdown, at will or N casts a
  day (the app counts them), using the stat block's own save DC and spell attack bonus.
- **Exhaustion:** a level stepper (0-6) on every creature. Each level takes 2 off the creature's attack and save bonuses (the d20 test
  rule), shows as "Exhaustion N" to the table, level 6 is death, and a long rest removes one level.
- **Multi-target effects:** Fireball and breath weapons hit several creatures from one damage roll, and each creature gets its own
  save with its own bonus (proficient saves included).
- **Rules assistance (never rolls for players):** advantage / disadvantage hints from conditions, automatic critical hits against
  Paralyzed / Unconscious targets within 5 ft, automatic failure of STR/DEX saves, per-turn condition reminders, Legendary
  Resistance, recharge rolls, legendary-action and limited-use tracking, action / bonus action / reaction trackers.
- **Death and unconsciousness:** dropping to 0 HP makes a PC Unconscious, further damage adds death-save failures (a crit adds two),
  massive damage kills outright, healing wakes them up.
- **Concentration:** damaging a concentrating creature raises a "CON save DC N" prompt, and failing ends the spell.
- **Undo** the last change (a cast also hands the spell slot back) and a combat log, for when the table disagrees about what just happened.
- **Lair actions** marker on initiative 20.
- **Effects with durations:** "Bless: 8 rounds left", "Hold Person: repeat the save at the end of each of its turns". Add an effect to anyone (spell presets, or by hand), and the app counts the rounds down, asks you for the repeat
  save when it is due, ends the effect (and its condition) when time runs out or the save succeeds, and ends spells the caster was concentrating on if they lose concentration or go down. Casting Hold Person from the turn panel sets it all up by itself.
  The table sees the spell names, and players see their own rounds left.
- **2024 details:** Heroic Inspiration (a star on the party card, in the fight and on the table), Weapon Mastery (tick "I have Mastery with this weapon" and the property's effect shows when the attack lands: Topple, Push, Graze...), and cover on attacks.

- **Effects that change numbers:** Shield of Faith, Shield, Haste and Slow change AC (the attack panel and target list use it), Rage gives resistance to bludgeoning / piercing / slashing, Dodge, Blur and Faerie Fire give attackers Disadvantage / Advantage (as a hint on the attack panel), and Bless, Bane, Rage and Haste show a reminder on the attacker's own rolls.
- **Allies and summons:** add a creature "as ally" from the Bestiary (or tick it on its row) and it fights on the party's side: the table sees its hit points like a character's, it gives no XP, and it can act right after the creature that controls it.
- **Wild Shape:** a druid's row can take a beast's form (the 2024 rules: temporary hit points equal to the druid's level, the beast's AC, Speed and actions, own hit points kept) and go back; undo covers it, the table sees the form.
- **Death saves from the phone:** an interactive player can type the d20 of a death save; the DM sees it on the row and applies it with a click (10+ success, 1 = two failures, 20 = back up with 1 HP).
- **Roll or average hit points:** a setting makes new monsters roll their hit point dice instead of using the average.
- **Hazards:** falling (per 10 feet), burning or your own trap (dice, type, optional save) against any creatures you tick; the table hears who got hurt.
- **Movement without a map:** count the feet each creature walks (Haste, Slow, Exhaustion and conditions like Grappled change its Speed), with Dash, Disengage, standing up from Prone and a reminder about opportunity attacks.

### Maps 🗺️
Upload battle maps and handouts in the Maps tab and **show one to the players**, the way you show a character sheet: their phones and the table screen switch to the picture until you go back to the feed. One thing is shown at a time, a reminder bar stays on
every tab while it is up, and pictures are shrunk to a size that is sharp on a phone yet light to send. Fog of war (the map starts hidden and you reveal it piece by piece) is the next step.

### The Journal 📖
A private campaign log for you: free-form notes (NPCs, clues, loot), session recaps, and an automatic summary of every fight you end
(who fought, who fell, XP, the full combat log). Search it, filter it, pin the important bits. Players never see it, and it travels
with your backups.

### Encounters 📜
Save a fight's monsters, build encounters from the bestiary, load them into combat. An XP total and a difficulty rating (Low /
Moderate / High / Beyond High) are calculated for your party from the 2024 XP budgets, so you know whether you're being kind or cruel.

### The Player View 📺
A read-only screen for the table's TV and the players' phones: turn order, the party's HP, monsters as
Healthy / Bloodied / Defeated (never their HP or AC, no peeking), conditions, a "Merlin's turn!" banner and short announcements
like "Goblin Warrior 1 hits Xaroz". Players log in on their phones and see it; a player can also look at their own characters.
The TV opens a secret link from Settings and needs no login.

**Players never have to do anything.** A phone starts as a pure spectator screen, and a big banner says **It's your turn!** when your character is up (and "You're up next" before that). Players who want more switch on **Interactive**: they can then
manage their characters, get a buzz on their turn, and type the number they rolled (initiative, an attack's d20, a save's d20) for the DM's screen. It lands ready in the right box of your attack panel, save table, concentration prompt or initiative
row, and you can ignore it or type your own: nothing waits for it. The dice stay physical; the app never rolls for a player.

**Show a character to the players:** the 📺 button on a party card puts that character's sheet on the TV and phones instead of the
feed (stats, saves, attacks, spells and slots, features, and optionally inventory and gold), so you and the player can check you agree
on their numbers. It is only a switch: the fight keeps running underneath, the sheet follows HP changes live, and "Back to the feed"
restores the view exactly as it was. A bar on every DM tab reminds you it is on.

- **Plain-language help:** tap any badge (Poisoned, Faerie Fire, Concentrating...) to see what it means, with Advantage and Disadvantage explained; a "?" in the header lists the common terms (Resistance, Death saves, Bloodied...); and when a creature gets a condition the table is told what it does. All optional, and in the DM's language.

### Administration 🛡️
The administrator account (made by `php artisan db:seed` from `ADMIN_EMAIL` / `ADMIN_PASSWORD`) gets an **Administration** page, linked from the campaign
list and from Settings: make and revoke site invites, see every account (send a password-reset link, lock or unlock, make or remove an
administrator, delete) and every campaign (delete). A locked account is signed out at once. You cannot lock or delete yourself, and a campaign's
only DM cannot be deleted before the campaign is. Everything an administrator does is written to a **log** on the same page.

### Settings ⚙️
Your account and campaign (who is at the table, invite codes, changing your e-mail or password, switching campaign, logging out; a new e-mail
address only takes effect when you open the link sent to it, and the old address gets a notice), the
**language** (English or Svenska), the player-dice policy, backup and restore, and the table-screen link with a QR code.

**Language:** pick it from the dropdown on the Settings tab and the whole app switches, including the TV and the players' phones
(they follow the DM's choice) and the lines that call out whose turn it is ("Merlins tur", "Runda 3"). Only the app's own words are
translated: spell, monster and item names, class features and rules text from the SRD stay in English.

## 📱 Live view on phones and TVs

Keep the app open in the DM's browser while you play. It uploads the player-safe state to the server (monsters are reduced to a status
before anything leaves your browser, so the server never holds their HP or AC), and the other screens ask for updates every second or two.

- **Players:** log in on their phone with their own account and open the campaign.
- **The TV:** open the **table screen** link from Settings (it comes with a QR code). It needs no login, so anyone who has the link can
  watch; "Make a new link" cancels the old one at once.
- Phones and the TV have to be able to reach the server's address (your Herd site only answers on your own computer unless you set that
  up, a web host is reachable from anywhere).

## 💾 Data and offline use

- Everything you create (characters, custom monsters, encounters, the current fight, settings) is stored locally in the browser
  (IndexedDB via Dexie). There is no server database, so data is per browser. **Use Settings -> Download backup regularly.**
- Class, spell, monster and condition data come from the free [5e SRD API](https://www.dnd5eapi.co/) (2024 rules). The first time the
  app opens online it downloads the whole reference library in the background (a minute or so; the footer shows progress) and stores
  it. After that it never calls the API again, so everything works offline (handy when the game is in a basement with no signal).
  Only SRD content is available; spells and monsters from other books can't be looked up (yet). You can add custom monsters and
  actions by hand.

> This work includes material from the System Reference Document 5.2 by Wizards of the Coast LLC, available at
> https://www.dndbeyond.com/srd, licensed under CC BY 4.0.

## 🗺️ A typical game night

1. Add characters on the **Party** tab (pick a class and level; slots and class features follow).
2. On **Combat**, click **Add party**, then add monsters from the **Bestiary** or load a saved encounter from **Encounters**.
3. Type each initiative (the players' numbers) and press Enter, then **Start combat**.
4. On a turn: choose the action, add the target(s), type the d20 the player rolled, then the damage. The panel shows bonuses, DCs and
   hints, and **Apply** does the bookkeeping. **Undo** if you slip.
5. After the fight, hit **End combat**, then take a **Short** or **Long rest** on the Party tab.

## 🕳️ Known limitations

- Only SRD content; non-SRD spells, monsters and subclasses are manual.
- Spells the API doesn't describe in a readable way (Shield, say) still spend the slot and set concentration, but you apply the
  effect with the Dmg / Heal / condition controls. Monster spells that need a roll the app can't read work the same way.
- Monster cantrips scale as if the monster's caster level were its CR (the stat block doesn't say), and its spells are cast at the
  level the stat block lists. Retype the damage if your table rules differently.
- Equipment doesn't track per-item charges, ammunition use or encumbrance penalties, and monster loot isn't generated.
- Gold and XP are split evenly; an uneven split means awarding it twice.
- Movement is counted by hand (there is no map). Crawling's extra cost, Cunning Action and "leaves the form when Incapacitated" are not automatic.
- Hazard presets (falling, burning) come from memory of the 2024 rules because the SRD API has no text for them: check them against your book.
- Two people editing the very same record at the same moment: the last save wins (the DM's fight state is only ever written by the DM).

## 🔮 On the horizon

Fog of war and tokens on the maps, and treasure generation after a fight.

## 📖 Changelog

- **Table-speed update 3:** effects that change AC / resistances / attack advantage, allies and summons, Wild Shape, death saves typed on the phone, rolled monster hit points, hazards and movement tracking.
- **Table-speed update 2:** effects with durations and repeat saves, a level-up helper (hit points, features, ability score improvement), Heroic Inspiration, Weapon Mastery and cover, a spectator-first player screen with an "It's your turn!" banner, optional phone rolls for the DM, an admin log, and a lighter fight sync.
- **Player characters:** players create and edit their own characters from their phones; the DM assigns characters to accounts.
- **Administration:** an admin page for site invites, accounts (lock, reset link, admin rights, delete) and campaigns.
- **Accounts and server storage:** sign-in, campaigns with a DM and players, invite codes, everything saved to a MySQL database and synced between devices.
- First version: party, bestiary, combat tracker, player view.
- Actions, targeted attacks / saves / healing, combat log; actions derived from character stats.
- RPG makeover (parchment / leather / gold theme from the logo).
- Class dropdown, spell slots and spells from the SRD API, casting in combat, short and long rests, class features, offline library.
- **Big combat update:** full SRD bestiary; automatic saving throws (bonuses only, players still roll); multi-target effects;
  resistances / immunities / vulnerabilities; undo; concentration, recharge and legendary-action tracking; auto-Unconscious,
  massive damage; condition-driven hints; action / bonus action / reaction trackers; lair actions; saved encounters with XP
  difficulty; backup and restore; settings; player-view announcements; live view on phones with a QR code.
- **Language:** English and Swedish, switched from Settings and followed by every connected screen.
- **Spotlight:** show one character's sheet on the players' screens and switch back to the feed any time.
- **Loot update:** equipment and inventory from the SRD item list, weapons that become attacks, Armor Class from gear, coins, XP and
  gold awards (after a fight or by hand), level-up badges, a Loot & XP journal log.
- **Table-speed update:** group initiative, Surprised, Delay; ray-by-ray Scorching Ray / Magic Missile / Eldritch Blast and monster
  Multiattack; monster spellcasting with per-day counts; Exhaustion levels; Arcane Recovery-style slot recovery; the campaign journal
  with automatic combat summaries.
