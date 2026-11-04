# Publier le site

Le site est en ligne sur `https://maliciousmusic.github.io/belai-garden-site/`, publié par GitHub Pages. Chaque poussée sur `main`
lance les tests, puis publie `public/` (`.github/workflows/site.yml`).

## Limites de GitHub Pages

- Un site publié de 1 Go au plus et 100 Go de trafic par mois (limites souples). Le site fait environ 770 Mo.
- 100 Mo par fichier au plus. Le plus gros fait 10,7 Mo, et `outils/verifie.py` refuse au-delà de 25 Mio, la limite de Cloudflare.

## Ce qui ne marche pas sur GitHub Pages

- `/api` et `/bzzou` n'existent pas à cette adresse. Le compte répond que le serveur est absent, et Bzzou se limite à ce qu'elle
  sait seule, puis à ses pistes.
- `public/_headers` (les durées de cache) n'est pas lu : il sert pour Cloudflare Pages.
- Belai Bureau 0.1.0 n'accepte que l'ancienne adresse et `belai.garden` (`SITES` dans `bureau/src-tauri/src/essai.rs`, dans l'atelier) :
  « L'essayer sur mon bureau » depuis cette adresse demande une nouvelle version de l'application.

## Pour ouvrir les ventes

Il faudra un domaine sur Cloudflare pour que `/api` réponde à la même adresse que les pages (`api/README.md`). Le site peut alors
rester sur GitHub Pages derrière ce domaine, ou passer sur Cloudflare Pages.

Avant de mettre `api/` en ligne, régler dans `api/wrangler.toml` :

- `ORIGINES` : l'adresse du site ;
- `CATALOGUE` : `https://<domaine>/scene/boutique.json` ;
- `database_id` : celui que donne `wrangler d1 create belai`.
