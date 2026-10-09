#!/usr/bin/env python3
"""
Carthage men (June 27, 1844), hand-painted as rig parts: Hyrum Smith, John Taylor,
Willard Richards. No AI imagery and no traced photographs: every shape below is a
coordinate list written by hand, informed by period descriptions —

  Hyrum Smith      tall and lean, long face, dark hair, substantial sideburns and the
                   mole on his right cheek noted in Maudsley's likeness; dark frock
                   coat, black silk stock.
  John Taylor      erect posture, oval face, high forehead, deep-set grey eyes, curly
                   dark-brown hair, short side-whiskers, otherwise clean-shaven
                   (English-born, "fastidious in dress"); black coat, burgundy
                   waistcoat, white cravat, dove-grey trousers.
  Willard Richards heavy-set and broad, large round face, clean-shaven, receding hair
                   kept curled at the sides; brown frock coat, tan waistcoat with a
                   watch chain, white cravat.

Parts use the house figure layout (Joseph's joints), so the shared skeleton, walk,
brace and IK work unchanged, but each man has his own painting: head, build (torso
width, belly, limb thickness), coat length and colours. Hidden areas (coat under the
arm, thigh tops) are painted in full, because each part is painted whole.

  python3 tools/rig/paint_men.py [names...] [--sheet out.png]
Outputs assets/rig/<name>-rig.{png,json} and tools/rig/src/carthage_<name>.png (rest pose).
"""
import json, math, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from men_lib import (W, H, XX, YY, ramp, poly, ell, cap, line_mask, dots, erode, dilate, Part, light, roundness,
                     vnoise, hexc, spline)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UP = 4

# house joints (Joseph layout) — the skeleton every pose is authored against
J = {
    'pelvis': (35.0, 76.0), 'neck': (33.0, 42.0),
    'nShoulder': (21.0, 50.0), 'nElbow': (20.5, 63.0), 'nWrist': (21.0, 76.0),
    'fShoulder': (39.5, 52.0), 'fElbow': (39.0, 65.0), 'fWrist': (39.5, 78.0),
    'skirt': (27.0, 72.0), 'tail': (21.0, 80.0), 'coatFar': (44.0, 74.0),
    'hipArt': (37.5, 76.0), 'kneeArt': (37.5, 100.0), 'ankleArt': (38.0, 119.5),
}

SKIN = {
    'hyrum': ['#4a2418', '#9c5c40', '#d08a62', '#eaa97c', '#f8c79c'],
    'taylor': ['#4c2618', '#a06244', '#d69466', '#efb486', '#fbd0a6'],
    'richards': ['#58281a', '#b06446', '#de8e68', '#f2ae88', '#fcc8a6'],
}
WHITE = ramp(['#5e6066', '#a4a6ac', '#d2d2d6', '#ececee', '#fbfbf8'])
BOOT = ramp(['#060506', '#121012', '#1e1a1c', '#2e2a2c', '#4a4448'])

MEN = {
    'hyrum': dict(
        coat=['#08080c', '#131319', '#1e1e27', '#2c2c38', '#40404f'],
        vest=['#09090b', '#141417', '#202024', '#2e2e34', '#44444c'],
        trouser=['#0e0e10', '#19191d', '#26262b', '#35353c', '#4a4a53'],
        hair=['#0a0706', '#1a120d', '#2b1e16', '#3e2c21', '#56402f'],
        neck='stock', armR=4.0, thighR=4.6, shinR=4.4, handR=(2.9, 3.4),
        back=[(44, 22.0), (48, 20.8), (56, 20.0), (66, 19.6), (76, 19.2), (86, 18.6), (96, 18.0), (104.5, 17.6)],
        front=[(46, 40.0), (52, 41.2), (60, 41.0), (68, 40.4), (76, 40.4), (81, 40.4)],
        shoulderY=44.6, hem=104.5, skirtFront=[(71, 32.0), (88, 29.6), (104.5, 27.2)],
        coatFar=[(39.4, 66), (42.6, 66), (45.2, 104), (39.6, 104.5), (38.6, 82)],
        pelvis=[(27, 71), (43.5, 71), (44, 80), (40, 85), (32, 85), (27, 80)],
    ),
    'taylor': dict(
        coat=['#060609', '#101015', '#1b1b22', '#292933', '#3c3c49'],
        vest=['#260810', '#44121e', '#641c2c', '#86283a', '#a8384a'],
        trouser=['#34343a', '#48484f', '#5c5c64', '#72727a', '#8a8a92'],
        hair=['#0c0705', '#1a100a', '#2a1a10', '#3c2618', '#523522'],
        neck='cravat', armR=4.5, thighR=5.2, shinR=4.9, handR=(3.0, 3.5),
        back=[(44, 21.0), (48, 19.6), (56, 18.8), (66, 18.2), (76, 17.6), (86, 17.0), (96, 16.6), (101, 16.4)],
        front=[(46, 40.8), (52, 42.6), (60, 42.4), (68, 41.6), (76, 41.4), (81, 41.4)],
        shoulderY=43.8, hem=101, skirtFront=[(71, 32.4), (86, 29.4), (101, 26.6)],
        coatFar=[(39.8, 66), (43.6, 66), (46.2, 100.5), (40.2, 101), (39.2, 82)],
        pelvis=[(26, 71), (44, 71), (44.5, 80), (40, 85), (32, 85), (26, 80)],
    ),
    'richards': dict(
        coat=['#140d07', '#22170e', '#342416', '#483420', '#5e462c'],
        vest=['#5a4424', '#7c6234', '#9e824e', '#bc9f6a', '#d8bd8a'],
        trouser=['#18161a', '#252228', '#343038', '#46414a', '#5a5460'],
        hair=['#0a0604', '#180e08', '#28180e', '#3a2416', '#503420'],
        neck='cravat', armR=5.6, thighR=6.6, shinR=5.9, handR=(3.4, 3.8),
        back=[(44, 19.4), (48, 16.4), (56, 14.6), (66, 13.6), (76, 13.0), (86, 12.4), (96, 12.0), (100, 11.9)],
        front=[(45.5, 42.2), (51, 44.4), (57, 46.6), (63, 48.0), (69, 48.2), (75, 46.8), (81, 45.0)],
        shoulderY=43.4, hem=100, skirtFront=[(71, 34.0), (86, 31.4), (100, 29.2)],
        coatFar=[(43.0, 70), (47.6, 70), (49.6, 99.5), (43.4, 100), (42.4, 84)],
        pelvis=[(23, 71), (47, 71), (47.5, 82), (42, 87), (30, 87), (23, 82)],
    ),
}


