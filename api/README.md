# Le serveur des comptes et des cadeaux

C'est un Worker Cloudflare avec une base D1. Le plan d'ensemble est dans `decor/COMPTE.md`, dans l'atelier. Ce dossier
couvre les lots C2 (le compte vérifié par SMS ou par e-mail, les sessions), C3 (l'achat par carte, le stock) et C9 (les factures,
l'échange sous 24 heures, la cagnotte, les contestations). Les lots C4 et C5 y ajouteront les cadeaux.

## Ce qu'il sait faire

| Route | Rôle |
|---|---|
| `POST /api/sms/demande` `{ numero, langue? }` | Envoie un code à 6 chiffres, valable 10 minutes. |
| `POST /api/sms/verifie` `{ numero, code, prenom, client? }` | Connecte la personne et crée le compte s'il est nouveau. Un nouveau compte exige un prénom : sans lui, la réponse est `prenom_requis` et le code reste valable. Le site reçoit un cookie `belai_session` (30 jours). Belai Bureau (`client: "bureau"`) reçoit un jeton porteur valable un an. |
| `POST /api/mail/demande` `{ adresse, langue? }` | La même chose par e-mail : un code à 6 chiffres, valable 10 minutes, envoyé à l'adresse. |
| `POST /api/mail/verifie` `{ adresse, code, prenom, client? }` | Comme `/api/sms/verifie`. Une adresse et un numéro font deux comptes distincts. |
| `GET /api/moi` | Le compte (prénom, cagnotte) et ses bouquets : leur fanaison, et jusqu'à quand chacun peut être échangé. |
| `POST /api/moi` `{ prenom }` | Change le prénom. |
| `DELETE /api/moi` | Supprime le compte. Il est anonymisé 30 jours plus tard, et se reconnecter avant annule la suppression. |
| `POST /api/deconnexion` | Ferme la session. |
| `GET /api/collection?mois=AAAA-MM&produits=a,b` | Les exemplaires restants de chaque bouquet (public). |
| `POST /api/achat` `{ produit, renonce, texte, langue, retour }` | Lot C3. Réserve un exemplaire 31 minutes, garde le renoncement daté et renvoie l'adresse de paiement : Stripe Checkout, ou la page simulée. |
| `GET /api/commande/<id>` | La commande de l'acheteur : son état, et une fois payée son bouquet avec son numéro dans la série et sa facture. |
| `POST /api/echange` `{ bouquet, produit }` | Lot C9. L'échange sous 24 heures : une fois, pour un bouquet jamais offert, contre un bouquet du jour disponible et pas plus cher. La différence va dans la cagnotte. Un avoir et une facture sont émis. |
| `GET /api/factures` | Les factures et avoirs du compte. |
| `GET /api/facture/<numéro>` | Une facture ou un avoir, en page à imprimer ou à enregistrer en PDF. |
| `POST /api/stripe/webhook` | Les événements de Stripe, signature vérifiée (`checkout.session.completed`, `expired`, `charge.dispute.created`, `charge.dispute.closed`). Un même événement rejoué ne livre qu'une fois. |
| `GET` et `POST /api/faux-stripe/<id>` | La page de paiement simulée (`PAIEMENT = "faux"`, jamais en ligne). |
| `POST /api/message` `{ texte, contact, page?, langue? }` | « Nous écrire » : un message du site, avec une adresse e-mail ou un numéro pour y répondre. |

Chaque jour à 3 h 17 (UTC), une tâche fait le ménage : codes et sessions expirés, compteurs, comptes supprimés depuis
30 jours, et cagnotte rendue aux commandes jamais payées.

## Le compte par e-mail

Le compte est obligatoire pour acheter, validé par e-mail ou par téléphone (porteur, 2026-11-02). La personne qui reçoit un
cadeau n'en a pas besoin. Le code par e-mail suit les mêmes règles que le code par SMS : un par minute, cinq par heure et dix
par jour pour une adresse, dix par heure pour une adresse IP, et `COURRIEL_JOUR` par jour pour toute la boutique (300 par
défaut). L'adresse est gardée chiffrée, comme le numéro, et le compte note son canal (`comptes.canal`).

En local, `COURRIEL_CODES = "faux"` écrit le code dans la console. En ligne, il part par Cloudflare (`COURRIEL_CODES =
"cloudflare"`, la liaison `CODES` et l'expéditeur `EXPEDITEUR_CODES`). **Reste à régler** : le routage d'e-mails de
Cloudflare n'écrit qu'aux adresses vérifiées chez lui. Pour écrire à n'importe quel visiteur, le domaine doit activer
l'envoi d'e-mails de Cloudflare (Email Sending). Sans cela, il faut un autre service de courrier, ce que le porteur a
écarté le 1er novembre.

## Factures, échange, cagnotte, contestations (lot C9)

- **Factures.** Chaque achat payé reçoit une facture `F-000001`, et chaque échange un avoir `A-…` pour le bouquet rendu,
  suivi d'une facture pour le nouveau. Factures et avoirs suivent une seule numérotation, sans trou. Ce qu'une facture
  dit est figé à son émission : vendeur (`VENDEUR` dans `wrangler.toml`), prénom, numéro masqué, bouquet, montants.
- **Cagnotte.** Elle est prise sur le prix dès la commande, et rendue si la commande n'est pas payée. Une commande que
  la cagnotte couvre entièrement est livrée tout de suite, sans page de paiement.
- **Exemplaires.** Un exemplaire rendu par un échange revient en vente, et son numéro est repris par l'acheteur suivant.
- **Contestation bancaire.** On y répond depuis le tableau de bord Stripe, avec les preuves que donne
  `GET /api/commande/<id>` : la renonciation datée et la livraison. Perdue, elle retire le bouquet (et celui reçu en
  échange) ainsi que la cagnotte laissée par cet échange.
- **Jours rendus après un défaut** (CGV, article 10). Le porteur repousse la fanaison d'un bouquet de N jours :

```bash
npx wrangler d1 execute belai --remote --command "UPDATE bouquets SET fin = COALESCE(fin, achat + 2592000000) + N * 86400000 WHERE id = '<bouquet>'"
```

## Les messages (« Nous écrire »)

La fenêtre « Nous écrire » du site envoie le message ici, avec l'adresse e-mail ou le numéro où répondre, la page d'où il
part et la langue du visiteur. Le message est gardé dans la base, et le porteur le reçoit aussitôt par e-mail, envoyé par
Cloudflare lui-même (porteur, 2026-11-01 : aucun autre service de courrier). Quand le visiteur a laissé une adresse, le
bouton « Répondre » de la boîte lui répond directement. Si l'e-mail ne part pas, le message reste dans la base.

Pour allumer l'e-mail, une fois le domaine de la boutique sur Cloudflare :

1. Dans le tableau de bord, *Email* → *Email Routing* : activer le routage pour le domaine, et ajouter puis vérifier
   l'adresse de destination (`lonjaret.hadrien@proton.me`).
2. Dans `wrangler.toml` : mettre une adresse du domaine dans `EXPEDITEUR_MESSAGES` (par exemple `messages@<domaine>`), et
   décommenter le bloc `[[send_email]]`.
3. Publier le serveur (`npx wrangler deploy`).

Pour relire les messages dans la base, et marquer comme lu ce qui est traité :

```bash
npx wrangler d1 execute belai --remote --command "SELECT datetime(cree / 1000, 'unixepoch') AS quand, genre, contact, langue, page, texte FROM messages WHERE lu IS NULL ORDER BY cree"
npx wrangler d1 execute belai --remote --command "UPDATE messages SET lu = unixepoch() * 1000 WHERE id = '<id>'"
```

Limites : trois messages par heure et dix par jour pour une adresse IP, `MESSAGES_JOUR` par jour pour toute la boutique
(200 par défaut). Un champ caché aux personnes, rempli par les robots, fait jeter le message sans le dire.

## Le guichet (l'abeille passe la main)

L'abeille du site répond seule à ce que son petit réseau reconnaît (`public/squelette/abeille-modele.json`, aucun modèle de
langage, porteur 2026-11-02). Pour le reste, elle ouvre un fil au guichet : la question, les derniers échanges, la page et
la langue arrivent ici, et la personne de l'atelier qui tient le panneau `public/squelette/guichet.html` répond en direct.
Le visiteur relit les réponses toutes les quatre secondes ; le panneau, toutes les trois.

Le panneau s'ouvre avec un secret, jamais dans le dépôt :

```bash
npx wrangler d1 migrations apply belai --remote
npx wrangler secret put GUICHET_JETON
```

(32 caractères aléatoires au moins, par exemple `openssl rand -base64 32`), puis on le colle une fois dans le panneau, qui
le garde dans ce navigateur. Le visiteur, lui, ne tient que le jeton de son propre fil, gardé ici en empreinte SHA-256.

Limites : quatre fils par heure et douze par jour pour une adresse IP, quarante messages par heure dans un fil,
`GUICHET_JOUR` fils par jour pour toute la boutique (300 par défaut). Sans réponse au bout de deux minutes, l'abeille
donne les heures de l'atelier et demande au visiteur une adresse ou un numéro.

## Protections

- **Le numéro** n'est jamais stocké en clair. Il est chiffré en AES-GCM avec `CLE_NUMEROS`, et une empreinte HMAC calculée
  avec `POIVRE` sert à retrouver le compte. Il n'est relu que pour envoyer un SMS.
- **Les codes et les jetons** ne sont gardés que sous forme d'empreinte SHA-256, et comparés en temps constant.
- **Les limites** (comptées et lues en une seule requête SQL : des requêtes envoyées toutes à la fois ne passent pas
  dessous ensemble) :
  - un SMS par minute, cinq par heure et dix par jour pour un numéro ;
  - dix par heure pour une adresse IP (gardée en empreinte avec `POIVRE`) ;
  - `SMS_JOUR` SMS par jour pour toute la boutique (300 par défaut) ;
  - cinq essais faux par code, puis le code est détruit ; quinze codes faux par jour pour un numéro, puis plus aucun
    code jusqu'au lendemain.
- **Les pays desservis** : un SMS ne part que vers les indicatifs de `INDICATIFS_SMS` (par défaut 33, 32, 41, 352, 49,
  34, 39, 44 et 1), et dans la zone +1 vers les États-Unis et le Canada seulement : les numéros des Caraïbes qui la
  partagent sont la cible favorite du SMS pumping.
- **Les modes simulés** : `SMS = "faux"` et `PAIEMENT = "faux"` ne marchent que sur la machine du développeur
  (`localhost`, `127.0.0.1`, `*.test`). En ligne, ces réglages, comme un réglage absent, renvoient une erreur de
  configuration : un oubli dans `wrangler.toml` ne peut ni écrire les codes dans les journaux, ni donner des bouquets.
- **Le CORS** n'est ouvert, avec cookie, qu'aux pages listées dans `ORIGINES`.
- **Le cookie** est `HttpOnly; Secure; SameSite=Lax`. En ligne, le site et ce serveur doivent donc être sur le même
  domaine (par exemple `belai.garden` et `belai.garden/api` sur Cloudflare), sinon les navigateurs refusent le cookie.

## En local, sans aucun compte

```bash
cd api
npm install
npm test
npm run dev
```

- `npm test` lance les tests avec le SQLite de Node, sans Wrangler.
- `npm run dev` lance Wrangler sur le port 8790, avec une base D1 locale.
- Les SMS sont « faux » : le code s'écrit dans la console de Wrangler.
- Les secrets locaux sont dans `api/.dev.vars`, ignoré par git. Pour les créer :

```bash
node -e "const c=require('crypto');console.log('POIVRE='+c.randomBytes(32).toString('base64url')+'\nCLE_NUMEROS='+c.randomBytes(32).toString('base64url'))"
```

## L'achat (lot C3)

- **Le prix** vient du `boutique.json` du site (`CATALOGUE`), jamais de la page de l'acheteur.
- **La réservation.** Un exemplaire est tenu tant que la page de paiement est ouverte. Le dernier exemplaire ne peut être
  tenu que par une personne : la réservation se fait en une seule requête, qui compte les ventes et les réservations en
  cours.
- **La livraison.** Une fois le paiement confirmé, le bouquet est ajouté au compte avec son numéro dans la série (n° 1,
  2…), et la commande garde la référence du paiement.
- **Sur le site**, le bouton Acheter fait suivre ces étapes :
  1. le renoncement au droit de rétractation ;
  2. la connexion par SMS, si la personne n'est pas connectée, dans la même feuille ;
  3. la page de paiement ;
  4. au retour, le gros plan s'ouvre avec « Votre bouquet est à vous : exemplaire n° 1 sur 100 » et le reçu à télécharger.

  Ce parcours ne s'active que si le site connaît l'adresse du serveur : `api` dans `boutique.json`, ou `?api=` dans
  l'adresse pour les essais. Sans elle, Acheter répond toujours « bientôt ».
- **En local** : ouvrir `http://localhost:8851/squelette/`. Le code SMS s'écrit dans la
  console de Wrangler, et la page de paiement simulée propose Payer et Annuler.

## Mise en ligne (une fois les comptes du porteur créés)

1. Dans Cloudflare : `npx wrangler login`, puis `npx wrangler d1 create belai`. Recopier son `database_id` dans
   `wrangler.toml`.
2. Créer les tables : `npx wrangler d1 migrations apply belai --remote`.
3. Mettre les secrets, jamais dans le dépôt : `npx wrangler secret put POIVRE`, puis `CLE_NUMEROS` (32 octets aléatoires
   en base64url chacun). **Ne jamais changer `CLE_NUMEROS` ni `POIVRE` une fois des comptes créés** : les numéros
   deviendraient illisibles et les comptes introuvables.
4. Chez OVHcloud SMS : créer une application d'API sur eu.api.ovh.com/createToken avec le droit `POST /sms/*/jobs`, et
   faire valider l'expéditeur « Belai ». Ensuite :
   - `wrangler secret put` pour `OVH_APP_KEY`, `OVH_APP_SECRET`, `OVH_CONSUMER_KEY`, `OVH_SERVICE` (le nom du compte SMS)
     et `OVH_EXPEDITEUR` ;
   - passer `SMS = "ovh"` dans `wrangler.toml`.
5. Chez Stripe :
   - en mode test, mettre la clé `sk_test_...` avec `wrangler secret put STRIPE_SECRET` ;
   - créer un point de terminaison de webhook vers `https://<domaine>/api/stripe/webhook`, avec les événements
     `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`,
     `charge.dispute.created` et `charge.dispute.closed` ;
   - mettre son secret `whsec_...` avec `wrangler secret put STRIPE_WEBHOOK_SECRET` ;
   - passer `PAIEMENT = "stripe"`.
6. Mettre dans `ORIGINES` l'adresse du site, et dans `CATALOGUE` celle de son `boutique.json`, puis `npx wrangler deploy`.
   Mettre enfin l'adresse du serveur dans `api` de `boutique.json` : le bouton Acheter s'ouvre alors en ligne.

L'envoi par OVH est écrit d'après sa documentation (signature `$1$` en SHA-1), mais il n'a pas encore été essayé : il le
sera avec le compte du porteur.
