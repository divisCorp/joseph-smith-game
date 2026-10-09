#!/usr/bin/env python3
"""
The ch. 5 warden repainted for the period (1830s jailer/constable), by hand in code
(no image generation). Starts from his painted frame 0 (bosses.png row 3) and keeps
his face, body, belt, arms and legs; replaces the medieval mail coif with
  * a black top hat (hat band, curled brim), short brown hair and sideburns, an ear,
  * a neck, black stock and white shirt-collar points,
  * the shoulders and stand collar of his blue coat (where the coif's mantle lay),
the gold baldric becomes plain coat cloth with a row of brass buttons, and a ring of
jail keys hangs from his belt. His mace is replaced by a plain wooden staff
(assets/rig/warden-staff.png, painted here too).

  python3 tools/rig/paint_warden.py [--zoom out.png]
Outputs tools/rig/src/warden_1830s.png (80x160) + assets/rig/warden-staff.{png,json}.
"""
import json, math, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import men_lib as ml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'tools', 'rig', 'src')
ml.set_size(80, 160)
W, H = 80, 160
XX, YY = ml.XX, ml.YY

src = np.array(Image.open(os.path.join(SRC, 'bosses.png')).convert('RGBA'))[480:640, 0:80].astype(float)
F = src.copy()
A = F[..., 3] > 128
r, g, b = F[..., 0], F[..., 1], F[..., 2]

COAT = ml.ramp(['#0e1422', '#1c2840', '#2c4468', '#3e5a84', '#56729c'])
SKIN = ml.ramp(['#7a4a30', '#d48e62', '#f4b986', '#fbc898', '#ffdcb6'])
HAIR = ml.ramp(['#120a06', '#24160c', '#3a2414', '#52341e', '#6c482c'])
HAT = ml.ramp(['#050508', '#0e0e14', '#1a1a24', '#2a2a38', '#40404f'])
WHITE = ml.ramp(['#6a6c72', '#a8aab0', '#d4d4d8', '#ececee', '#fbfbf8'])
IRON = ml.ramp(['#141416', '#2c2c30', '#4a4a50', '#707078', '#a4a4aa'])
BRASS = ml.ramp(['#4a3210', '#80581c', '#b88a30', '#e0b850', '#f8e090'])

# ---- 1. keep the painted face; clear the coif and its mantle ---------------------------
face_keep = ml.poly([(39.2, 34.0), (58.5, 33.2), (62.4, 40.0), (63.2, 50.0), (61.6, 56.5), (58.4, 62.4), (46.0, 64.0),
                     (40.2, 58.0), (39.0, 45.0)])
coat_keep = (YY > 78.5) | ((YY > 70) & (b > r + 12) & A)
clear = (YY < 80) & ~face_keep & ~coat_keep
F[clear] = 0
# the coif's dark edge ran along the top of the forehead (y 33-35): repaint it as skin
fore = ml.poly([(40.0, 29.0), (58.0, 28.6), (61.6, 33.0), (62.2, 38.0), (40.0, 38.0)])
P = ml.Part()
P.rgb[:] = F[..., :3]
P.a[:] = F[..., 3] > 128

# ---- 2. the gold baldric (and its dark edges) becomes coat cloth + brass buttons -----------
band = (ml.cap(31.0, 98.0, 58.0, 75.0, 4.4, 4.4) | ml.cap(34.0, 100.0, 58.0, 79.0, 4.0, 4.0)) & (YY < 96.5) & (YY > 72)
belt = (YY > 95.5) & (YY < 105)
strap = band & A & ~belt
coat_px = A & ~band & (b > r + 12) & (YY > 72) & (YY < 99)
for y, x in zip(*np.nonzero(strap)):
    row = [F[y, xx, :3] for xx in range(max(0, x - 9), min(W, x + 10)) if coat_px[y, xx]]
    if not row:
        row = [F[yy, x, :3] for yy in range(max(0, y - 6), min(H, y + 7)) if coat_px[yy, x]]
    if row:
        P.rgb[y, x] = np.median(np.array(row), axis=0)
