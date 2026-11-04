"""regard.py: where the eye goes first on a screen of the shop, for the audit (AUDIT.md).

    python outils/regard.py <dir of ecrans.mjs captures> [--fixations 6] [--voulu ordre.json]

For each <screen>.png (with its <screen>.json of named element boxes) it computes a bottom-up saliency map and the order
of the first fixations, then writes <screen>.regard.png (the map over the screen, fixations numbered) and adds to
regard.json, per screen, the fixations and the named element each one lands in. With --voulu (a JSON
{screen: [labels in the wanted order]}), it also scores how far the predicted order is from the wanted one.

The map is classic and cheap, no learned model:
- spectral residual on luminance (Hou and Zhang 2007): what breaks the image's own regularity;
- frequency-tuned colour contrast (Achanta et al. 2009): Lab distance to the screen's mean colour;
- a soft centre bias, as on any screen.
The fixations come by winner-take-all with inhibition of return (Itti and Koch 1998). It sees contrast, colour and
isolated shapes, and it does not read: a headline catches a real eye by its words too. That is why the panel goes with it.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

args = sys.argv[1:]


def opt(k, d):
    if k in args:
        i = args.index(k)
        v = args[i + 1]
        del args[i : i + 2]
        return v
    return d


N_FIX = int(opt('--fixations', 6))
WANTED = opt('--voulu', None)
root = Path(args[0])
W = 320  # the map's width: enough for page-scale structure, fast


def norm(a):
    a = a - a.min()
    m = a.max()
    return a / m if m > 0 else a


def saliency(img):
    h0, w0 = img.shape[:2]
    small = cv2.resize(img, (W, round(h0 * W / w0)), interpolation=cv2.INTER_AREA)
    lab = cv2.cvtColor(small, cv2.COLOR_BGR2LAB).astype(np.float32)
    # spectral residual on luminance
    L = lab[:, :, 0] / 255.0
    F = np.fft.fft2(L)
    logamp = np.log(np.abs(F) + 1e-8)
    phase = np.angle(F)
    resid = logamp - cv2.blur(logamp, (3, 3))
    sr = np.abs(np.fft.ifft2(np.exp(resid + 1j * phase))) ** 2
    sr = cv2.GaussianBlur(sr, (0, 0), 2.5)
    # colour contrast to the mean, on a slightly blurred image
    lb = cv2.GaussianBlur(lab, (0, 0), 1.5)
    ft = np.linalg.norm(lb - lab.reshape(-1, 3).mean(0), axis=2)
    ft = cv2.GaussianBlur(ft, (0, 0), 2.0)
    s = 0.5 * norm(sr) + 0.5 * norm(ft)
    # soft centre bias
    h, w = s.shape
    yy, xx = np.mgrid[0:h, 0:w]
    cb = np.exp(-(((xx - w / 2) / (0.45 * w)) ** 2 + ((yy - h / 2) / (0.45 * h)) ** 2))
    return norm(s * (0.7 + 0.3 * cb))


def fixations(s, n):
    s = s.copy()
    h, w = s.shape
    r = 0.09 * w
    yy, xx = np.mgrid[0:h, 0:w]
    out = []
    for _ in range(n):
        y, x = np.unravel_index(np.argmax(s), s.shape)
        out.append((x / w, y / h, float(s[y, x])))
        s *= 1 - np.exp(-(((xx - x) ** 2 + (yy - y) ** 2) / (2 * r * r)))
    return out


def label_at(fx, fy, meta):
    # the smallest named box holding the point, else the nearest one within a short reach
    px, py = fx * meta['w'], fy * meta['h']
    inside = [b for b in meta['boxes'] if b['box'][0] <= px <= b['box'][0] + b['box'][2] and b['box'][1] <= py <= b['box'][1] + b['box'][3]]
    if inside:
        return min(inside, key=lambda b: b['box'][2] * b['box'][3])['label']
    best, bd = None, 0.06 * meta['w']
    for b in meta['boxes']:
        x, y, bw, bh = b['box']
        d = np.hypot(max(x - px, 0, px - x - bw), max(y - py, 0, py - y - bh))
        if d < bd:
            best, bd = b['label'], d
    return best or '(rien de nommé)'


def overlay(img, s, fx):
    h, w = img.shape[:2]
    heat = cv2.applyColorMap((cv2.resize(s, (w, h)) * 255).astype(np.uint8), cv2.COLORMAP_INFERNO)
    out = cv2.addWeighted((img * 0.45).astype(np.uint8), 1.0, heat, 0.55, 0)
    k = w / 1440 if w >= 1000 else w / 390 / 1.6
    pts = [(int(x * w), int(y * h)) for x, y, _ in fx]
    for a, b in zip(pts, pts[1:]):
        cv2.line(out, a, b, (255, 255, 255), max(1, int(2 * k)), cv2.LINE_AA)
    for i, (x, y) in enumerate(pts, 1):
        rad = int(22 * k)
        cv2.circle(out, (x, y), rad, (40, 40, 220), -1, cv2.LINE_AA)
        cv2.circle(out, (x, y), rad, (255, 255, 255), max(1, int(2 * k)), cv2.LINE_AA)
        t = str(i)
        fs = 0.8 * k
        (tw, th), _ = cv2.getTextSize(t, cv2.FONT_HERSHEY_SIMPLEX, fs, max(1, int(2 * k)))
        cv2.putText(out, t, (x - tw // 2, y + th // 2), cv2.FONT_HERSHEY_SIMPLEX, fs, (255, 255, 255), max(1, int(2 * k)), cv2.LINE_AA)
    return out


def order_score(pred, wanted):
    # share of wanted pairs (a before b) that the predicted order keeps; unseen labels count as seen last
    pos = {}
    for i, l in enumerate(pred):
        pos.setdefault(l, i)
    pairs = [(a, b) for i, a in enumerate(wanted) for b in wanted[i + 1 :]]
    if not pairs:
        return None
    ok = sum(1 for a, b in pairs if pos.get(a, 99) < pos.get(b, 99) or (a in pos and b not in pos))
    return round(ok / len(pairs), 2)


wanted = json.loads(Path(WANTED).read_text(encoding='utf-8')) if WANTED else {}
report = {}
for png in sorted(root.glob('*.png')):
    if png.name.endswith('.regard.png'):
        continue
    meta_f = png.with_suffix('.json')
    if not meta_f.exists():
        continue
    meta = json.loads(meta_f.read_text(encoding='utf-8'))
    img = cv2.imread(str(png))
    s = saliency(img)
    fx = fixations(s, N_FIX)
    labels = [label_at(x, y, meta) for x, y, _ in fx]
    cv2.imwrite(str(png.with_name(png.stem + '.regard.png')), overlay(img, s, fx))
    entry = {'fixations': [{'x': round(x, 3), 'y': round(y, 3), 'force': round(v, 2), 'sur': l} for (x, y, v), l in zip(fx, labels)]}
    want = wanted.get(png.stem) or wanted.get(png.stem.split('-', 2)[-1])
    if want:
        entry['voulu'] = want
        entry['accord'] = order_score(labels, want)
    report[png.stem] = entry
    print(png.stem, ' > '.join(labels), f"(accord {entry['accord']})" if 'accord' in entry else '')
with open(root / 'regard.json', 'w', encoding='utf-8', newline='\n') as f:
    json.dump(report, f, ensure_ascii=False, indent=1)
