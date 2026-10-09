"""
Small full-frame painting kit for hand-painted humanoid rig parts (64x128 model
space, the house figure layout). Shapes are supersampled masks; materials are
smooth colour ramps lit from the upper front (screen right), with a little painted
variation; every part gets the cast's 1px outline in darkened local colour.
No image generation: everything is drawn from coordinates written by hand.
"""
import math
import numpy as np
from PIL import Image, ImageDraw

W, H = 64, 128
SS = 8
YY, XX = np.mgrid[0:H, 0:W].astype(float) + 0.5


def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def ramp(cols):
    C = np.stack([hexc(c) if isinstance(c, str) else np.array(c, float) for c in cols])

    def f(v):
        v = np.clip(np.asarray(v, float), 0, 1) * (len(C) - 1)
        i = np.minimum(np.floor(v).astype(int), len(C) - 2)
        t = (v - i)[..., None]
        return C[i] * (1 - t) + C[i + 1] * t
    f.cols = C
    return f


def spline(pts, n=5, closed=True):
    """Catmull-Rom through hand-placed key points (rounder silhouettes)."""
    P = list(pts)
    m = len(P)
    out = []
    rng = range(m) if closed else range(m - 1)
    for i in rng:
        p0 = P[(i - 1) % m] if closed else P[max(0, i - 1)]
        p1, p2 = P[i], P[(i + 1) % m]
        p3 = P[(i + 2) % m] if closed else P[min(m - 1, i + 2)]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    if not closed:
        out.append(P[-1])
    return out


def _canvas():
    im = Image.new('L', (W * SS, H * SS), 0)
    return im, ImageDraw.Draw(im)


def _m(im):
    return np.array(im.resize((W, H), Image.BOX)) >= 128


def poly(pts, smooth=False):
    im, d = _canvas()
    if smooth:
        pts = spline(pts)
    d.polygon([(x * SS, y * SS) for x, y in pts], fill=255)
    return _m(im)


def ell(cx, cy, rx, ry, rot=0.0):
    pts = []
    c, s = math.cos(rot), math.sin(rot)
    for i in range(48):
        a = 2 * math.pi * i / 48
        x, y = rx * math.cos(a), ry * math.sin(a)
        pts.append((cx + x * c - y * s, cy + x * s + y * c))
    return poly(pts)


def cap(x0, y0, x1, y1, r0, r1):
    n = 16
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
    return poly(pts)


def line_mask(pts, width=1, smooth=False):
    """1px painted stroke through key points (pixel-exact at 1x)."""
    if smooth and len(pts) > 2:
        pts = spline(pts, 6, closed=False)
    im = Image.new('L', (W, H), 0)
    ImageDraw.Draw(im).line([(x - 0.5, y - 0.5) for x, y in pts], fill=255, width=width)
    return np.array(im) > 0


def dots(pts):
    m = np.zeros((H, W), bool)
    for x, y in pts:
        xi, yi = int(math.floor(x)), int(math.floor(y))
        if 0 <= xi < W and 0 <= yi < H:
            m[yi, xi] = True
    return m


def erode(m):
    o = m.copy()
    o[1:, :] &= m[:-1, :]
    o[:-1, :] &= m[1:, :]
    o[:, 1:] &= m[:, :-1]
    o[:, :-1] &= m[:, 1:]
    return o


def dilate(m, r=1):
    o = m.copy()
    for _ in range(r):
        n = o.copy()
        n[1:, :] |= o[:-1, :]
        n[:-1, :] |= o[1:, :]
        n[:, 1:] |= o[:, :-1]
        n[:, :-1] |= o[:, 1:]
        o = n
    return o


def dist_in(m, cap_=30):
    d = np.zeros(m.shape, float)
    cur = m.copy()
    k = 0
    while cur.any() and k < cap_:
        d += cur
        cur = erode(cur)
        k += 1
    return d


def blur(a, n=1):
    for _ in range(n):
        p = np.pad(a, 1, mode='edge')
        a = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] + 2 * p[1:-1, 1:-1]) / 6
    return a


def roundness(m, R=None):
    """0 at the silhouette → 1 inside: a rounded form for lighting."""
    d = dist_in(m)
    if R is None:
        R = max(1.5, np.percentile(d[m], 85) if m.any() else 2)
    t = np.clip(d / R, 0, 1)
    return blur(np.sqrt(1 - (1 - t) ** 2), 1)


def vnoise(cell, seed):
    rng = np.random.default_rng(seed)
    gw, gh = int(W / cell) + 3, int(H / cell) + 3
    g = rng.random((gh, gw))
    ys, xs = np.mgrid[0:H, 0:W] / cell
    x0, y0 = np.floor(xs).astype(int), np.floor(ys).astype(int)
    tx, ty = xs - x0, ys - y0
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a, b = g[y0, x0], g[y0, x0 + 1]
    c, d = g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


class Part:
    """An RGBA layer in model space. Paint materials into it, then outline it."""

    def __init__(self):
        self.rgb = np.zeros((H, W, 3), float)
        self.a = np.zeros((H, W), bool)

    def fill(self, m, rp, v):
        v = np.broadcast_to(v, (H, W))
        c = rp(v)
        self.rgb[m] = c[m]
        self.a |= m
        return self

    def solid(self, m, col):
        self.rgb[m] = hexc(col) if isinstance(col, str) else col
        self.a |= m
        return self

    def tone(self, m, k, add=0.0):
        m = m & self.a
        self.rgb[m] = np.clip(self.rgb[m] * k + add, 0, 255)
        return self

    def mix(self, m, col, t):
        m = m & self.a
        c = hexc(col) if isinstance(col, str) else np.array(col, float)
        self.rgb[m] = self.rgb[m] * (1 - t) + c * t
        return self

    def cut(self, m):
        self.a &= ~m
        return self

    def outline(self, k=0.36, soft=None, warm=(10, 6, 4)):
        edge = self.a & ~erode(self.a)
        if soft is not None:
            edge &= ~soft
        self.rgb[edge] = self.rgb[edge] * k + np.array(warm, float) * 0.4
        return self

    def rgba(self):
        o = np.zeros((H, W, 4), np.uint8)
        o[..., :3] = np.clip(np.round(self.rgb), 0, 255).astype(np.uint8)
        o[..., 3] = self.a * 255
        return o


def light(m, base=0.55, kx=0.0, ky=0.0, kf=0.35, cx=32.0, cy=64.0, R=None, noise=0.0, cell=3.0, seed=0):
    """Light value field for a material inside mask m (0..1)."""
    v = base + kf * (roundness(m, R) - 0.6)
    v = v + kx * (XX - cx) / 10.0 + ky * (YY - cy) / 10.0
    if noise:
        v = v + noise * (vnoise(cell, seed) - 0.5)
    return v


def set_size(w, h):
    """Paint on another frame size (e.g. the 80x160 boss cells)."""
    global W, H, YY, XX
    W, H = w, h
    YY, XX = np.mgrid[0:H, 0:W].astype(float) + 0.5
