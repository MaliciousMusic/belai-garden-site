"""entraine.py: trains the shop bee's small network (owner, 2026-11-02: « un petit réseau pré-cuit, pas de LLM »).

The customers' own wordings (questions/<lang>.tsv, « id<TAB>question ») become features the same way the page makes them
(abeille.mjs, traits()): the text folded (lower case, no accents, punctuation as spaces), then its character n-grams of
1 to 4 and its words, hashed (FNV-1a over UTF-8) into D buckets, counted, log-scaled and L2-normalised. One hidden layer of
H ReLU units, a softmax over the intentions. Each line is also learnt twice with typos. Trained with Adam on 85 % of the
lines, checked on the other 15 % (which sets the confidence under which the bee hands over), then again on all of them;
the weights are quantised to int8 (one scale per matrix) and written to public/squelette/abeille-modele.json.

lexique.json gives, for each intention and language, short words that name it beyond doubt (« paypal », « nft »): they are
learnt as lines too, and written folded into the model (lex), where the page gives them half of the weight.

    python outils/abeille/entraine.py
"""
import base64
import glob
import json
import math
import os
import random
import unicodedata

import numpy as np
from scipy import sparse

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, '..', '..', 'public', 'squelette', 'abeille-modele.json')
D = 4096
H = 128
GRAINE = 20261102
# how often the answers the bee gives must be right, on the questions it never saw in training
JUSTESSE = 0.85


def plie(t):
    """The text as the page folds it: NFKD, combining marks dropped, lower case, every non letter-or-digit a space."""
    t = unicodedata.normalize('NFKD', t)
    t = ''.join(c for c in t if not unicodedata.combining(c)).lower()
    t = ''.join(c if (c.isalnum()) else ' ' for c in t)
    return ' '.join(t.split())


def fnv(s):
    h = 0x811C9DC5
    for b in s.encode('utf-8'):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def traits(t):
    """Hashed counts of the character n-grams (1 to 4, on the text padded with spaces; a lone space is not one) and of the
    words. The single characters carry Chinese, Japanese and Korean, whose words are one or two characters long."""
    t = plie(t)
    v = {}
    p = ' ' + t + ' '
    for n in (1, 2, 3, 4):
        for i in range(len(p) - n + 1):
            g = p[i:i + n]
            if g == ' ':
                continue
            k = fnv(g) % D
            v[k] = v.get(k, 0) + 1
    for w in t.split():
        k = fnv('#' + w) % D
        v[k] = v.get(k, 0) + 1
    x = {k: math.log1p(c) for k, c in v.items()}
    n = math.sqrt(sum(c * c for c in x.values())) or 1.0
    return {k: c / n for k, c in x.items()}


def matrice(textes):
    """The features of many texts, as one sparse matrix (some 150 buckets used out of D per line: 27 000 lines dense
    would take more than a gigabyte, sparse about a hundred megabytes)."""
    lig, col, val = [], [], []
    for i, t in enumerate(textes):
        for k, c in traits(t).items():
            lig.append(i)
            col.append(k)
            val.append(c)
    return sparse.csr_matrix((np.array(val, np.float32), (lig, col)), shape=(len(textes), D))


FAUTES = random.Random(3)


def faute(q):
    """The same question with a typo or two (a letter dropped, doubled or two swapped): customers type fast."""
    s = list(q)
    for _ in range(FAUTES.randint(1, 2)):
        if len(s) < 4:
            break
        i = FAUTES.randrange(len(s) - 1)
        k = FAUTES.random()
        if k < 0.33:
            del s[i]
        elif k < 0.66:
            s.insert(i, s[i])
        else:
            s[i], s[i + 1] = s[i + 1], s[i]
    return ''.join(s)


def avec_fautes(lignes, X, Y, idx):
    """The lines idx, each also twice with typos."""
    extra = matrice([faute(lignes[i][1]) for i in idx for _ in range(2)])
    return sparse.vstack([X[idx], extra]).tocsr(), np.concatenate([Y[idx], np.repeat(Y[idx], 2)])


def lexique():
    f = os.path.join(ICI, 'lexique.json')
    return json.load(open(f, encoding='utf-8')) if os.path.exists(f) else {}


