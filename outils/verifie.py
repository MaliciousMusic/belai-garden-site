"""verifie.py: what the published folder must hold, without a browser. Fails (exit 1) on a missing file.

    python -X utf8 outils/verifie.py            (in the tests, and after each delivery from the atelier)
    python -X utf8 outils/verifie.py --coloris  (also the Composer's colourways, which git does not carry)

It checks:
- each bouquet of boutique.json: ouvert.json, atelier.json, manifeste.json and its pieces (the gift's opening grows them),
  sprites/sprites.json and the pictures it names;
- each soliflore of soliflores/index.json: its pictures;
- every relative address written in the pages, modules and styles of public/, except the ones built at run time;
- no file over GitHub's limit of 100 MB, nor Cloudflare Pages' limit of 25 MiB.
"""
import json
import os
import posixpath
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public')
EXT = 'html|js|mjs|css|json|svg|png|jpg|jpeg|webp|avif|woff2|mp4|mp3|m4a|ogg|wav|exe|webmanifest'
TOK = re.compile(r'''(?<![\w$}/.:-])(?:\.\./|\./)?[A-Za-z0-9_-][A-Za-z0-9_./~-]*\.(?:''' + EXT + r''')\b''')
MAX = 25 * 2**20
errors = []


def need(path, why):
    if not os.path.isfile(os.path.join(ROOT, path)):
        errors.append(f'{path} manque ({why})')


def load(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return json.load(f)


shop = load('scene/boutique.json')
for p in shop['produits']:
    base = f"scene/bouquets/{p['id']}/"
    for name in ('ouvert.json', 'manifeste.json', 'atelier.json', 'sprites/sprites.json'):
        need(base + name, p['id'])
    if os.path.isfile(os.path.join(ROOT, base, 'manifeste.json')):
        for piece in load(base + 'manifeste.json')['pieces']:
            need(base + piece['f'], p['id'])
    if os.path.isfile(os.path.join(ROOT, base, 'sprites/sprites.json')):
        s = load(base + 'sprites/sprites.json')
        for src in [s['frise']['src']] + s['proche']['sheets']:
            need(base + 'sprites/' + src.split('?')[0].split('/')[-1], p['id'])
    if '--coloris' in sys.argv and os.path.isfile(os.path.join(ROOT, base, 'atelier.json')):
        pack = load(base + 'atelier.json')
        for own, others in (pack.get('coloris') or {}).items():
            for other in others:
                if other != own:
                    need(f'{base}coloris/{own}__{other}.json', p['id'])

index = load('squelette/soliflores/index.json')
for sid, entry in index.items():
    if sid.startswith('_'):
        continue
    for k in entry['c']:
        need(f'squelette/soliflores/{sid}/{k}.webp', sid)

for folder, _, files in os.walk(ROOT):
    for name in files:
        full = os.path.join(folder, name)
        rel = os.path.relpath(full, ROOT).replace(os.sep, '/')
        if os.path.getsize(full) > MAX:
            errors.append(f'{rel} dépasse 25 Mio')
        if not name.endswith(('.html', '.js', '.mjs', '.css')) or 'vendor/' in rel:
            continue
        with open(full, encoding='utf-8', errors='ignore') as f:
            text = f.read()
        if name.endswith(('.js', '.mjs', '.css')):
            text = re.sub(r'^\s*(//|\*|/\*).*$', '', text, flags=re.M)
        base = posixpath.dirname(rel)
        if '<base href="../">' in text:
            base = posixpath.dirname(base)
        for t in TOK.findall(text):
            if t.startswith(('../', './')) or '/' in t:
                r = posixpath.normpath(posixpath.join(base, t))
                while r.startswith('../'):
                    r = r[3:]
                top = r.split('/')[0]
                if top in ('squelette', 'scene', 'insectes') and t.startswith(('../', './')):
                    need(r, rel)

if errors:
    print(f'{len(errors)} erreurs :')
    for e in sorted(set(errors))[:60]:
        print(' ', e)
    sys.exit(1)
print(f"verifie.py : tout est là ({len(shop['produits'])} bouquets, {len(index) - 1} soliflores)")
