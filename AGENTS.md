# Consignes pour les agents — site de Belai's Garden

Lis d'abord le [README](README.md), puis [docs/ORIGINE.md](docs/ORIGINE.md). Ce dépôt est public : les notes de travail, les
décisions et les audits vont dans l'atelier (privé), jamais ici.

## Règles permanentes

- **Le site seul.** Rien de l'atelier ici : ni moteur, ni sources de fleurs, ni catalogue, ni photos de tiers.
- **Les bouquets et les soliflores ne se redessinent pas ici.** Ils viennent de l'atelier par `decor/livrer.mjs` (dépôt
  `the-internet-florist`). On n'édite jamais à la main ce qu'il livre.
- **Vocabulaire** : bouquets, tiges, collectionner, composer, offrir. Jamais « investissement », « rendement », « plus-value »,
  « bourse », « trading », « spéculation » ou « token sale ».
- **Aucun secret dans le dépôt** : clés dans `api/.dev.vars` (ignoré) ou dans `wrangler secret`. Jamais le port 8766.
- **Une tâche lourde à la fois** sur le PC du porteur, au plus 3 navigateurs headless (verrou
  `../flower-atelier/ws/gate.sh`) et plus de 2,5 Go de RAM libre. Le PC a déjà planté.

## Conventions

- **Langues** : docs, rapports et messages de commit en français ; code et commentaires en anglais.
- **Adresses** : les pages se lisent entre elles par des chemins relatifs (`../scene/`, `../insectes/`). Ne déplace pas ces
  dossiers sans les corriger partout.
- **Après une livraison ou une nouvelle page** : `python -X utf8 outils/verifie.py --coloris`.
- **Décisions** : si une décision manque, ne la prends pas. Écris la question et ta proposition, puis continue.
