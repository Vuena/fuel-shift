"""Analyse frames from tools/artefacts.mjs:  python tools/artefacts.py shots/art-<tag>[-phone]
Nudge pairs: B was rendered with the camera 1 px to the right, so B[:, :-1] should equal A[:, 1:] on static surfaces.
Pixels near edges (either image) are ignored (parallax / antialiasing); what is left changing by > 40 (0-255 luma) is
flicker-prone: z-fighting, shadow acne, shadow shimmer. A view FAILS when > 0.05 % of compared pixels or any 32x32 block
> 2 % flag. Clips: the same on consecutive frames with every character / car disc masked. Writes *-heat.png overlays."""
import sys, json, os, glob
import numpy as np
from PIL import Image
D = sys.argv[1].rstrip('/' + chr(92)) + '/'
meta = json.load(open(D + 'meta.json'))
def luma(f): return np.asarray(Image.open(f).convert('RGB'), dtype=np.float32) @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
def edges(L, thr=22, grow=2):
    gx = np.zeros_like(L); gy = np.zeros_like(L); gx[:, 1:-1] = np.abs(L[:, 2:] - L[:, :-2]); gy[1:-1, :] = np.abs(L[2:, :] - L[:-2, :])
    e = (np.maximum(gx, gy) > thr)
    for _ in range(grow):
        e2 = e.copy(); e2[1:, :] |= e[:-1, :]; e2[:-1, :] |= e[1:, :]; e2[:, 1:] |= e[:, :-1]; e2[:, :-1] |= e[:, 1:]; e = e2
    return e
def compare(fa, fb, mask=None, name='', shift=True):
    A, B = luma(fa), luma(fb); a, b = (A[:, 1:], B[:, :-1]) if shift else (A, B)
    ign = edges(a, grow=1) & edges(b, grow=1)  # only edges present in BOTH frames are geometry; stripes that move are flagged
    if mask is not None: ign |= (mask[:, 1:] if shift else mask)
    flag = (np.abs(a - b) > 40) & ~ign
    valid = (~ign).sum(); frac = flag.sum() / max(1, valid)
    h, w = flag.shape; worst = 0; wpos = None
    for y in range(0, h - 31, 32):
        for x in range(0, w - 31, 32):
            v = (~ign[y:y + 32, x:x + 32]).sum()
            if v < 200: continue
            f = flag[y:y + 32, x:x + 32].sum() / v
            if f > worst: worst, wpos = f, (x, y)
    return frac, worst, wpos, flag
def heat(fa, flag, outname):
    im = np.asarray(Image.open(fa).convert('RGB')).copy()[:, 1:]; im[flag] = [255, 0, 255]; Image.fromarray(im).save(outname)
fails = 0
print('coplanar (in-page, after fix):', meta.get('coplanar'))
for v in meta['views']:
    n = v['name']; frac, worst, wpos, flag = compare(D + n + '-a.png', D + n + '-b.png')
    bad = frac > 0.0005 or worst > 0.02; fails += bad
    print(f"{'FAIL' if bad else 'ok  '} camera-nudge {n:18s} flagged {frac*100:.3f}%  worst block {worst*100:.1f}% at {wpos}")
    if bad or n.startswith('close'): heat(D + n + '-a.png', flag, D + n + '-heat.png')
    if os.path.exists(D + n + '-c.png'):
        frac, worst, wpos, flag = compare(D + n + '-a.png', D + n + '-c.png', shift=False)
        bad = frac > 0.0005 or worst > 0.02; fails += bad
        print(f"{'FAIL' if bad else 'ok  '} light-jitter {n:18s} flagged {frac*100:.3f}%  worst block {worst*100:.1f}% at {wpos}")
        if bad: im = np.asarray(Image.open(D + n + '-a.png').convert('RGB')).copy(); im[flag] = [255, 0, 255]; Image.fromarray(im).save(D + n + '-light-heat.png')
clips = {}
for c in meta['clips']: clips.setdefault(c['clip'], []).append(c)
for cn, frames in clips.items():
    frames.sort(key=lambda c: c['i']); worst_frac, worst_blk, worst_i = 0, 0, None
    for k in range(len(frames) - 1):
        f0, f1 = frames[k], frames[k + 1]; a = D + f'{cn}-{f0["i"]:02d}.png'; b = D + f'{cn}-{f1["i"]:02d}.png'
        L = luma(a); m = np.zeros(L.shape, bool); yy, xx = np.mgrid[0:L.shape[0], 0:L.shape[1]]; sc = L.shape[1] / meta.get('cssW', L.shape[1])  # marks are CSS px, frames are device px
        for (x, y, r) in [(int(x * sc), int(y * sc), int(r * sc)) for (x, y, r) in f0['marks'] + f1['marks']]:
            r = max(18, int(r * 0.9)); x0, x1, y0, y1 = max(0, x - r), min(L.shape[1], x + r), max(0, y - 2 * r), min(L.shape[0], y + r)
            if x0 < x1 and y0 < y1: m[y0:y1, x0:x1] |= ((xx[y0:y1, x0:x1] - x) ** 2 + ((yy[y0:y1, x0:x1] - y) * 0.6) ** 2) < r * r * 1.6
        frac, worst, wpos, flag = compare(a, b, m)
        if frac > worst_frac: worst_frac, worst_blk, worst_i, wflag, wa = frac, worst, (f0['i'], wpos), flag, a
    bad = worst_frac > 0.0008 or worst_blk > 0.03; fails += bad
    print(f"{'FAIL' if bad else 'ok  '} clip  {cn:20s} worst pair flagged {worst_frac*100:.3f}%  worst block {worst_blk*100:.1f}% (frame, block) {worst_i}")
    if worst_i: heat(wa, wflag, D + cn + '-worst-heat.png')
print('RESULT', 'FAIL' if fails else 'PASS', fails, 'failing checks')