def keys_x(keys, y):
    """Interpolate x at row y through (y, x) keys (clamped)."""
    if y <= keys[0][0]:
        return keys[0][1]
    for (y0, x0), (y1, x1) in zip(keys, keys[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            t = t * t * (3 - 2 * t) * 0.4 + t * 0.6
            return x0 + (x1 - x0) * t
    return keys[-1][1]


# ============================================================== heads
def head_spec(name):
    """Hand-placed head shapes and feature pixels (model px)."""
    if name == 'hyrum':
        return dict(
            # long face, lean jaw; dark hair combed over from a side parting; heavy sideburns
            skull=[(18.0, 30), (17.4, 23), (19.8, 17.0), (25.0, 12.8), (31.6, 11.4), (37.6, 12.4), (41.2, 15.6), (42.0, 19.6),
                   (39.6, 22.6), (34.4, 23.6), (31.2, 26.8), (29.8, 33.2), (28.6, 38.6), (25.0, 40.4), (21.0, 38.8)],
            face=[(31.0, 21.6), (38.2, 19.6), (40.4, 22.8), (41.3, 26.8), (41.0, 29.0), (41.9, 30.8), (43.1, 32.8), (43.7, 34.2), (42.9, 35.1),
                  (42.2, 35.5), (42.3, 36.7), (41.6, 37.7), (42.0, 38.8), (41.7, 41.1), (39.8, 43.2), (35.2, 43.2), (31.6, 40.8),
                  (29.6, 37.2), (29.0, 31.0), (29.4, 25.0)],
            front=[(28.4, 15.2), (35.6, 12.4), (40.6, 14.6), (42.6, 18.6), (41.6, 21.2), (38.6, 20.6), (35.2, 21.8), (32.2, 23.8),
                   (29.6, 25.4), (27.6, 20.6)],
            burn=[(29.4, 24.8), (32.9, 25.8), (33.4, 31.0), (33.9, 36.8), (33.0, 39.8), (30.8, 39.0), (29.6, 33.0)],
            ear=(27.4, 32.2, 1.9, 3.0), part=(35.0, 12.6), locks=11, curl=0.25, hair_v=0.5, curls=False,
            brow_y=27, chin_y=43,
            eye=dict(at=(37, 29), iris='#3a2618', brow=[(35, 27), (36, 26), (37, 26), (38, 26), (39, 27)]),
            nose_tip=(43, 34), mouth=[(40, 37), (41, 37)], lip=[(41, 38)], chin=[(38, 42), (39, 42), (37, 42)],
            mole=(35, 35), cheek=None, jowl=False,
        )
    if name == 'taylor':
        return dict(
            # oval face, high forehead, curly hair with volume at the back, short whiskers
            skull=[(16.6, 31), (16.4, 23.4), (18.8, 17.4), (23.6, 13.4), (30.2, 11.8), (36.6, 12.4), (40.6, 15.2), (41.6, 18.6),
                   (39.2, 19.6), (33.6, 21.0), (30.8, 25.0), (29.6, 32.0), (28.4, 37.6), (24.6, 40.0), (19.6, 38.6)],
            face=[(31.0, 20.4), (37.0, 17.6), (40.4, 20.2), (41.6, 24.2), (42.0, 27.4), (41.5, 29.3), (42.2, 31.0), (43.2, 32.9), (43.6, 34.1),
                  (42.8, 35.0), (42.0, 35.3), (42.2, 36.5), (41.6, 37.5), (41.9, 38.5), (41.2, 40.2), (38.6, 41.7), (33.6, 41.5),
                  (30.4, 38.6), (29.3, 32.0), (29.6, 25.0)],
            front=[(27.6, 16.4), (32.6, 13.0), (38.0, 13.4), (40.8, 15.8), (40.0, 18.0), (37.0, 17.8), (34.0, 18.8), (31.4, 21.0),
                   (29.8, 24.6), (27.6, 22.0)],
            burn=[(29.5, 24.6), (32.2, 25.2), (32.6, 30.0), (31.6, 32.6), (29.6, 31.4)],
            ear=(27.4, 31.6, 1.9, 3.0), part=(33.0, 15.0), locks=16, curl=1.6, hair_v=0.5, curls=True,
            brow_y=27, chin_y=41.5,
            eye=dict(at=(37, 30), iris='#56606a', deep=True, brow=[(35, 27), (36, 27), (37, 27), (38, 27), (39, 28)]),
            nose_tip=(43, 34), mouth=[(40, 37), (41, 37)], lip=[(41, 38)], chin=[(37, 41), (38, 41)],
            mole=None, cheek=None, jowl=False,
        )
    return dict(
        # large round face (full cheeks, double chin); high receding hairline, the rest
        # of the hair kept long and curled at the sides and back
        skull=[(16.4, 31), (16.6, 23.4), (19.0, 18.0), (23.4, 14.6), (28.6, 13.0), (33.0, 13.4), (31.6, 18.0), (30.4, 23.0),
               (30.6, 28.0), (30.2, 34.0), (29.0, 39.6), (25.0, 41.8), (20.2, 40.4), (17.4, 36.4)],
        top=[(22.0, 15.0), (28.0, 12.6), (35.0, 12.6), (38.4, 14.2), (36.0, 15.6), (32.6, 17.6), (30.6, 21.0), (29.4, 24.0), (25.0, 19.0)],
        face=[(27.0, 14.6), (31.6, 13.0), (36.6, 13.6), (40.4, 16.2), (42.6, 20.0), (43.2, 24.2), (43.3, 27.2), (43.0, 29.2),
              (43.9, 31.0), (45.0, 33.0), (45.3, 34.3), (44.4, 35.2), (43.7, 35.5), (43.9, 36.8), (43.2, 37.8), (43.7, 38.9), (43.3, 40.8),
              (42.0, 42.4), (39.6, 43.9), (35.4, 44.4), (31.4, 43.0), (28.8, 39.6), (28.2, 32.0), (28.4, 24.0), (27.2, 18.6)],
        front=None, burn=None,
        ear=(27.4, 32.4, 2.0, 3.0), part=(31.0, 14.0), locks=14, curl=1.4, hair_v=0.5, curls=True,
        brow_y=27, chin_y=44,
        eye=dict(at=(38, 30), iris='#40322a', brow=[(37, 27), (38, 27), (39, 27), (40, 28)]),
        nose_tip=(45, 34), mouth=[(42, 38), (43, 38)], lip=[(43, 39)], chin=[(37, 43), (38, 43), (39, 43), (40, 42), (36, 43)],
        mole=None, cheek=(40.5, 34.6), jowl=True,
    )


def hair_locks(P, m, HR, part, nl=12, curl=0.0, base=0.5, seed=0, face=None):
    """Hair painted in locks fanning from the parting: each lock lit along its middle and
    dark at its seams, on top of the light from the upper front (the cast's hair style)."""
    ys, xs = np.nonzero(m)
    if not len(xs):
        return
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    px_, py_ = part
    rng = np.random.default_rng(seed)
    jit = rng.random(64)
    v = np.zeros((H, W))
    for y, x in zip(ys, xs):
        u = (x - x0) / max(1, x1 - x0)
        w = (y - y0) / max(1, y1 - y0)
        val = base + 0.28 * (1 - w) * (0.4 + 0.6 * u) - 0.28 * w * (1 - u)
        ang = math.atan2(y + .5 - py_, x + .5 - px_)
        d = math.hypot(x + .5 - px_, y + .5 - py_)
        f = (ang / math.pi * nl * 0.5 + 0.13 * d * curl) % 1.0
        k = int(ang / math.pi * nl * 0.5 + 0.13 * d * curl) % 64
        across = abs(f - 0.5) * 2
        val += (0.2 + 0.08 * jit[k]) * (1 - across) - 0.22 * max(0, across - 0.7) / 0.3
        v[y, x] = val
    if face is not None:
        near = dilate(face, 1) & m
        v[near] = np.minimum(v[near], 0.3)
    P.fill(m, HR, v)


def paint_head(name, cfg):
    hs = head_spec(name)
    SK = ramp(SKIN[name])
    HR = ramp(cfg['hair'])
    P = Part()
    skull = poly(hs['skull'], smooth=True)
    face = poly(hs['face'], smooth=True)
    ex, ey, erx, ery = hs['ear']
    ear = ell(ex, ey, erx, ery)
    fr = poly(hs['front'], smooth=True) if hs['front'] else np.zeros_like(skull)
    burn = poly(hs['burn'], smooth=True) if hs['burn'] else np.zeros_like(skull)
    top = poly(hs['top'], smooth=True) if hs.get('top') else np.zeros_like(skull)
    # --- face + ear (skin first; hair is painted over it) -------------------------
    fv = light(face, base=0.62, kx=0.2, ky=-0.02, kf=0.34, cx=35.5, cy=30, noise=0.02, cell=4, seed=5)
    fv = fv + 0.07 * np.exp(-(((XX - 38.5) / 2.6) ** 2 + ((YY - hs['brow_y'] + 4.5) / 2.4) ** 2))      # lit forehead
    fv = fv + 0.06 * np.exp(-(((XX - 39.5) / 1.8) ** 2 + ((YY - 32.5) / 1.4) ** 2))                     # cheekbone
    fv = fv - 0.10 * np.clip((33.0 - XX) / 4.0, 0, 1)                                                     # turning away
    fv = fv - 0.10 * np.clip((YY - (hs['chin_y'] - 3.5)) / 3.0, 0, 1) * (XX < 40)                        # under the jaw
    from men_lib import blur as _blur
    fv = _blur(fv, 2)
    P.fill(face, SK, fv)
    P.fill(ear & ~face, SK, light(ear, base=0.48, kx=0.12, kf=0.4, cx=ex, cy=ey))
    P.tone(dots([(ex - 0.2, ey - 0.4), (ex - 0.2, ey + 0.6)]), 0.72)
    # --- hair -----------------------------------------------------------------------
    back = skull & ~face & ~ear
    hair = back | fr | top | burn
    hair_locks(P, hair, HR, hs['part'], nl=hs['locks'], curl=hs['curl'], base=hs['hair_v'], seed=len(name),
               face=face & ~hair)
    if hs['curls']:
        # loose curls: a few lit crescents over dark cores, and a softly bumpy silhouette
        rng = np.random.default_rng(len(name) + 1)
        inner = hair & erode(hair) & ~burn
        ys, xs = np.nonzero(inner)
        for i in rng.permutation(len(xs))[: len(xs) // 10]:
            x, y = xs[i] + 0.5, ys[i] + 0.5
            P.tone(dots([(x, y)]), 1.3, 6)
            P.tone(dots([(x - 1, y + 1)]), 0.72)
        edge = hair & ~erode(hair)
        ys, xs = np.nonzero(edge)
        for i in range(0, len(xs), 4):
            x, y = xs[i], ys[i]
            if (x < 29 or y < 16) and not burn[y, x]:
                for dx, dy in ((-1, 0), (0, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and not P.a[yy, xx]:
                        P.fill(dots([(xx + .5, yy + .5)]), HR, 0.22)
                        break
    # --- features -------------------------------------------------------------------
    e = hs['eye']
    ex_, ey_ = e['at']
    lash = HR.cols[0] * 0.55
    if e.get('deep'):
        P.tone(dots([(ex_ - 2, ey_ - 1.6 + 0.5), (ex_ - 1, ey_ - 2 + 0.5), (ex_, ey_ - 2 + 0.5), (ex_ + 1, ey_ - 2 + 0.5)]) & face, 0.82)
    P.solid(dots(e['brow']), HR.cols[1] * 0.9 + 6)
    P.solid(dots([(ex_ - 2, ey_ - 1), (ex_ - 1, ey_ - 1), (ex_, ey_ - 1), (ex_ + 1, ey_ - 1)]), lash)
    P.solid(dots([(ex_ - 1, ey_)]), '#efe9e0')
    P.solid(dots([(ex_, ey_), (ex_, ey_ + 1)]), e['iris'])
    P.solid(dots([(ex_ + 1, ey_)]), np.array(hexc(e['iris'])) * 0.5 + 100)
    P.tone(dots([(ex_ - 1, ey_ + 1), (ex_ + 1, ey_ + 1)]), 0.88)
    P.tone(dots([(ex_ - 1, ey_ + 2), (ex_, ey_ + 2)]), 0.93)
    nx, ny = hs['nose_tip']
    P.tone(dots([(nx - 1.5, ny + 0.8)]), 0.7)                                          # nostril
    P.tone(dots([(nx - 2.5, ny + 1.6), (nx - 1.5, ny + 1.6)]), 0.88)                    # shadow under the nose
    P.tone(dots([(nx - 2.5, ny - 1), (nx - 2.5, ny - 2)]), 0.92)                        # side of the nose
    P.solid(dots(hs['mouth']), SK.cols[0] * 0.85 + np.array([28, 4, 4]))
    P.tone(dots(hs['lip']), 0.9)
    P.tone(dots(hs['chin']), 0.84)
    if hs['mole']:
        P.solid(dots([hs['mole']]), SK.cols[0] * 0.7)
    if hs['cheek']:
        cx_, cy_ = hs['cheek']
        P.mix(ell(cx_, cy_, 2.2, 1.5) & face, '#e2806a', 0.3)
    if hs['jowl']:
        P.tone(line_mask([(35.5, 42.8), (38.5, 42.6), (41.4, 41.6)], smooth=True) & face, 0.8)
        P.tone(line_mask([(31.0, 39.2), (32.6, 41.6), (35.0, 42.9)], smooth=True) & face, 0.88)
    P.outline(0.34)
    return P


# ============================================================== body
def torso_mask(c):
    back, front = c['back'], c['front']
    sy = c['shoulderY']
    pts = [(27.0, sy - 1.6), (24.0, sy - 0.8), (21.0, sy + 0.4)]
    for y in range(int(sy) + 2, 82, 3):
        pts.append((keys_x(back, y), y))
    pts += [(keys_x(back, 82), 82), (keys_x(front, 82) - 0.5, 82)]
    for y in range(80, int(front[0][0]) - 1, -3):
        pts.append((keys_x(front, y), y))
    pts += [(keys_x(front, front[0][0]), front[0][0]), (39.6, sy + 0.8), (37.0, sy - 1.6)]
    return poly(pts, smooth=False)


def paint_torso(name, cfg):
    COAT, VEST, TR = ramp(cfg['coat']), ramp(cfg['vest']), ramp(cfg['trouser'])
    SK = ramp(SKIN[name])
    P = Part()
    body = torso_mask(cfg)
    front = cfg['front']
    # neck (under the chin) -------------------------------------------------------
    nk = poly([(29.0, 35.5), (36.8, 35.5), (37.6, 45.0), (29.6, 45.0)])
    P.fill(nk, SK, light(nk, base=0.42, kx=0.25, cx=33, kf=0.2))
    # coat --------------------------------------------------------------------------
    cv = light(body, base=0.52, kx=0.11, ky=-0.05, kf=0.42, cx=30, cy=60, noise=0.05, cell=4, seed=11)
    P.fill(body, COAT, cv)
    # open front: the waistcoat / shirt show between the lapel edge and the far coat strip
    vx = lambda y: keys_x(front, y) - (2.0 if name != 'richards' else 1.6)
    lap = {'hyrum': 31.2, 'taylor': 31.6, 'richards': 32.0}[name]
    V = [(lap - 1.2, 43.0), (lap, 50), (lap + 0.6, 60), (lap + 0.8, 70), (lap + 1.0, 77.5)]
    vb = 77.5 if name != 'richards' else 79.0
    vpts = V + [(36.5, vb + 1.6), (vx(76), 76)] + [(vx(y), y) for y in range(74, 45, -4)] + [(38.5, 44.2), (36.0, 43.0)]
    vm = poly(vpts) & body
    vest = vm & (YY > 46.5)
    vv = light(vest, base=0.55, kx=0.16, ky=-0.03, kf=0.45, cx=36, cy=60, noise=0.04, seed=13)
    if name == 'richards':
        # the belly: a round, lit form pushing the waistcoat forward
        vv = vv + 0.22 * (roundness(vest, 6.0) - 0.5)
    P.fill(vest, VEST, vv)
    # waistcoat buttons + the front edge of the waistcoat
    bx = lambda y: vx(y) - 1.6
    P.solid(dots([(bx(y), y) for y in range(52, int(vb) - 2, 4)]), VEST.cols[4] * 0.9 + 18)
    P.tone(dots([(bx(y) + 1, y) for y in range(52, int(vb) - 2, 4)]), 0.7)
    # shirt + neckwear -----------------------------------------------------------------
    shirt = vm & (YY <= 47.0)
    P.fill(shirt, WHITE, light(shirt, base=0.78, kx=0.1, cx=35, kf=0.2))
    if cfg['neck'] == 'stock':
        st = poly([(30.0, 41.2), (38.4, 41.2), (39.4, 45.6), (36.0, 47.2), (30.4, 45.6)])
        P.fill(st, ramp(['#020203', '#0a0a0c', '#16161a', '#24242a', '#383840']), light(st, base=0.4, kx=0.2, cx=35, kf=0.3))
        # white shirt-collar points standing up above the stock
        cp = poly([(36.6, 41.6), (39.6, 38.8), (40.2, 41.8), (38.6, 42.4)])
        P.fill(cp, WHITE, 0.82)
    else:
        cr = poly([(30.0, 41.4), (38.6, 41.0), (40.0, 44.0), (39.0, 48.4), (36.6, 47.4), (30.4, 45.4)])
        P.fill(cr, WHITE, light(cr, base=0.7, kx=0.18, cx=35, kf=0.35, noise=0.06, seed=15))
        P.tone(line_mask([(36.2, 44.0), (38.6, 46.8)]) & cr, 0.78)                     # the knot's fold
        cp = poly([(36.8, 41.6), (39.8, 38.6), (40.4, 41.6), (38.8, 42.2)])
        P.fill(cp, WHITE, 0.86)
    # lapel + rolled collar ------------------------------------------------------------
    collar = poly([(25.6, 42.0), (30.2, 42.4), (30.4, 45.8), (26.4, 47.0), (23.8, 45.0)])
    P.fill(collar & body, COAT, light(collar, base=0.62, kx=0.1, cx=28, kf=0.3))
    lp = poly([(29.4, 43.4), (lap - 0.6, 43.6), (lap + 3.4, 47.6), (lap + 1.8, 49.0), (lap + 2.8, 50.4), (lap + 0.6, 58.5),
               (lap - 1.6, 52.0)])
    P.fill(lp & body, COAT, light(lp, base=0.68, kx=0.12, cx=lap, kf=0.3) )
    lp_edge = lp & ~erode(lp)
    P.tone(lp_edge & body & (XX < lap + 0.2), 0.62)
    # the open-front edge of the coat (dark line), waist seam, side seam fold
    P.tone(line_mask([(V[i][0], V[i][1]) for i in range(len(V))], smooth=True) & body, 0.55)
    P.tone(line_mask([(keys_x(cfg['back'], 72) + 1, 72.2), (lap, 72.0)]) & body, 0.7)          # frock-coat waist seam
    P.tone(line_mask([(24.5, 52), (25.2, 60), (25.4, 68)], smooth=True) & body, 0.8)             # side fold under the arm
    P.tone(line_mask([(keys_x(front, 50) - 0.8, 47), (keys_x(front, 60) - 0.6, 60), (keys_x(front, 72) - 0.6, 74)], smooth=True) & body & ~vm, 1.18, 4)
    if name == 'richards':
        # watch chain across the tan waistcoat to the fob pocket (gilt links)
        chain = [(bx(62) - 0.4, 62.5), (40.0, 65.4), (38.0, 66.6), (36.0, 66.8), (34.6, 66.0)]
        cm = line_mask(chain, smooth=True) & vest
        ys, xs = np.nonzero(cm)
        for i, (y, x) in enumerate(zip(ys, xs)):
            P.solid(dots([(x + .5, y + .5)]), '#f0cc74' if (x + y) % 2 else '#9c7428')
        P.tone(dots([(34.5, 67.5), (35.5, 67.5)]), 0.75)       # the fob pocket
    if name == 'taylor':
        # watch pocket on the waistcoat (his watch at Carthage) — a small welt
        P.tone(line_mask([(35.4, 66.2), (38.0, 66.0)]) & vest, 0.72)
    P.outline(0.34)
    return P, body


def paint_skirt(name, cfg):
    COAT = ramp(cfg['coat'])
    back, sf, hem = cfg['back'], cfg['skirtFront'], cfg['hem']
    pts = [(keys_x(back, 71) - 0.2, 71)]
    for y in range(74, int(hem), 3):
        pts.append((keys_x(back, y) - 0.2, y))
    pts += [(keys_x(back, hem), hem + 0.6), (sf[-1][1] - 0.4, hem + 0.2)]
    pts += [(x, y) for y, x in reversed(sf)]
    m = poly(pts)
    P = Part()
    v = light(m, base=0.48, kx=0.12, cx=24, kf=0.36, noise=0.05, cell=4, seed=17)
    # vertical folds of the skirt (light ridge, dark valley)
    for fx in (22.0, 26.0):
        P.tone(np.zeros_like(m), 1)
        v = v + 0.08 * np.exp(-((XX - fx - (YY - 72) * -0.05) ** 2) / 1.2) * (YY > 78)
        v = v - 0.07 * np.exp(-((XX - fx - 1.6 - (YY - 72) * -0.05) ** 2) / 0.8) * (YY > 80)
    P.fill(m, COAT, v)
    # front edge of the skirt (a lit fold) and the hem
    P.tone(line_mask([(x - 0.8, y) for y, x in sf], smooth=True) & m, 1.25, 4)
    P.outline(0.34, soft=(YY < 73.5))
    tail = Part()
    tx = {'hyrum': 21.0, 'taylor': 20.4, 'richards': 17.8}[name]
    tm = m & (XX <= tx) & (YY >= 79)
    tail.rgb[tm] = P.rgb[tm]
    tail.a = tm.copy()
    tail.outline(0.6, soft=(YY < 80.5) | (XX > tx - 0.6))
    return P, tail


def paint_coatfar(name, cfg):
    COAT = ramp(cfg['coat'])
    m = poly(cfg['coatFar'])
    P = Part()
    P.fill(m, COAT, light(m, base=0.42, kx=0.12, cx=42, kf=0.3, noise=0.04, seed=19))
    # its front edge is a lit fold, like the near skirt's edge
    xs = [p[0] for p in cfg['coatFar']]
    P.tone(line_mask([(cfg['coatFar'][1][0] - 0.6, 67), (cfg['coatFar'][2][0] - 0.8, 99)]) & m, 1.3, 5)
    P.outline(0.34, soft=(YY < 72))
    return P


def paint_pelvis(name, cfg):
    TR = ramp(cfg['trouser'])
    m = poly(cfg['pelvis'], smooth=True)
    P = Part()
    P.fill(m, TR, light(m, base=0.45, kx=0.12, cx=35, kf=0.35, noise=0.04, seed=21))
    P.outline(0.4, soft=(XX > 29) | (YY < 73))
    return P


def paint_arm(name, cfg):
    COAT = ramp(cfg['coat'])
    SK = ramp(SKIN[name])
    r = cfg['armR']
    up = cap(21.0, 48.0, 20.5, 63.0, r, r - 0.5)
    fo = cap(20.5, 63.0, 21.0, 75.6, r - 0.5, r - 1.0)
    U, Fo = Part(), Part()
    U.fill(up, COAT, light(up, base=0.5, kx=0.22, cx=21, kf=0.4, noise=0.04, seed=23))
    U.tone(line_mask([(18.5, 58.5), (20.0, 61.5)]) & up, 0.75)        # fold at the inner elbow
    U.outline(0.34)
    Fo.fill(fo, COAT, light(fo, base=0.5, kx=0.22, cx=21, kf=0.4, noise=0.04, seed=25))
    Fo.tone(line_mask([(18.6, 66), (19.4, 70)]) & fo, 0.8)
    cuff = poly([(17.6, 74.6), (24.2, 74.6), (24.0, 76.6), (17.8, 76.6)])
    Fo.fill(cuff & dilate(fo, 1), WHITE, 0.7)
    hx, hy = 22.0, 80.4
    rx, ry = cfg['handR']
    hand = ell(hx, hy, rx, ry)
    Fo.fill(hand, SK, light(hand, base=0.62, kx=0.2, cx=hx, kf=0.4, cy=hy))
    Fo.tone(dots([(hx + rx - 1.2, hy - 1.2), (hx + rx - 1.0, hy)]), 0.78)      # thumb crease
    Fo.tone(line_mask([(hx - rx + 1, hy + 1.2), (hx + 0.5, hy + 1.6)]) & hand, 0.85)
    Fo.outline(0.36, soft=(YY < 64.5))
    # elbow cap carried by the upper arm (under the forearm) so bending never opens a hole
    elbow = ell(20.5, 63.2, r - 0.5, r - 0.4)
    U.fill(elbow & ~U.a, COAT, 0.45)
    return U, Fo


def paint_legs(name, cfg):
    TR = ramp(cfg['trouser'])
    rT, rS = cfg['thighR'], cfg['shinR']
    th = cap(37.5, 71.0, 37.5, 100.0, rT, rT - 0.5)
    sh = cap(37.5, 99.0, 38.0, 120.6, rT - 0.6, rS)
    # 1840s trousers fall straight over the boot to the instep
    sh |= poly([(38.0 - rS, 114), (38.0 + rS, 114), (38.0 + rS + 1.2, 121.6), (37.6 - rS - 0.4, 121.6)])
    T, S, Fp = Part(), Part(), Part()
    T.fill(th, TR, light(th, base=0.5, kx=0.18, cx=37.5, kf=0.4, noise=0.04, seed=27))
    T.tone(line_mask([(39.5, 92), (40.4, 98)]) & th, 1.2, 4)            # knee crease highlight
    T.outline(0.38, soft=(YY > 95.5) | (YY < 79))
    S.fill(sh, TR, light(sh, base=0.48, kx=0.18, cx=38, kf=0.4, noise=0.04, seed=29))
    S.tone(line_mask([(40.5, 104), (41.0, 116)]) & sh, 1.15, 3)
    S.tone(line_mask([(35.0, 116.5), (36.0, 120.5)]) & sh, 0.78)
    S.outline(0.38, soft=(YY < 100.5))
    boot = poly([(33.8, 118.0), (41.6, 117.6), (43.6, 120.2), (47.4, 122.4), (49.4, 124.4), (49.3, 126.95), (33.5, 126.95),
                 (33.2, 123.0)], smooth=False)
    Fp.fill(boot, BOOT, light(boot, base=0.5, kx=0.25, cx=40, ky=-0.35, cy=123, kf=0.3))
    Fp.solid(dots([(x + 0.5, 126.5) for x in range(34, 49)]) & boot, '#050405')
    Fp.tone(dots([(45.5, 122.5), (46.5, 123.5)]), 1.6, 18)                # toe shine
    Fp.outline(0.4, soft=(YY < 120.5))
    return T, S, Fp


def shade(L, k, tint=(0, 0, 0)):
    M = L.copy()
    m = M[..., 3] > 0
    for c in range(3):
        M[..., c][m] = np.clip(M[..., c][m] * k + tint[c], 0, 255)
    return M


def build(name):
    cfg = MEN[name]
    parts = {}
    parts['head'] = paint_head(name, cfg).rgba()
    torso, body = paint_torso(name, cfg)
    parts['torso'] = torso.rgba()
    sk, tl = paint_skirt(name, cfg)
    parts['skirt'], parts['tail'] = sk.rgba(), tl.rgba()
    parts['pelvis'] = paint_pelvis(name, cfg).rgba()
    parts['coatFar'] = paint_coatfar(name, cfg).rgba()
    U, Fo = paint_arm(name, cfg)
    parts['nUpper'], parts['nFore'] = U.rgba(), Fo.rgba()
    parts['fUpper'], parts['fFore'] = shade(parts['nUpper'], 0.74, (0, 2, 8)), shade(parts['nFore'], 0.74, (0, 2, 8))
    parts['fUpper'][:47] = 0
    WR = 77
    parts['nForeOpen'] = parts['nFore'].copy(); parts['nForeOpen'][WR:] = 0
    parts['fForeOpen'] = parts['fFore'].copy(); parts['fForeOpen'][WR:] = 0
    # small praying-hands part (unused by the Carthage actions; kept for the shared format)
    ph = np.zeros((H, W, 4), np.uint8)
    SKr = ramp(SKIN[name])
    for j, row in enumerate(["..OO.", ".OLMO", ".OLMO", "OLLMO", "OLMSO", ".OMSO", "..OO."]):
        for i, ch in enumerate(row):
            if ch != '.':
                c = {'O': SKr.cols[0] * 0.7, 'L': SKr.cols[4], 'M': SKr.cols[3], 'S': SKr.cols[2]}[ch]
                ph[20 + j, 40 + i, :3] = c; ph[20 + j, 40 + i, 3] = 255
    parts['prayHands'] = ph
    T, S, Fp = paint_legs(name, cfg)
    for side, k in (('n', 1.0), ('f', 0.8)):
        parts[side + 'Thigh'] = shade(T.rgba(), k)
        parts[side + 'Shin'] = shade(S.rgba(), k)
        parts[side + 'Foot'] = shade(Fp.rgba(), k)
    return parts


def rest_composite(parts):
    """The painting as it stands at rest (near leg at its rest hip, like the rig)."""
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dxN = -7  # near leg hangs from hipN (30.5) vs the art hip (37.5); near ankle 26.5 vs 38 → shift ~-7..-11
    order = ['coatFar', 'fShin', 'fFoot', 'fThigh', 'fUpper', 'fFore', 'pelvis', 'nShin', 'nFoot', 'nThigh', 'torso', 'skirt',
             'tail', 'head', 'nUpper', 'nFore']
    for n in order:
        im = Image.fromarray(parts[n])
        if n in ('fUpper', 'fFore'):
            off = (int(J['fShoulder'][0] - J['nShoulder'][0]), int(J['fShoulder'][1] - J['nShoulder'][1]))
        elif n in ('nThigh',):
            off = (-7, 0)
        elif n in ('nShin', 'nFoot'):
            off = (-10, 0)
        else:
            off = (0, 0)
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        layer.paste(im, off)
        out.alpha_composite(layer)
    return out


def pack(name, parts):
    PRAY_PIVOT = (40 + 2.5, 20 + 6.5)
    pivots = {
        'head': J['neck'], 'torso': J['pelvis'], 'pelvis': J['pelvis'], 'skirt': J['skirt'], 'tail': J['tail'],
        'coatFar': J['coatFar'], 'nUpper': J['nShoulder'], 'nFore': J['nElbow'], 'fUpper': J['nShoulder'], 'fFore': J['nElbow'],
        'nForeOpen': J['nElbow'], 'fForeOpen': J['nElbow'], 'prayHands': PRAY_PIVOT,
        'nThigh': J['hipArt'], 'nShin': J['kneeArt'], 'nFoot': J['ankleArt'],
        'fThigh': J['hipArt'], 'fShin': J['kneeArt'], 'fFoot': J['ankleArt'],
    }
    crops = {}
    for n, L in parts.items():
        ys, xs = np.nonzero(L[..., 3])
        crops[n] = (max(0, xs.min() - 1), max(0, ys.min() - 1), min(W - 1, xs.max() + 1), min(H - 1, ys.max() + 1))
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
    atlas = Image.new('RGBA', (AW, cy + rowh), (0, 0, 0, 0))
    meta = {'scale': UP, 'cell': [W, H], 'ground': 126, 'joints': J, 'parts': {}, 'painted': 'tools/rig/paint_men.py',
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
        ax, ay, w, h = place[n]
        atlas.paste(im, (ax, ay))
        meta['parts'][n] = {'x': int(ax), 'y': int(ay), 'w': int(w), 'h': int(h), 'ox': int(x0), 'oy': int(y0),
                            'pivot': list(pivots[n]), **EXTRA.get(n, {})}
    atlas.save(os.path.join(ROOT, 'assets', 'rig', f'{name}-rig.png'), optimize=True)
    json.dump(meta, open(os.path.join(ROOT, 'assets', 'rig', f'{name}-rig.json'), 'w'), indent=1)


if __name__ == '__main__':
    names = [a for a in sys.argv[1:] if not a.startswith('--') and a in MEN] or list(MEN)
    rests = []
    for n in names:
        parts = build(n)
        pack(n, parts)
        rc = rest_composite(parts)
        rc.save(os.path.join(ROOT, 'tools', 'rig', 'src', f'carthage_{n}.png'))
        rests.append(rc)
        print('painted', n)
    if '--sheet' in sys.argv:
        out = sys.argv[sys.argv.index('--sheet') + 1]
        S = 5
        sheet = Image.new('RGBA', (len(rests) * W * S, H * S), (176, 206, 176, 255))
        for i, r in enumerate(rests):
            sheet.alpha_composite(r.resize((W * S, H * S), Image.NEAREST), (i * W * S, 0))
        sheet.save(out)
