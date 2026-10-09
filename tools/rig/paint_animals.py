"""
Paint the wildlife as cut-out rig parts (timber rattlesnake, bobcat, American black
bear, American crow, great horned owl) in the painted cast's style, procedurally in
Python (no image generation, nothing bought). Parts are authored at the cast's model
density (1 model px = 0.875 game px) and packed 4x nearest like the human rigs.

  python3 tools/rig/paint_animals.py [--sheet out.png]

Output: assets/rig/animals.png + animals.json  ({animal: {parts: {name: {x,y,w,h,pivot,pts}}}})
"""
import json, math, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paint_lib import (Canvas, setF, G, F as FF, ramp_fn, hexc, shade_field, fur_strokes, finish, value_noise, quant,
                       erode, dist_in, blur)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UP = 4
AF = {'snake': 1.0, 'bobcat': 1.27, 'bear': 1.0, 'crow': 1.3, 'owl': 1.25}   # authoring scale per animal
PARTS = {}      # animal -> name -> (rgba, pivot, pts)


def _sc(v):
    f = FF[0]
    if isinstance(v, tuple) and len(v) == 2 and all(isinstance(a, (int, float)) for a in v):
        return (v[0] * f, v[1] * f)
    return v


def add(animal, name, rgba, pivot, **pts):
    PARTS.setdefault(animal, {})[name] = (rgba, _sc(pivot), {k: _sc(v) for k, v in pts.items()})


def px_set(rgba, x, y, col):
    """Set one painted detail pixel given in design units."""
    f = FF[0]
    xi, yi = int(round((x + 0.5) * f - 0.5)), int(round((y + 0.5) * f - 0.5))
    if 0 <= yi < rgba.shape[0] and 0 <= xi < rgba.shape[1]:
        rgba[yi, xi, :3] = hexc(col) if isinstance(col, str) else col
        rgba[yi, xi, 3] = 255


def render(m, v, ramp, rng=None, marks=(), outline=0.42, out_mix=0.25, levels=16, soft=None):
    """v (0..1 light) → colour via ramp, then marks [(mask, ramp, dv)] re-ramp with the same light."""
    v = quant(v, levels)
    rgb = ramp(v)
    for mm, rp, dv in marks:
        mm = mm & m
        rgb[mm] = rp(np.clip(v + dv, 0, 1))[mm]
    return finish(rgb, m, outline=outline, out_mix=out_mix, soft=soft)


# ======================================================================= rattlesnake
SN_TAN = ramp_fn(['#3c2610', '#6e4a22', '#a07a3a', '#c8a458', '#e6c886', '#f4e0aa'])
SN_BAND = ramp_fn(['#140c06', '#24160a', '#3a2614', '#56391e', '#6e4c2a'])
SN_BELLY = ramp_fn(['#6a5434', '#a89064', '#d8c494', '#efe0b4', '#fbf0cc'])
SN_TAIL = ramp_fn(['#08060a', '#141014', '#22191a', '#352a26', '#4a3c34'])
SN_RUST = ramp_fn(['#4a2410', '#7a4220', '#a8622e', '#c88044', '#e0a060'])


