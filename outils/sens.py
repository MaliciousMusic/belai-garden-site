"""sens.py: builds sens.json (what the shop shows) from sens-sources.json (the sourced meanings, SENS-SOURCES.md).

Two readings of every flower (owner, 2026-10-31):
- the atelier's choice, shown by default: the favourable meaning that a source gives (a 19th-century text, level A, or a
  reputable secondary source, B), with a short citation; a flower whose only sourced meanings are a reproach shows none,
  and so does a colour whose only meaning is one (yellow rose: infidelity; yellow tulip: hopeless love);
- each country's own reading (France, Britain and America, Germany, Spain, China, Japan), chosen with a toggle: there the
  old meaning is shown as the books give it, a taboo marked as such (white chrysanthemum: mourning in France).

    python outils/sens.py
"""
import json
import os
import re

OUTILS = os.path.dirname(os.path.abspath(__file__))
HERE = os.path.join(os.path.dirname(OUTILS), 'public', 'squelette')

# the atelier's choice for the flowers in dispute (SENS-SOURCES.md, 5.1): the favourable sourced meaning, or none
CHOICE = {
    'hortensia-boule': None,  # cold, boastful, fickle in every old book; "gratitude" is modern usage only
    'fritillaire-meleagris': None,  # persecution is its only old meaning
    'chrysantheme-disbud': ('Gaieté dans l’adversité, longévité', 'Greenaway 1884 · tradition chinoise', 'A'),
    'viburnum-roseum': ('Bonne nouvelle', 'La Tour 1819', 'A'),
    'narcisse-trompette': ('Désir, estime', 'La Tour 1819 · Greenaway 1884', 'A'),
    'narcisse-bouquet': ('Bonne fortune', 'tradition chinoise', 'B'),
    'mimosa': ('Amour secret', 'Greenaway 1884', 'A'),
    'scabieuse': ('Consolation dans la solitude', 'Braun 1843', 'A'),
    'anemone-coronaria': ('Jette ta tristesse au vent', 'Braun 1843', 'A'),
    'anemone-sauvage': ('Jette ta tristesse au vent', 'Braun 1843', 'A'),
    'dahlia-decoratif': ('Reconnaissance et estime', 'La Tour 1819 · Braun 1843', 'A'),
}
# a reproach, a loss, a death: never the atelier's message
NEGATIVE = re.compile(
    r'jalous|infid|sans espoir|chagrin|regret|inconstan|dédain|refus|hauteur|abandon|froid|vantard|insensib|persécut|veuv'
    r'|malheur|délaiss|égo[iï]s|instabil|deuil|mort|funér|funèbre|cimeti|toussaint|maladie|trompeur|perdu|hiver|âge|caractère'
    r'|dédaign|déclin|victime', re.I)

BOOKS = [
    ('La Tour', 'La Tour 1819'), ('Greenaway', 'Greenaway 1884'), ('Phillips', 'Phillips 1825'), ('Braun', 'Braun 1843'),
    ('Jazmín', 'Jazmín 1882'), ('Ingram', 'Ingram 1869'), ('Symanski', 'Symanski 1832'),
]
CULTURES = {'CN': 'tradition chinoise', 'JP': 'tradition japonaise', 'FR': 'tradition française', 'UK': 'tradition anglaise',
            'US': 'usage américain', 'DE': 'tradition allemande', 'ES': 'tradition espagnole'}
# the Spanish books name their colours in Spanish
FAMILIES = {'amarillo': 'jaune', 'blanco': 'blanc', 'rojo': 'rouge', 'rosa': 'rose', 'morado': 'violet', 'azul': 'bleu'}
# the toggle's countries; America reads the British books (its own entries are modern florists' usage)
COUNTRIES = {'FR': ['FR'], 'UK': ['UK', 'US'], 'DE': ['DE'], 'ES': ['ES'], 'CN': ['CN'], 'JP': ['JP']}
ETYMOLOGY = {'gloriosa': ('Gloire', 'étymologie latine'), 'cosmos': ('Harmonie, ordre', 'étymologie grecque')}
RANK = {'A': 0, 'B': 1, 'C': 2}
# where a book gives several flowers under one genus, the entry of the flower the shop sells comes first (the jonquille
# is « désir » in La Tour; « égoïsme » is the poet's narcissus)
PREFER = {'narcisse-trompette': r'jonquille|trompette|daffodil', 'narcisse-bouquet': r'tazette|shuixian'}
# words that name a flower at the head of a book's line
FLOWER_WORDS = ('rose', 'tulipe', 'renoncule', 'anémone', 'pois', 'jacinthe', 'narcisse', 'jonquille', 'lilas', 'iris', 'dahlia',
                'scabieuse', 'pied-d', 'hortensia', 'hydrangea', 'chrysanth', 'œillet', 'oeillet', 'calla', 'arum', 'orchid',
                'amarante', 'cerisier', 'cognassier', 'pyrus', 'glycine', 'mimosa', 'acacia', 'sensitive', 'fritillaire', 'boule',
                'rose de gueldre', 'viorne', 'delphinium', 'éperon', 'coing', 'freesia', 'gerbera', 'muscari', 'fleur', 'bouquet', 'renouée', 'dauphinelle')


def short_source(t):
    s = next((v for k, v in BOOKS if k in t['source']), None)
    if s:
        return s
    if t.get('niveau') == 'C':
        return 'usage des fleuristes'
    return CULTURES.get(t['culture'], t['source'].split(',')[0].strip())


