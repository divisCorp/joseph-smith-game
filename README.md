# Joseph Smith — Palmyra Quest

A family-friendly, 7-chapter side-scroller about the life of Joseph Smith, from the Sacred Grove to Carthage. Vanilla HTML5 canvas + ES modules; no build step, no backend.

Play: https://palmyra-quest.netlify.app/

## Run locally

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

For automated tests, `window.__pq` is exposed only when the URL has `?debug` **and** `localStorage['palmyraQuest.debug'] === '1'` (set it in DevTools first). Production players never see it.

## Controls

| Action | Keyboard | Touch | Gamepad |
|--------|----------|-------|---------|
| Walk | ← → / A D | Stick left / right | D-pad / left stick |
| Kneel & pray (heals; defeats the Dark Cloud) | Hold ↓ / S | Stick down | Down |
| Look up | ↑ / W | Stick up | Up |
| Jump | X / K | **A** | **A** |
| Pitchfork / throw plates | Space / Z | **B** | **B** or **X** |
| Pause menu | Esc / P | **II** (top right) | **Start** |
| Menus | ↑ ↓ + Enter | Tap | D-pad + A / Start |
| Mute | M | **MUTE** | — |

Gamepads use the browser Gamepad API (standard mapping); a toast confirms when one connects.

## Campaign

| # | Chapter | Year | Goal |
|---|---------|------|------|
| 1 | Sacred Grove | 1820 | Young Joseph; wolves; kneel to break the Dark Cloud |
| 2 | A Messenger | 1823 | Reach Moroni |
| 3 | Hill Cumorah | 1827 | Receive the plates (unlocks plate-throwing) |
| 4 | Missouri Night | 1838 | Mobs + Mob Captain |
| 5 | Far West Road | 1838–39 | Road mobs + Jailer Warden |
| 6 | Nauvoo | 1844 | Streets + Conspiracy Ringleader |
| 7 | Carthage Jail | 1844 | A quiet walk with friends, then hold the door (no fighting); respectful ending |

Each chapter opens with a short title card (chapter, story line, place and year).

## Round 2 features

- **Checkpoints** — glowing lanterns midway through each chapter. Touching one refills hearts; dying (or choosing *Retry from Checkpoint* after losing the last heart) respawns you there. Pause → Restart still restarts the whole chapter.
- **Bosses** — the Dark Cloud, Mob Captain, Jail Warden and Ringleader each show a wind-up tell (gold aura, "!" bubble, held pose, beep cue, flash) before every attack, have at least two attack patterns, and change phase at half health (roar + new moves). A named health bar appears at the top with a half-way tick.
- **Chapter set pieces** — Ch4 Missouri night: lamp-lit streets, rolling barrels (edge "!" warning, breakable for points) and thrown torches. Ch5 Far West road: snowstorm with "WIND COMING" warnings and gusts that push you back. Ch6 Nauvoo: temple scaffolds with falling bricks (shadow warning) and a river dock with sinking planks.
- **Credits** — after the Carthage fade a calm sunrise credits roll shows the story, chapter list, music credits, final and best score, and *Share on X*.

## Round 3 features

- **Results + stars** — every chapter ends on a results card. One star for finishing, and each goal met counts: finish under par time (Easy gets 1.5× par), lose 1 heart or fewer, and find all 3 journal pages (max 3 stars). The card waits for **Continue**.
- **Journal pages** — 3 hidden pages per chapter (+250 each), placed on the highest platform in each third of the chapter that a jump chain can reach. Pages found before a checkpoint stay found when you retry from it.
- **Chapters screen** — from the title: replay any unlocked chapter and see best stars, pages found and best time per chapter.
- **Difficulty** — Normal or Easy (7 hearts, foes move and act at 75% speed, boss tells last longer, every hit costs at most 1 heart). Change it on the title or in the pause menu; it is saved.
- **Reduce flashing** — turns off screen shake, the storm lightning flash, the strobe at the end of boss tells and the hurt blink (Joseph turns see-through instead).
- **Carthage finale** — no foes inside the jail. Quiet story lines play as Joseph walks, then he stands in the lamplight to shield his friends at the door. Knocks come in three telegraphed waves (the door rattles, "!", knock sound) and the pressure pushes him back, so hold → to brace. Courage fills while he stands in the light. Nothing costs hearts, and the reverent fade and credits follow.
- **Polish** — boss entrance banner takes the top slot, then the health bar fades in. Sinking dock planks bob when you are near, then creak (shake, crack, "!"), sink with ripples and float back. Credits stop with the last lines resting above the footer.

