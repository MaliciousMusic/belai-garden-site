"""entetes.py: the pages' security policy (CSP), written in one place. No inline script runs unless its fingerprint is listed here.

    python -X utf8 outils/entetes.py            (writes it: after any change to an inline script)
    python -X utf8 outils/entetes.py --verifie  (in the tests: fails if a page or _headers is behind)

It writes:
- in each page of public/, a <meta> with that page's own fingerprints (GitHub Pages sends no headers; the developer's machine
  needs its two local servers);
- in public/_headers, for Cloudflare Pages, the same policy for all pages, with what a <meta> cannot say (frame-ancestors).
  Both apply there: a script must pass the two.
"""
import base64
import glob
import hashlib
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public')
# PixiJS (the insects) builds functions at run time; these pages have none of it
SANS_EVAL = {'guichet.html', 'legal.html', 'catalogue.html'}
# Cloudflare Turnstile, loaded only when a form is sent (squelette/antirobot.mjs)
ROBOT = 'https://challenges.cloudflare.com'
LOCAL = 'http://127.0.0.1:8790 http://127.0.0.1:8792'
META = re.compile(r'(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)')
SCRIPT = re.compile(r'<script([^>]*)>(.*?)</script>', re.S)


def empreintes(html):
    out = []
    for attrs, corps in SCRIPT.findall(html):
        if 'src=' in attrs or 'ld+json' in attrs:
            continue
        h = "'sha256-" + base64.b64encode(hashlib.sha256(corps.encode()).digest()).decode() + "'"
        if h not in out:
            out.append(h)
    return out


def politique(scripts, evalue, local, cadre):
    r = [
        "default-src 'self'",
        ' '.join(["script-src 'self'"] + scripts + (["'unsafe-eval'"] if evalue else []) + [ROBOT]),
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob: data:",
        "media-src 'self' blob:",
        "font-src 'self'",
        "connect-src 'self' blob: data:" + (' ' + LOCAL if local else ''),
        "worker-src 'self' blob:",
        "frame-src 'self' " + ROBOT,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ]
    if cadre:
        r += ["frame-ancestors 'none'", 'upgrade-insecure-requests']
    return '; '.join(r)


retards = []


def ecrit(chemin, avant, apres):
    if avant == apres:
        return
    retards.append(os.path.relpath(chemin, ROOT))
    if '--verifie' not in sys.argv:
        with open(chemin, 'w', encoding='utf-8', newline='') as f:
            f.write(apres)


tous = []
for page in sorted(glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True)):
    with open(page, encoding='utf-8', newline='') as f:
        html = f.read()
    for m in re.findall(r'<[^>]+\son[a-z]+\s*=', html):
        sys.exit(f'{os.path.relpath(page, ROOT)} : un gestionnaire dans la balise ne passera pas ({m[:60]})')
    h = empreintes(html)
    tous += [x for x in h if x not in tous]
    nom = os.path.basename(page)
    ecrit(page, html, META.sub(lambda m: m[1] + politique(h, nom not in SANS_EVAL, True, False) + m[2], html))

regle = '  Content-Security-Policy: ' + politique(tous, True, False, True)
# (Cloudflare Pages drops a longer line)
if len(regle) > 2000:
    sys.exit(f'_headers : ligne de {len(regle)} caractères, 2 000 au plus')
fichier = os.path.join(ROOT, '_headers')
with open(fichier, encoding='utf-8', newline='') as f:
    texte = f.read()
ecrit(fichier, texte, re.sub(r'^  Content-Security-Policy: .*$', lambda m: regle, texte, flags=re.M))

if retards and '--verifie' in sys.argv:
    sys.exit(f"entetes.py : {', '.join(retards)} à refaire (python -X utf8 outils/entetes.py)")
print(f"entetes.py : {len(tous)} scripts en ligne connus" + (f", {len(retards)} fichiers écrits" if retards else ''))