def cite(entry, level='A'):
    if level == 'B':
        names = [CULTURES.get(t['culture']) for t in entry.get('traditions', []) if t.get('niveau') == 'B' and t['culture'] in ('CN', 'JP')]
        names = [n for n in names if n]
        if names:
            return names[0]
    out = []
    for lvl in ('A', 'B'):
        for t in entry.get('traditions', []):
            if t.get('niveau') == lvl and (s := short_source(t)) not in out:
                out.append(s)
        if out:
            break
    return ' · '.join(out[:2])


def tidy(text, names=()):
    """A book's meaning, short: no commentary in brackets, no 'Flower :' head (only when the head names a flower: in
    « Pudeur : la plante qui se referme », the head is the meaning), a capital first letter."""
    t = re.sub(r'\s*\([^)]*\)', '', text).strip()
    t = re.sub(r'\s*«[^»]*»\s*$', '', t).strip() or t
    head, sep, rest = t.partition(' : ')
    if sep and len(head.split()) <= 4:
        # « Hortensia : un vantard » gives its meaning after the name; « Pudeur : la plante qui... » before its gloss
        t = rest if any(n in head.lower() for n in names) else head
    t = t.split(' ; ')[0].strip(' .;')
    if len(t) > 72:
        t = t[: t.rfind(' ', 0, 70)].rstrip(' ,;') + '…'
    return t[:1].upper() + t[1:] if t else ''


def country(entry, codes, sid=''):
    """A country's reading of a flower: its species meaning and its colours, from its best sources, taboos marked."""
    pref = re.compile(PREFER.get(sid, r'$^'), re.I)
    trads = sorted((t for t in entry.get('traditions', []) if t['culture'] in codes),
                   key=lambda t: (0 if pref.search(t['fr'] + ' ' + t['sens']) else 1, RANK.get(t['niveau'], 3)))
    tabous = [t for t in entry.get('tabous', []) if t['culture'] in codes]
    out = {'couleur': {}}
    for t in trads:
        fam = FAMILIES.get(t.get('couleur'), t.get('couleur'))
        # a line about one colour may open on that colour's name (« Blanc : innocence… »): the meaning is after it
        text = tidy(t['fr'], FLOWER_WORDS + tuple(filter(None, [t.get('couleur')])))
        if not text:
            continue
        if fam is None and 'sens' not in out:
            out.update(sens=text, source=short_source(t), tabou=bool(NEGATIVE.search(text)))
        elif fam and fam not in out['couleur']:
            out['couleur'][fam] = {'sens': text, 'source': short_source(t), 'tabou': bool(NEGATIVE.search(text))}
    # a taboo on a colour the books give no meaning to becomes that colour's reading (white chrysanthemum: funerals);
    # the species' own flag comes from its meaning alone
    for t in tabous:
        fam = FAMILIES.get(t.get('couleur'), t.get('couleur'))
        if fam and fam not in out['couleur'] and (note := tidy(t['fr'], FLOWER_WORDS + tuple(filter(None, [t.get('couleur')])))):
            out['couleur'][fam] = {'sens': note, 'source': short_source(t), 'tabou': True}
    return out if ('sens' in out or out['couleur']) else None


def main():
    src = json.load(open(os.path.join(OUTILS, 'sens-sources.json'), encoding='utf-8'))
    out = {}
    for sid, e in src.items():
        p = e.get('propose') or {}
        lvl = p.get('niveau') or 'D'
        parent = re.search(r'Hérite de ([a-z-]+)', p.get('base') or '')
        base = src[parent.group(1)] if parent and parent.group(1) in src else e
        # the atelier's choice
        if sid in CHOICE:
            c = CHOICE[sid]
            sens, source, lvl = c if c else (None, None, 'D')
        elif not p.get('sens') or lvl == 'D':
            sens, source = None, None
        else:
            sens = re.sub(r'\s*\((sens ancien|Chine|Japon)\)', '', p['sens'])
            source = cite(base, lvl) if lvl != 'C' else 'usage des fleuristes'
            if sid in ETYMOLOGY:
                sens, source = ETYMOLOGY[sid]
        # colours: a favourable meaning, or null (no message) when the only one is a reproach
        colours = {}
        for k, v in (p.get('couleur') or {}).items():
            colours[k] = None if NEGATIVE.search(v) else re.sub(r'\s*\((sens ancien|mais [^)]*)\)', '', v)
        row = {'sens': sens, 'source': source, 'niveau': lvl, 'couleur': colours, 'pays': {}}
        for code, cultures in COUNTRIES.items():
            r = country(base if not e.get('traditions') else e, cultures, sid)
            if r:
                row['pays'][code] = r
        out[sid] = row
    with open(os.path.join(HERE, 'sens.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, indent=0)
        f.write('\n')
    # the soliflores carry the atelier's meaning of their flower
    soli = json.load(open(os.path.join(HERE, 'soli.json'), encoding='utf-8'))
    for fl in soli['fleurs']:
        s = out.get(fl['sid'])
        if s:
            fl['sens'] = s['sens'] or ''
            fl['source'] = s['source'] or ''
    with open(os.path.join(HERE, 'soli.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(soli, f, ensure_ascii=False, indent=0)
        f.write('\n')
    print('with a meaning', sum(1 for v in out.values() if v['sens']), '· none', sum(1 for v in out.values() if not v['sens']),
          '· country readings', sum(len(v['pays']) for v in out.values()))


if __name__ == '__main__':
    main()
