# Publier le site

Le site est en ligne sur `https://maliciousmusic.github.io/belai-garden-site/`, publié par GitHub Pages. Chaque poussée sur `main`
lance les tests, puis publie `public/` (`.github/workflows/site.yml`).

## Limites de GitHub Pages

- Un site publié de 1 Go au plus et 100 Go de trafic par mois (limites souples). Le site fait environ 770 Mo.
- 100 Mo par fichier au plus. Le plus gros fait 10,7 Mo, et `outils/verifie.py` refuse au-delà de 25 Mio, la limite de Cloudflare.

## Ce qui ne marche pas sur GitHub Pages

- `/api` et `/bzzou` n'existent pas à cette adresse. Le compte répond que le serveur est absent, et Bzzou se limite à ce qu'elle
  sait seule, puis à ses pistes.
- `public/_headers` (les durées de cache, les en-têtes de sécurité) n'est pas lu : il sert pour Cloudflare Pages. Après un changement de script
  dans une page : `python -X utf8 outils/entetes.py`.
- Belai Bureau 0.1.0 n'accepte que l'ancienne adresse et `belai.garden` (`SITES` dans `bureau/src-tauri/src/essai.rs`, dans l'atelier) :
  « L'essayer sur mon bureau » depuis cette adresse demande une nouvelle version de l'application.

## Passer sur Cloudflare (belaisgarden.com)

Les pages vont sur Cloudflare Pages, le serveur sur un Worker qui répond à `belaisgarden.com/api/*`, la base sur D1. Chaque commande se
lance depuis la racine du dépôt, sauf indication. Le porteur tape lui-même ses identifiants, ses clés et ses codes.

### 1. Les pages

```bash
cd api && npm ci && npx wrangler login
```

```bash
npx wrangler pages project create belais-garden --production-branch main
```

Remplacer l'ancienne adresse dans les balises `canonical` et `og:` :

```bash
grep -rl maliciousmusic.github.io/belai-garden-site public --include=*.html | xargs sed -i 's#https://maliciousmusic.github.io/belai-garden-site/#https://belaisgarden.com/#g'
```

Publier une copie allégée, sans toucher aux sources :

```bash
rm -rf /tmp/belai-public && cp -r public /tmp/belai-public && sh outils/minifie.sh /tmp/belai-public && npx --prefix api wrangler pages deploy /tmp/belai-public --project-name belais-garden --branch main
```

Cloudflare Pages sert `produit.html` à l'adresse `/squelette/produit` : c'est normal. Essayer d'abord sur l'adresse `belais-garden.pages.dev` (les pages, la page 404, les en-têtes), puis ajouter `belaisgarden.com` dans
Workers & Pages → belais-garden → Custom domains.

### 2. La base

```bash
cd api && npx wrangler d1 create belai --location weur
```

Recopier son `database_id` dans `[env.production]` de `api/wrangler.toml`, puis :

```bash
cd api && npx wrangler d1 migrations apply belai --env production --remote
```

### 3. Les secrets

Un par un, avec `cd api && npx wrangler secret put <NOM> --env production`. `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='` en donne
un bon pour les trois premiers. Les garder aussi hors ligne : **`POIVRE` et `CLE_NUMEROS` ne se changent plus une fois des comptes créés**
(les numéros deviendraient illisibles, les comptes introuvables), et une sauvegarde ne sert à rien sans eux.

| Nom | Quand | D'où |
|---|---|---|
| `POIVRE`, `CLE_NUMEROS`, `GUICHET_JETON` | tout de suite | `openssl`, trois valeurs différentes |
| `TURNSTILE_SECRET` | tout de suite | Cloudflare → Turnstile, widget « Managed » pour `belaisgarden.com` seul |
| `OVH_APP_KEY`, `OVH_APP_SECRET`, `OVH_CONSUMER_KEY`, `OVH_SERVICE`, `OVH_EXPEDITEUR` | avec `SMS = "ovh"` | eu.api.ovh.com/createToken, droit `POST /sms/*/jobs` seul |
| `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET` | avec `PAIEMENT = "stripe"` | Stripe → clé restreinte (Checkout Sessions en écriture), et le point de terminaison ci-dessous |

La clé **publique** de Turnstile se met dans `public/squelette/antirobot.mjs` (`CLE`).

### 4. Le serveur

```bash
cd api && npm run deploie
```

La commande lance les tests, refuse si un réglage manque, puis publie. Tout est fermé au départ (`SMS`, `COURRIEL_CODES` et `PAIEMENT` à
`"ferme"`). `https://belaisgarden.com/api/moi` doit répondre `non_connecte` ; s'il répond `configuration`, les journaux du Worker disent
quel nom manque.

Une porte à la fois : ouvrir d'abord les codes par e-mail (Email Sending, SPF, DKIM), puis les SMS, puis le paiement.

### 5. Stripe

D'abord dans un second environnement, `ENVIRONNEMENT = "preproduction"` avec une clé d'essai : les clés d'essai sont refusées en
production, et les clés réelles ailleurs. Point de terminaison : `https://belaisgarden.com/api/stripe/webhook`, événements
`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
`checkout.session.expired`, `charge.dispute.created` et `charge.dispute.closed`. Les montants sont comparés en euros : laisser « Adaptive
Pricing », les codes promotionnels et les taxes automatiques éteints. Puis `PAIEMENT = "stripe"` et `npm run deploie`.

### 6. Le tableau de bord Cloudflare

- SSL/TLS : Full (strict), Always Use HTTPS, TLS 1.2 au moins, TLS 1.3. Universal SSL.
- `www` : une règle de redirection 301 vers `https://belaisgarden.com`.
- DNS : activer DNSSEC. CAA et courrier : voir l'audit du porteur.
- Sécurité : une règle de débit sur `/api/` (la limite gratuite suffit), en plus de celles du Worker. Turnstile. « Under Attack » en secours.
- Éteindre ce qui réécrit les pages, que la politique de sécurité bloquerait : Rocket Loader, Email Address Obfuscation, JavaScript
  Detections (Bot Fight Mode), Web Analytics injecté.
- Zero Trust → Access : une application pour `/squelette/guichet*`, `/api/guichet/*/tout`, `/api/guichet/*/reponse` et `/api/guichet/*/clos`, avec une
  connexion à deux facteurs. Les autres chemins `/api/guichet` sont ceux des visiteurs : ne pas les protéger.
- Notifications : erreurs du Worker, échec de la tâche planifiée, quotas, santé du domaine.

### Sauvegarder et restaurer

D1 garde de quoi revenir à n'importe quelle minute (Time Travel : 7 jours en formule gratuite, 30 jours en payante). En plus, une copie hors de Cloudflare, chaque
semaine et avant chaque migration, dans un dossier chiffré **hors du dépôt** :

```bash
cd api && npm run sauvegarde -- <dossier>
```

La commande exporte la base, la restaure dans une base vide et la vérifie. Pour restaurer en ligne : créer une base neuve, y verser le fichier,
mettre son `database_id` dans `wrangler.toml` et publier.

```bash
cd api && npx wrangler d1 create belai-2 --location weur
```

```bash
cd api && npx wrangler d1 execute belai-2 --remote --file <fichier.sql>
```

Retour à une minute précise, sur la base en place : `npx wrangler d1 time-travel restore belai --env production --timestamp <date>`.

### Revenir en arrière

- Les pages : Workers & Pages → belais-garden → Deployments → « Rollback ».
- Le serveur : `cd api && npx wrangler rollback --env production`. Les migrations ne font qu'ajouter : le serveur d'avant marche avec la base d'après,
  sauf les cookies (`__Host-`), que les visiteurs redemandent en se reconnectant.
- Fermer d'urgence : `PAIEMENT = "ferme"` (et `SMS`, `COURRIEL_CODES`) puis `npm run deploie`.
