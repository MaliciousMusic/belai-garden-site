# Traduire la boutique Belai's Garden

La boutique vend des bouquets numériques vivants, dessinés tige à tige d'après de vraies fleurs. Ils éclosent sur l'écran,
respirent dans la brise et fanent doucement sur trente jours. On les offre, ou on les garde pour soi. C'est une maison de
luxe : le ton est chaleureux, sobre et précis, jamais publicitaire ni criard. Le site est écrit en français.

## Ce qu'on te donne

- `langues/source.json` : `{ clé française: où elle a été vue }`, environ 1 700 phrases.
- Ta langue et ton fichier de sortie, `langues/<code>.json`, sous la forme `{ clé française: traduction }`. Toutes les
  clés doivent y être, sans exception.

## Les repères dans les clés

Une clé peut contenir des repères : `{p1}` un prix, `{d1}` une date (jour et mois), `{m1}` un mois, `{n1}` un nombre,
`{x1}` des mots libres (un nom de bouquet, de fleur, etc.).

- Chaque repère de la clé doit apparaître **exactement une fois** dans la traduction.
- Tu peux les déplacer selon ta grammaire, jamais les supprimer, les dupliquer ou les renommer.
- Le site les remplace lui-même : prix écrits à ta façon avec une estimation en monnaie locale, dates et mois dans ta
  langue. N'écris donc ni « € » à côté de `{p1}`, ni mot de mois à côté de `{d1}` ou `{m1}`.
- `{n1}er` en français veut dire « 1er » : adapte (« 1 », « 1st » si la phrase le demande), en gardant `{n1}`.

## Règles

- **Noms propres.** « Belai's Garden » et « Belai’s Launcher » restent tels quels.
- **Noms de bouquets.** Traduis-les avec poésie et brièveté (ce sont des titres), sauf les mots qui sont déjà des noms
  propres (« Citrine »).
- **Fleurs et coloris.** Les noms de fleurs sont les noms communs usuels dans ta langue, justes botaniquement. Un nom de
  cultivar entre parenthèses, comme « (Green Twist) », reste tel quel. Les coloris sont traduits.
- **Significations des fleurs.** Elles sont sourcées (langage des fleurs du XIXᵉ siècle, par pays). Traduis-les
  fidèlement, sans en inventer.
- **Vocabulaire du jeu.** Utilise bouquets, tiges, collectionner, composer, offrir. N'emploie jamais l'équivalent de
  « investissement », « rendement », « plus-value », « bourse », « trading » ou « spéculation ».
- **Typographie.** Suis celle de ta langue : guillemets, espaces, majuscules des titres. Les capitales décoratives sont
  faites par le CSS : garde la casse de la phrase.
- **Phrases partielles.** Une clé peut être un morceau de phrase coupé par une balise (un lien au milieu). Traduis le
  morceau pour qu'il se recolle naturellement, et regarde les clés voisines si besoin.
- **Mélange de langues.** Si une clé est déjà dans une autre langue, comme un nom latin ou un mot étranger, recopie-la.
- **Adresse au lecteur.** Elle suit les usages de ta langue, indiqués dans ton lot.

## Méthode

1. Découpe le travail en tranches d'environ 300 clés, dans l'ordre du fichier.
2. Écris chaque tranche avec Python dans `langues/<code>.partN.json`, en UTF-8 avec `json.dumps(..., ensure_ascii=False, indent=1)`.
3. Fusionne les tranches dans `langues/<code>.json`, puis efface les fichiers `.partN`.
4. Vérifie avec ce script et corrige jusqu'à ce qu'il affiche « ok » :

```python
import json, re
src = json.load(open('langues/source.json', encoding='utf-8'))
out = json.load(open('langues/CODE.json', encoding='utf-8'))
tok = lambda s: sorted(re.findall(r'\{[pdmnx]\d+\}', s))
miss = [k for k in src if k not in out]
bad = [k for k in src if k in out and tok(k) != tok(out[k])]
print('manquantes', len(miss), miss[:5]); print('repères faux', len(bad), bad[:5]); print('ok' if not miss and not bad else 'à corriger')
```

Ne touche à aucun autre fichier. Rends compte en 5 lignes : le nombre de clés, le résultat du script, et tes choix pour
les noms de bouquets, avec trois exemples.
