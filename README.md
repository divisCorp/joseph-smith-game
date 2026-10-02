# Joseph Smith — Palmyra Quest

A family-friendly, 7-chapter side-scroller about the life of Joseph Smith, from the Sacred Grove to Carthage. Vanilla HTML5 canvas + ES modules; no build step, no backend.

Play: https://palmyra-quest.netlify.app/

## Run locally

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

Add `?debug` to the URL to expose the game object as `window.__pq` for automated tests.

## Controls

| Action | Keyboard | Touch |
|--------|----------|-------|
| Walk | ← → / A D | Stick left / right |
| Kneel & pray (heals; defeats the Dark Cloud) | Hold ↓ / S | Stick down |
| Look up | ↑ / W | Stick up |
| Jump | X / K | **A** |
| Pitchfork / throw plates | Space / Z | **B** |
| Pause menu | Esc / P | **II** (top right) |
| Menus | ↑ ↓ + Enter | Tap |
| Mute | M | **MUTE** |

## Campaign

| # | Chapter | Year | Goal |
|---|---------|------|------|
| 1 | Sacred Grove | 1820 | Young Joseph; wolves; kneel to break the Dark Cloud |
| 2 | A Messenger | 1823 | Reach Moroni |
| 3 | Hill Cumorah | 1827 | Receive the plates (unlocks plate-throwing) |
| 4 | Missouri Night | 1838 | Mobs + Mob Captain |
| 5 | Far West Road | 1838–39 | Road mobs + Jailer Warden |
| 6 | Nauvoo | 1844 | Streets + Conspiracy Ringleader |
| 7 | Carthage Jail | 1844 | Last stand; respectful ending |

Each chapter opens with a short title card (chapter, story line, place and year).

## Saving

Progress lives in `localStorage` (`palmyraQuest.save.v1`): furthest chapter unlocked, best score, mute preference, and which first-run tips have been shown. Values are validated on load, so a missing, corrupt or out-of-range save simply falls back to defaults. The title shows **Continue (Chapter N)** next to **Begin** once a later chapter is unlocked. Starting at chapter 4 or later grants the plates.

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
index.html        Page, HUD and HTML overlays (title, intro card, pause, clear, win, lose)
css/style.css     Layout, touch UI and overlay styling
js/main.js        Bootstrap + main loop
js/game.js        State machine, campaign, pause menu, tips, drawing
js/save.js        localStorage progress (validated)
js/audio.js       Web Audio SFX + look-ahead chiptune sequencer
js/songs.js       Public-domain melody data + bass roots
js/player.js      Joseph movement, kneel/pray, pitchfork, plates
js/enemy.js       Wolves, mobs, bosses, Dark Cloud
js/level.js       Chapter maps and backgrounds
js/input.js       Keyboard + virtual stick / buttons
js/sprites.js     Sprite-sheet drawing + pixel font
js/ui.js          HTML overlay sync
assets/           Sprite sheets and portraits
```

## License / credit

Fan tribute. The historical figure is depicted respectfully. Not affiliated with The Church of Jesus Christ of Latter-day Saints.
