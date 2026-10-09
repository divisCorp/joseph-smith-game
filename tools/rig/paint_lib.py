"""
Small painting kit for the animal parts, written to match the painted cast:
1 model px = 0.875 game px, rounded form lighting from the upper front, warm ramps,
painted fur/feather/scale texture, and a 1px darkened-local-colour outline (dark on
dark fur, softer on pale fur), like the cast's sprites.
No scipy: distance fields by repeated 3x3 erosion (parts are small).
"""
import math, random
import numpy as np
from PIL import Image, ImageDraw

SS = 4  # supersampling for shape masks


def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def ramp_fn(cols):
    C = [hexc(c) if isinstance(c, str) else np.array(c, float) for c in cols]

    def f(v):
        v = np.clip(v, 0, 1) * (len(C) - 1)
        i = np.minimum(np.floor(v).astype(int), len(C) - 2)
        t = (v - i)[..., None]
        A = np.stack([C[k] for k in range(len(C))])
        return A[i] * (1 - t) + A[i + 1] * t
    return f


F = [1.0]   # per-animal authoring scale (set by the painter): shapes are drawn at F× their design size


def setF(f):
    F[0] = f


def G(m):
    """Pixel-centre grid in design units (so marks scale with F)."""
    h, w = m.shape
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    return (ys + 0.5) / F[0] - 0.5, (xs + 0.5) / F[0] - 0.5


class Canvas:
    """One part: shapes → mask → lit, textured, outlined RGBA (model px)."""

    def __init__(self, w, h):
        w, h = int(math.ceil(w * F[0])), int(math.ceil(h * F[0]))
        self.w, self.h = w, h
        self.big = Image.new('L', (w * SS, h * SS), 0)
        self.d = ImageDraw.Draw(self.big)

    def _p(self, pts):
        f = F[0] * SS
        return [(x * f, y * f) for x, y in pts]

    def ell(self, cx, cy, rx, ry, rot=0, fill=255):
        n = 40
        pts = []
        c, s = math.cos(rot), math.sin(rot)
        for i in range(n):
            a = 2 * math.pi * i / n
            x, y = rx * math.cos(a), ry * math.sin(a)
            pts.append((cx + x * c - y * s, cy + x * s + y * c))
        self.d.polygon(self._p(pts), fill=fill)
        return self

    def poly(self, pts, fill=255):
        self.d.polygon(self._p(pts), fill=fill)
        return self

    def cap(self, x0, y0, x1, y1, r0, r1, fill=255):
        # tapered capsule
        n = 18
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1
        ux, uy = dx / L, dy / L
        px, py = -uy, ux
        pts = [(x0 + px * r0, y0 + py * r0), (x1 + px * r1, y1 + py * r1)]
        a0 = math.atan2(py, px)
        for i in range(n + 1):
            a = a0 - math.pi * i / n
            pts.append((x1 + math.cos(a) * r1, y1 + math.sin(a) * r1))
        pts.append((x0 - px * r0, y0 - py * r0))
        for i in range(n + 1):
            a = a0 + math.pi - math.pi * i / n
            pts.append((x0 + math.cos(a) * r0, y0 + math.sin(a) * r0))
        self.d.polygon(self._p(pts), fill=fill)
        return self

    def mask(self):
        a = np.array(self.big.resize((self.w, self.h), Image.BOX)).astype(float) / 255
        return a >= 0.5


def shapes_mask(w, h, fn):
    c = Canvas(w, h)
    fn(c)
    return c.mask()


def erode(m):
    o = m.copy()
    o[1:, :] &= m[:-1, :]
    o[:-1, :] &= m[1:, :]
    o[:, 1:] &= m[:, :-1]
    o[:, :-1] &= m[:, 1:]
    return o


def dist_in(m, cap=40):
    d = np.zeros(m.shape, float)
    cur = m.copy()
    k = 0
    while cur.any() and k < cap:
        d += cur
        cur = erode(cur)
        k += 1
    return d


def blur(a, n=1):
    for _ in range(n):
        p = np.pad(a, 1, mode='edge')
        a = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] + 2 * p[1:-1, 1:-1]) / 6
    return a


