"""
Shared painted cut-out cutter for the cast (Palmyra Quest rigs).

A character config names regions of ONE original painted frame (polygons in the
frame's own pixel coordinates) and the joints of the shared humanoid skeleton.
Every part keeps the real painted pixels. Hidden areas (coat under an arm, the
neck under the chin, a thigh under a coat) are filled only with cloth/skin
sampled from the same painting so rotations never open holes. Output: a 4x
nearest atlas + JSON in the same format as the Joseph rig.
"""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw

UP = 4


def lum(px):
    return 0.3 * float(px[0]) + 0.59 * float(px[1]) + 0.11 * float(px[2])


def poly_mask(shape, pts):
    h, w = shape
    im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=1, outline=1)
    return np.array(im, bool)


def shade(L, k, tint=(0, 0, 0)):
    M = L.copy()
    m = M[..., 3] > 0
    for c in range(3):
        M[..., c][m] = np.clip(M[..., c][m] * k + tint[c], 0, 255)
    return M


def capsule(shape, a, b, r):
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w]
    px, py = xx + .5, yy + .5
    dx, dy = b[0] - a[0], b[1] - a[1]
    L2 = dx * dx + dy * dy or 1
    t = np.clip(((px - a[0]) * dx + (py - a[1]) * dy) / L2, 0, 1)
    qx, qy = a[0] + t * dx, a[1] + t * dy
    return np.hypot(px - qx, py - qy) <= r


def disk(shape, c, r):
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w]
    return np.hypot(xx + .5 - c[0], yy + .5 - c[1]) <= r


def side_of(p, a, b):
    """>0 if p is on the left of a→b (screen coords)."""
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])


def ang_down(a, b):
    return math.degrees(math.atan2(-(b[0] - a[0]), b[1] - a[1]))