# the coif's dark edge left lines along the back of the face and the forehead: repaint as skin
lum = 0.3 * F[..., 0] + 0.59 * F[..., 1] + 0.11 * F[..., 2]
protect = ml.poly([(44.5, 35.5), (57.5, 35.5), (57.5, 49.0), (44.5, 49.0)]) | ml.poly([(53.0, 54.5), (60.0, 54.5), (60.0, 59.5), (53.0, 59.5)])
skin_like = face_keep & A & (r > 170) & (g > 110)
dark_edge = face_keep & A & (lum < 150) & ~protect & ((XX < 44) | (YY < 37))
for y, x in zip(*np.nonzero(dark_edge)):
    nb = [F[yy, xx, :3] for yy in range(y - 3, y + 4) for xx in range(x - 3, x + 4)
          if 0 <= yy < H and 0 <= xx < W and skin_like[yy, xx]]
    if nb:
        P.rgb[y, x] = np.median(np.array(nb), axis=0) * 0.97

# ---- 3. hair, ear and jaw behind the face --------------------------------------------------
skull = ml.poly([(24.4, 54.0), (21.4, 45.0), (22.0, 36.0), (24.6, 30.0), (30.0, 26.0), (42.0, 25.6), (44.0, 30.0), (41.6, 34.0), (40.2, 40.0),
                 (40.8, 47.0), (42.6, 55.0), (41.4, 62.0), (34.0, 65.0), (27.0, 61.0)], smooth=True)
jaw = ml.poly([(38.6, 40.0), (40.4, 34.0), (44.0, 34.0), (44.0, 63.0), (40.0, 60.0), (38.4, 52.0)], smooth=True) & ~face_keep
P.fill(skull & ~face_keep, HAIR, ml.light(skull, base=0.45, kx=0.12, ky=-0.12, kf=0.45, cx=32, cy=40, noise=0.08, cell=2.5, seed=3))
# combed strands
rng = np.random.default_rng(4)
for k in range(9):
    y0 = 30 + k * 3.3 + rng.random()
    x0 = 24.5 + rng.random() * 2
    P.tone(ml.line_mask([(x0, y0), (x0 + 5, y0 + 1.6), (x0 + 11, y0 + 0.6)], smooth=True) & skull & ~face_keep, 0.82 if k % 2 else 1.15)
P.fill(jaw, SKIN, ml.light(jaw, base=0.5, kx=0.2, cx=41, kf=0.3))
burn = ml.poly([(38.6, 38.0), (42.0, 38.4), (42.4, 50.0), (41.2, 56.0), (39.0, 52.0)], smooth=True) & ~face_keep
P.fill(burn, HAIR, ml.light(burn, base=0.38, kx=0.1, cx=40, kf=0.3, noise=0.06, seed=5))
ear = ml.ell(36.4, 48.6, 2.6, 3.8)
P.fill(ear, SKIN, ml.light(ear, base=0.5, kx=0.15, cx=36.4, kf=0.4))
P.tone(ml.dots([(36.0, 48.0), (36.0, 49.0), (37.0, 50.0)]), 0.75)
P.fill(fore & ~face_keep, SKIN, ml.light(fore, base=0.7, kx=0.12, ky=0.2, cy=33, cx=50, kf=0.2))
# brow-ridge shadow under the brim
P.tone(ml.poly([(40.5, 29.0), (60.0, 29.0), (60.0, 31.0), (40.5, 31.0)]), 0.86)