def value_noise(w, h, cell, rng):
    gw, gh = w // cell + 3, h // cell + 3
    g = rng.random((gh, gw))
    ys, xs = np.mgrid[0:h, 0:w] / cell
    x0, y0 = np.floor(xs).astype(int), np.floor(ys).astype(int)
    tx, ty = xs - x0, ys - y0
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a, b = g[y0, x0], g[y0, x0 + 1]
    c, d = g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


LIGHT = np.array([0.42, -0.72, 0.55])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def shade_field(m, R=None, light=LIGHT, flat=0.0):
    """Lambert shading of a rounded form built from the mask's inside distance."""
    d = dist_in(m)
    if R is None:
        R = max(2.0, np.percentile(d[m], 92) if m.any() else 2)
    t = np.clip(d / R, 0, 1)
    hgt = np.sqrt(1 - (1 - t) ** 2) * R
    hgt = blur(hgt, 2)
    gy, gx = np.gradient(hgt)
    n = np.stack([-gx, -gy, np.ones_like(hgt) * (0.9 + flat * 3)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    lam = np.clip((n * light).sum(-1), 0, 1)
    v = 0.12 + 0.88 * lam
    return v


def fur_strokes(v, m, rng, n, ang, jitter=0.5, length=(2, 3), amt=0.12, flow=None):
    """Short painted strokes along the fur flow: alternating lighter/darker."""
    h, w = m.shape
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        return v
    v = v.copy()
    for _ in range(n):
        i = rng.integers(len(xs))
        x, y = float(xs[i]), float(ys[i])
        a = (flow(x, y) if flow else ang) + rng.normal(0, jitter)
        L = rng.integers(length[0], length[1] + 1)
        dv = amt * (1 if rng.random() < 0.45 else -1) * (0.6 + 0.4 * rng.random())
        for k in range(L):
            xi, yi = int(round(x + math.cos(a) * k)), int(round(y + math.sin(a) * k))
            if 0 <= xi < w and 0 <= yi < h and m[yi, xi]:
                v[yi, xi] += dv * (1 - k / (L + 1))
    return v


def finish(rgb, m, outline=0.42, warm=(26, 14, 8), out_mix=0.25, inner_dark=None, soft=None):
    """1px outline in darkened local colour (none where `soft`: joint ends that tuck under
    the body, like the cast's cut parts); returns RGBA uint8."""
    h, w = m.shape
    edge = m & ~erode(m)
    if soft is not None:
        edge &= ~soft
    out = rgb.copy()
    dark = rgb * outline * (1 - out_mix) + np.array(warm, float) * out_mix
    out[edge] = dark[edge]
    if inner_dark is not None:
        out[inner_dark & m] = (rgb * 0.6)[inner_dark & m]
    A = np.zeros((h, w, 4), np.uint8)
    A[..., :3] = np.clip(np.round(out), 0, 255).astype(np.uint8)
    A[..., 3] = (m * 255).astype(np.uint8)
    return A


def quant(v, levels=14):
    return np.round(np.clip(v, 0, 1) * levels) / levels


# ---------------------------------------------------------------- hand-painted fur (v2)
PAL_AT = (0.08, 0.28, 0.5, 0.72, 0.92)


def palette(rp, at=PAL_AT):
    """A fixed 5-colour palette sampled once from a ramp (no in-between colours)."""
    return np.stack([np.asarray(rp(np.array(a)), float) for a in at])


def fur_paint(m, base_rp, marks=(), R=None, flow=0.0, seed=0, tuft=3.2, light_bias=0.0, soft=None,
              edge_tufts=True, outline=0.42, out_mix=0.25, warm=(26, 14, 8), planes=(0.30, 0.47, 0.63, 0.80),
              tuft_amt=0.5, crease=True):
    """
    Fur painted the way the cast is painted: the form is cut into a few readable light
    planes (shadow / mid / light / highlight, from the upper front), every colour comes
    from a fixed 5-colour palette, and the planes are broken up by clustered tufts —
    small pointed clumps laid along the fur flow, lit clumps on the lit side and dark
    clumps in the shade, each with a dark crease under its tip — plus a few tuft tips
    breaking the silhouette. `marks` = [(mask, ramp, dv)] become their own palettes
    (dv shifts the plane index). flow = radians or f(y, x) in design units.
    """
    rng = np.random.default_rng(seed)
    h, w = m.shape
    v = shade_field(m, R=R) + light_bias
    v = blur(v, 1)
    idx = np.digitize(v, planes).astype(int)          # 0..4
    pals = [palette(base_rp)]
    mat = np.zeros((h, w), int)
    for mm, rp, dv in marks:
        pals.append(palette(rp))
        k = len(pals) - 1
        mm = mm & m
        mat[mm] = k
        idx[mm] = np.clip(idx[mm] + int(round(dv * 5)), 0, 4)
    f = F[0]
    s = tuft * f * 1.45
    # jittered seeds, drawn upstream → downstream so clumps overlap like laid fur
    seeds = []
    for gy in np.arange(s * 0.5, h, s * 0.8):
        for gx in np.arange(s * 0.5, w, s * 0.8):
            y = int(gy + rng.uniform(-0.4, 0.4) * s)
            x = int(gx + rng.uniform(-0.4, 0.4) * s)
            if 0 <= y < h and 0 <= x < w and m[y, x]:
                seeds.append((y, x))
    def ang_at(y, x):
        return flow((y + .5) / f - .5, (x + .5) / f - .5) if callable(flow) else flow
    seeds.sort(key=lambda p: -(p[1] * math.cos(ang_at(*p)) + p[0] * math.sin(ang_at(*p))))
    idx0, mat0 = idx.copy(), mat.copy()
    for (y, x) in seeds:
        if soft is not None and soft[y, x]:
            continue
        r = rng.random()
        if r > tuft_amt:
            continue
        lit = v[y, x] > 0.56
        delta = 1 if (lit and rng.random() < 0.7) or (not lit and rng.random() < 0.25) else -1
        a = ang_at(y, x) + rng.normal(0, 0.28)
        ca, sa = math.cos(a), math.sin(a)
        L = s * rng.uniform(0.9, 1.35)
        w0 = s * rng.uniform(0.32, 0.48)
        ri, ci = idx0[y, x], mat0[y, x]
        rr = int(L + 2)
        for dy in range(-rr, rr + 1):
            for dx in range(-rr, rr + 1):
                yy, xx = y + dy, x + dx
                if not (0 <= yy < h and 0 <= xx < w) or not m[yy, xx]:
                    continue
                al = dx * ca + dy * sa
                ac = -dx * sa + dy * ca
                if 0 <= al <= L:
                    half = w0 * (1 - al / L) ** 0.8
                    if abs(ac) <= half:
                        idx[yy, xx] = int(np.clip(idx0[yy, xx] + delta, 0, 4)) if mat0[yy, xx] != ci else int(np.clip(ri + delta, 0, 4))
                    elif crease and half < ac <= half + 1.0 and al > L * 0.3 and mat0[yy, xx] == ci:
                        idx[yy, xx] = int(np.clip(ri - 1, 0, 4))      # the shadow under the clump
    # silhouette: a few tuft tips poking out along the flow
    mm = m.copy()
    if edge_tufts:
        edge = m & ~erode(m)
        ys, xs = np.nonzero(edge)
        for i in rng.permutation(len(xs))[: max(1, len(xs) // 5)]:
            y, x = ys[i], xs[i]
            if soft is not None and soft[y, x]:
                continue
            a = ang_at(y, x)
            for step in (1, 2):
                yy, xx = int(round(y + math.sin(a) * step)), int(round(x + math.cos(a) * step))
                if 0 <= yy < h and 0 <= xx < w and not m[yy, xx]:
                    if step == 2 and rng.random() < 0.6:
                        break
                    mm[yy, xx] = True
                    idx[yy, xx] = idx[y, x]
                    mat[yy, xx] = mat[y, x]
    rgb = np.zeros((h, w, 3))
    for k, pal in enumerate(pals):
        sel = mm & (mat == k)
        rgb[sel] = pal[idx[sel]]
    return finish(rgb, mm, outline=outline, warm=warm, out_mix=out_mix, soft=soft), mm
