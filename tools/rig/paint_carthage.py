#!/usr/bin/env python3
"""
Hand-painted Carthage men (June 27, 1844): Hyrum Smith, John Taylor, Willard Richards.

No AI imagery. Each figure is painted pixel by pixel on the house figure template
(adult Joseph's idle painting: same pose, outline weight, shading and pixel density as
the rest of the painted cast). What is painted here, per man:
  * clothing recoloured onto 1840s ramps (dark frock coat without piping, waistcoat,
    stock or cravat, dark trousers, black boots), keeping the painted fold shading;
  * a new head of hair (shape, parting, hairline, colour) and brows, painted with
    the cast's ramp-and-outline shading; forehead/ear skin painted where Joseph's
    fringe used to be;
  * Willard Richards: a fuller face (jowl and second chin) and a watch chain on a
    buff waistcoat; he is also drawn larger in game (taller and broader).
Output: tools/rig/src/carthage_<name>.png, aligned to joseph.png frame 0, so the
Joseph cutter (--skin) cuts each man exactly like Joseph.

  python3 tools/rig/paint_carthage.py [--debug out.png]
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'assets', 'joseph.png')
OUT = os.path.join(ROOT, 'tools', 'rig', 'src')
J = np.array(Image.open(SRC).convert('RGBA'))[:, 0:64].astype(float)
H, W = J.shape[:2]


def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def ramp(cols, v):
    """Sample a dark→light colour ramp at v in [0,1]."""
    v = min(1.0, max(0.0, v))
    f = v * (len(cols) - 1)
    i = min(len(cols) - 2, int(f))
    k = f - i
    return cols[i] * (1 - k) + cols[i + 1] * k


def lum(p):
    return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]


def poly_mask(pts):
    im = Image.new('L', (W * 4, H * 4), 0)
    ImageDraw.Draw(im).polygon([(x * 4, y * 4) for x, y in pts], fill=255)
    m = np.array(im.resize((W, H), Image.BOX)) > 127
    return m


def disk(cx, cy, r):
    yy, xx = np.mgrid[0:H, 0:W]
    return (xx + .5 - cx) ** 2 + (yy + .5 - cy) ** 2 <= r * r


# ---------------------------------------------------------------- classify Joseph's pixels
A = J[..., 3] > 24
cls = np.full((H, W), '', object)
for y in range(H):
    for x in range(W):
        if not A[y, x]:
            continue
        r, g, b, a = J[y, x]
        L = lum(J[y, x])
        skin = r > 170 and g > 110 and b > 70 and r - b > 40 and r > g + 25
        if b > r + 6 and b >= g - 6:
            c = 'coat'
        elif skin and (y < 44 or 74 <= y <= 92):
            c = 'skin'
        elif r > 110 and g > 85 and r - b > 28 and g < r and 44 <= y <= 104:
            c = 'trim'
        elif L > 150 and 38 <= y <= 60:
            c = 'shirt'
        elif y <= 42 and L >= 26:
            c = 'hair'
        elif L < 26:
            c = 'dark'
        elif y >= 103:
            c = 'boot'
        elif 43 <= y <= 79 and 26 <= x <= 44:
            c = 'vest'
        else:
            c = 'trouser'
        cls[y, x] = c
# dark pixels take the class of their surroundings (they are that cloth's outline/folds)
dk = list(zip(*np.nonzero(cls == 'dark')))
for y, x in dk:
    votes = {}
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and cls[yy, xx] not in ('', 'dark'):
                votes[cls[yy, xx]] = votes.get(cls[yy, xx], 0) + 1
    cls[y, x] = max(votes, key=votes.get) if votes else 'dark'
cls[(cls == 'dark') & A] = 'outline'

# source luminance range per class (for ramp mapping)
LUM = np.array([[lum(J[y, x]) for x in range(W)] for y in range(H)])
RNG = {}
for c in set(cls[A]):
    v = LUM[cls == c]
    RNG[c] = (np.percentile(v, 2), np.percentile(v, 98))

# ---------------------------------------------------------------- the three men
SKIN = [hexc('#5a2c1c'), hexc('#b8704a'), hexc('#e09a6c'), hexc('#f4b886'), hexc('#fcd2a8')]
MEN = {
    'hyrum': dict(
        label='Hyrum Smith',
        coat=['#08080a', '#16161c', '#24242c', '#33333d', '#454552'],
        vest=['#0a0a0c', '#18181c', '#26262b', '#35353c', '#46464e'],
        trouser=['#0c0c0e', '#1c1c20', '#2c2c32', '#3c3c44', '#4e4e58'],
        boot=['#060504', '#120e0c', '#1e1814', '#2c241e', '#3c322a'],
        neck='stock',   # black silk stock over a white collar
        hair=['#0c0705', '#1c120c', '#2c1c12', '#3e2a1c', '#54392a'],
        # silhouette of the hair (model px), and where the face/forehead shows
        hairS=[(17, 30), (16.5, 23), (19, 18), (24.5, 14.8), (31, 13.6), (38, 14.2), (43, 17), (45.5, 21.5),
               (44.5, 24), (40, 24.2), (35, 25.5), (32, 28.5), (31, 33), (29.5, 37), (26.5, 39.5), (22, 40), (18.5, 37.5)],
        tips=[[(17, 32), (20.5, 37), (15.5, 39)], [(20, 37), (24.5, 39.5), (19.5, 42.5)], [(24, 38.5), (28.5, 38), (25.5, 42.5)],
              [(24, 15.5), (30, 13.8), (26, 12.2)], [(31, 14), (37, 14), (35, 12.4)], [(29.5, 32), (31.6, 32), (30.6, 37.6)]],
        over=[[(39.5, 23), (45.5, 21.5), (44.6, 26.8)], [(36, 24.2), (41, 23.8), (38.4, 27.2)], [(33, 25.6), (37, 25), (34.2, 28.4)]],
        face=[(32, 28.5), (35, 26.3), (38.5, 25.4), (43.5, 25.2), (45, 27), (45, 43), (30, 43), (29.6, 37)],
        part=(36.5, 14.6), locks=12, curl=0.6,
        ear=(27.5, 32.2),
    ),
    'taylor': dict(
        label='John Taylor',
        coat=['#060608', '#111116', '#1d1d24', '#2b2b35', '#3d3d4a'],
        vest=['#14060a', '#2a0e16', '#401822', '#562430', '#6e3440'],
        trouser=['#121214', '#24242a', '#36363e', '#48484f', '#5c5c64'],
        boot=['#060504', '#120e0c', '#1e1814', '#2c241e', '#3c322a'],
        neck='cravat',
        hair=['#060506', '#121014', '#1e1a1e', '#2c272c', '#3e373c'],
        hairS=[(17.5, 30), (17, 23), (20, 17.6), (26, 14.6), (33, 14), (39.5, 15.2), (44, 18.6), (45, 22.4),
               (42, 23.4), (37, 24.4), (33.4, 26.4), (31.2, 30), (30.6, 35), (28.5, 38.4), (25, 39.6), (21, 39), (18.5, 36)],
        tips=[[(18, 34), (21.5, 38), (17, 39.5)], [(21.5, 38.4), (25.5, 39.5), (22, 42)], [(41, 15.8), (45.5, 18), (44.4, 15.4)]],
        over=[[(41.5, 22.2), (45.4, 21.6), (44.2, 25.4)]],
        face=[(31.4, 29.5), (33.8, 26.8), (37.6, 25.1), (43.6, 24.2), (45, 27), (45, 43), (30, 43), (29.6, 37)],
        part=(30, 14.8), locks=13, curl=0.25,
        ear=(27.5, 32.4),
    ),
    'richards': dict(
        label='Willard Richards',
        coat=['#140e08', '#261c12', '#3a2c1e', '#4c3a2a', '#614c38'],
        vest=['#4a3a20', '#7a6440', '#9c8558', '#b8a070', '#d2bc8c'],
        trouser=['#100c0a', '#201a16', '#302822', '#40362e', '#52463c'],
        boot=['#060504', '#120e0c', '#1e1814', '#2c241e', '#3c322a'],
        neck='cravat',
        hair=['#0a0604', '#1a100a', '#2a1a10', '#3c2618', '#523522'],
        # higher, receding hairline; fuller face
        hairS=[(16, 31), (16.5, 24), (19.5, 18.6), (25, 15.6), (30.5, 15.2), (35, 16), (38.6, 18), (39.6, 20.4),
               (36.6, 21.4), (33, 23.6), (31, 27.6), (30.6, 33), (29, 37.6), (26, 40), (22, 40.6), (18.5, 38)],
        tips=[[(16.5, 33), (19.5, 38), (15, 39.5)], [(19.5, 38), (24, 40.4), (19, 42.6)], [(24, 39.4), (28.6, 38.4), (26, 43)],
              [(29.6, 31), (31.6, 31), (30.8, 36.4)]],
        over=[[(36, 20.6), (40, 19.6), (38.4, 23)]],
        face=[(31, 27), (33, 23.6), (37, 21.6), (41, 20.6), (44, 22.5), (45.5, 27), (45.5, 43), (29.5, 43), (29.2, 37)],
        part=(31, 16), locks=11, curl=0.9,
        ear=(27.5, 32.4),
        full=True, vest_smooth=True,
    ),
}


def pull_front(pts, x0=40.5, k=0.55):
    # hair volume ahead of the brow stays modest (the painted profile is at x≈41.5)
    return [(x0 + (x - x0) * k if x > x0 else x, y) for x, y in pts]


def paint(name, cfg):
    cfg = dict(cfg)
    cfg['hairS'] = pull_front(cfg['hairS'])
    cfg['tips'] = [pull_front(t) for t in cfg.get('tips', [])]
    cfg['over'] = [pull_front(t) for t in cfg.get('over', [])]
    F = J.copy()
    C = {k: [hexc(c) for c in cfg[k]] for k in ('coat', 'vest', 'trouser', 'boot', 'hair')}
    # ---- clothing: map each cloth's painted luminance onto the man's ramp
    for y in range(H):
        for x in range(W):
            c = cls[y, x]
            if not A[y, x]:
                continue
            src = c
            if c == 'trim':
                nv = sum(cls[y + dy, x + dx] == 'vest' for dy in (-1, 0, 1) for dx in (-1, 0, 1))
                nc = sum(cls[y + dy, x + dx] == 'coat' for dy in (-1, 0, 1) for dx in (-1, 0, 1))
                if nv > nc:
                    # waistcoat buttons/edges: a quiet darker tone of the waistcoat itself
                    F[y, x, :3] = ramp(C['vest'], 0.22)
                    continue
                # 1840s frock coats: no piping; the edge becomes a soft lit fold of the coat
                lo, hi = RNG['coat']
                F[y, x, :3] = ramp(C['coat'], 0.7)
                continue
            if c in ('coat', 'vest', 'trouser', 'boot'):
                lo, hi = RNG[c]
                L0 = LUM[y, x]
                if c == 'vest' and cfg.get('vest_smooth'):
                    nb = [LUM[y + dy, x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if cls[y + dy, x + dx] == 'vest']
                    L0 = 0.35 * L0 + 0.65 * (sum(nb) / len(nb))
                v = (L0 - lo) / max(1, hi - lo)
                v = 0.08 + 0.86 * v
                if c == 'vest' and cfg.get('vest_smooth'):
                    v = 0.25 + 0.6 * v
                F[y, x, :3] = ramp(C[c], v)
            elif c == 'outline':
                F[y, x, :3] = ramp(C['coat'], 0.0)
    # ---- neckwear
    for y in range(40, 52):
        for x in range(26, 44):
            if cls[y, x] != 'shirt':
                continue
            if cfg['neck'] == 'stock' and 41 <= y <= 46 and 31 <= x <= 39:
                v = (LUM[y, x] - 150) / 105
                F[y, x, :3] = ramp([hexc('#050506'), hexc('#121216'), hexc('#24242a'), hexc('#3a3a44')], v)
    # ---- head: new hair silhouette, forehead/ear skin
    S = poly_mask(cfg['hairS'])
    for tip in cfg.get('tips', []):
        S |= poly_mask(tip)
    FACE = poly_mask(cfg['face'])
    # the forehead never juts past Joseph's painted profile (front edge x≈41.5, sloping back)
    for y in range(H):
        front = 41.5 - max(0, 26 - y) * 0.3
        FACE[y, int(math.ceil(front)):] = False if y < 29 else FACE[y, int(math.ceil(front)):]
    EAR = disk(cfg['ear'][0], cfg['ear'][1], 2.4) & ~FACE
    head_zone = np.zeros((H, W), bool)
    head_zone[:42, :48] = True
    old_head = head_zone & ((cls == 'hair') | (cls == 'skin') | ((cls == 'outline') & (np.arange(H)[:, None] <= 40)))
    OVER = np.zeros((H, W), bool)
    for tip in cfg.get('over', []):
        OVER |= poly_mask(tip)
    hair = (S & ~FACE & ~EAR) | OVER
    # where the old painting had hair but neither new hair nor face/ear → transparent
    for y in range(0, 42):
        for x in range(W):
            if not head_zone[y, x] or (y >= 29 and 33 <= x <= 42 and FACE[y, x]):
                continue
            was = A[y, x] and cls[y, x] in ('hair', 'outline') and y <= 40
            if was and not (hair[y, x] or FACE[y, x] or EAR[y, x]):
                F[y, x] = 0
    # paint skin where the face/ear is uncovered but the old pixel was hair or empty
    ys, xs = np.nonzero(S | FACE)
    for y, x in zip(ys, xs):
        if y > 41:
            continue
        inface = (FACE[y, x] and (A[y, x] or y < 30)) or EAR[y, x]
        if y >= 29 and x >= 33 and A[y, x]:
            continue            # eye, nose and cheek: Joseph's painted pixels stay as they are
        if inface and not hair[y, x] and cls[y, x] != 'skin':
            if FACE[y, x] and not A[y, x] and y >= 30:
                continue
            # forehead: lit from the front-top; darker toward the hairline and the back
            v = 0.72 - 0.05 * max(0, 30 - y) * 0.2 + 0.03 * (x - 36)
            if EAR[y, x]:
                v = 0.5 + 0.08 * (cfg['ear'][1] - y) / 2.4
            F[y, x, :3] = ramp(SKIN, v)
            F[y, x, 3] = 255
    # hair: painted in locks like the rest of the cast. Locks fan out from the parting;
    # each lock is lit along its middle and darkens at its edges (the dark seams between
    # locks), on top of the overall light from the upper front.
    px, py = cfg['part']
    ys, xs = np.nonzero(hair)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    nl = cfg.get('locks', 11)
    for y, x in zip(ys, xs):
        u = (x - x0) / max(1, x1 - x0)
        w = (y - y0) / max(1, y1 - y0)
        v = 0.5 + 0.3 * (1 - w) * (0.4 + 0.6 * u) - 0.3 * w * (1 - u)
        ang = math.atan2(y + .5 - py, x + .5 - px)
        d = math.hypot(x + .5 - px, y + .5 - py)
        f = (ang / math.pi * nl * 0.5 + 0.13 * d * cfg.get('curl', 0.0)) % 1.0
        across = abs(f - 0.5) * 2          # 0 at the lock's middle, 1 at its seam
        v += 0.2 * (1 - across) - 0.22 * max(0, across - 0.72) / 0.28
        if d < 2.2:
            v -= 0.15                        # the parting itself
        nb_face = any(FACE[min(H - 1, max(0, y + dy)), min(W - 1, max(0, x + dx))] or EAR[min(H - 1, max(0, y + dy)), min(W - 1, max(0, x + dx))]
                      for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)))
        if nb_face:
            v = min(v, 0.28)
        F[y, x, :3] = ramp(C['hair'], v)
        F[y, x, 3] = 255
    # outline: hair pixels touching the outside
    out_c = C['hair'][0]
    for y, x in zip(ys, xs):
        edge = False
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            yy, xx = y + dy, x + dx
            if not (0 <= yy < H and 0 <= xx < W) or (F[yy, xx, 3] == 0):
                edge = True
        if edge:
            F[y, x, :3] = out_c
    # nothing of the old painting floats ahead of the profile (old fringe highlights)
    for y in range(12, 35):
        for x in range(43, W):
            if not hair[y, x]:
                F[y, x] = 0
    # face outline along the new forehead front edge
    for y in range(18, 31):
        row = [x for x in range(30, 48) if F[y, x, 3] > 0]
        if row and FACE[y, row[-1]] and not hair[y, row[-1]]:
            F[y, row[-1], :3] = SKIN[0] * 0.8 + ramp(SKIN, 0.3) * 0.2
    # brows: a short dark stroke above the eye
    for (x, y) in cfg.get('brow', [(35, 28), (36, 27), (37, 27), (38, 27), (39, 27)]):
        if FACE[y, x] and not hair[y, x]:
            F[y, x, :3] = C['hair'][1]
            F[y, x, 3] = 255
    if cfg.get('full'):
        # fuller face: jowl behind the jaw and a soft second chin
        for (x, y, v) in [(31, 39, 0.45), (31, 40, 0.35), (32, 41, 0.4), (33, 41, 0.5), (34, 42, 0.42),
                          (35, 42, 0.5), (36, 42, 0.45), (37, 42, 0.38), (30, 38, 0.4)]:
            F[y, x, :3] = ramp(SKIN, v)
            F[y, x, 3] = 255
        for (x, y) in [(30, 39), (30, 40), (31, 41), (32, 42), (33, 43), (37, 43), (38, 42)]:
            if F[y, x, 3] == 0 or cls[y, x] in ('', 'outline'):
                F[y, x, :3] = SKIN[0]
                F[y, x, 3] = 255
        # watch chain across the buff waistcoat (gilt, two links of light)
        for i, (x, y) in enumerate([(34, 66), (35, 67), (36, 67), (37, 68), (38, 68), (39, 67)]):
            if cls[y, x] == 'vest':
                F[y, x, :3] = hexc('#e8c470') if i % 2 else hexc('#a07a30')
    F[F[..., 3] <= 24] = 0
    return np.clip(F, 0, 255).astype(np.uint8)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    tiles = [Image.fromarray(J.astype(np.uint8))]
    for name, cfg in MEN.items():
        im = Image.fromarray(paint(name, cfg))
        im.save(os.path.join(OUT, f'carthage_{name}.png'))
        tiles.append(im)
        print('painted', name)
    if '--debug' in sys.argv:
        out = sys.argv[sys.argv.index('--debug') + 1]
        S_ = 6
        sheet = Image.new('RGBA', (len(tiles) * W * S_, 60 * S_), (170, 205, 170, 255))
        for i, t in enumerate(tiles):
            c = t.crop((0, 8, W, 68)).resize((W * S_, 60 * S_), Image.NEAREST)
            sheet.alpha_composite(c, (i * W * S_, 0))
        sheet.save(out)
        full = Image.new('RGBA', (len(tiles) * W * 3, H * 3), (170, 205, 170, 255))
        for i, t in enumerate(tiles):
            full.alpha_composite(t.resize((W * 3, H * 3), Image.NEAREST), (i * W * 3, 0))
        full.save(out.replace('.png', '-full.png'))
