# Joseph Smith — Palmyra Quest

Family-friendly NES-style side-scroller. Play as Joseph Smith on a frontier path near Palmyra—run, jump, and defend the road from brigands and wild animals, then face the Frontier Ringleader.

Inspired by classic NES action/platformers (e.g. *Teenage Mutant Ninja Turtles*, 1989). Respectful historical-fantasy arcade tone—not parody.

## Play

Serve the folder over HTTP (ES modules require a local server):

```bash
# Option A
npx --yes serve .

# Option B
python3 -m http.server 8080
```

Then open the URL shown (often `http://localhost:3000` or `http://localhost:8080`).

Or open GitHub Pages if enabled for this repo.

## Controls

| Action | Keys |
|--------|------|
| Move | ← → / A D |
| Jump | ↑ / W |
| Melee attack | Space / Z |
| Start / confirm | Enter (or Z on title) |
| Pause | P |

## Goal (Level 1 — Palmyra Woods)

1. Title screen → press **Enter** or **Z**
2. Cross the woods path; defeat brigands and wolves
3. Watch gaps and platforms
4. Enter the arena and defeat the **Frontier Ringleader**
5. Win or lose screens → Enter/Z returns to title

## Project layout

```
index.html          Entry page (256×240 canvas, CSS-scaled)
css/style.css       Pixel scaling + page chrome
js/
  main.js           Loop bootstrap
  game.js           State machine, HUD, win/lose
  player.js         Joseph movement, jump, melee, health
  enemy.js          Brigands, wolves, boss AI
  level.js          Level 1 map + createLevel2() stub
  input.js          Keyboard mapping
  sprites.js        Pixel-rect sprite drawing
  constants.js      Resolution & shared constants
assets/             Reserved for future art
```

Level 2 can plug in via `createLevel2()` in `js/level.js` and a level select / progression hook in `game.js`.

## Tech

Vanilla HTML / CSS / JS (ES modules). No build step, no backend. Fixed internal resolution **256×240** (NES-like), scaled up with `image-rendering: pixelated`.

## License / credit

Fan arcade tribute. Historical figure depicted respectfully as an arcade hero. Not affiliated with Nintendo or Konami.