# ---- 4. neck, stock and collar points ---------------------------------------------------------
neck = ml.poly([(41.6, 58.0), (53.6, 60.0), (54.4, 69.0), (36.0, 69.0), (34.0, 62.0)])
P.fill(neck & ~(face_keep & P.a), SKIN, ml.light(neck, base=0.38, kx=0.25, cx=48, kf=0.2))
stock = ml.poly([(40.6, 64.2), (55.6, 63.6), (56.8, 69.6), (49.0, 71.0), (41.0, 69.6)])
P.fill(stock, ml.ramp(['#020203', '#0a0a0c', '#16161a', '#24242a', '#383840']), ml.light(stock, base=0.42, kx=0.2, cx=48, kf=0.3))
pts = ml.poly([(53.6, 64.6), (57.8, 61.8), (58.6, 65.0), (56.0, 66.0)])
P.fill(pts, WHITE, 0.82)

# ---- 5. coat shoulders and stand collar where the mantle lay ------------------------------------
sh = ml.poly([(13.4, 82.0), (14.0, 76.0), (17.4, 71.4), (24.0, 68.0), (33.0, 66.0), (41.0, 67.0), (41.0, 70.0), (57.0, 70.4),
              (60.0, 67.0), (63.6, 70.4), (65.4, 76.0), (66.0, 82.0)], smooth=True)
need = sh & ~(P.a & (YY > 78.5))
P.fill(need, COAT, ml.light(sh, base=0.5, kx=0.12, ky=-0.1, cx=40, cy=76, kf=0.5, noise=0.05, cell=3, seed=9))
# feather the join into the painted coat below (rows 76-81): mix toward the old pixels
for y in range(76, 82):
    t = (y - 75) / 7.0
    for x in range(W):
        if need[y, x] and src[min(H - 1, y + 3), x, 3] > 128 and b[min(H - 1, y + 3), x] > r[min(H - 1, y + 3), x] + 10:
            P.rgb[y, x] = P.rgb[y, x] * (1 - t) + src[min(H - 1, y + 3), x, :3] * t
collar = ml.poly([(31.0, 64.6), (41.6, 64.0), (42.4, 71.0), (30.4, 72.0), (28.0, 68.0)], smooth=True)
P.fill(collar, COAT, ml.light(collar, base=0.62, kx=0.15, cx=36, kf=0.4))
lap = ml.poly([(56.6, 67.4), (61.0, 66.2), (63.0, 72.0), (59.4, 78.0), (57.4, 74.0)], smooth=True)
P.fill(lap, COAT, ml.light(lap, base=0.66, kx=0.15, cx=60, kf=0.4))
P.tone(ml.line_mask([(57.6, 68.0), (58.4, 74.0), (59.4, 78.0)], smooth=True), 0.55)
# shoulder seam / fold lines
P.tone(ml.line_mask([(20.0, 74.0), (25.0, 71.0), (30.0, 70.4)], smooth=True) & sh, 1.2, 4)
# coat front opening + brass buttons (the old baldric's place)
P.tone(ml.line_mask([(58.6, 78.0), (58.6, 96.0)]) & P.a, 0.55)
for y in (80.5, 86.5, 92.5):
    P.solid(ml.dots([(56.5, y)]), BRASS.cols[3])
    P.solid(ml.dots([(56.5, y + 1)]), BRASS.cols[1])
    P.tone(ml.dots([(57.5, y + 1)]), 0.7)

# ---- 6. a ring of jail keys on the belt ------------------------------------------------------------
ring = ml.ell(56.0, 106.4, 3.2, 3.2) & ~ml.ell(56.0, 106.4, 1.5, 1.5)
P.fill(ring, IRON, ml.light(ring, base=0.62, kx=0.2, cx=56, kf=0.2))
keys = ring.copy()
for kx_, ang in ((53.8, 0.25), (58.4, -0.2)):
    L = 10.0
    x1, y1 = kx_ + math.sin(ang) * -L, 109.0 + math.cos(ang) * L
    bow = ml.ell(kx_, 109.8, 1.8, 1.8) & ~ml.ell(kx_, 109.8, 0.6, 0.6)
    stem = ml.cap(kx_, 110.6, x1, y1, 0.85, 0.85)
    bit = ml.poly([(x1 - 0.4, y1 - 3.4), (x1 + 2.8, y1 - 3.2), (x1 + 2.8, y1 - 0.2), (x1 - 0.4, y1 + 0.2)])
    km = stem | bit | bow
    P.fill(km, IRON, ml.light(km, base=0.66, kx=0.25, cx=kx_, kf=0.2))
    P.tone(ml.dots([(x1 + 1.2, y1 - 1.8)]), 0.4)
    keys |= km