def lis():
    lignes = []
    for f in sorted(glob.glob(os.path.join(ICI, 'questions', '*.tsv'))):
        for l in open(f, encoding='utf-8'):
            l = l.rstrip('\n')
            if '\t' not in l:
                continue
            i, q = l.split('\t', 1)
            if q.strip():
                lignes.append((i.strip(), q.strip(), os.path.basename(f)[:-4]))
    # the lexicon's words, each a line of its intention
    for i, par in lexique().items():
        for lg, mots in par.items():
            lignes.extend((i, m, lg) for m in mots if m.strip())
    return lignes


def entraine(X, Y, K, epoques=70, lr=0.01, l2=1e-4, lot=64, graine=GRAINE):
    r = np.random.default_rng(graine)
    W1 = (r.standard_normal((D, H)) * math.sqrt(2 / D)).astype(np.float32)
    b1 = np.zeros(H, np.float32)
    W2 = (r.standard_normal((H, K)) * math.sqrt(2 / H)).astype(np.float32)
    b2 = np.zeros(K, np.float32)
    P = [W1, b1, W2, b2]
    m = [np.zeros_like(p) for p in P]
    v = [np.zeros_like(p) for p in P]
    t = 0
    n = X.shape[0]
    for ep in range(epoques):
        ordre = r.permutation(n)
        for s in range(0, n, lot):
            idx = ordre[s:s + lot]
            x, y = X[idx], Y[idx]
            # a little noise on the input: a typo drops or adds a few n-grams
            x = x.copy()
            x.data *= r.random(x.nnz) > 0.1
            h = np.maximum(0, x @ W1 + b1)
            z = h @ W2 + b2
            z -= z.max(1, keepdims=True)
            e = np.exp(z)
            p = e / e.sum(1, keepdims=True)
            g = p.copy()
            g[np.arange(len(y)), y] -= 1
            g /= len(y)
            gW2 = h.T @ g + l2 * W2
            gb2 = g.sum(0)
            gh = g @ W2.T
            gh[h <= 0] = 0
            gW1 = x.T @ gh + l2 * W1
            gb1 = gh.sum(0)
            t += 1
            for k, gr in enumerate([gW1, gb1, gW2, gb2]):
                m[k] = 0.9 * m[k] + 0.1 * gr
                v[k] = 0.999 * v[k] + 0.001 * gr * gr
                mh = m[k] / (1 - 0.9 ** t)
                vh = v[k] / (1 - 0.999 ** t)
                P[k] -= lr * mh / (np.sqrt(vh) + 1e-8)
    return P