def dilate(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r + 1:
                out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


class Cutter:
    def __init__(self, cfg, src_dir):
        self.cfg = cfg
        sheet = np.array(Image.open(os.path.join(src_dir, cfg['src'])).convert('RGBA')).astype(np.int32)
        fx, fy, fw, fh = cfg['cell']
        F = sheet[fy:fy + fh, fx:fx + fw].copy()
        if cfg.get('alphaCut'):
            # resampled sheets have soft, grey-blended edges: keep only solid pixels
            F[F[..., 3] < cfg['alphaCut']] = 0
            F[F[..., 3] > 0, 3] = 255
        if cfg.get('edgeFlecks', cfg.get('alphaCut') is not None):
            # rough spot: the resampled sheets carry pale grey flecks just outside the
            # outline. They flicker once parts move, so drop pale protruding pixels and
            # lone specks (the dark painted outline itself is never pale).
            for _ in range(2):
                a = (F[..., 3] > 0).astype(int)
                nb = sum(np.roll(np.roll(a, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - a
                rgb = F[..., :3]
                pale = (rgb.min(-1) > 140) & ((rgb.max(-1) - rgb.min(-1)) < 45)
                kill = (a > 0) & (((nb <= 4) & pale) | (nb <= 1))
                F[kill] = 0
        self.F = F
        self.H, self.W = F.shape[:2]
        self.op = F[..., 3] > 40
        self.parts = {}
        self.extra = {}

    # ---------------------------------------------------------------- ownership
    def own(self):
        c, sh = self.cfg, (self.H, self.W)
        op = self.op
        owner = np.full(sh, '', dtype=object)
        head = poly_mask(sh, c['head']) & op
        nArm = poly_mask(sh, c['nArm']['poly']) & op & ~head
        fArm = (poly_mask(sh, c['fArm']['poly']) & op & ~head & ~nArm) if c.get('fArm') and c['fArm'].get('poly') else np.zeros(sh, bool)
        extra = {}
        taken = head | nArm | fArm
        for name, p in c.get('extraParts', {}).items():
            m = poly_mask(sh, p['poly']) & op & ~taken
            extra[name] = m
            taken = taken | m
        drop = np.zeros(sh, bool)
        for p in c.get('drop', []):
            drop |= poly_mask(sh, p)
        drop &= op & ~taken
        yy = np.mgrid[0:sh[0], 0:sh[1]][0]
        body = op & ~head & ~nArm & ~fArm & ~drop
        for m in extra.values():
            body &= ~m
        waist = c['waist']
        skirt = body & (yy >= waist) if c.get('skirt', True) else np.zeros(sh, bool)
        torso = body & ~skirt
        for name, m in (('head', head), ('nArm', nArm), ('fArm', fArm), ('drop', drop), ('torso', torso), ('skirt', skirt)):
            owner[m] = name
        for name, m in extra.items():
            owner[m] = name
        self.owner = owner
        self.M = {'head': head, 'nArm': nArm, 'fArm': fArm, 'drop': drop, 'torso': torso, 'skirt': skirt, **extra}
        return owner

    def layer(self, mask):
        L = np.zeros_like(self.F)
        L[mask] = self.F[mask]
        return L

    # ---------------------------------------------------------------- cloth fill
    def edge_fn(self, keys):
        keys = sorted(keys)

        def f(y):
            if y <= keys[0][0]:
                return keys[0][1]
            for (y0, x0), (y1, x1) in zip(keys, keys[1:]):
                if y0 <= y <= y1:
                    t = (y - y0) / max(1e-6, y1 - y0)
                    t = t * t * (3 - 2 * t) * 0.35 + t * 0.65
                    return x0 + (x1 - x0) * t
            return keys[-1][1]
        return f

    def fill_flat(self, arm_mask, edge_keys, side, rows, layers_for, body_ok, tex=4, win=13):
        """Repaint a LARGE hidden strip (a whole side of a long coat) as plain cloth: each
        row takes the mean of the first `tex` visible cloth pixels, smoothed over `win` rows
        (so no mirrored buttons or stripes), shaded into a dark rounded back edge."""
        F = self.F
        edge = self.edge_fn(edge_keys)
        outline = self.outline_color()
        cols = {}
        for y in range(rows[0], rows[1] + 1):
            xe = int(math.floor(edge(y) + 0.5))
            xs = range(xe, self.W) if side < 0 else range(xe, -1, -1)
            got = []
            for x in xs:
                if body_ok[y, x] and not arm_mask[y, x]:
                    got.append(F[y, x, :3].astype(float))
                    if len(got) >= tex:
                        break
                elif got:
                    break
            if got:
                cols[y] = (np.mean(got, 0), x)
        if not cols:
            return
        ys = sorted(cols)
        for y in range(rows[0], rows[1] + 1):
            near = [cols[v][0] for v in ys if abs(v - y) <= win // 2]
            if not near:
                continue
            base = np.median(near, 0)
            xe = edge(y)
            xei = int(math.floor(xe + 0.5))
            # first visible pixel of this row past the arm
            xv = None
            for x in (range(xei, self.W) if side < 0 else range(xei, -1, -1)):
                if body_ok[y, x] and not arm_mask[y, x]:
                    xv = x
                    break
            if xv is None:
                continue
            span = range(xei, xv) if side < 0 else range(xv + 1, xei + 1)
            for x in span:
                if not (0 <= x < self.W):
                    continue
                L = layers_for(y, x)
                if L[y, x, 3]:
                    continue
                de = abs(x - xe)
                k = 0.62 + 0.38 * min(1.0, de / 6.0) ** 0.7
                L[y, x, :3] = np.clip(base * k, 0, 255)
                L[y, x, 3] = 255
            if len(span) >= 2 and 0 <= xei < self.W:
                L = layers_for(y, xei)
                if arm_mask[y, xei] or not self.op[y, xei]:
                    L[y, xei] = outline

    def fill_under(self, arm_mask, edge_keys, side, rows, layers_for, body_ok, tex=5, outline_on=True, dark=(0.74, 0.86, 0.94)):
        """Repaint body cloth hidden by an arm. side=-1: hidden strip runs from the
        back edge (left) to the visible body on the right; side=+1: front edge on the right.
        Texture is mirrored from the visible cloth of the same row (keeps folds and
        light), darkened toward the smooth silhouette edge, which gets a dark outline."""
        F = self.F
        edge = self.edge_fn(edge_keys)
        outline = self.outline_color()
        for y in range(rows[0], rows[1] + 1):
            xe = edge(y)
            xei = int(math.floor(xe + 0.5))
            xs = range(xei, self.W) if side < 0 else range(xei, -1, -1)
            # first visible body pixel past the arm
            xv = None
            for x in xs:
                if body_ok[y, x] and not arm_mask[y, x]:
                    xv = x
                    break
            if xv is None:
                continue
            hidden = [x for x in (range(xei, xv) if side < 0 else range(xv + 1, xei + 1)) if 0 <= x < self.W]
            for x in hidden:
                L = layers_for(y, x)
                if L[y, x, 3]:
                    continue
                d = abs(x - xv)
                # ping-pong mirror inside the first `tex` px of visible cloth (no lapels/shirt)
                d = ((d - 1) % (2 * tex))
                d = (d if d < tex else 2 * tex - 1 - d) + 1
                src = None
                for dd in range(d, 0, -1):
                    sx = xv + (dd - 1) * (1 if side < 0 else -1)
                    if 0 <= sx < self.W and body_ok[y, sx] and not arm_mask[y, sx]:
                        src = F[y, sx].copy()
                        break
                if src is None:
                    src = F[y, xv].copy()
                de = abs(x - xe)
                k = dark[0] if de < 1.5 else dark[1] if de < 2.5 else dark[2] if de < 3.5 else 1.0
                src[:3] = np.clip(src[:3] * k, 0, 255)
                src[3] = 255
                L[y, x] = src
            if outline_on and len(hidden) >= 2 and 0 <= xei < self.W:
                L = layers_for(y, xei)
                if arm_mask[y, xei] or not self.op[y, xei]:
                    L[y, xei] = outline

    def fill_holes(self, arm_mask, layers_for, body_ok, tex=4, rows=None):
        """Repaint body hidden by an arm that lies INSIDE the silhouette (body on both
        sides, e.g. a sleeve over a cape or robe): each half of the hole mirrors the
        real cloth next to it, so folds and light continue under the arm."""
        F = self.F
        y0, y1 = rows or (0, self.H - 1)
        for y in range(y0, y1 + 1):
            vis = body_ok[y] & ~arm_mask[y]
            xs = np.nonzero(vis)[0]
            if len(xs) < 2:
                continue
            x = xs[0]
            while x <= xs[-1]:
                if arm_mask[y, x] and not vis[x]:
                    a = x
                    while x <= xs[-1] and arm_mask[y, x] and not vis[x]:
                        x += 1
                    b = x - 1
                    if a - 1 < 0 or not vis[a - 1] or b + 1 >= self.W or not vis[b + 1]:
                        continue
                    for hx in range(a, b + 1):
                        L = layers_for(y, hx)
                        if L[y, hx, 3]:
                            continue
                        if hx - a <= b - hx:
                            d = hx - a
                            d = (d % (2 * tex)); d = d if d < tex else 2 * tex - 1 - d
                            sx = a - 1 - d
                            while sx < a - 1 and not vis[sx]:
                                sx += 1
                        else:
                            d = b - hx
                            d = (d % (2 * tex)); d = d if d < tex else 2 * tex - 1 - d
                            sx = b + 1 + d
                            while sx > b + 1 and not vis[sx]:
                                sx -= 1
                        px = F[y, sx].copy(); px[3] = 255
                        L[y, hx] = px
                else:
                    x += 1

    def outline_color(self):
        F, op = self.F, self.op
        px = []
        for y in range(self.H):
            row = np.nonzero(op[y])[0]
            if len(row):
                px.append(F[y, row[0]])
                px.append(F[y, row[-1]])
        px.sort(key=lum)
        c = px[len(px) // 10].copy() if px else np.array([20, 16, 14, 255])
        c[3] = 255
        return c

    # ---------------------------------------------------------------- build
    def build(self):
        c = self.cfg
        F = self.F
        sh = (self.H, self.W)
        owner = self.own()
        M = self.M
        parts = self.parts
        body_ok = M['torso'] | M['skirt']
        # cloth parts cut out of the body (the pelvis/seat) still count as visible cloth
        # to mirror from when repainting what an arm covered
        for name_, p_ in c.get('extraParts', {}).items():
            if 'torso' in p_.get('borrow', []) and name_ in M:
                body_ok = body_ok | M[name_]
        torso = self.layer(M['torso'])
        skirt = self.layer(M['skirt'])
        waist = c['waist']

        def layers_for(y, x):
            return skirt if (c.get('skirt', True) and y >= waist) else torso
        # neck under the chin: the torso carries the head's lowest rows (hidden at rest)
        nk = c.get('neckUnder', 4)
        ys = np.nonzero(M['head'].any(1))[0]
        if len(ys):
            hb = ys.max()
            band = M['head'].copy()
            band[:hb - nk] = False
            if c.get('neckX'):
                band[:, :c['neckX'][0]] = False
                band[:, c['neckX'][1]:] = False
            torso[band] = F[band]
        na = c['nArm']
        if na.get('back'):
            rows_ = na.get('fillRows', (na['back'][0][0], na['back'][-1][0]))
            if na.get('flat'):
                self.fill_flat(M['nArm'], na['back'], -1, rows_, layers_for, body_ok, na.get('tex', 4))
            else:
                self.fill_under(M['nArm'], na['back'], -1, rows_, layers_for, body_ok, na.get('tex', 5))
            # smooth silhouette: clip body pixels beyond the edge on the arm rows
            edge = self.edge_fn(na['back'])
            for y in range(na['back'][0][0], na['back'][-1][0] + 1):
                xi = int(math.floor(edge(y) + 0.5))
                for L in (torso, skirt):
                    L[y, :max(0, xi)] = 0
        if na.get('holes'):
            ys_ = np.nonzero(M['nArm'].any(1))[0]
            self.fill_holes(M['nArm'], layers_for, body_ok, na.get('tex', 4), (ys_.min(), ys_.max()) if len(ys_) else None)
        fa = c.get('fArm') or {}
        if fa.get('holes'):
            ys_ = np.nonzero(M['fArm'].any(1))[0]
            self.fill_holes(M['fArm'], layers_for, body_ok, fa.get('tex', 4), (ys_.min(), ys_.max()) if len(ys_) else None)
        if fa.get('front'):
            self.fill_under(M['fArm'], fa['front'], 1, fa.get('fillRows', (fa['front'][0][0], fa['front'][-1][0])), layers_for, body_ok, fa.get('tex', 4), fa.get('outline', False), fa.get('dark', (0.9, 0.95, 1.0)))
            edge = self.edge_fn(fa['front'])
            for y in range(fa['front'][0][0], fa['front'][-1][0] + 1):
                xi = int(math.floor(edge(y) + 0.5))
                for L in (torso, skirt):
                    L[y, xi + 1:] = 0
        # overlap so the skirt's top tucks under the torso without a seam
        if c.get('skirt', True):
            add = dilate(skirt[..., 3] > 0, 2) & (torso[..., 3] > 0)
            sk2 = skirt.copy()
            sk2[add & (skirt[..., 3] == 0)] = torso[add & (skirt[..., 3] == 0)]
            torso_add = dilate(torso[..., 3] > 0, 2) & M['skirt']
            torso[torso_add & (torso[..., 3] == 0)] = F[torso_add & (torso[..., 3] == 0)]
            parts['skirt'] = sk2
        parts['torso'] = torso
        parts['head'] = self.layer(M['head'])
        for name, p in c.get('extraParts', {}).items():
            L = self.layer(M[name])
            if p.get('round'):
                cx, cy, r = p['round']
                L[~disk(sh, (cx, cy), r)] = 0
            for src_name in p.get('borrow', []):
                # tuck under neighbours: carry their pixels within 2px (hidden at rest)
                add = dilate(L[..., 3] > 0, 2) & M[src_name] & (L[..., 3] == 0)
                L[add] = F[add]
            parts[name] = L
        # ---- arms
        J = {}
        for s in ('n', 'f'):
            a = c.get(s + 'Arm')
            if s == 'f' and (not a or a.get('copyNear')):
                continue
            mask = M[s + 'Arm']
            L = self.layer(mask)
            if s == 'f' and a.get('upperFromNear'):
                # the painted far upper arm is hidden behind the chest: only the forearm and
                # hand are painted. Upper = the near sleeve, shaded, tucked behind the torso.
                k = a.get('upperShade', 0.8)
                fu = shade(parts['nUpper'], k, (0, 1, 4))
                na_ = c['nArm']
                r = a.get('upperR', 4.5)
                keep = capsule(sh, (na_['shoulder'][0], na_['shoulder'][1] + r * 0.6), na_['elbow'], r)
                fu[~keep] = 0
                parts['fUpper'] = fu
                fore = L.copy()
                kk = a.get('shade', 1.0)
                parts['fFore'] = shade(fore, kk) if kk != 1 else fore
                na_ = c['nArm']
                J['fShoulder'] = list(a['shoulder'])
                J['fElbow'] = [a['shoulder'][0] + na_['elbow'][0] - na_['shoulder'][0], a['shoulder'][1] + na_['elbow'][1] - na_['shoulder'][1]]
                self.extra['fFore'] = {'hand': list(a['hand']), 'wrist': list(a.get('wrist', a['hand']))}
                continue
            sp = a['split']  # two points: elbow cut line; upper is on the shoulder side
            sgn = 1 if side_of(a['shoulder'], sp[0], sp[1]) > 0 else -1
            yy, xx = np.mgrid[0:sh[0], 0:sh[1]]
            sd = ((sp[1][0] - sp[0][0]) * (yy + .5 - sp[0][1]) - (sp[1][1] - sp[0][1]) * (xx + .5 - sp[0][0])) * sgn
            upper = L.copy(); upper[sd < 0] = 0
            fore = L.copy(); fore[sd >= 0] = 0
            # elbow caps: each side carries a rounded bit of the other so bending never gaps
            cap = disk(sh, a['elbow'], a.get('cap', 4.2)) & mask
            upper[cap & (upper[..., 3] == 0)] = F[cap & (upper[..., 3] == 0)]
            fcap = disk(sh, a['elbow'], a.get('cap', 4.2) + 0.8) & mask
            fore[fcap & (fore[..., 3] == 0)] = F[fcap & (fore[..., 3] == 0)]
            k = a.get('shade', 1.0)
            parts[s + 'Upper'] = shade(upper, k) if k != 1 else upper
            parts[s + 'Fore'] = shade(fore, k) if k != 1 else fore
            J[s + 'Shoulder'] = list(a['shoulder']); J[s + 'Elbow'] = list(a['elbow'])
            self.extra[s + 'Fore'] = {'hand': list(a['hand']), 'wrist': list(a.get('wrist', a['hand']))}
            if a.get('open'):
                o = fore.copy()
                o[poly_mask(sh, a['open'])] = 0
                parts[s + 'ForeOpen'] = shade(o, k) if k != 1 else o
                self.extra[s + 'ForeOpen'] = self.extra[s + 'Fore']
        fa = c.get('fArm')
        if not fa or fa.get('copyNear'):
            k = (fa or {}).get('shade', 0.74)
            parts['fUpper'] = shade(parts['nUpper'], k, (0, 2, 6))
            parts['fFore'] = shade(parts['nFore'], k, (0, 2, 6))
            na = c['nArm']
            off = (fa or {}).get('offset', (0, 0))
            J['fShoulder'] = [na['shoulder'][0] + off[0], na['shoulder'][1] + off[1]]
            J['fElbow'] = [na['elbow'][0] + off[0], na['elbow'][1] + off[1]]
            self.fArmArt = (na['shoulder'], na['elbow'])
            self.extra['fFore'] = self.extra['nFore']
        # ---- legs from one painted leg
        lg = c['leg']
        art = np.zeros(sh, bool)
        for p in lg['polys']:
            art |= poly_mask(sh, p)
        art &= self.op
        if lg.get('despeckle'):
            # rough spot in the source: pale grey motion flecks around the boots read as
            # noise once the leg moves on its own. Drop pale, unsaturated pixels.
            Fi = F[..., :3].astype(int)
            pale = (Fi.min(-1) > lg.get('paleMin', 120)) & ((Fi.max(-1) - Fi.min(-1)) < 40)
            art &= ~pale
            # and isolated specks (fewer than 3 opaque 8-neighbours)
            a8 = art.astype(int)
            nb = sum(np.roll(np.roll(a8, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - a8
            art &= nb >= 3
        LA = self.layer(art)
        hip, knee, ankle = lg['hip'], lg['knee'], lg['ankle']
        shin_m = capsule(sh, (knee[0], knee[1] - 1), (ankle[0], ankle[1] + 1), lg['shinR'])
        foot_m = poly_mask(sh, lg['footPoly']) | (disk(sh, ankle, lg.get('ankleR', 4.2)))
        shin = LA.copy(); shin[~shin_m] = 0
        foot = LA.copy(); foot[~foot_m] = 0
        thigh = np.zeros_like(F)
        if lg.get('thighFromShin'):
            # thigh hidden under the coat at rest: paint it from the trouser of the shin,
            # translated so its knee end meets the knee (same cloth, same width)
            dx, dy = knee[0] - hip[0], knee[1] - hip[1]
            tr = LA.copy()
            tf = lg.get('thighFrac', 0.75)
            tr[~capsule(sh, knee, (knee[0] + (ankle[0] - knee[0]) * tf, knee[1] + (ankle[1] - knee[1]) * tf), lg['thighR'])] = 0
            # rotate trouser segment from the shin axis to the thigh axis around the knee
            a_sh = math.atan2(ankle[1] - knee[1], ankle[0] - knee[0])
            a_th = math.atan2(knee[1] - hip[1], knee[0] - hip[0])
            ys_, xs_ = np.nonzero(tr[..., 3])
            Lseg = math.hypot(dx, dy)
            for y in range(sh[0]):
                for x in range(sh[1]):
                    px, py = x + .5 - hip[0], y + .5 - hip[1]
                    # coordinates along / across the thigh axis
                    u = (px * math.cos(a_th) + py * math.sin(a_th))
                    v = (-px * math.sin(a_th) + py * math.cos(a_th))
                    if u < -2 or u > Lseg + 2 or abs(v) > lg['thighR']:
                        continue
                    # map to the shin trouser: same v, u measured from the knee down the shin
                    uu = (u / Lseg) * (tf * math.hypot(ankle[0] - knee[0], ankle[1] - knee[1]))
                    sx = knee[0] + uu * math.cos(a_sh) - v * math.sin(a_sh)
                    sy = knee[1] + uu * math.sin(a_sh) + v * math.cos(a_sh)
                    ix, iy = int(sx), int(sy)
                    if 0 <= ix < sh[1] and 0 <= iy < sh[0] and tr[iy, ix, 3]:
                        thigh[y, x] = tr[iy, ix]
        else:
            thigh = LA.copy(); thigh[~capsule(sh, (hip[0], hip[1] - 2), knee, lg['thighR'])] = 0
        if lg.get('cleanCloth'):
            # rough spot: the trouser cloth carries blotchy source noise. Repaint it as
            # smooth cloth: luminance blurred inside the part (keeping a little of the
            # painted folds), mapped back through the part's own colour ramp.
            y_max = lg['cleanCloth']
            thigh = clean_cloth(thigh)
            shin = clean_cloth(shin, y_max)
        fk = lg.get('farShade', 0.8)
        for s, k in (('n', 1.0), ('f', fk)):
            parts[s + 'Thigh'] = shade(thigh, k) if k != 1 else thigh
            parts[s + 'Shin'] = shade(shin, k) if k != 1 else shin
            parts[s + 'Foot'] = shade(foot, k) if k != 1 else foot
        # ---- props / extra drop-ins handled by caller
        self.J = J
        return parts

    @staticmethod
    def drop_crumbs(L, min_px=5):
        """Remove tiny disconnected crumbs (< min_px, 8-connected) from a part: stray source
        flecks that would float free of the body once the part moves."""
        a = L[..., 3] > 0
        H, W = a.shape
        seen = np.zeros_like(a)
        for y0, x0 in zip(*np.nonzero(a)):
            if seen[y0, x0]:
                continue
            comp, st = [], [(y0, x0)]
            seen[y0, x0] = True
            while st:
                y, x = st.pop()
                comp.append((y, x))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < H and 0 <= xx < W and a[yy, xx] and not seen[yy, xx]:
                            seen[yy, xx] = True
                            st.append((yy, xx))
            if len(comp) < min_px:
                for y, x in comp:
                    L[y, x] = 0

    def write(self, out_dir, name):
        c = self.cfg
        if c.get('crumbs', True):
            for L in self.parts.values():
                self.drop_crumbs(L)
        lg = c['leg']
        J = dict(self.J)
        J['pelvis'] = list(c['pelvis'])
        J['neck'] = list(c['neck'])
        if c.get('skirt', True):
            J['skirt'] = list(c.get('skirtPivot', (c['pelvis'][0], c['waist'])))
        pivots = {
            'head': J['neck'], 'torso': J['pelvis'], 'skirt': J.get('skirt'),
            'nUpper': c['nArm']['shoulder'], 'nFore': c['nArm']['elbow'], 'nForeOpen': c['nArm']['elbow'],
            'nThigh': lg['hip'], 'nShin': lg['knee'], 'nFoot': lg['ankle'],
            'fThigh': lg['hip'], 'fShin': lg['knee'], 'fFoot': lg['ankle'],
        }
        fa = c.get('fArm')
        if fa and fa.get('upperFromNear'):
            pivots.update({'fUpper': c['nArm']['shoulder'], 'fFore': fa['elbow']})
        elif fa and not fa.get('copyNear'):
            pivots.update({'fUpper': fa['shoulder'], 'fFore': fa['elbow'], 'fForeOpen': fa['elbow']})
        else:
            pivots.update({'fUpper': c['nArm']['shoulder'], 'fFore': c['nArm']['elbow']})
        for n, p in c.get('extraParts', {}).items():
            pivots[n] = p['pivot']
            J[n] = list(p['pivot'])
        for n, p in self.cfg.get('paintedParts', {}).items():
            pivots[n] = p['pivot']
        # skeleton
        T = math.hypot(lg['knee'][0] - lg['hip'][0], lg['knee'][1] - lg['hip'][1])
        S = math.hypot(lg['ankle'][0] - lg['knee'][0], lg['ankle'][1] - lg['knee'][1])
        na = c['nArm']
        fa_s, fa_e = (fa['shoulder'], fa['elbow']) if fa and not fa.get('copyNear') else (na['shoulder'], na['elbow'])
        fa_h = fa['hand'] if fa and not fa.get('copyNear') else na['hand']
        ua = math.hypot(na['elbow'][0] - na['shoulder'][0], na['elbow'][1] - na['shoulder'][1])
        fo = math.hypot(na['hand'][0] - na['elbow'][0], na['hand'][1] - na['elbow'][1])
        phi = {
            'thigh': 0 if lg.get('thighFromShin') else ang_down(lg['hip'], lg['knee']),
            'shin': ang_down(lg['knee'], lg['ankle']),
            'foot': math.degrees(math.atan2(lg['toe'][1] - lg['heel'][1], lg['toe'][0] - lg['heel'][0])) - lg.get('soleTilt', 0),
            'nUp': ang_down(na['shoulder'], na['elbow']), 'nFo': ang_down(na['elbow'], na['hand']),
            'fUp': ang_down(fa_s, fa_e), 'fFo': ang_down(fa_e, fa_h),
        }
        if lg.get('thighFromShin'):
            phi['thigh'] = ang_down(lg['hip'], lg['knee'])
        armRest = {'nUp': phi['nUp'], 'nFo': phi['nFo'] - phi['nUp'], 'fUp': phi['fUp'], 'fFo': phi['fFo'] - phi['fUp']}
        if fa and fa.get('upperFromNear'):
            phi['fUp'] = phi['nUp']           # the far upper art IS the near sleeve
            armRest['fUp'] = ang_down(fa['shoulder'], fa['elbow'])
            armRest['fFo'] = phi['fFo'] - armRest['fUp']
        skel = {
            'ground': c['ground'], 'thigh': round(T, 2), 'shin': round(S, 2),
            'hipN': list(c['hipN']), 'hipF': list(c['hipF']), 'restN': list(c['restN']), 'restF': list(c['restF']),
            'ankleArt': list(lg['ankle']), 'heelArt': list(lg['heel']), 'toeArt': list(lg['toe']),
            'hipArt': list(lg['hip']), 'kneeArt': list(lg['knee']),
            'upperArm': round(ua, 2), 'forearm': round(fo, 2),
            'nShoulder': list(J['nShoulder']), 'fShoulder': list(J['fShoulder']),
            'farArmRest': c.get('farArmRest', 0), 'phi': {k: round(v, 2) for k, v in phi.items()},
            # idle arms hang exactly as painted; actions add to this
            'armRest': c.get('armRest', {k: round(v, 2) for k, v in armRest.items()}),
        }
        # atlas
        parts = self.parts
        crops = {}
        for n, L in list(parts.items()):
            ys, xs = np.nonzero(L[..., 3])
            if not len(xs):
                del parts[n]
                continue
            crops[n] = (max(0, xs.min() - 1), max(0, ys.min() - 1), min(self.W - 1, xs.max() + 1), min(self.H - 1, ys.max() + 1))
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
        meta = {'name': name, 'scale': UP, 'cell': [self.W, self.H], 'ground': c['ground'], 'joints': J, 'skel': skel,
                'draw': c.get('draw', {}), 'parts': {}}
        if c.get('order'):
            meta['order'] = c['order']
        for n in parts:
            x0, y0, x1, y1 = crops[n]
            im = Image.fromarray(parts[n][y0:y1 + 1, x0:x1 + 1].astype(np.uint8), 'RGBA')
            im = im.resize((im.width * UP, im.height * UP), Image.NEAREST)
            ax, ay, w, h = place[n]
            atlas.paste(im, (ax, ay))
            meta['parts'][n] = {'x': int(ax), 'y': int(ay), 'w': int(w), 'h': int(h), 'ox': int(x0), 'oy': int(y0),
                                'pivot': [float(v) for v in pivots[n]], **self.extra.get(n, {})}
            if n in c.get('flex', {}):
                meta['parts'][n]['flex'] = c['flex'][n]
        atlas.save(os.path.join(out_dir, name + '-rig.png'), optimize=True)
        with open(os.path.join(out_dir, name + '-rig.json'), 'w') as f:
            json.dump(meta, f, indent=1)
        return meta

    def debug(self, out):
        pal = {'head': (255, 80, 80), 'torso': (80, 200, 80), 'nArm': (80, 80, 255), 'fArm': (255, 0, 255),
               'drop': (0, 0, 0), 'skirt': (0, 140, 140)}
        dbg = np.zeros((self.H, self.W, 4), np.uint8)
        for y in range(self.H):
            for x in range(self.W):
                o = self.owner[y, x]
                if o:
                    dbg[y, x, :3] = pal.get(o, (230, 160, 0)); dbg[y, x, 3] = 255
        src = Image.fromarray(self.F.astype(np.uint8))
        ov = Image.fromarray(dbg)
        bg = Image.new('RGBA', src.size, (200, 220, 200, 255)); bg.alpha_composite(src)
        mix = Image.blend(bg, Image.alpha_composite(bg.copy(), ov), 0.45)
        Z = 5
        sheet = Image.new('RGBA', (self.W * Z * 2 + 10, self.H * Z), (255, 255, 255, 255))
        sheet.paste(bg.resize((self.W * Z, self.H * Z), Image.NEAREST), (0, 0))
        sheet.paste(mix.resize((self.W * Z, self.H * Z), Image.NEAREST), (self.W * Z + 10, 0))
        d = ImageDraw.Draw(sheet)
        c = self.cfg
        def dot(p, col):
            for ox in (0, self.W * Z + 10):
                x, y = ox + p[0] * Z, p[1] * Z
                d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=col)
        for p in [c['nArm']['shoulder'], c['nArm']['elbow'], c['nArm']['hand']]:
            dot(p, (0, 0, 255))
        if c.get('fArm') and c['fArm'].get('shoulder'):
            for p in [c['fArm']['shoulder'], c['fArm']['elbow'], c['fArm']['hand']]:
                dot(p, (255, 0, 255))
        lg = c['leg']
        for p in [lg['hip'], lg['knee'], lg['ankle']]:
            dot(p, (0, 160, 0))
        for p in [lg['heel'], lg['toe']]:
            dot(p, (255, 255, 0))
        for p in [c['pelvis'], c['neck'], c['hipN'], c['hipF'], c['restN'], c['restF']]:
            dot(p, (255, 0, 0))
        for i in range(0, self.H, 10):
            d.line([(0, i * Z), (8, i * Z)], fill=(255, 0, 0))
            d.text((10, i * Z - 5), str(i), fill=(200, 0, 0))
        for i in range(0, self.W, 10):
            d.line([(i * Z, 0), (i * Z, 8)], fill=(255, 0, 0))
            d.text((i * Z - 4, 10), str(i), fill=(200, 0, 0))
        sheet.save(out)


def clean_cloth(L, y_max=None, keep=0.3):
    import numpy as _np
    L = L.copy()
    m = L[..., 3] > 0
    inner = m.copy()
    inner[1:, :] &= m[:-1, :]; inner[:-1, :] &= m[1:, :]; inner[:, 1:] &= m[:, :-1]; inner[:, :-1] &= m[:, 1:]
    if y_max is not None:
        inner[int(y_max):, :] = False
    rgb = L[..., :3].astype(float)
    lum = 0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]
    if inner.sum() < 8:
        return L
    # the part's own cloth ramp: median colour of each luminance quintile
    vals = lum[inner]
    order = _np.argsort(vals)
    cols = rgb[inner][order]
    n = len(cols)
    ramp = _np.stack([_np.median(cols[int(n * q0):max(int(n * q0) + 1, int(n * q1))], axis=0)
                      for q0, q1 in ((0, .15), (.15, .4), (.4, .6), (.6, .85), (.85, 1.0))])
    lo, hi = _np.percentile(vals, 4), _np.percentile(vals, 96)
    s = _np.where(m, lum, 0.0)
    w = m.astype(float)
    for _ in range(3):
        ps, pw = _np.pad(s, 1), _np.pad(w, 1)
        s2 = sum(ps[1 + dy:ps.shape[0] - 1 + dy, 1 + dx:ps.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        w2 = sum(pw[1 + dy:pw.shape[0] - 1 + dy, 1 + dx:pw.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        s = _np.where(m, s2 / _np.maximum(w2, 1), 0.0)
        w = m.astype(float)
    t = keep * lum + (1 - keep) * s
    v = _np.clip((t - lo) / max(1.0, hi - lo), 0, 1) * 4
    i = _np.minimum(_np.floor(v).astype(int), 3)
    f = (v - i)[..., None]
    new = ramp[i] * (1 - f) + ramp[i + 1] * f
    L[..., :3][inner] = _np.clip(_np.round(new[inner]), 0, 255).astype(L.dtype)
    # ragged edge: drop 1px spurs, then give the silhouette one clean dark outline
    rows = _np.ones(m.shape, bool) if y_max is None else (_np.arange(m.shape[0])[:, None] < int(y_max))
    for _ in range(2):
        a8 = (L[..., 3] > 0).astype(int)
        nb = sum(_np.roll(_np.roll(a8, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - a8
        spur = (a8 > 0) & (nb < 3) & rows
        L[spur] = 0
    m2 = L[..., 3] > 0
    in2 = m2.copy()
    in2[:, 1:] &= m2[:, :-1]; in2[:, :-1] &= m2[:, 1:]     # sides only: the knee/hip ends tuck under other parts
    edge = m2 & ~in2 & rows
    L[..., :3][edge] = _np.clip(ramp[0] * 0.9, 0, 255).astype(L.dtype)
    return L
