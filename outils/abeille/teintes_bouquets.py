"""teintes_bouquets.py: the colours of each bouquet of the month, for Bzzou's advice (abeille-conseil.mjs).

Each stem of a bouquet's recipe (scene/boutique.json, « sid~k » and its count) has its colourway's colour in the atelier's
pack (scene/bouquets/<id>/atelier.json, fiches[sid~k].col). They are sorted into the soliflores' page's nine colours (the
same reading as teinte() in soliflore.mjs and abeille-conseil.mjs) and counted: abeille-bouquets.json gives each bouquet
the share of its stems in each colour (the 10 MB packs are read here, once, never by the page).

    python outils/abeille/teintes_bouquets.py      (after each new collection)
"""
import json
import os

ICI = os.path.dirname(os.path.abspath(__file__))
SQUELETTE = os.path.join(os.path.dirname(os.path.dirname(ICI)), 'public', 'squelette')
SCENE = os.path.join(os.path.dirname(SQUELETTE), 'scene')


def teinte(hexa):
    n = int(hexa[1:7], 16)
    r, g, b = ((n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    d = mx - mn
    s = 0 if d == 0 else d / (1 - abs(2 * l - 1))
    h = 0
    if d:
        h = ((g - b) / d + 6) % 6 if mx == r else (b - r) / d + 2 if mx == g else (r - g) / d + 4
    h *= 60
    if l > 0.84 and (s < 0.55 or 30 < h < 75):
        return 'blanc'
    if s < 0.14:
        return 'blanc' if l > 0.6 else 'sombre'
    if l < 0.2 or (h < 45 and l < 0.36 and s < 0.65):
        return 'sombre'
    if h < 14 or h >= 345:
        return 'rose' if l > 0.68 else 'rouge'
    if h < 22 and l > 0.68:
        return 'rose'
    if h < 42:
        return 'orange'
    if h < 68:
        return 'jaune'
    if h < 165:
        return 'vert'
    if h < 255:
        return 'bleu'
    if h < 290:
        return 'violet'
    return 'rose' if l > 0.55 else 'violet'


def main():
    boutique = json.load(open(os.path.join(SCENE, 'boutique.json'), encoding='utf-8'))
    out = {}
    for p in boutique['produits']:
        pack = os.path.join(SCENE, 'bouquets', p['id'], 'atelier.json')
        if not os.path.exists(pack):
            continue
        fiches = json.load(open(pack, encoding='utf-8'))['fiches']
        compte, tot = {}, 0
        # the recipe's colourways, or (a bouquet without one) each stem's first colourway in the pack
        lignes = p.get('recette') or [(next((k for k in fiches if k.split('~')[0] == sid), sid), n) for sid, n, *_ in p['tiges']]
        for sk, n, *_ in lignes:
            col = fiches.get(sk, {}).get('col')
            if not col:
                continue
            t = teinte(col)
            compte[t] = compte.get(t, 0) + n
            tot += n
        out[p['id']] = {t: round(c / tot, 3) for t, c in sorted(compte.items(), key=lambda x: -x[1])} if tot else {}
    dest = os.path.join(SQUELETTE, 'abeille-bouquets.json')
    json.dump(out, open(dest, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
    for i, t in out.items():
        print(f"{i:24} {', '.join(f'{k} {v:.0%}' for k, v in list(t.items())[:3])}")


if __name__ == '__main__':
    main()
