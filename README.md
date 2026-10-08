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

```
pnpm install
pnpm dev        # then open the URL Vite prints
```

Other scripts: `pnpm build` (type-check + production build), `pnpm lint`, and `pnpm live` (build, then serve the built app
on your network, a bit snappier than `pnpm dev` for game night).

## 🧙 What's in the box

### The Party
Characters with a class dropdown, level, AC/HP, ability scores, saving-throw proficiencies, damage resistances, a portrait,
actions, spells and limited-use class features. Attack bonuses, damage and spell DCs can be worked out from the character's stats
("From my stats") and follow level-ups.

- **Spellcasting:** slots, cantrip and prepared-spell limits come from the official class tables. Pick spells from the class's SRD
  list (searchable, with the spell text). Slots are clickable pips.
- **Class features:** add limited-use features from the official SRD list (Second Wind, Rage, Action Surge, Channel Divinity, Lay
  On Hands...) or your own. Counts follow level-ups, and rests recharge them, including "one use back per short rest" features.
- **Rests:** a short rest (spend Hit Dice, type or roll the healing; short-rest features recharge; Warlocks regain slots) and a long
  rest (full HP, half your Hit Dice, all slots and features, and one Exhaustion level off). A day counter tracks the campaign.
- **Slot recovery on a short rest:** Arcane Recovery (Wizard), Natural Recovery (Circle of the Land Druid) and Sorcerous Restoration
  (Sorcerer) show up in the short-rest panel once per long rest, with a budget so you can't over-recover.

### The Bestiary 🐉
All 341 SRD monsters with search, CR / type / size filters, sortable columns and full stat blocks, plus custom monsters. Attacks,
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

### The Journal 📖
A private campaign log for you: free-form notes (NPCs, clues, loot), session recaps, and an automatic summary of every fight you end
(who fought, who fell, XP, the full combat log). Search it, filter it, pin the important bits. Players never see it, and it travels
with your backups.

### Encounters 📜
Save a fight's monsters, build encounters from the bestiary, load them into combat. An XP total and a difficulty rating (Low /
Moderate / High / Beyond High) are calculated for your party from the 2024 XP budgets, so you know whether you're being kind or cruel.

### The Player View 📺
A read-only screen for a TV or phones, in a second window or on any device on your Wi-Fi: turn order, the party's HP, monsters as
Healthy / Bloodied / Defeated (never their HP or AC, no peeking), conditions, a "Merlin's turn!" banner and short announcements
like "Goblin Warrior 1 hits Xaroz".

### Settings ⚙️
The player-dice policy, backup and restore, and the live-view address with a QR code.

## 📱 Live view on phones and TVs

Run the game from the computer with `pnpm dev` or `pnpm live`. Open the **Settings** tab: it shows an address like
`http://192.168.1.23:4173/#player` and a QR code. Open that on any phone, tablet or TV on the same Wi-Fi and they see the player
view live.

The DM's browser pushes only the player-safe state through a tiny relay built into the dev/preview server (nothing is stored on
disk). If a device can't connect, allow Node.js through the Windows firewall for private networks. There is no password, so only use
it on a network you trust.

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
- Equipment, inventory and gold aren't tracked.
- Speed isn't tracked, so Exhaustion's speed penalty is only a reminder.
- Derived action numbers are fixed when a character joins a fight; edit-and-re-add to pick up mid-fight changes.

## 🔮 On the horizon

Equipment and inventory, gold and XP tracking, a level-up helper, a battle map with tokens, and players logging in as their own
characters.

## 📖 Changelog

- First version: party, bestiary, combat tracker, player view.
- Actions, targeted attacks / saves / healing, combat log; actions derived from character stats.
- RPG makeover (parchment / leather / gold theme from the logo).
- Class dropdown, spell slots and spells from the SRD API, casting in combat, short and long rests, class features, offline library.
- **Big combat update:** full SRD bestiary; automatic saving throws (bonuses only, players still roll); multi-target effects;
  resistances / immunities / vulnerabilities; undo; concentration, recharge and legendary-action tracking; auto-Unconscious,
  massive damage; condition-driven hints; action / bonus action / reaction trackers; lair actions; saved encounters with XP
  difficulty; backup and restore; settings; player-view announcements; live view on phones with a QR code.
- **Table-speed update:** group initiative, Surprised, Delay; ray-by-ray Scorching Ray / Magic Missile / Eldritch Blast and monster
  Multiattack; monster spellcasting with per-day counts; Exhaustion levels; Arcane Recovery-style slot recovery; the campaign journal
  with automatic combat summaries.
