#!/usr/bin/env python3
"""
Painted cut-out cutter for the Joseph rig (Palmyra Quest).

Takes the ORIGINAL idle frame (assets/joseph.png, cell 0, 64x128) and cuts it into
rig parts. Every part keeps the real painted pixels; where one part hides another
at rest (arm over coat, thigh under hip, knee/elbow/ankle overlaps) the hidden
piece is extended by cloning neighbouring painted pixels, so rotations never open
gaps. Output is a 4x nearest-neighbour atlas (crisp when rotated) + JSON.

  python3 tools/rig/cut_joseph.py [--debug outdir]
"""
import json, math, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'assets', 'joseph.png')
def _arg(flag, default):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default
# --skin: a recolour of the same painting (e.g. the Presbyterian preacher, built by the
# live game from joseph.png). Ownership/colour tests run on Joseph's pixels; every
# copied pixel comes from the skin, so the cut is identical and the colours are its own.
SKIN = _arg('--skin', None)
NAME = _arg('--name', 'joseph')
OUT_PNG = os.path.join(ROOT, 'assets', 'rig', NAME + '-rig.png')
OUT_JSON = os.path.join(ROOT, 'assets', 'rig', NAME + '-rig.json')
UP = 4           # atlas upscale (nearest) so rotated parts stay crisp at 3x zoom
FW, FH = 64, 128

sheet = np.array(Image.open(SRC).convert('RGBA')).astype(np.int32)
JF = sheet[:, 0:FW].copy()         # Joseph idle frame 0 (ownership tests)
F = JF if SKIN is None else np.array(Image.open(SKIN).convert('RGBA')).astype(np.int32)[:, 0:FW].copy()
H_, W_ = F.shape[:2]

def opaque(x, y):
    return 0 <= x < W_ and 0 <= y < H_ and JF[y, x, 3] > 24

def blue(x, y):
    r, g, b, a = JF[y, x]
    return a > 24 and b > r + 6 and b >= g - 6

def lum(px):
    return 0.3 * px[0] + 0.59 * px[1] + 0.11 * px[2]

# ---------------------------------------------------------------- joints (model px)
J = {
    'pelvis': (35.0, 76.0),
    'neck': (33.0, 42.0),
    'nShoulder': (21.0, 50.0), 'nElbow': (20.5, 63.0), 'nWrist': (21.0, 76.0),
    'fShoulder': (39.5, 52.0), 'fElbow': (39.0, 65.0), 'fWrist': (39.5, 78.0),
    'skirt': (27.0, 72.0), 'tail': (21.0, 80.0), 'coatFar': (44.0, 74.0),
    # leg art comes from the fully visible right-hand leg in the idle frame
    'hipArt': (37.5, 76.0), 'kneeArt': (37.5, 100.0), 'ankleArt': (38.0, 119.5),
}

def far_arm_left(y):
    # slanted inner edge of the far sleeve (x where the sleeve starts)
    if y <= 46: return 40
    if y >= 70: return 43
    return int(round(40 + (y - 46) * 3 / 24))

# ---------------------------------------------------------------- ownership
def trim(x, y):
    """Tan/gold piping on the coat's front edge and hem."""
    r, g, b, a = JF[y, x]
    return a > 24 and r > 110 and g > 85 and r - b > 28 and g < r

# x of the coat's front-edge piping per row: everything left of it is coat skirt,
# right of it (until the visible leg) is the near trouser, which the rig re-draws.
trimX = {}
for y in range(70, 102):
    tx = None
    for x in range(33, 21, -1):
        if trim(x, y):
            tx = x
            break
    trimX[y] = tx