## Cache busting

Every asset reference carries one version number: `index.html` (`?v=` on CSS, portrait, `main.js`) and **every relative ES module import** in `js/*.js`. All modules must import a file with the same specifier, or the browser loads two copies. To bump:

```
node scripts/bump-version.mjs 69
```

## Saving

Progress lives in `localStorage` (`palmyraQuest.save.v1`): furthest chapter unlocked, best score, mute preference, which first-run tips have been shown, difficulty, reduce-flashing, and per-chapter bests (stars, pages bitmask, time). Values are validated on load, so a missing, corrupt or out-of-range save simply falls back to defaults. The title shows **Continue (Chapter N)** next to **Begin** once a later chapter is unlocked. Starting at chapter 4 or later grants the plates.

Falling into a gap costs one heart and returns Joseph to his last solid footing. On the last heart it ends the run. After a loss you can **Retry Chapter** (score resets to its value at the start of that chapter) or go back to the title.

## Music

All melodies are public-domain hymn tunes. The chiptune arrangements (square/triangle voicing and the generated bass lines) are original to this game. Melody data lives in `js/songs.js` and was transcribed from public-domain scores on hymnary.org; the sequencer is in `js/audio.js`.

| Where | Tune | Known as | Source / date |
|-------|------|----------|---------------|
| Title, chapter clear, ending | JESUS LOVES ME | "Jesus Loves Me" | William B. Bradbury, 1862 |
| Ch 1 Sacred Grove (and a slower, lower version while praying at the cloud) | NEW BRITAIN | "Amazing Grace" | American folk melody, first printed 1829 |
| Ch 2 A Messenger | OLD HUNDREDTH | "Praise God from Whom All Blessings Flow" | Genevan Psalter, 1551 (Louis Bourgeois) |
| Ch 3 Hill Cumorah | FOUNDATION | "How Firm a Foundation" | American folk hymn, Funk's *Genuine Church Music*, 1832 |
| Ch 4 Missouri Night | ALL IS WELL | "Come, Come, Ye Saints" | English/American folk hymn; *Revival Melodies* 1842, *Sacred Harp* 1844 |
| Ch 5 Far West Road | ST. GERTRUDE | "Onward, Christian Soldiers" | Arthur Sullivan, 1871 |
| Ch 6 Nauvoo | AUSTRIAN HYMN | "Glorious Things of Thee Are Spoken" | Joseph Haydn, 1797 |
| Ch 7 Carthage | BETHANY | "Nearer, My God, to Thee" | Lowell Mason, 1856 |
| Boss fights (ch 4–6) | BATTLE HYMN | "Battle Hymn of the Republic" | American camp-meeting tune, c. 1856 |

## Project layout

```
index.html        Page, HUD and HTML overlays (title, chapters, intro card, pause, results, credits, lose)
css/style.css     Layout, touch UI and overlay styling
js/main.js        Bootstrap + main loop
js/game.js        State machine, campaign, pause menu, tips, drawing
js/save.js        localStorage progress (validated)
js/audio.js       Web Audio SFX + look-ahead chiptune sequencer
js/songs.js       Public-domain melody data + bass roots
js/player.js      Joseph movement, kneel/pray, pitchfork, plates
js/enemy.js       Wolves, mobs, bosses, Dark Cloud
js/level.js       Chapter maps and backgrounds
js/input.js       Keyboard + virtual stick / buttons + Gamepad API
js/hazards.js     Boss/set-piece hazards and the "!" alert bubble
js/setpieces.js   Checkpoints, chapter set pieces, dock, Carthage finale, boss bar/banner
scripts/          bump-version.mjs (cache-bust every import)
js/sprites.js     Sprite-sheet drawing + pixel font
js/ui.js          HTML overlay sync
assets/           Sprite sheets and portraits
```

## License / credit

Fan tribute. The historical figure is depicted respectfully. Not affiliated with The Church of Jesus Christ of Latter-day Saints.
