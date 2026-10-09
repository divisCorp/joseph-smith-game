#!/usr/bin/env python3
"""
Cut the cast's ORIGINAL painted frames into rig parts (same JSON format as Joseph).

Sources are the frames the live v73 game actually shows (tools/rig/src/, exported
from the running game by /workspace/qa/tools/rig_export_src.mjs): the painted foe
sheet, the preacher canvases, Moroni and the boss sheet. No reproportioning: each
config only names regions and joints of an existing frame.

  python3 tools/rig/cut_cast.py [names...] [--debug outdir]
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cast_lib import Cutter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'tools', 'rig', 'src')
OUT = os.path.join(ROOT, 'assets', 'rig')

# ------------------------------------------------------------------ foes (painted sheet, frame 4)
def foe(row, hem):
    return dict(
        src='foesFixed.png', cell=(256, row * 128, 64, 128), ground=126, alphaCut=128,
        head=[(4, 14), (60, 14), (60, 44), (47, 47), (41, 49), (30, 50), (21, 50), (14, 49), (4, 47)],
        neck=(33, 48), pelvis=(32, 80), waist=81,
        nArm=dict(poly=[(13, 51), (24, 50), (26, 58), (26, 70), (25, 78), (23, 82), (22.5, 90), (19, 94), (11, 94), (9, 85), (10, 72), (12, 60)],
                  shoulder=(19, 55), elbow=(18.5, 67), wrist=(19, 80), hand=(18, 86), split=[(9, 67.5), (29, 67.5)],
                  back=[(51, 17), (60, 15.2), (70, 14.2), (80, 13.6), (88, 12.6), (93, 11), (96, 10.5)], fillRows=(51, 96), tex=4),
        fArm=dict(poly=[(46, 58), (50, 59), (54, 64), (56, 70), (61, 73), (62, 84), (56, 89), (49, 85), (47, 77), (46, 68)], tex=3,
                  upperFromNear=True, shoulder=(43.5, 51), elbow=(47.5, 63), wrist=(53, 77), hand=(55, 81)),
        # painted mid-stride legs (front trousers + both legs below the coat) are re-drawn by the rig
        drop=[[(31.5, 82), (64, 82), (64, 128), (2, 128), (2, hem), (31.5, hem)]],
        extraParts={'pelvis': dict(poly=[(31.5, 81), (47, 81), (47, 93), (31.5, 93)], pivot=(32, 80), round=(37.5, 80.5, 9.5), borrow=['torso'])},
        leg=dict(polys=[[(30, 95), (50, 95), (50, 108), (58, 108), (58, 128), (34, 128), (34, 116), (30, 108)]],
                 hip=(34, 84), knee=(36, 101), ankle=(42, 119.5), heel=(40.5, 126), toe=(53, 115),
                 shinR=5.5, thighR=5.5, thighFromShin=True,
                 footPoly=[(36, 112), (58, 108), (58, 128), (35, 128)]),
        hipN=(29, 84), hipF=(35, 84), restN=(28, 0), restF=(37, 0),
        flex={'skirt': 6},
    )

# ------------------------------------------------------------------ 80x160 painted figures
def tall(src, cell, **kw):
    d = dict(src=src, cell=cell, alphaCut=128, flex={'skirt': 8})
    d.update(kw)
    return d

CAST_TALL = {
    'methodist': tall('preacher_methodist.png', (0, 0, 80, 160), ground=150,
        head=[(16, 18), (72, 18), (72, 50), (62, 54), (58, 66), (48, 69), (30, 69), (22, 64), (16, 55)],
        neck=(40, 67), pelvis=(41, 102), waist=101,
        nArm=dict(poly=[(24, 70), (36, 70), (38, 85), (37, 100), (36, 112), (32, 118), (21, 117), (19, 105), (20, 90), (22, 78)],
                  shoulder=(29, 75), elbow=(28.5, 92), wrist=(28.5, 104), hand=(28.5, 110), split=[(17, 92), (40, 92)],
                  back=[(70, 24), (80, 22.5), (90, 21.5), (100, 21), (110, 20.5), (118, 20)], tex=4),
        fArm=dict(poly=[(57, 86), (63, 88), (67, 98), (71, 104), (71, 117), (61, 118), (57, 108), (56, 98)],
                  upperFromNear=True, shoulder=(51, 75), elbow=(56.5, 91), wrist=(63, 104), hand=(64, 110)),
        drop=[[(36, 117), (78, 117), (78, 160), (0, 160), (0, 141), (31, 141), (35, 130)]],
        extraParts={'pelvis': dict(poly=[(33, 101), (58, 101), (58, 117), (33, 117)], pivot=(41, 102), round=(45, 101, 11), borrow=['torso'])},
        leg=dict(polys=[[(44, 117), (56, 117), (56, 138), (68, 138), (68, 154), (44, 154)]],
                 hip=(46, 104), knee=(51, 124), ankle=(54, 145), heel=(48, 152), toe=(65, 151),
                 shinR=6.5, thighR=6.5, thighFromShin=True, despeckle=True, footPoly=[(44, 138), (68, 138), (68, 154), (44, 154)]),
        hipN=(38, 104), hipF=(46, 104), restN=(37, 0), restF=(49, 0)),
    'baptist': tall('preacher_baptist.png', (0, 0, 80, 160), ground=156,
        head=[(14, 18), (72, 18), (72, 52), (60, 56), (48, 59), (36, 57), (26, 52), (19, 44)],
        neck=(45, 57), pelvis=(45, 102), waist=101,
        nArm=dict(poly=[(22, 82), (36, 80), (38, 92), (36, 104), (35, 116), (29, 120), (20, 117), (18, 105), (18, 92)],
                  shoulder=(30, 74), elbow=(27.5, 93), wrist=(27, 105), hand=(27, 110), split=[(15, 93), (40, 93)], holes=True, tex=4),
        fArm=dict(poly=[(58, 82), (66, 82), (72, 86), (80, 87), (80, 106), (70, 107), (64, 100), (58, 95)],
                  upperFromNear=True, shoulder=(51, 70), elbow=(60, 87), wrist=(70, 95), hand=(75, 97)),
        # the long tunic front (gold trim) hangs to y~125 as cloth over the thighs
        drop=[[(30, 125), (50, 125), (52, 119), (78, 119), (78, 160), (20, 160), (22, 146), (27, 131), (30, 128)]],
        extraParts={'pelvis': dict(poly=[(50, 101), (67, 101), (67, 121), (50, 121)], pivot=(45, 102), round=(52, 101, 12), borrow=['torso'])},
        leg=dict(polys=[[(46, 121), (66, 121), (66, 140), (70, 140), (70, 158), (46, 158)]],
                 hip=(50, 106), knee=(55, 127), ankle=(58, 148), heel=(52, 156), toe=(68, 152),
                 shinR=6.5, thighR=6.5, thighFromShin=True, despeckle=True, footPoly=[(46, 140), (70, 140), (70, 158), (46, 158)]),
        hipN=(40, 106), hipF=(50, 106), restN=(38, 0), restF=(52, 0)),
    'captain': tall('bosses.png', (0, 320, 80, 160), ground=158,
        head=[(8, 20), (78, 20), (78, 52), (66, 60), (62, 76), (52, 80), (40, 79), (28, 74), (18, 62), (8, 52)],
        neck=(46, 78), pelvis=(46, 118), waist=117,
        # sleeve only: the plain coat at x 27-33 (left of the buttons) stays body, so the
        # repaint under the arm mirrors plain red cloth instead of the button column
        nArm=dict(poly=[(10, 76), (27, 76), (28, 90), (27.5, 104), (29.5, 112), (29.5, 123), (8, 123), (8, 112), (9, 100), (9, 86)],
                  shoulder=(20, 84), elbow=(20, 98), wrist=(21, 111), hand=(21, 117), split=[(6, 98), (33, 98)],
                  back=[(78, 12.5), (90, 11), (100, 10.5), (110, 11), (117, 11), (124, 10)], fillRows=(78, 124), tex=4, flat=True, holes=True),
        fArm=dict(poly=[(62, 100), (68, 100), (72, 106), (75, 112), (73, 121), (63, 121), (61, 112)],
                  upperFromNear=True, shoulder=(57, 86), elbow=(62, 100), wrist=(66, 110), hand=(67, 114)),
        drop=[[(40, 121), (78, 121), (78, 160), (0, 160), (0, 144), (40, 144)]],
        extraParts={'pelvis': dict(poly=[(38, 117), (64, 117), (64, 130), (38, 130)], pivot=(46, 118), round=(51, 117, 12), borrow=['torso'])},
        leg=dict(polys=[[(42, 121), (61, 121), (61, 144), (68, 144), (68, 160), (42, 160)]],
                 hip=(51, 121), knee=(52, 134), ankle=(54, 149), heel=(47.5, 158), toe=(62, 157),
                 shinR=7, thighR=7, thighFromShin=True, thighFrac=0.5, despeckle=True,
                 footPoly=[(43, 145), (67, 145), (67, 160), (43, 160)]),
        hipN=(42, 121), hipF=(51, 121), restN=(40, 0), restF=(53, 0)),
    'warden': tall('bosses.png', (0, 480, 80, 160), ground=155,
        head=[(16, 14), (70, 14), (72, 64), (66, 74), (54, 78), (40, 79), (26, 78), (16, 70)],
        neck=(44, 77), pelvis=(45, 103), waist=103,
        nArm=dict(poly=[(12, 78), (26, 78), (28, 90), (27, 100), (26, 110), (24, 118), (8, 118), (6, 108), (7, 95), (9, 84)],
                  shoulder=(18, 84), elbow=(17, 97), wrist=(17, 106), hand=(16, 111), split=[(4, 97), (30, 97)],
                  back=[(78, 12), (90, 9), (100, 8), (110, 8), (118, 9)], tex=4),
        fArm=dict(poly=[(59, 86), (66, 86), (69, 95), (71, 103), (70, 112), (66, 116), (63, 114), (62.5, 104), (60, 96)],
                  upperFromNear=True, shoulder=(56, 82), elbow=(61, 94), wrist=(64, 103), hand=(66, 109)),
        drop=[[(10, 124), (74, 124), (74, 160), (10, 160)]],
        leg=dict(polys=[[(46, 120), (64, 120), (64, 142), (70, 142), (70, 158), (44, 158)]],
                 hip=(50, 106), knee=(52, 126), ankle=(54, 146), heel=(47, 156), toe=(66, 152),
                 shinR=6.5, thighR=6.5, thighFromShin=True, despeckle=True, footPoly=[(44, 140), (70, 140), (70, 158), (44, 158)]),
        hipN=(38, 106), hipF=(50, 106), restN=(36, 0), restF=(52, 0)),
    'overseer': tall('bosses.png', (0, 640, 80, 160), ground=156,
        head=[(14, 16), (78, 16), (76, 52), (66, 62), (54, 66), (40, 64), (26, 58), (16, 50)],
        neck=(46, 64), pelvis=(46, 104), waist=103,
        nArm=dict(poly=[(22, 96), (36, 94), (38, 104), (37, 114), (36, 122), (28, 126), (20, 122), (19, 110), (19, 100)],
                  shoulder=(30, 82), elbow=(28, 101), wrist=(28, 112), hand=(28, 117), split=[(15, 101), (41, 101)], holes=True, tex=4),
        fArm=dict(poly=[(66, 92), (72, 92), (76, 95), (80, 96), (80, 110), (72, 110), (68, 104), (66, 98)],
                  upperFromNear=True, shoulder=(56, 78), elbow=(66, 95), wrist=(72, 101), hand=(76, 103)),
        drop=[[(32, 128), (78, 128), (78, 160), (22, 160), (24, 146), (30, 134)]],
        extraParts={'pelvis': dict(poly=[(36, 103), (64, 103), (64, 128), (36, 128)], pivot=(46, 104), round=(50, 103, 13), borrow=['torso'])},
        leg=dict(polys=[[(48, 128), (66, 128), (66, 142), (72, 142), (72, 159), (46, 159)]],
                 hip=(52, 108), knee=(56, 128), ankle=(58, 148), heel=(52, 157), toe=(70, 154),
                 shinR=6.5, thighR=6.5, thighFromShin=True, despeckle=True, footPoly=[(46, 140), (72, 140), (72, 159), (46, 159)]),
        hipN=(42, 108), hipF=(52, 108), restN=(40, 0), restF=(54, 0)),
    'moroni': dict(src='moroni.png', cell=(0, 0, 64, 128), ground=123, alphaCut=128, edgeFlecks=False, flex={'skirt': 10},
        head=[(10, 16), (62, 16), (60, 46), (46, 48), (40, 50), (30, 50), (20, 46), (10, 40)],
        neck=(38, 48), pelvis=(40, 74), waist=72,
        nArm=dict(poly=[(28, 49), (37, 49), (40, 60), (40, 74), (39, 79), (38, 88), (30, 88), (28, 80), (26, 70), (26, 58)],
                  shoulder=(33, 53), elbow=(33, 66), wrist=(34, 79), hand=(34, 83), split=[(24, 66), (42, 66)], holes=True, tex=4),
        fArm=dict(poly=[(50, 50), (58, 50), (62, 58), (63, 70), (62, 84), (54, 86), (52, 76), (50, 64)],
                  shoulder=(53, 53), elbow=(56, 66), wrist=(57, 77), hand=(57, 80), split=[(48, 66), (64, 66)]),
        drop=[[(10, 111), (64, 111), (64, 128), (10, 128)]],
        leg=dict(polys=[[(38, 102), (62, 102), (62, 126), (38, 126)]],
                 hip=(47, 78), knee=(47, 98), ankle=(48, 117), heel=(43, 123), toe=(58, 122),
                 shinR=6.5, thighR=6, thighFromShin=True, footPoly=[(38, 113), (62, 113), (62, 126), (38, 126)]),
        hipN=(37, 78), hipF=(46, 78), restN=(32, 0), restF=(47, 0)),
}

CAST = {
    'brigand': foe(0, 102.5),
    'scout': foe(1, 100.5),
    'thug': foe(2, 98.5),
    **CAST_TALL,
}

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dbg = sys.argv[sys.argv.index('--debug') + 1] if '--debug' in sys.argv else None
    if dbg in args:
        args.remove(dbg)
    names = args or list(CAST)
    os.makedirs(OUT, exist_ok=True)
    for n in names:
        c = Cutter(CAST[n], SRC)
        c.build()
        if dbg:
            os.makedirs(dbg, exist_ok=True)
            c.debug(os.path.join(dbg, f'own-{n}.png'))
        m = c.write(OUT, n)
        print(n, 'parts', len(m['parts']), 'skel thigh/shin', m['skel']['thigh'], m['skel']['shin'])


# ------------------------------------------------------------------ props cut from the same paintings
def cut_warden_mace():
    """The warden's mace, cut from his painted frame 1 (bosses.png row 3). His fist covered
    ~14 rows of the shaft: those rows are painted in by continuing the shaft above."""
    import numpy as np
    from PIL import Image
    im = np.array(Image.open(os.path.join(SRC, 'bosses.png')).convert('RGBA'))
    ox, oy = 130, 530  # crop origin in the sheet (= cell 80,480 + (50,50))
    C = im[oy:oy + 85, ox:ox + 32].copy()
    H, W = C.shape[:2]
    a0, a1 = (18.5, 24.0), (9.5, 81.0)
    out = np.zeros_like(C)
    rgb = C[..., :3].astype(int)
    skin = (rgb[..., 0] > 170) & (rgb[..., 1] > 110) & (rgb[..., 0] > rgb[..., 2] + 40)
    blue = rgb[..., 2] > rgb[..., 0] + 10
    pale = (rgb.min(-1) > 125) & ((rgb.max(-1) - rgb.min(-1)) < 40)
    for y in range(H):
        for x in range(W):
            if C[y, x, 3] < 128:
                continue
            head = 8 <= x <= 28 and 2 <= y <= 25
            t = (y + .5 - a0[1]) / (a1[1] - a0[1])
            cx = a0[0] + (a1[0] - a0[0]) * t
            shaft = 22 <= y <= 82 and abs(x + .5 - cx) <= 3.2
            if (head or shaft) and not skin[y, x] and not blue[y, x] and not (pale[y, x] and not head):
                out[y, x] = C[y, x]
                out[y, x, 3] = 255
    # paint the shaft through the fist (rows 45..61): copy the shaft 13 rows up, shifted 2px
    for y in range(45, 62):
        out[y] = 0
        src = out[y - 13]
        for x in range(W):
            if src[x, 3] and 0 <= x - 2 < W:
                out[y, x - 2] = src[x]
    # drop isolated flecks (motion speckle in the source)
    a8 = (out[..., 3] > 0).astype(int)
    nb = sum(np.roll(np.roll(a8, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - a8
    out[(nb < 3)] = 0
    Image.fromarray(out).save(os.path.join(OUT, 'warden-mace.png'))
    # grip = fist centre in crop coords; head = mace head centre
    meta = {'grip': [15.0, 53.0], 'head': [17.5, 15.0], 'w': W, 'h': H}
    json.dump(meta, open(os.path.join(OUT, 'warden-mace.json'), 'w'))
    return meta


if __name__ == '__main__' and ('warden' in sys.argv[1:] or len([a for a in sys.argv[1:] if not a.startswith('--')]) == 0):
    print('warden mace', cut_warden_mace())
