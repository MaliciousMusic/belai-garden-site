# D'où vient ce dépôt

Extrait le 4 novembre 2026 de `MaliciousMusic/the-internet-florist`, branche `ch/squelette`, commit
`926848bf3f438c776e100a30a89b95b5a3f52942`. Il repart sans historique : celui-ci reste dans l'atelier.

Les commentaires du code citent encore les anciens chemins. Voici la correspondance.

| Dans l'atelier | Ici |
|---|---|
| `decor/squelette/` | `public/squelette/` |
| `decor/squelette/outils/` | `outils/` |
| `decor/scene/` (une partie) | `public/scene/` |
| `insectes/runtime/`, `insectes/abeille/atlas/` | `public/insectes/` |
| `api/`, `bzzou/` | `api/`, `bzzou/` |
| `decor/scene/servir.py` | `outils/servir.py` |

## Ce qui a changé en route

Dans `public/`, tous les fichiers sont identiques à l'octet près à leur source, sauf ceux qui portent un lien vers la page légale, et :

- `_headers` : seul son commentaire de tête change, et GitHub Pages ne s'en sert pas. `index.html` est nouveau et envoie vers `squelette/`.
- `scene/essai.mjs` : le chemin des insectes, pour marcher sous `/belai-garden-site/`.
- `squelette/legal.html` est nouvelle : elle remplace les pages légales de l'ancien site (voir
  `decor/LEGAL-A-TRANCHER.md` dans l'atelier). Les liens des pages y mènent désormais, et `squelette.css` a reçu son style.

Hors de `public/`, seuls des chemins changent : les outils, le relais de Bzzou et `api/`.

## Ce qui reste dans l'atelier

- Le moteur et la cuisson : `mkengine.sh`, `predessin.mjs`, `paquet.mjs`, `sprites.mjs`, `soliflores.mjs`.
- `outils/soli.py`, qui lit `catalogue/` et écrit `soli.json`.
- L'ancien site (`decor/scene`, la frise, `decor/out`) et ses réglages en ligne.
- Les notes de travail : décisions, audits, plan des comptes, personas et flotte de questions de Bzzou (`decor/`, branche `ch/squelette`).
- `decor/squelette/audit/` : les captures se refont avec `outils/ecrans.mjs` et `outils/regard.py`.
- Les pages, l'en-tête et le décor de l'ancien site : aucune page d'ici ne les lit plus.

## Comment un bouquet arrive ici

Depuis la copie de l'atelier, ce dépôt étant cloné à côté de `flower-atelier` :

```bash
node decor/livrer.mjs <id>
```

Le script reprend `boutique.json` d'ici, cuit le bouquet dans l'atelier et copie ici ce que le site lit :
`ouvert.json`, `atelier.json`, `manifeste.json` et ses morceaux (`vase.svg`, `vase-dos.svg`, `p*.svg`), `sprites/` et `coloris/`. Il met à jour
le prix et la version de `sw.js`, lance `outils/verifie.py`, puis fait un commit sur la branche `livraison/<id>` en citant le
commit de l'atelier. Il ne pousse rien.

`--soliflore <sid>` fait de même pour un soliflore : `soliflores/<sid>/`, `soliflores/index.json` et `soli.json`.
