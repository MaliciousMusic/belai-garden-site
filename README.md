# Belai's Garden, le site de vente

Le site où l'on offre et où l'on garde des bouquets numériques vivants. Ce dépôt ne contient que le site : ses pages, le
serveur des comptes et le relais de Bzzou. Les fleurs, les vases, le moteur de dessin et l'ancien site restent dans l'atelier,
`MaliciousMusic/the-internet-florist`, qui livre ici les bouquets déjà cuits.

## Contenu

| Dossier | Rôle |
|---|---|
| `public/` | Tout ce qui est publié, tel quel. La racine du site : `/squelette/`, `/scene/`, `/insectes/` |
| `public/squelette/` | Les pages, dont la page légale, les modules, les langues, Bzzou et les 270 soliflores |
| `public/scene/` | Le catalogue (`boutique.json`), les bouquets cuits, les polices, l'essai sur le bureau |
| `public/insectes/` | Le moteur des insectes et l'atlas de l'abeille |
| `api/` | Le serveur des comptes, des achats et du guichet (Worker Cloudflare et base D1) |
| `bzzou/` | Le relais entre la page et le petit modèle de langage de Bzzou |
| `outils/` | Contrôles du site, captures, entraînement de Bzzou, serveur local |
| `docs/` | [D'où vient ce dépôt](docs/ORIGINE.md) et [comment il se publie](docs/PUBLIER.md) |

## Cloner sous Windows

Les noms des coloris sont longs. Clonez près de la racine du disque, ou activez `core.longpaths` :

```bash
git clone -c core.longpaths=true https://github.com/MaliciousMusic/belai-garden-site.git
```

## Lancer le site en local

```bash
python outils/servir.py 8851 public
```

Puis ouvrir `http://localhost:8851/squelette/`.

Pour le serveur des comptes, voir [api/README.md](api/README.md). Pour Bzzou, voir [bzzou/README.md](bzzou/README.md).

## Contrôler

```bash
python -X utf8 outils/verifie.py --coloris
```

```bash
cd api && npm test
```

Les tests tournent aussi à chaque poussée (`.github/workflows/site.yml`).

## Publier

Chaque poussée sur `main` publie le site sur `https://maliciousmusic.github.io/belai-garden-site/`. Voir
[docs/PUBLIER.md](docs/PUBLIER.md).