def snake():
    rng = np.random.default_rng(11)
    setF(1.0)
    W, H = 100, 16
    cy = 8.0

    def r_of(x):
        # half thickness along the body (tail tip at x=0, neck at x=W)
        u = x / W
        return 1.22 * (1.4 + 3.9 * math.sin(min(1, u * 1.18) * math.pi * 0.88 + 0.12) ** 0.8 - (1.2 if u > 0.94 else 0) * (u - 0.94) / 0.06)

    c = Canvas(W, H)
    top = [(x, cy - r_of(x)) for x in np.linspace(0, W, 60)]
    bot = [(x, cy + r_of(x)) for x in np.linspace(W, 0, 60)]
    c.poly(top + bot)
    m = c.mask()
    ys, xs = G(m)
    v = shade_field(m, R=5.5)
    # scale texture: a quiet diamond lattice, each scale lit on its upper edge
    lat = (((xs + ys * 2) % 4) == 0) | (((xs - ys * 2) % 4) == 0)
    v = v - 0.07 * lat + 0.04 * (((xs + ys * 2) % 4) == 1)
    v += (value_noise(m.shape[1], m.shape[0], 3, rng) - 0.5) * 0.1
    rr = np.array([r_of(x + 0.5) for x in range(W)])
    rel = (ys + 0.5 - cy) / rr[None, :]          # -1 top .. +1 belly
    # crossbands: dark chevrons pointing toward the head, edged pale
    band = np.zeros_like(m)
    edge = np.zeros_like(m)
    for xc in np.arange(20, 94, 8.6):
        off = xs + 0.5 - (xc - 2.4 * np.abs(rel) * (1 + 0.15 * math.sin(xc)))
        band |= (off >= 0) & (off < 2.8 + 0.6 * math.cos(xc * 0.7))
        edge |= ((off >= -1) & (off < 0)) | ((off >= 2.8) & (off < 3.6))
    tail = xs < 15 + 1.5 * np.abs(rel)
    belly = rel > 0.62
    rust = (np.abs(rel + 0.55) < 0.22) & (xs > 18) & ~band
    v_b = v.copy()
    marks = [(edge & ~tail & ~belly, SN_BELLY, -0.12), (rust, SN_RUST, 0.0), (band & ~tail & ~belly, SN_BAND, 0.0),
             (belly & ~tail, SN_BELLY, 0.05), (tail, SN_TAIL, 0.0)]
    rgba = render(m, v_b, SN_TAN, rng, marks, outline=0.38)
    add('snake', 'body', rgba, (0, cy), length=W, r=[round(r_of(x + 0.5), 2) for x in range(W)])

    # tongue (forked, flicks out of the snout notch)
    T = np.zeros((5, 8, 4), np.uint8)
    for (x, y) in [(0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (5, 1), (6, 0), (5, 3), (6, 4)]:
        T[y, x] = (196, 52, 58, 255)
    for (x, y) in [(1, 2), (3, 2)]:
        T[y, x] = (228, 96, 96, 255)
    add('snake', 'tongue', T, (0, 2))
    setF(1.3)
    # head: broad, flat-topped, triangular; seen from the side
    Wh, Hh = 19, 13
    c = Canvas(Wh, Hh)
    c.poly([(0.5, 3.6), (4, 2.2), (9, 1.6), (13.5, 2.2), (16.8, 3.8), (18.4, 6.0), (17.6, 7.6), (13, 8.6),
            (8, 9.6), (4.5, 10.4), (1.4, 9.6), (0.2, 7.6)])
    m = c.mask()
    ys, xs = G(m)
    v = shade_field(m, R=4)
    v += (value_noise(m.shape[1], m.shape[0], 2, rng) - 0.5) * 0.08
    chin = ys >= 8 + (xs > 12) * -0.5
    stripe = (np.abs((ys + 0.5) - (5.2 + (12 - xs) * 0.28)) < 1.0) & (xs < 12) & (xs > 1)
    crown = (ys < 4) & (xs > 3) & (xs < 15) & ((xs + ys) % 3 == 0)
    rgba = render(m, v, ramp_fn(['#3a2410', '#6a4a24', '#94703a', '#b89050', '#d6b070', '#e8cc90']), rng,
                  [(chin, SN_BELLY, 0.1), (stripe, SN_BAND, 0.05), (crown, SN_BAND, 0.2)], outline=0.38)
    # eye (keeled brow over it), heat pit, mouth line
    def px(x, y, col):
        px_set(rgba, x, y, col)
    px(12, 4, '#2a1608'); px(13, 4, '#2a1608')
    px(12, 5, '#e8b848'); px(13, 5, '#14080a'); px(14, 5, '#c89838')
    px(16, 6, '#20120a')
    for x in range(8, 17):
        y = 8 if x > 11 else 9
        xi, yi = int(round((x + .5) * FF[0] - .5)), int(round((y + .5) * FF[0] - .5))
        if rgba[yi, xi, 3]:
            rgba[yi, xi, :3] = rgba[yi, xi, :3] * 0.55
    add('snake', 'head', rgba, (1.5, 6.2), eye=(13, 5), snout=(18, 6.4))



    # rattle: four loosely stacked buff keratin segments, darker at each joint
    Wr, Hr = 10, 7
    c = Canvas(Wr, Hr)
    for i in range(4):
        cx = 8.4 - i * 2.2
        rr_ = 2.9 - i * 0.35
        c.ell(cx, 3.5, 1.5, rr_)
    m = c.mask()
    ys, xs = G(m)
    v = shade_field(m, R=2.5)
    joints = np.zeros_like(m)
    for i in range(4):
        joints |= (np.abs(xs + 0.5 - (7.2 - i * 2.2)) < 0.5)
    rgba = render(m, v, ramp_fn(['#4a3a28', '#7a6648', '#a89068', '#cbb48a', '#e6d4aa']), rng,
                  [(joints, ramp_fn(['#2a1e14', '#3e3020', '#56442e', '#6e5a40', '#86704e']), 0)], outline=0.45)
    add('snake', 'rattle', rgba, (9.6, 3.5))


# ======================================================================= bobcat
BC = ramp_fn(['#3e240e', '#6e4622', '#a0703c', '#c4945a', '#dcb27a', '#ecca96'])
BC_DARK = ramp_fn(['#2a180a', '#4a2e16', '#6a4422', '#86582e', '#9c6c3a'])
BC_BELLY = ramp_fn(['#7a6248', '#b49c78', '#dccaa4', '#f0e2c4', '#fcf2dc'])
BC_SPOT = ramp_fn(['#1c1008', '#2e1c0c', '#422a14', '#5a3a1c', '#6e4a26'])
BC_BLACK = ramp_fn(['#0a0806', '#16100c', '#241a12', '#34261a', '#463424'])


def spots(m, rng, n, rmin=0.7, rmax=1.4, region=None):
    h, w = m.shape
    out = np.zeros_like(m)
    ys, xs = G(m)
    cand = np.argwhere(m if region is None else (m & region))
    if len(cand) == 0:
        return out
    for _ in range(n):
        y, x = cand[rng.integers(len(cand))]
        r = rng.uniform(rmin, rmax)
        out |= ((xs + 0.5 - x - 0.5) ** 2 / (r * 1.4) ** 2 + (ys + 0.5 - y - 0.5) ** 2 / r ** 2) <= 1
    return out


def furpart(animal, name, w, h, draw, pivot, ramp, rng, ang=0.0, nstrokes=None, R=None, marks_fn=None,
            amt=0.13, outline=0.42, out_mix=0.25, flow=None, light_bias=0.0, soft=None, **pts):
    c = Canvas(w, h)
    draw(c)
    m = c.mask()
    v = shade_field(m, R=R) + light_bias
    v += (value_noise(m.shape[1], m.shape[0], 4, rng) - 0.5) * 0.12
    v = fur_strokes(v, m, rng, nstrokes if nstrokes is not None else int(m.sum() * 0.35), ang, amt=amt, flow=flow)
    marks = marks_fn(m, v) if marks_fn else []
    sm = None
    if soft is not None:
        ys, xs = G(m)
        sm = soft(ys, xs)
    rgba = render(m, v, ramp, rng, marks, outline=outline, out_mix=out_mix, soft=sm)
    add(animal, name, rgba, pivot, **pts)
    return rgba, m


def bobcat():
    rng = np.random.default_rng(23)
    setF(AF['bobcat'])
    ys_ = lambda h, w: np.mgrid[0:h, 0:w]
    # torso: 50×26, facing right; shoulder at the right, hip at the left, belly sags slightly
    W, H = 52, 26
    def body(c):
        c.ell(32, 13.5, 17, 11.2, -0.05)         # deep chest
        c.ell(15, 11.5, 12.5, 9.6, 0.1)          # loins/hips (bobcats are high at the rump)
        c.ell(43, 11.5, 8, 10)                   # shoulder mass
        c.poly([(6, 8), (12, 3), (24, 2.6), (36, 2.8), (46, 4), (49, 9), (48, 17), (40, 22.4), (26, 23.4), (14, 21.6), (5, 17)])
    def bmarks(m, v):
        h, w = m.shape
        ys, xs = G(m)
        belly = ys > 17.5 - (xs - 26) ** 2 * 0.004
        sp = spots(m, rng, 46, 0.45, 0.85, region=(ys > 6) & (ys < 22))
        bars = (np.abs(ys - 5.2 - 0.6 * np.sin(xs * 0.5)) < 0.5) & (xs > 10) & (xs < 40) & (((xs // 3) % 2) == 0)
        dorsal = (ys < 4.5) & (xs > 6)
        return [(dorsal, BC_DARK, 0.05), (belly, BC_BELLY, 0.08), (sp & ~belly, BC_SPOT, 0.05), (bars & ~belly, BC_SPOT, 0.1),
                (sp & belly, BC_SPOT, 0.3)]
    furpart('bobcat', 'body', W, H, body, (26, 13), BC, rng, ang=math.pi, marks_fn=bmarks, R=7, amt=0.08,
            neck=(45, 8), hipN=(13, 13), hipF=(16, 12), shN=(41, 14), shF=(38, 13), tail=(4, 8))
    # head 24×22: broad face with cheek ruff, tufted ears, short muzzle
    W, H = 24, 24
    def head(c):
        c.ell(11.5, 13.5, 8.6, 7.6)
        c.ell(17.5, 15.2, 5.2, 4.2)       # muzzle
        c.ell(7, 17, 6, 5.2)              # cheek ruff
        c.poly([(3, 19), (1, 22.6), (5.6, 21.5), (7, 23.4), (10, 21)])   # ruff points
        c.poly([(6.2, 8.6), (7.4, 1.4), (11.6, 7)])        # far ear
        c.poly([(10.4, 7.6), (13.2, 0.6), (15.6, 7.8)])    # near ear
    def hmarks(m, v):
        h, w = m.shape
        ys, xs = G(m)
        muzzle = ((xs - 18) ** 2 / 25 + (ys - 16.4) ** 2 / 9 <= 1) | ((xs - 6.6) ** 2 / 16 + (ys - 19) ** 2 / 9 <= 1)
        ear_back = (ys < 7.5) & ((xs - 13) ** 2 + (ys - 3) ** 2 < 10) | ((ys < 7.2) & ((xs - 8.6) ** 2 + (ys - 3.6) ** 2 < 7))
        tufts = (ys <= 2) & ((np.abs(xs - 13) <= 0) | (np.abs(xs - 7) <= 0))
        cheek_bars = (np.abs(ys - (16.2 + (xs - 10) * -0.15)) < 0.55) & (xs > 4) & (xs < 11) | \
                     (np.abs(ys - (18.4 + (xs - 10) * -0.1)) < 0.5) & (xs > 3) & (xs < 10)
        brow = (np.abs(ys - (9.6 - (xs - 12) * 0.05)) < 0.5) & (xs > 11) & (xs < 17) & ((xs % 2) == 0)
        return [(muzzle, BC_BELLY, 0.04), (ear_back, BC_BLACK, 0.1), (cheek_bars, BC_SPOT, 0.0), (brow, BC_SPOT, 0.1)]
    rgba, m = furpart('bobcat', 'head', W, H, head, (6, 15), BC, rng, ang=math.pi * 0.9, marks_fn=hmarks, R=5, amt=0.1,
                      soft=lambda ys, xs: (xs < 5) & (ys > 9))
    P = lambda x, y, col: px_set(rgba, x, y, col)
    # tufts, eye (gold with a dark rim and the pale patch beneath), nose, mouth
    for (x, y) in [(13, 0), (13, 1), (8, 1), (8, 2), (12, 0)]:
        P(x, y, '#120a06')
    for (x, y, col) in [(14, 10, '#2a1608'), (15, 10, '#2a1608'), (16, 10, '#2a1608'), (17, 11, '#2a1608'),
                        (14, 11, '#3a2410'), (15, 11, '#d8a830'), (16, 11, '#140a04'), (17, 12, '#3a2410'),
                        (15, 12, '#b88a28'), (16, 12, '#e8c050'), (14, 12, '#3a2410'),
                        (14, 13, '#f4ead4'), (15, 13, '#f4ead4'), (16, 13, '#e8dcc0'),
                        (22, 13, '#6a3a30'), (22, 14, '#3a1e18'), (21, 14, '#7a4a3c'), (21, 15, '#5a3a2c'),
                        (20, 16, '#4a2e20'), (19, 17, '#4a2e20'), (18, 17, '#6a4a34'),
                        (9, 15, '#1a0e06'), (8, 15, '#1a0e06'), (7, 16, '#1a0e06'), (8, 18, '#1a0e06'), (7, 18, '#1a0e06'), (6, 19, '#1a0e06')]:
        P(x, y, col)
    add('bobcat', 'head', rgba, (6, 15), eye=(16, 12), nose=(22, 15))
    # stub tail, black-tipped
    def tail(c):
        c.cap(10, 4, 3, 5.2, 3.2, 2.6)
    def tmarks(m, v):
        h, w = m.shape
        ys, xs = G(m)
        return [(xs < 4.2, BC_BLACK, 0.1), (ys > 6.4, BC_BELLY, 0.0), ((np.abs(xs - 6.6) < 0.6) & (ys < 6), BC_SPOT, 0)]
    furpart('bobcat', 'tail', 13, 9, tail, (11, 4), BC, rng, ang=math.pi, marks_fn=tmarks, R=2.4)
    # legs: upper (pivot top centre), lower (pivot top), paw (pivot at the wrist / hock)
    def legmarks(stripes):
        def f(m, v):
            h, w = m.shape
            ys, xs = G(m)
            bars = np.zeros_like(m)
            for y0 in stripes:
                bars |= np.abs(ys + 0.5 - y0 - (xs - w / 2) * 0.3) < 0.6
            return [(bars, BC_SPOT, 0.05)]
        return f
    for side, rp, bias in (('n', BC, 0.0), ('f', BC_DARK, -0.06)):
        furpart('bobcat', side + 'ForeUp', 11, 22, lambda c: c.cap(5.5, 4.5, 5, 17.5, 4.8, 3.2), (5.5, 3.5), rp, rng,
                ang=math.pi / 2, R=3, light_bias=bias, end=(5, 18), soft=lambda ys, xs: ys < 9)
        furpart('bobcat', side + 'ForeLo', 8, 18, lambda c: c.cap(4, 2.5, 4, 15.5, 2.9, 2.4), (4, 2.5), rp, rng,
                ang=math.pi / 2, R=2.4, light_bias=bias, marks_fn=legmarks([6, 9]), end=(4, 15.5), soft=lambda ys, xs: ys < 3.5)
        furpart('bobcat', side + 'HindUp', 15, 22, lambda c: (c.ell(7.5, 8, 6.6, 7.6), c.cap(7.5, 9, 6.4, 18, 5.4, 3.4)), (7.5, 5), rp, rng,
                ang=math.pi / 2, R=7, light_bias=bias, marks_fn=legmarks([10, 13]), end=(6.4, 18), soft=lambda ys, xs: ys < 12)
        furpart('bobcat', side + 'HindLo', 8, 17, lambda c: c.cap(4, 2.5, 4, 14.5, 2.9, 2.3), (4, 2.5), rp, rng,
                ang=math.pi / 2, R=2.3, light_bias=bias, end=(4, 14.5), soft=lambda ys, xs: ys < 3.5)
        furpart('bobcat', side + 'Paw', 11, 7, lambda c: (c.ell(5.8, 4, 4.6, 2.7), c.cap(3, 2.6, 3, 1, 2, 2)), (3, 1.5), rp, rng,
                ang=0, R=2, light_bias=bias, amt=0.08, toe=(10, 6))


# ======================================================================= black bear
BR = ramp_fn(['#060406', '#120e0e', '#1e1816', '#2c2420', '#3e342e', '#52463e'])
BR_FAR = ramp_fn(['#040304', '#0c0a0a', '#151110', '#1e1916', '#2a2420', '#38302a'])
BR_SHEEN = ramp_fn(['#141010', '#241e1c', '#342c28', '#463c36', '#5a4e46'])
BR_MUZ = ramp_fn(['#3a2414', '#6a4a2c', '#9a7450', '#b8926a', '#d0ac84'])


def bear():
    rng = np.random.default_rng(37)
    setF(AF['bear'])
    W, H = 96, 54
    def body(c):
        c.ell(56, 26, 34, 22, -0.06)     # chest + shoulder hump
        c.ell(28, 28, 24, 21, 0.08)      # rump
        c.ell(70, 20, 18, 15)            # hump over the shoulders
        c.poly([(8, 30), (14, 12), (30, 7), (52, 5), (70, 5.5), (84, 12), (90, 24), (86, 38), (70, 47), (44, 49), (22, 47), (8, 40)])
    def bmarks(m, v):
        h, w = m.shape
        ys, xs = G(m)
        sheen = (v > 0.72) & (ys < 22)
        return [(sheen, BR_SHEEN, -0.1)]
    furpart('bear', 'body', W, H, body, (48, 28), BR, rng, ang=math.pi * 0.95, R=12, marks_fn=bmarks, amt=0.16,
            nstrokes=1400, outline=0.5, out_mix=0.2,
            neck=(86, 22), hipN=(26, 30), hipF=(30, 28), shN=(70, 32), shF=(66, 30), tail=(6, 22))
    for nm, mouth in (('head', 0), ('headHuff', 1)):
        Wh, Hh = 40, 34
        def head(c):
            c.ell(17, 18, 13.5, 12.5)
            c.ell(30, 21.5, 8.6, 7.2, 0.12)          # long muzzle
            c.ell(7.5, 6.6, 4.8, 4.6)               # far ear
            c.ell(17, 5.2, 5, 4.8)                  # near ear
            if mouth:
                c.ell(29, 27.6, 6.5, 2.6, 0.2)       # lower jaw dropped a little (no teeth)
        def hmarks(m, v):
            h, w = m.shape
            ys, xs = G(m)
            muz = ((xs - 31) ** 2 / 70 + (ys - 22) ** 2 / 46 <= 1) & (xs > 23)
            ear_in = ((xs - 17) ** 2 + (ys - 5.6) ** 2 < 5) | ((xs - 7.6) ** 2 + (ys - 7) ** 2 < 4)
            mouth_m = np.zeros_like(m)
            if mouth:
                mouth_m = ((xs - 30) ** 2 / 26 + (ys - 26.2) ** 2 / 2.2 <= 1)
            return [(muz, BR_MUZ, 0.0), (ear_in, BR_SHEEN, -0.2),
                    (mouth_m, ramp_fn(['#1e0c0c', '#3a1616', '#5a2424', '#7a3434', '#8c4040']), -0.1)]
        rgba, m = furpart('bear', nm, Wh, Hh, head, (8, 20), BR, rng, ang=math.pi * 0.9, R=8, marks_fn=hmarks,
                          amt=0.14, outline=0.5, out_mix=0.2, soft=lambda ys, xs: (xs < 9) & (ys > 12))
        P = lambda x, y, col: px_set(rgba, x, y, col)
        # nose, eye
        for (x, y, col) in [(37, 18, '#0a0606'), (38, 18, '#0a0606'), (37, 19, '#0a0606'), (38, 19, '#1a1212'), (36, 19, '#0a0606'),
                            (37, 17, '#2a2224'), (22, 14, '#0a0604'), (23, 14, '#0a0604'), (22, 13, '#3a2a20'), (23, 15, '#6a5040')]:
            P(x, y, col)
        add('bear', nm, rgba, (8, 20), eye=(22, 14), nose=(38, 18))
    furpart('bear', 'tail', 10, 9, lambda c: c.ell(5, 4.5, 4, 3.6), (8, 4.5), BR, rng, R=2.5)
    for side, rp, bias in (('n', BR, 0.0), ('f', BR_FAR, 0.0)):
        furpart('bear', side + 'ForeUp', 22, 37, lambda c: (c.ell(11, 10, 10, 10), c.cap(11, 12, 10, 32, 9, 6.8)), (11, 8), rp, rng,
                ang=math.pi / 2, R=5, amt=0.16, outline=0.5, end=(10, 32), soft=lambda ys, xs: ys < 9)
        furpart('bear', side + 'ForeLo', 16, 26, lambda c: c.cap(8, 4.5, 8, 21, 6.8, 6.2), (8, 4.5), rp, rng,
                ang=math.pi / 2, R=4, amt=0.16, outline=0.5, end=(8, 21), soft=lambda ys, xs: ys < 3.5)
        furpart('bear', side + 'HindUp', 28, 38, lambda c: (c.ell(14, 12, 12.5, 11.5), c.cap(13, 14, 12, 32, 10.6, 7.2)), (14, 9), rp, rng,
                ang=math.pi / 2, R=6, amt=0.16, outline=0.5, end=(12, 32), soft=lambda ys, xs: ys < 12)
        furpart('bear', side + 'HindLo', 16, 24, lambda c: c.cap(8, 4.5, 8.4, 20, 7, 6.2), (8, 4.5), rp, rng,
                ang=math.pi / 2, R=4, amt=0.16, outline=0.5, end=(8.4, 20), soft=lambda ys, xs: ys < 3.5)
        rgba, m = furpart('bear', side + 'Paw', 24, 11, lambda c: (c.ell(12, 6.4, 10.5, 4.4), c.ell(6, 4, 5, 4)), (6, 3), rp, rng,
                          ang=0, R=3, amt=0.12, outline=0.5)
        # short claws (blunt, dark horn — no gore)
        for x in (18, 20, 22):
            px_set(rgba, x, 9, (70, 60, 52)) if rgba[int(round(9.5 * FF[0] - .5)), int(round((x + .5) * FF[0] - .5)), 3] else None
        add('bear', side + 'Paw', rgba, (6, 3), toe=(23, 10))


# ======================================================================= birds
CR = ramp_fn(['#030304', '#09090c', '#111115', '#1a1a20', '#26262e', '#363640'])
CR_FAR = ramp_fn(['#020203', '#060608', '#0c0c10', '#131318', '#1c1c22', '#26262e'])
CR_SHEEN = ramp_fn(['#0e0e16', '#181824', '#242434', '#303046', '#3e3e58'])
OW = ramp_fn(['#2a1a0c', '#4a3018', '#6a4a28', '#8c6a42', '#ae8c60', '#ccae80'])
OW_FAR = ramp_fn(['#1e1208', '#342212', '#4c341c', '#644a2c', '#7e6240', '#987c56'])
OW_PALE = ramp_fn(['#7a6648', '#a89070', '#cdb894', '#e6d6b4', '#f6ecd4'])
OW_BAR = ramp_fn(['#1a1008', '#2e1e10', '#42301c', '#56402a', '#6a5036'])
OW_DISC = ramp_fn(['#6a4424', '#946a40', '#b88c5c', '#d4a878', '#e8c494'])


def feathers(m, rng, ang, spacing=3.0):
    """Feather-edge lines (scalloped rows) for wings and tails."""
    h, w = m.shape
    ys, xs = G(m)
    u = xs * math.cos(ang) + ys * math.sin(ang)
    vv = -xs * math.sin(ang) + ys * math.cos(ang)
    rows = ((u / spacing + 0.35 * np.sin(vv * 1.3)) % 1.0) < 0.22
    return rows & m


def bird(animal, ramp, far_ramp, sheen, owl):
    rng = np.random.default_rng(51 if owl else 47)
    setF(AF[animal])
    if not owl:
        # crow: sleek body with wedge tail and stout bill
        def body(c):
            c.ell(15, 8, 12, 6.2, -0.08)
            c.ell(23, 6, 6, 5.4)
        furpart(animal, 'body', 30, 15, body, (14, 8), ramp, rng, ang=math.pi, R=4, amt=0.1, outline=0.55, out_mix=0.35,
                marks_fn=lambda m, v: [((v > 0.66), sheen, -0.15)],
                neck=(25, 6), tail=(4, 8), shoulder=(18, 6), hip=(12, 12))
        rgba, m = furpart(animal, 'head', 17, 13, lambda c: (c.ell(6.5, 6.5, 5.6, 5), c.poly([(10, 4.4), (16.6, 6.6), (10.4, 9)])),
                          (3, 7), ramp, rng, ang=math.pi, R=3, amt=0.08, outline=0.55, out_mix=0.35,
                          marks_fn=lambda m, v: [((v > 0.7), sheen, -0.15),
                                                 ((G(m)[1] >= 11), ramp_fn(['#0a0a0e', '#1a1a20', '#2a2a32', '#3a3a44', '#4a4a56']), 0.0)])
        px_set(rgba, 8, 5, (210, 206, 196)); px_set(rgba, 9, 5, (14, 12, 16)); px_set(rgba, 8, 6, (40, 38, 46))
        add(animal, 'head', rgba, (3, 7), eye=(9, 5))
        def tail(c):
            c.poly([(16, 2.4), (2, 0.6), (0.4, 4), (2.2, 7.4), (16, 5.6)])
        furpart(animal, 'tail', 17, 8, tail, (15.5, 4), ramp, rng, ang=math.pi, R=2.2, amt=0.06, outline=0.55, out_mix=0.35,
                marks_fn=lambda m, v: [(feathers(m, rng, 0.2, 2.6), sheen, -0.25)])
        span_in, span_out = 16, 22
    else:
        # great horned owl: barrel body, barred pale breast
        def body(c):
            c.ell(13, 12, 11, 10.5)
            c.ell(16, 16, 9, 7.5)
        def bm(m, v):
            h, w = m.shape
            ys, xs = G(m)
            breast = (xs > 12) & (ys > 8)
            bars = breast & ((((ys + 0.6 * np.sin(xs * 1.7)) % 2.6) < 0.6)) & (rng.random(m.shape) < 0.7)
            mott = (~breast) & (rng.random(m.shape) < 0.18)
            return [(breast, OW_PALE, 0.0), (bars, OW_BAR, 0.1), (mott, OW_BAR, 0.15)]
        furpart(animal, 'body', 26, 24, body, (13, 12), ramp, rng, ang=math.pi / 2, R=6, amt=0.1, marks_fn=bm,
                neck=(18, 4), tail=(3, 15), shoulder=(14, 7), hip=(15, 20))
        def head(c):
            c.ell(10.5, 12, 9.2, 8.6)
            c.poly([(3.4, 6.4), (2.4, 0.4), (7.6, 4.6)])      # far tuft
            c.poly([(9.6, 4.6), (12.2, 0.2), (14.2, 5.6)])    # near tuft
        def hm(m, v):
            h, w = m.shape
            ys, xs = G(m)
            disc = ((xs - 13.2) ** 2 / 34 + (ys - 12.6) ** 2 / 40) <= 1
            rim = disc & ~(((xs - 13.2) ** 2 / 24 + (ys - 12.6) ** 2 / 30) <= 1)
            throat = (ys > 18) & (xs > 9) & (xs < 17)
            return [(disc, OW_DISC, 0.05), (rim, OW_BAR, 0.1), (throat, OW_PALE, 0.15)]
        rgba, m = furpart(animal, 'head', 21, 22, head, (8, 16), ramp, rng, ang=math.pi / 2, R=5, amt=0.08, marks_fn=hm)
        P = lambda x, y, col: px_set(rgba, x, y, col)
        for (x, y, col) in [(13, 10, '#3a2410'), (14, 10, '#3a2410'), (15, 10, '#3a2410'),
                            (13, 11, '#f0c030'), (14, 11, '#140a04'), (15, 11, '#f8d040'),
                            (13, 12, '#c89020'), (14, 12, '#e8b030'), (15, 12, '#c89020'),
                            (18, 11, '#e8b030'), (18, 12, '#b88420'), (17, 11, '#3a2410'),
                            (17, 14, '#2a1a0e'), (17, 15, '#3a2a1a'), (16, 14, '#4a3420')]:
            P(x, y, col)
        add(animal, 'head', rgba, (8, 16), eye=(14, 11))
        furpart(animal, 'tail', 14, 9, lambda c: c.poly([(13, 2), (1.6, 2.6), (0.4, 5), (1.8, 7.6), (13, 6.6)]), (12.5, 4.4),
                ramp, rng, ang=math.pi, R=2.2, amt=0.08,
                marks_fn=lambda m, v: [((G(m)[1] % 4) == 1, OW_BAR, 0.1)])
        span_in, span_out = 18, 24
    # wings: painted fully spread and seen from the side at the top of the upstroke (span
    # straight up from the shoulder, chord along the body). The rig flaps them about the
    # body's long axis, so the side view foreshortens them exactly: up, edge-on, down.
    for side, rp in (('n', ramp), ('f', far_ramp)):
        if not owl:
            Ww, Hw = 22, 34
            def wing(c):
                # leading edge (front) rises from the shoulder; fingered primaries at the tip
                c.poly([(14.5, 33), (16.5, 26), (17, 17), (15.6, 9), (13, 3.4), (10.6, 0.6), (9.4, 3.6), (8, 1.4), (6.6, 4.8),
                        (5, 3.4), (4, 7.2), (2.2, 6.6), (2.4, 10.6), (0.8, 11.6), (2, 16), (3, 22), (6, 28), (9.4, 33)])
            piv = (12.5, 32.5)
        else:
            Ww, Hw = 30, 38
            def wing(c):
                # broad, rounded owl wing with soft fringed primaries
                c.poly([(20, 37), (23.4, 29), (25, 19), (24, 10), (21, 4.4), (16.6, 1.2), (12.6, 0.8), (10.4, 2.6), (8, 2.2),
                        (6.4, 4.6), (4, 5), (3.4, 8.4), (1.4, 10), (1.6, 14), (0.6, 17), (2, 24), (5.4, 31), (10, 36.4), (14, 37.4)])
            piv = (17, 36.5)
        def wm(m, v, owl=owl):
            ys, xs = G(m)
            # flight feathers radiate from the shoulder; coverts form the lit band near the base
            ang = np.arctan2(ys - piv[1], xs - piv[0])
            rays = (((ang * (13 if not owl else 10)) % 1.0) < 0.28) & (ys < piv[1] - 9)
            cov = ys > piv[1] - 11
            out = [(rays, sheen if not owl else OW_BAR, -0.18 if not owl else 0.05)]
            if owl:
                bars = (((np.hypot(xs - piv[0], ys - piv[1]) + 0.8 * np.sin(xs * 0.9)) % 5.0) < 0.9) & ~cov & ~rays
                out += [(bars, OW_PALE, -0.12), ((rng.random(m.shape) < 0.14) & cov, OW_PALE, -0.05)]
            else:
                out += [((v > 0.62) & cov, sheen, -0.22)]
            return out
        furpart(animal, side + 'Wing', Ww, Hw, wing, piv, rp, rng, ang=-math.pi / 2, R=3, amt=0.07, marks_fn=wm,
                outline=0.55 if not owl else 0.42, out_mix=0.35 if not owl else 0.25,
                soft=lambda ys, xs, py=piv[1]: ys > py - 2.5)
    # legs/talons: tucked and reaching
    tal = '#2a2a30' if not owl else '#c8a050'
    for nm, pts in (('feetTuck', [(0, 0), (1, 1), (2, 2), (3, 2), (4, 2), (4, 3)]),
                    ('feetReach', [(0, 0), (1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 5), (7, 5), (6, 6), (5, 7), (7, 4)])):
        A = np.zeros((9, 9, 4), np.uint8)
        col = hexc(tal)
        for (x, y) in pts:
            A[y, x, :3] = col; A[y, x, 3] = 255
            if owl and y < 4:
                A[y, x, :3] = hexc('#b89870')   # feathered legs
        add(animal, nm, A, (0.5, 0.5))


def pack(sheet_out=None):
    meta = {}
    imgs = []
    for animal, parts in PARTS.items():
        for name, (rgba, pivot, pts) in parts.items():
            imgs.append((animal, name, rgba, pivot, pts))
    W = 1024
    x = y = rowh = 0
    place = []
    for animal, name, rgba, pivot, pts in imgs:
        h, w = rgba.shape[:2]
        w4, h4 = (w + 2) * UP, (h + 2) * UP
        if x + w4 > W:
            x, y, rowh = 0, y + rowh, 0
        place.append((animal, name, rgba, pivot, pts, x, y))
        x += w4
        rowh = max(rowh, h4)
    H = y + rowh
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for animal, name, rgba, pivot, pts, px, py in place:
        h, w = rgba.shape[:2]
        im = Image.fromarray(rgba).resize((w * UP, h * UP), Image.NEAREST)
        atlas.paste(im, (px + UP, py + UP))
        meta.setdefault(animal, {'parts': {}, 'F': AF[animal]})['parts'][name] = {
            'x': px + UP, 'y': py + UP, 'w': w * UP, 'h': h * UP, 'pivot': [float(pivot[0]), float(pivot[1])],
            **{k: (list(v) if isinstance(v, tuple) else v) for k, v in pts.items()}}
    out = os.path.join(ROOT, 'assets', 'rig')
    atlas.save(os.path.join(out, 'animals.png'), optimize=True)
    with open(os.path.join(out, 'animals.json'), 'w') as f:
        json.dump({'scale': UP, 'k': 0.875, 'animals': meta}, f, separators=(',', ':'))
    print('atlas', atlas.size, 'parts', len(place))
    if sheet_out:
        bg = Image.new('RGBA', atlas.size, (164, 200, 168, 255))
        bg.alpha_composite(atlas)
        bg.save(sheet_out)


if __name__ == '__main__':
    snake(); bobcat(); bear(); bird('crow', CR, CR_FAR, CR_SHEEN, False); bird('owl', OW, OW_FAR, OW_PALE, True)
    pack(sys.argv[sys.argv.index('--sheet') + 1] if '--sheet' in sys.argv else None)
