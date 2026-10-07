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
| Kneel & pray (heals; ends chapter 1 in the grove) | Hold ↓ / S | Stick down | Down |
| Look up | ↑ / W | Stick up | Up |
| Jump (hold for higher) | Space / Z | **A** | **A** |
| Pitchfork / throw plates | X / J | **B** | **B** or **X** |
| Pause menu | Esc / P | **II** (top right) | **Start** |
| Menus | ↑ ↓ + Enter | Tap | D-pad + A / Start |
| Mute | M | **MUTE** | — |

All keyboard bindings can be changed on the **Controls** screen (title → Controls, or Pause → Controls): click a key (or select it and press Enter), then press the new key. A key already used by another action moves to the new action (the screen says so); Esc cancels; **Reset to defaults** restores the table above. Bindings are saved in `localStorage` (`palmyraQuest.keys.v1`). Enter (confirm) and M (mute) are fixed. Gamepad and touch layouts are shown on the same screen for reference.

Gamepads use the browser Gamepad API (standard mapping); a toast confirms when one connects.

## Campaign

| # | Chapter | Year | Goal |
|---|---------|------|------|
| 1 | Sacred Grove | 1820 | Young Joseph; wolves; preachers of rival churches; camp meeting; kneel to pray in the grove |
| 2 | A Messenger | 1823 | Reach Moroni |
| 3 | Hill Cumorah | 1827 | Receive the plates (unlocks plate-throwing) |
| 4 | Missouri Night | 1838 | Mobs + Mob Captain |
| 5 | Far West Road | 1838–39 | Road mobs + Jailer Warden |
| 6 | Nauvoo | 1844 | Streets + Conspiracy Ringleader |
| 7 | Carthage Jail | 1844 | A quiet walk with friends, then hold the door (no fighting); respectful ending |

Each chapter opens with a short title card (chapter, story line, place and year).

## Round 2 features

- **Checkpoints** — glowing lanterns midway through each chapter. Touching one refills hearts; dying (or choosing *Retry from Checkpoint* after losing the last heart) respawns you there. Pause → Restart still restarts the whole chapter.
- **Bosses** — the Mob Captain, Jail Warden and Ringleader each show a wind-up tell (gold aura, "!" bubble, held pose, beep cue, flash) before every attack, have at least two attack patterns, and change phase at half health (roar + new moves). A named health bar appears at the top with a half-way tick.
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

## Round 4 features