# dark rim so the iron reads against the blue coat
P.tone(ml.dilate(keys, 1) & ~keys & P.a, 0.42)
P.tone(ml.dots([(56.5, 104.5)]), 1.4, 20)

# ---- 7. the top hat (drawn last: it sits over the hair and forehead) ----------------------------------
crown = ml.poly([(27.4, 26.0), (28.6, 14.0), (28.0, 6.0), (30.0, 3.4), (56.0, 3.0), (58.4, 5.6), (57.6, 14.0), (58.6, 26.0)])
brim = ml.poly([(17.6, 25.4), (22.0, 23.6), (30.0, 24.6), (56.0, 24.4), (64.0, 23.4), (68.4, 25.0), (66.0, 28.6), (58.0, 29.8),
                (30.0, 30.0), (21.0, 29.0)], smooth=True)
hv = ml.light(crown, base=0.42, kx=0.22, cx=43, kf=0.45, noise=0.03, seed=11)
hv = hv + 0.18 * np.exp(-((XX - 52.5) ** 2) / 3.0) * (YY < 22)          # felt sheen down the lit side
P.fill(crown, HAT, hv)
P.fill(ml.poly([(27.6, 20.2), (58.4, 20.0), (58.6, 24.6), (27.4, 24.8)]) & crown, HAT, 0.12)        # hat band
P.fill(brim, HAT, ml.light(brim, base=0.4, kx=0.2, cx=43, ky=-0.6, cy=27, kf=0.3))
P.tone(ml.line_mask([(20.0, 26.4), (30.0, 27.4), (56.0, 27.2), (66.0, 26.2)], smooth=True) & brim, 1.5, 10)   # brim edge catch-light
P.tone(ml.line_mask([(29.4, 6.0), (56.6, 5.6)]) & crown, 1.35, 6)

# ---- the old coif's pale edge left a seam down the back of the face: repaint as skin
sat = np.abs(P.rgb[..., 0] - P.rgb[..., 2])
seam = face_keep & P.a & (XX < 42.5) & (YY > 33) & (YY < 60) & (sat < 60) & ~(skull & ~face_keep)
for y, x in zip(*np.nonzero(seam)):
    nb = [P.rgb[yy, xx] for yy in range(y - 2, y + 3) for xx in range(x, min(W, x + 5))
          if face_keep[yy, xx] and not seam[yy, xx] and P.rgb[yy, xx, 0] > 170]
    if nb:
        P.rgb[y, x] = np.median(np.array(nb), axis=0) * 0.95
