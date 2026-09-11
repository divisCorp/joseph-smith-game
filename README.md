# Joseph Smith — Palmyra Quest

Family-friendly NES-style side-scroller. Play as Joseph Smith on a frontier campaign near Palmyra—run, jump, and defend the road through five themed levels, then face the Storm Overseer on Temple Hill.

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

Or open GitHub Pages: https://diviscorp.github.io/joseph-smith-game/

## Controls

| Action | Keys | Touch (phones) |
|--------|------|----------------|
| Move | ← → / A D | **Virtual stick** left / right |
| Duck / crouch (hold) | ↓ / S | **Virtual stick** down |
| Jump | ↑ / W (release duck first) | **Virtual stick** up · or **A** |
| Fling gold plates | Space / Z | **B** button |
| Start / confirm | Enter (or Z on title) | **START** |
| Pause | P | START (resume) |

### Mobile notes

- On-screen controls appear whenever the device has touch (`maxTouchPoints` / `ontouchstart`) or a coarse/narrow viewport—including iPhone Safari desktop-site mode; keyboard still works.
- **Virtual D-pad / stick (left thumb):** circular base + movable knob. Drag maps to left / right / up (jump) / down (crouch) with a small dead zone; diagonals can hold two directions. Holding keeps the action down; release clears directions.
- Separate ◀ ▶ and ↓ duck buttons were removed; **A** remains a secondary jump for muscle memory; **B** stays gold-plate attack.
- Canvas scales to fit the viewport (portrait or landscape); landscape leaves more play area.
- Touch scrolling and pinch-zoom are blocked on the game area (`touch-action: none` + `preventDefault`).
- Thumb-sized semi-transparent controls sit under the canvas so they don’t cover the HUD.
- Relative asset paths keep GitHub Pages (`/joseph-smith-game/`) working.

## Campaign (Levels 1–5)

Start from the title screen (**Enter**, **Z**, or **START**). Defeat each level’s boss to advance; after Level 5 you get the win screen.

| Level | Name | Theme | Boss |
|-------|------|-------|------|
| 1 | **Palmyra Woods** (Woods Path) | Dawn forest path, gaps & platforms | Frontier Ringleader |
| 2 | **Sacred Grove** (Hill Path) | Night woods, denser trees, scouts & wolves | Grove Sentinel |
| 3 | **Palmyra Streets** (Village) | Buildings, rooftop platforms, thugs | Street Captain |
| 4 | **River Crossing** (Bridges) | Water hazards, bridge jumps | River Warden |
| 5 | **Temple Hill** (Final Trial) | Stormy ascent, hardest foes | Storm Overseer |

**Progression:** clear a boss (levels 1–4) → brief “path cleared” overlay → Continue / auto-advance to the next level (score carries). Clear Level 5 → **Quest Complete!** Lose / win → return to title and start again from Level 1.

## Project layout

```
index.html          Entry page (512×480 canvas, CSS-scaled)
css/style.css       Pixel scaling + page chrome + touch UI
js/
  main.js           Loop bootstrap + virtual controls init
  game.js           State machine, campaign progression, HUD
  player.js         Joseph movement, crouch, jump, gold-plate attack, health
  projectiles.js    Gold-plate projectiles (flight, despawn)
  enemy.js          Brigands, scouts, thugs, wolves, bosses
  level.js          Levels 1–5 maps, themes, decor
  input.js          Keyboard + virtual stick / touch mapping
  sprites.js        Hand-drawn-style pixel sprites (maps + poses)
  constants.js      Resolution, states, level metadata
  ui.js             HTML overlay menus (title / clear / win / lose)
assets/             Optional sprite sheets (game uses canvas pixel art)
```

## Tech

Vanilla HTML / CSS / JS (ES modules). No build step, no backend. Fixed internal resolution **512×480** (NES-like), scaled up with `image-rendering: auto (painterly)`.

## Art

Visuals use hand-drawn-style **pixel sprites** (canvas-drawn pixel maps): Joseph with walk/jump/crouch/throw poses, engraved **gold-plate** projectiles, brigand/scout/thug/wolf and themed boss palettes, grass/dirt/water tiles, themed parallax backgrounds (woods, grove night, village, river mist, storm), cabin/buildings/fence accents, and clearer HUD hearts. Assets stay compact for phones.

## Changelog notes

- **Soft-lock fix (Palmyra Woods):** The boss-arena entrance used a full-height solid timber column (“the pole”) that was taller than Joseph’s jump, blocking progress. Entrance posts are decorative/non-solid now; the far arena wall remains.
- **Campaign (v8):** Levels 2–5 added with unique layouts, enemy mixes, bosses, level-clear transitions, and win screen after Temple Hill.
- **Crouch (v10):** Hold ↓ / S (or touch **↓**) on the ground to duck — shorter hurtbox, slow crawl, release duck to jump; crouch sprite pose.
- **Virtual stick (v11):** Mobile direction uses a circular D-pad / virtual stick (L/R/U/D); stick-up jumps, stick-down crouches; **A** kept as secondary jump; **B** attack unchanged.

## License / credit

Fan arcade tribute. Historical figure depicted respectfully as an arcade hero. Not affiliated with Nintendo or Konami.