- **Full screen button** — gold FULL SCREEN button on the title, "Full screen" in the pause menu and a small HUD icon. Uses the Fullscreen API (with webkit prefixes) plus `screen.orientation.lock('landscape')`. On iPhone Safari, where that API is unavailable, it opens an illustrated guide: Share → Add to Home Screen. The old install pill and auto-fullscreen-on-tap were removed (`js/fullscreen.js`).
- **Chapter 1 story** — the Dark Cloud boss is gone. A Methodist circuit rider, a Presbyterian minister and a Baptist preacher (friendly NPCs, Joseph's pitchfork is put away near them) speak along the road; a final camp meeting has all three urging him at once, Joseph recalls James 1:5, walks into the grove and the player holds ↓ to kneel and pray; a gentle light fade ends the chapter (`js/grove.js`).
- **Journal entries** — collecting all 3 pages in a chapter opens a short parchment entry (ch1 burned-over district, ch2 praying for strength (the kneel-to-heal tip), ch3 Moroni, ch4 translation, ch5 Missouri, ch6 Liberty Jail / D&C 121, ch7 Nauvoo & Carthage). Unlocked entries can be re-read from the Chapters screen (`js/journal.js`).
- **Grounded stacks** — floating platforms are now stacks that rest on the ground: hay bales, logs, rocks and stumps in the grove/farm, crates and barrels in towns and on the dock, with step piles leading up (`js/stacks.js`).
- **Jump animation** — takeoff squash, rising stretch, apex tuck, falling pose and landing squash with dust puffs, all built from the painted frames.
- **Chapter 2 foe** — the first chapter 2 enemy's oversized head was re-proportioned at load time (art files untouched).

## Round 5 fixes

- **Safe spawns** — every chapter start, checkpoint respawn and Continue now uses `findStand()` (`js/level.js`): Joseph's whole box must be clear of solids, both feet on firm ground and room to walk right, just right of the on-screen D-pad. Start-area stacks in ch3/4/6/7 were moved clear; ch1/ch4 checkpoints moved to open ground. `qa/tools/qa_r5.mjs` asserts this for all 7 chapters and every checkpoint on desktop and iPhone layouts.
- **Hill Cumorah** — chapter 3 ends on a large natural hill (`js/hill.js`): a smooth walkable height field (player and foes snap to it, no snagging) painted with earth strata, buried rocks, grass, wildflowers and trees, with the plates at the foot of a great stone under a big tree near the top, and a distant drumlin silhouette that comes into view as Joseph approaches.

## Round 6 (controls, hit fairness, game feel)

- **Standard platformer keys** — Space/Z jump, X/J attack, arrows/WASD move, ↓/S kneel, Esc/P pause, Enter confirm. X no longer jumps. Every tip, the pause hint and the title hint are built from the live bindings.
- **Controls screen** with click-to-rebind, conflict handling, Reset to defaults and saved bindings (`js/input.js`, `#ui-controls`).
- **Hit cooldowns** — 1.2 s of invulnerability after a hit (blink, or steady see-through with Reduce flashing) and a short knockback away from the attacker. Walking foes now telegraph melee (gold glow, lean back, "!") for 0.3 s, then lunge; only the lunge hurts. Each foe then waits 1.5 s before it can hit again. Thrown knives pass through Joseph during i-frames.
- **Game feel** — coyote time (~100 ms), jump buffering (~120 ms), variable jump height (release early for a short hop), acceleration/deceleration, a forgiving hurtbox (smaller than the sprite) and camera lookahead toward the direction of travel.
- **No cheap arrivals** — foes are moved out of a 9-tile safe zone ahead of every chapter start and checkpoint, and throwers wait 1.5 s after you arrive. Chapter 2 gained a second checkpoint.
- Full audit: `qa/round6/design-audit.md` (in the QA workspace). Tests: `qa/tools/qa_r6.mjs`.

## Round 7 (Moroni)

- **Moroni faces Joseph** — the sheet is painted facing right, so it is mirrored every frame toward Joseph's side (also behind the chapter-clear card). He raises a hand in greeting when Joseph is within 6 tiles.
- **Same height** — each Moroni frame is scaled so his head-to-feet height (measured from the sheet's dark body pixels at load, glow rim excluded) equals Joseph's (~100 px). Aspect ratio is kept, scaling is nearest-neighbour, and the painted glow rim scales with him. His feet stand on Joseph's baseline with a 0–2 px float. Sprite art is unchanged.
- **Room between them** — the meeting triggers ~1.75 tiles before they touch (`MORONI_MEET` in `js/level.js`). Tests: `qa/tools/qa_r7.mjs`.

## Cache busting

Every asset reference carries one version number: `index.html` (`?v=` on CSS, portrait, `main.js`) and **every relative ES module import** in `js/*.js`. All modules must import a file with the same specifier, or the browser loads two copies. To bump:

```
node scripts/bump-version.mjs 72
```

## Saving

Progress lives in `localStorage` (`palmyraQuest.save.v1`): furthest chapter unlocked, best score, mute preference, which first-run tips have been shown, difficulty, reduce-flashing, and per-chapter bests (stars, pages bitmask, time). Values are validated on load, so a missing, corrupt or out-of-range save simply falls back to defaults. The title shows **Continue (Chapter N)** next to **Begin** once a later chapter is unlocked. Starting at chapter 4 or later grants the plates.

Falling into a gap costs one heart and returns Joseph to his last solid footing. On the last heart it ends the run. After a loss you can **Retry Chapter** (score resets to its value at the start of that chapter) or go back to the title.

## Music

All melodies are public-domain hymn tunes. The chiptune arrangements (square/triangle voicing and the generated bass lines) are original to this game. Melody data lives in `js/songs.js` and was transcribed from public-domain scores on hymnary.org; the sequencer is in `js/audio.js`.

| Where | Tune | Known as | Source / date |
|-------|------|----------|---------------|
| Title, chapter clear, ending | JESUS LOVES ME | "Jesus Loves Me" | William B. Bradbury, 1862 |
| Ch 1 Sacred Grove (and a slower, lower version while kneeling in the grove) | NEW BRITAIN | "Amazing Grace" | American folk melody, first printed 1829 |
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
js/enemy.js       Wolves, mobs, bosses
js/level.js       Chapter maps and backgrounds
js/input.js       Keyboard + virtual stick / buttons + Gamepad API
js/hazards.js     Boss/set-piece hazards and the "!" alert bubble
js/setpieces.js   Checkpoints, chapter set pieces, dock, Carthage finale, boss bar/banner
scripts/          bump-version.mjs (cache-bust every import)
js/sprites.js     Sprite-sheet drawing + pixel font
js/ui.js          HTML overlay sync
js/grove.js       Chapter 1 preachers, camp meeting, grove prayer ending
js/journal.js     Journal entries shown when a chapter's pages are complete
js/stacks.js      Grounded stacks (hay, logs, rocks, crates, barrels)
js/fullscreen.js  Full screen button + iPhone Add to Home Screen guide
js/hill.js        Hill Cumorah height-field hill (collision + art)
assets/           Sprite sheets and portraits
```

## License / credit

Fan tribute. The historical figure is depicted respectfully. Not affiliated with The Church of Jesus Christ of Latter-day Saints.