for y in range(70, 102):          # fill gaps by interpolation
    if trimX[y] is None:
        prev = next((trimX[k] for k in range(y - 1, 69, -1) if trimX[k] is not None), None)
        nxt = next((trimX[k] for k in range(y + 1, 102) if trimX[k] is not None), None)
        trimX[y] = prev if nxt is None else (nxt if prev is None else (prev + nxt) // 2)
trimX[100] = max(trimX[100] or 0, 25)
trimX[101] = max(trimX[101] or 0, 24)

owner = np.full((H_, W_), '', dtype=object)
for y in range(H_):
    for x in range(W_):
        if not opaque(x, y):
            continue
        tx = trimX.get(y)
        if 62 <= y <= 84 and 13 <= x <= (25 if y >= 76 else 24):
            o = 'nFore'
        elif 43 <= y <= 61 and 13 <= x <= 24:
            o = 'nUpper'
        elif y <= 40 or (y <= 42 and 26 <= x <= 38):
            o = 'head'
        elif 46 <= y <= 84 and x >= far_arm_left(y):
            o = 'fUpper' if y <= 63 else 'fFore'
        elif 85 <= y <= 101 and x >= 43:
            o = 'coatFar'
        elif tx is not None and x <= tx:
            o = 'tail' if (y >= 80 and x <= 20) else 'skirt'
        elif y >= 102 and x <= 32:
            o = 'drop'             # near boot (re-drawn by the rigged near leg)
        elif 75 <= y <= 84 and x <= 42:
            o = 'pelvis'
        elif y >= 76 and x >= 33:
            o = 'legArt'
        elif y >= 76:
            o = 'drop'             # near trouser sliver + shadow (re-drawn by the near leg)
        else:
            o = 'torso'
        owner[y, x] = o

def layer_from(names):
    L = np.zeros_like(F)
    for y in range(H_):
        for x in range(W_):
            if owner[y, x] in names:
                L[y, x] = F[y, x]
    return L

def put(L, x, y, px):
    if 0 <= x < W_ and 0 <= y < H_:
        L[y, x] = px

def dup(L, x0, x1, y0, y1, cond=None):
    """Duplicate original pixels (hidden under a higher part at rest) into L."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if opaque(x, y) and (cond is None or cond(x, y)) and L[y, x, 3] == 0:
                L[y, x] = F[y, x]

def clip_circle_outside(L, cx, cy, r, region):
    """Within region(x,y)==True, keep only pixels within r of (cx,cy) (rounded joint caps)."""
    for y in range(H_):
        for x in range(W_):
            if L[y, x, 3] and region(x, y) and math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r:
                L[y, x] = 0

def shade(L, k, tint=(0, 0, 0)):
    M = L.copy()
    m = M[..., 3] > 0
    for c in range(3):
        M[..., c][m] = np.clip(M[..., c][m] * k + tint[c], 0, 255)
    return M

# ---------------------------------------------------------------- parts
parts = {}

# HEAD + hair
head = layer_from({'head'})
parts['head'] = head

# TORSO / SKIRT / TAIL behind the near arm.
# The arm hides a strip of coat. It is repainted as cloth: the fold texture comes
# from the SAME columns of real coat painted below the hand (rows 86-99), its
# brightness is matched row-by-row to the coat visible just past the sleeve, and it
# darkens toward one smooth back silhouette (spline through the visible shoulder and
# hem outline) so the back reads as a continuous edge with no notches.
torso = layer_from({'torso'})
dup(torso, 27, 37, 36, 42, lambda x, y: owner[y, x] == 'head')    # neck under chin
skirt = layer_from({'skirt'})
tail = layer_from({'tail'})

BACK = [(43, 20.6), (47, 19.5), (56, 18.4), (66, 17.6), (76, 16.9), (86, 16.2), (92, 15.8)]
def back_x(y):
    for (y0, x0), (y1, x1) in zip(BACK, BACK[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            t = t * t * (3 - 2 * t) * 0.35 + t * 0.65      # gentle ease between keys
            return x0 + (x1 - x0) * t
    return BACK[-1][1]

ARM = ('nUpper', 'nFore')
def is_cloth(x, y):
    return opaque(x, y) and blue(x, y) and not trim(x, y) and owner[y, x] in ('torso', 'skirt', 'tail')
BAND = (86, 99)
band_cols = {}
for x in range(10, 34):
    col = [y for y in range(BAND[0], BAND[1] + 1) if is_cloth(x, y)]
    if col:
        band_cols[x] = col
band_lum = np.mean([lum(F[y, x]) for x, ys in band_cols.items() for y in ys])
def texture(x, y):
    """Real coat-cloth pixel for column x (nearest painted column), cycling its rows."""
    for dx in (0, 1, -1, 2, -2, 3, -3, 4, 5, 6):
        ys = band_cols.get(x + dx)
        if ys:
            return F[ys[(y * 7 + x) % len(ys)] if False else ys[(y - BAND[0]) % len(ys)], x + dx].copy()
    return F[BAND[0] + 4, 22].copy()
# brightness of the coat visible right of the sleeve, per row (smoothed)
row_lum = {}
for y in range(40, 100):
    xs = [x for x in range(12, 34) if owner[y, x] in ARM]
    x0 = (max(xs) + 1) if xs else int(back_x(y)) + 1
    vals = [lum(F[y, x]) for x in range(x0, x0 + 6) if is_cloth(x, y)]
    row_lum[y] = np.mean(vals) if vals else None
for y in range(40, 100):
    if row_lum[y] is None:
        near = [(abs(k - y), row_lum[k]) for k in row_lum if row_lum[k] is not None]
        row_lum[y] = min(near)[1] if near else band_lum
sm = {y: np.mean([row_lum[k] for k in range(y - 3, y + 4) if k in row_lum]) for y in row_lum}
edge_px = [F[y, x] for y in range(86, 100) for x in range(10, 22) if opaque(x, y) and (not opaque(x - 1, y))]
COAT_EDGE = min(edge_px, key=lum).copy() if edge_px else np.array([18, 26, 44, 255])
COAT_EDGE[3] = 255

def target(y, x):
    if y < 72: return torso
    if x <= 20 and y >= 80: return tail
    return skirt
for y in range(43, 93):
    xb = back_x(y)
    xbi = int(math.floor(xb + 0.5))
    for x in range(xbi, 27):
        hidden = owner[y, x] in ARM or (not opaque(x, y) and y >= 47)
        if not hidden:
            continue
        L = target(y, x)
        if L[y, x, 3]:
            continue
        px = texture(x, y)
        k = (sm[y] / max(1, band_lum))
        d = x - xb
        k *= 0.74 if d < 1.5 else 0.86 if d < 2.5 else 0.94 if d < 3.5 else 1.0
        px[:3] = np.clip(px[:3] * k, 0, 255)
        px[3] = 255
        L[y, x] = px
    # one dark outline pixel on the smooth back edge (only where the edge was hidden)
    if owner[y, xbi] in ARM or not opaque(xbi, y):
        target(y, xbi)[y, xbi] = COAT_EDGE
    # nothing may stick out past the smooth edge on the hidden rows
    if y < 86:
        for L in (torso, skirt, tail):
            for x in range(8, xbi):
                L[y, x] = 0
# rounded shoulder: no fill above the painted shoulder line
for y in range(43, 47):
    for x in range(16, 22):
        if not opaque(x, y):
            torso[y, x] = 0
dup(skirt, 15, 21, 80, 100, lambda x, y: owner[y, x] == 'tail')   # under the tail
parts['torso'] = torso

# PELVIS (trouser seat) — sits over both thigh tops so legs swing from inside it
pelvis = layer_from({'pelvis'})
# rounded bottom (crotch) so leg seams hide in the folds
clip_circle_outside(pelvis, 36.0, 76.0, 8.6, lambda x, y: y >= 80)
parts['pelvis'] = pelvis
parts['skirt'] = skirt
parts['tail'] = tail

# FAR COAT PANEL (far front edge of the coat). Extended up behind the far forearm.
cfar = layer_from({'coatFar'})
for y in range(58, 85):
    for x in range(43, 47):
        sy = y + 20 if y + 20 <= 100 else y + 10
        if cfar[y, x, 3] == 0 and opaque(x, sy) and owner[sy, x] == 'coatFar':
            cfar[y, x] = F[sy, x]
parts['coatFar'] = shade(cfar, 0.92)

# ARMS. Upper arm carries a rounded elbow cap (cloned from the forearm pixels it
# sits under) so bending never opens a hole; forearm top is trimmed round.
def arm(upper_name, fore_name, shoulder, elbow, k):
    up = layer_from({upper_name})
    fo = layer_from({fore_name})
    ex, ey = elbow
    for y in range(int(ey) - 1, int(ey) + 6):
        for x in range(int(ex) - 6, int(ex) + 7):
            if up[y, x, 3] == 0 and owner[y, x] == fore_name and math.hypot(x + .5 - ex, y + .5 - ey) <= 5.2:
                up[y, x] = F[y, x]
    clip_circle_outside(fo, ex, ey + 0.5, 5.6, lambda x, y: y < ey)
    return shade(up, k), shade(fo, k)

parts['nUpper'], parts['nFore'] = arm('nUpper', 'nFore', J['nShoulder'], J['nElbow'], 1.0)
# The painted far sleeve is only a 4px sliver (the rest is hidden by the chest in
# this 3/4 view), which reads as a stick once it swings. The far arm therefore
# re-uses the near arm's painting, darkened, hung BEHIND the torso at the far
# shoulder, so at rest only its front edge, cuff and hand show — as in the original.
parts['fUpper'], parts['fFore'] = shade(parts['nUpper'], 0.74, (0, 2, 8)), shade(parts['nFore'], 0.74, (0, 2, 8))
parts['fUpper'][:47] = 0   # its shoulder cap always sits behind the chest

# OPEN HANDS FOR PRAYER. The painting only has fists. For kneel-pray the forearms
# end at the cuff (fist removed) and one small painted part — two flat palms pressed
# together, fingers up — is drawn between the wrists. Its colours are sampled from
# the fist's own skin ramp and outline, so it matches the original painting.
WRIST_Y = 77
parts['nForeOpen'] = parts['nFore'].copy(); parts['nForeOpen'][WRIST_Y:] = 0
parts['fForeOpen'] = parts['fFore'].copy(); parts['fForeOpen'][WRIST_Y:] = 0
skin = [F[y, x] for y in range(77, 87) for x in range(14, 28)
        if opaque(x, y) and JF[y, x, 0] > JF[y, x, 2] + 30 and JF[y, x, 0] > 120]
skin.sort(key=lum)
ramp = {k: skin[int(q * (len(skin) - 1))].copy() for k, q in (('S', 0.12), ('M', 0.45), ('L', 0.75), ('H', 0.97))}
outl = [F[y, x] for y in range(77, 88) for x in range(13, 28) if opaque(x, y) and lum(JF[y, x]) < 70]
ramp['O'] = min(outl, key=lum).copy() if outl else np.array([40, 22, 16, 255])
HANDS = [
    "...OO..",
    "..OHMO.",
    "..OLMSO",
    ".OHLMSO",
    ".OLLMSO",
    "OOLLMSO",
    "OSLLMSO",
    "OLLMMSO",
    ".OLMSSO",
    ".OMMSO.",
    "..OOO..",
]
ph = np.zeros_like(F)
HX, HY = 40, 20            # paint location (any free area of the 64x128 canvas)
for j, row in enumerate(HANDS):
    for i, c in enumerate(row):
        if c != '.':
            ph[HY + j, HX + i] = ramp[c]; ph[HY + j, HX + i, 3] = 255
parts['prayHands'] = ph
PRAY_PIVOT = (HX + 3.5, HY + len(HANDS) - 0.5)

# LEGS — real painted trouser + boot pixels from the visible leg, with thickness.
hx, hy = J['hipArt']; kx, ky = J['kneeArt']; ax, ay = J['ankleArt']
def leg_src_box(x0, x1, y0, y1):
    L = np.zeros_like(F)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            sy = max(y, 77)                     # above the hip: clone the first trouser row
            if opaque(x, sy) and not (owner[sy, x] == 'coatFar') and not (x >= 43 and sy < 101):
                L[y, x] = F[sy, x]
    return L

thigh = leg_src_box(33, 42, 70, 105)
# capsule hip→knee, radius ~ half the trouser width, round knee cap
def capsule_clip(L, x0, y0, x1, y1, r):
    for y in range(H_):
        for x in range(W_):
            if not L[y, x, 3]:
                continue
            px, py = x + .5, y + .5
            t = max(0, min(1, ((px - x0) * (x1 - x0) + (py - y0) * (y1 - y0)) / ((x1 - x0) ** 2 + (y1 - y0) ** 2)))
            qx, qy = x0 + t * (x1 - x0), y0 + t * (y1 - y0)
            if math.hypot(px - qx, py - qy) > r:
                L[y, x] = 0
capsule_clip(thigh, hx, hy - 2, kx, ky, 5.6)
shin = leg_src_box(32, 44, 94, 123)
capsule_clip(shin, kx, ky - 1, ax, ay + 1, 6.4)
foot = np.zeros_like(F)
for y in range(113, 127):
    for x in range(32, 50):
        if opaque(x, y):
            foot[y, x] = F[y, x]
clip_circle_outside(foot, ax, ay + 0.5, 4.6, lambda x, y: y < 120)

for side, k in (('n', 1.0), ('f', 0.8)):
    parts[side + 'Thigh'] = shade(thigh, k)
    parts[side + 'Shin'] = shade(shin, k)
    parts[side + 'Foot'] = shade(foot, k)

# ---------------------------------------------------------------- seam overlap
# Each part slides 1-2px under the parts drawn above it (cloned original pixels),
# so bilinear filtering never shows a hairline seam where two parts meet.
DIL = {
    # (never clone pixels of parts that MOVE away, e.g. the arms: they would leave a fringe)
    'torso': ({'skirt', 'tail'}, 2),
    'pelvis': ({'torso', 'skirt'}, 2),
    'skirt': ({'tail'}, 2),
    'coatFar': ({'pelvis', 'torso', 'legArt'}, 1),
    'nUpper': ({'nFore'}, 2),
}
for name, (targets, r) in DIL.items():
    L = parts[name]
    base = L[..., 3] > 0
    add = np.zeros_like(base)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy > r * r + 1:
                continue
            add |= np.roll(np.roll(base, dy, 0), dx, 1)
    for y, x in zip(*np.nonzero(add & ~base)):
        if owner[y, x] in targets:
            L[y, x] = F[y, x] if name not in ('coatFar', 'fUpper') else L[y, x] * 0 + shade(F[y:y+1, x:x+1], 0.92 if name == 'coatFar' else 0.86)[0, 0]

# Back of the waist: when the run leans the torso forward its back-bottom corner lifts
# ~3px off the coat skirt. Let the torso carry 5 more rows of the (repainted) skirt cloth
# there, tucked under the skirt at rest, so the lean never opens a gap.
T_, S_, TL_ = parts['torso'], parts['skirt'], parts['tail']
for x in range(8, 27):
    ys_ = np.nonzero(T_[:, x, 3])[0]
    if not len(ys_):
        continue
    yb = ys_.max()
    for y in range(yb + 1, min(yb + 6, T_.shape[0])):
        src = S_ if S_[y, x, 3] else TL_ if TL_[y, x, 3] else None
        if src is not None:
            T_[y, x] = src[y, x]

# ---------------------------------------------------------------- atlas
pivots = {
    'head': J['neck'], 'torso': J['pelvis'], 'pelvis': J['pelvis'],
    'skirt': J['skirt'], 'tail': J['tail'], 'coatFar': J['coatFar'],
    'nUpper': J['nShoulder'], 'nFore': J['nElbow'],
    'fUpper': J['nShoulder'], 'fFore': J['nElbow'],
    'nForeOpen': J['nElbow'], 'fForeOpen': J['nElbow'], 'prayHands': PRAY_PIVOT,
    'nThigh': J['hipArt'], 'nShin': J['kneeArt'], 'nFoot': J['ankleArt'],
    'fThigh': J['hipArt'], 'fShin': J['kneeArt'], 'fFoot': J['ankleArt'],
}
pad = 1
crops = {}
for name, L in parts.items():
    ys, xs = np.nonzero(L[..., 3])
    x0, x1, y0, y1 = xs.min() - pad, xs.max() + pad, ys.min() - pad, ys.max() + pad
    crops[name] = (max(0, x0), max(0, y0), min(W_ - 1, x1), min(H_ - 1, y1))

# simple shelf packing at 4x
order = sorted(parts, key=lambda n: -(crops[n][3] - crops[n][1]))
AW = 512
cx = cy = rowh = 0
place = {}
for n in order:
    x0, y0, x1, y1 = crops[n]
    w, h = (x1 - x0 + 1) * UP, (y1 - y0 + 1) * UP
    if cx + w > AW:
        cx, cy, rowh = 0, cy + rowh + 4, 0
    place[n] = (cx, cy, w, h)
    cx += w + 4
    rowh = max(rowh, h)
AH = cy + rowh
atlas = Image.new('RGBA', (AW, AH), (0, 0, 0, 0))
meta = {'scale': UP, 'cell': [FW, FH], 'ground': 126, 'joints': J, 'parts': {},
        'skel': {'ground': 126, 'thigh': 24, 'shin': 20, 'hipN': [30.5, 76], 'hipF': [38, 76],
                 'restN': [26.5, 119.5], 'restF': [38, 119.5],
                 'ankleArt': list(J['ankleArt']), 'heelArt': [34.5, 126], 'toeArt': [48.5, 126],
                 'hipArt': list(J['hipArt']), 'kneeArt': list(J['kneeArt']),
                 'upperArm': 13, 'forearm': 17, 'nShoulder': list(J['nShoulder']), 'fShoulder': list(J['fShoulder']),
                 'farArmRest': -11, 'phi': {}}}
EXTRA = {'skirt': {'flex': 6}, 'tail': {'flex': 6},
         'nFore': {'wrist': [21.5, 76.5], 'hand': [22.0, 81.0]}, 'fFore': {'wrist': [21.5, 76.5], 'hand': [22.0, 81.0]},
         'nForeOpen': {'wrist': [21.5, 76.5], 'hand': [22.0, 81.0]}, 'fForeOpen': {'wrist': [21.5, 76.5], 'hand': [22.0, 81.0]}}
for n in parts:
    x0, y0, x1, y1 = crops[n]
    im = Image.fromarray(parts[n][y0:y1 + 1, x0:x1 + 1].astype(np.uint8), 'RGBA')
    im = im.resize((im.width * UP, im.height * UP), Image.NEAREST)
    ax_, ay_, w, h = place[n]
    atlas.paste(im, (ax_, ay_))
    meta['parts'][n] = {'x': int(ax_), 'y': int(ay_), 'w': int(w), 'h': int(h), 'ox': int(x0), 'oy': int(y0), 'pivot': list(pivots[n]), **EXTRA.get(n, {})}
os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
atlas.save(OUT_PNG, optimize=True)
with open(OUT_JSON, 'w') as f:
    json.dump(meta, f, indent=1)
print('atlas', atlas.size, 'parts', len(parts))

if '--debug' in sys.argv:
    out = sys.argv[sys.argv.index('--debug') + 1]
    os.makedirs(out, exist_ok=True)
    pal = {'head': (255, 80, 80), 'torso': (80, 200, 80), 'nUpper': (80, 80, 255), 'nFore': (0, 200, 255),
           'fUpper': (200, 0, 200), 'fFore': (255, 0, 255), 'pelvis': (255, 200, 0), 'legArt': (160, 100, 40),
           'drop': (0, 0, 0), 'tail': (255, 140, 0), 'skirt': (0, 120, 120), 'coatFar': (120, 120, 0)}
    dbg = np.zeros((H_, W_, 4), np.uint8)
    for y in range(H_):
        for x in range(W_):
            if owner[y, x]:
                dbg[y, x, :3] = pal[owner[y, x]]; dbg[y, x, 3] = 255
    Image.fromarray(dbg).resize((W_ * 6, H_ * 6), Image.NEAREST).save(os.path.join(out, 'owners.png'))
    sheet_im = Image.new('RGBA', (W_ * len(parts) * 3, H_ * 3), (190, 215, 190, 255))
    for i, n in enumerate(parts):
        im = Image.fromarray(parts[n].astype(np.uint8), 'RGBA').resize((W_ * 3, H_ * 3), Image.NEAREST)
        sheet_im.alpha_composite(im, (i * W_ * 3, 0))
    sheet_im.save(os.path.join(out, 'parts.png'))
    print('debug ->', out, list(parts))