def predit(P, X):
    W1, b1, W2, b2 = P
    z = np.maximum(0, X @ W1 + b1) @ W2 + b2
    z -= z.max(1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(1, keepdims=True)


def quantifie(W):
    s = float(np.abs(W).max()) / 127 or 1.0
    q = np.clip(np.round(W / s), -127, 127).astype(np.int8)
    return base64.b64encode(q.tobytes()).decode('ascii'), s, q.astype(np.float32) * s


def main():
    lignes = lis()
    ids = sorted({i for i, _, _ in lignes})
    K = len(ids)
    X = matrice([q for _, q, _ in lignes])
    Y = np.array([ids.index(i) for i, _, _ in lignes])
    r = random.Random(GRAINE)
    tous = list(range(len(lignes)))
    r.shuffle(tous)
    cut = int(len(tous) * 0.85)
    a, b = np.array(tous[:cut]), np.array(tous[cut:])
    P = entraine(*avec_fautes(lignes, X, Y, a), K, epoques=30, l2=5e-5)
    pv = predit(P, X[b])
    juste = (pv.argmax(1) == Y[b]).mean()
    # by language, on the held-out lines
    par = {}
    for k, j in enumerate(b):
        lg = lignes[j][2]
        par.setdefault(lg, []).append(pv[k].argmax() == Y[j])
    print(f'{len(lignes)} questions, {K} intentions ; tenue à part : {juste:.1%} justes')
    print('  ' + ', '.join(f'{lg} {np.mean(v):.0%}' for lg, v in sorted(par.items())))
    # the threshold under which the bee hands over to the atelier: the lowest at which, on the held-out lines, the answers it
    # gives are right at least JUSTESSE of the time (a wrong answer costs more than a person on the line)
    conf = pv.max(1)
    bon = pv.argmax(1) == Y[b]
    seuil = 0.9
    for s in np.arange(0.3, 0.9, 0.01):
        m = conf >= s
        if m.any() and bon[m].mean() >= JUSTESSE:
            seuil = float(s)
            break
    m = conf >= seuil
    print(f'  seuil de confiance : {seuil:.2f} (elle répond à {m.mean():.0%} des questions, juste à {bon[m].mean():.0%})')
    # then on everything
    P = entraine(*avec_fautes(lignes, X, Y, np.arange(len(lignes))), K, epoques=30, l2=5e-5)
    W1, b1, W2, b2 = P
    w1, s1, w1q = quantifie(W1)
    w2, s2, w2q = quantifie(W2)
    pq = predit([w1q, b1, w2q, b2], X)
    print(f'  quantifié, sur tout : {(pq.argmax(1) == Y).mean():.1%} justes')
    lex = {i: sorted({plie(m) for mots in par.values() for m in mots if plie(m)}) for i, par in lexique().items() if i in ids}
    json.dump(
        {'version': 2, 'D': D, 'H': H, 'ids': ids, 'seuil': round(seuil, 3), 'W1': w1, 's1': s1, 'b1': [round(float(x), 5) for x in b1],
         'W2': w2, 's2': s2, 'b2': [round(float(x), 5) for x in b2], 'lex': lex},
        open(SORTIE, 'w', encoding='utf-8', newline='\n'),
        separators=(',', ':'),
    )
    print(f'  écrit : {os.path.normpath(SORTIE)} ({os.path.getsize(SORTIE) // 1024} Ko)')
    essai(ids, [w1q, b1, w2q, b2], seuil, lex)


# kana, CJK ideographs, Hangul jamo and syllables: written without spaces, their lexicon words are matched anywhere
CJK = ('぀', 'ヿ'), ('㐀', '鿿'), ('ᄀ', 'ᇿ'), ('가', '힯')


def essai(ids, P, seuil, lex):
    """essai.tsv (« attendu<TAB>question », attendu may be « a|b »): visitors' questions never learnt, read as the page
    reads them (the lexicon's half weight included): answered right, answered wrong, offered as a guess, handed over."""
    for f in sorted(glob.glob(os.path.join(ICI, 'essai*.tsv'))):
        essai1(f, ids, P, seuil, lex)


def essai1(f, ids, P, seuil, lex):
    montre = os.path.basename(f) == 'essai.tsv'
    pas_un_choix = {'salut', 'merci', 'au_revoir', 'abeille', 'hors_sujet', 'humain', 'blague', 'blague_abeille', 'compliment', 'insulte_critique', 'manipulation', 'abeille_preferences', 'solitude_reconfort', 'deuil_personnel'}
    n = juste = faux = propose = passe = 0
    for l in open(f, encoding='utf-8'):
        if '\t' not in l:
            continue
        att, q = l.rstrip('\n').split('\t', 1)
        att = set(att.split('|'))
        p = predit(P, matrice([q]))[0]
        mots = ' ' + plie(q) + ' '
        vus = [i for i in ids if any((t in mots) if any(a <= c <= b for c in t for a, b in CJK) else (' ' + t + ' ') in mots for t in lex.get(i, []))]
        if vus:
            p = np.array([x * 0.5 + (0.5 / len(vus) if ids[c] in vus else 0) for c, x in enumerate(p)])
        o = np.argsort(-p)
        best = ids[o[0]]
        n += 1
        if best == 'humain' or (best != 'hors_sujet' and p[o[0]] >= seuil):
            ok = best in att
            juste += ok
            faux += not ok
            etat = 'juste' if ok else 'FAUX'
        else:
            choix = [ids[c] for c in o[:6] if p[c] >= 0.08 and ids[c] not in pas_un_choix][:3]
            if best == 'hors_sujet' and 'hors_sujet' in att:
                juste += 1
                etat = 'juste'
            elif att & set(choix):
                propose += 1
                etat = 'propose'
            else:
                passe += 1
                etat = 'passe'
        if montre and etat not in ('juste',):
            print(f'    {etat:8} {best:18} {p[o[0]]:.2f}  {q}')
    print(f'  {os.path.basename(f)} : {n} questions ; {juste} justes, {faux} fausses, {propose} proposées parmi les choix, {passe} passées à l’atelier')


if __name__ == '__main__':
    main()