# smooth the strip behind the cheek (x 39-44): one soft turn into shadow instead of a pale line
cheek = face_keep & P.a & (XX >= 45) & (XX <= 50) & (YY > 36) & (YY < 56) & (P.rgb[..., 0] > 200) & (P.rgb[..., 2] < 170)
base = np.median(P.rgb[cheek], axis=0)
strip = P.a & (XX >= 39) & (XX <= 44) & (YY >= 33) & (YY <= 58) & (P.rgb[..., 0] > 170) & ~ear
P.rgb[strip] = base * (0.82 + 0.03 * (XX[strip] - 39))[:, None]
# motion streaks on the legs (1-2 px flecks): morphological opening below the knees
low = (YY > 117) & (YY < 152)
opened = ml.dilate(ml.erode(P.a), 1)
P.a[low & P.a & ~opened] = False
# brown streak flecks over the blue trousers (above the boot tops)
rr, gg, bb = P.rgb[..., 0], P.rgb[..., 1], P.rgb[..., 2]
fleck = P.a & (YY > 119) & (YY < 132) & (rr > bb + 25) & (rr > gg)
P.a[fleck] = False
# motion flecks around the legs in the source frame: drop small detached bits
seen = np.zeros_like(P.a)
for y0, x0 in zip(*np.nonzero(P.a)):
    if seen[y0, x0]:
        continue
    stack, comp = [(y0, x0)], []
    seen[y0, x0] = True
    while stack:
        y, x = stack.pop()
        comp.append((y, x))
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and P.a[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True
                stack.append((yy, xx))
    if len(comp) < 25:
        for y, x in comp:
            P.a[y, x] = False

# ---- outline the new work (old painted edges keep theirs) -------------------------------------------
new = ~(src[..., 3] > 128) | clear | strap
edge = P.a & ~ml.erode(P.a)
oc = edge & ml.dilate(new & P.a, 1)
P.rgb[oc] = P.rgb[oc] * 0.34 + np.array([6, 4, 4]) * 0.4
out = P.rgba()
# speckle cleanup: isolated opaque pixels outside the figure (source compression flecks)
a8 = (out[..., 3] > 0).astype(int)
nb = sum(np.roll(np.roll(a8, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - a8
out[(nb <= 1)] = 0
Image.fromarray(out).save(os.path.join(SRC, 'warden_1830s.png'))
print('warden_1830s.png')


# ---- the wooden staff (body-frame px; grip = where his fist closes) ---------------------------------
def staff():
    ml.set_size(16, 100)
    WOOD = ml.ramp(['#2a160a', '#4e2e16', '#7a4c26', '#a06a3a', '#c48c54'])
    L = 95.0
    sh = ml.cap(8.0, 6.0, 8.0, L, 2.0, 1.7)
    knob = ml.ell(8.0, 5.0, 3.0, 3.4)
    S = ml.Part()
    v = ml.light(sh | knob, base=0.5, kx=0.35, cx=8, kf=0.4, noise=0.0)
    S.fill(sh | knob, WOOD, v)
    # grain: long thin darker streaks, a couple of knots
    for x0, y0, y1 in ((7.0, 14, 46), (8.6, 40, 70), (7.4, 62, 88)):
        S.tone(ml.line_mask([(x0, y0), (x0 + 0.4, y1)]) & sh, 0.82)
    for ky in (33, 70):
        S.tone(ml.dots([(8.0, ky), (8.0, ky + 1)]), 0.6)
    ferrule = ml.poly([(5.8, L - 6), (10.2, L - 6), (10.0, L + 1.6), (6.0, L + 1.6)]) & (sh | ml.ell(8, L, 2.2, 2))
    S.fill(ferrule, IRON, ml.light(ferrule, base=0.55, kx=0.3, cx=8, kf=0.3))
    S.tone(ml.dots([(7.0 + i, 9.0) for i in range(3)]), 0.6)          # turned groove under the knob
    S.outline(0.38)
    im = Image.fromarray(S.rgba())
    im.save(os.path.join(ROOT, 'assets', 'rig', 'warden-staff.png'))
    meta = {'grip': [8.0, 44.0], 'gripLow': [8.0, 72.0], 'w': 16, 'h': 100, 'bodyScale': True}
    json.dump(meta, open(os.path.join(ROOT, 'assets', 'rig', 'warden-staff.json'), 'w'))
    print('warden-staff', meta)


staff()
if '--zoom' in sys.argv:
    o = sys.argv[sys.argv.index('--zoom') + 1]
    z = Image.new('RGBA', (80 * 5 + 16 * 5 + 20, 160 * 5), (170, 205, 170, 255))
    z.alpha_composite(Image.fromarray(out).resize((400, 800), Image.NEAREST), (0, 0))
    z.alpha_composite(Image.open(os.path.join(ROOT, 'assets', 'rig', 'warden-staff.png')).resize((80, 580), Image.NEAREST), (420, 100))
    z.save(o)
