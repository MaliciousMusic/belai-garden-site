# Bzzou, la conversation

Bzzou répond seule, sans aucun modèle de langage, à tout ce que son petit réseau reconnaît, et elle conseille fleurs et
bouquets (`public/squelette/abeille.mjs`). Quand elle hésite, elle demande à un petit modèle de langage qui tourne chez
l'atelier : d'abord sur le PC du porteur, plus tard sur son serveur. Rien n'est payé au message.

- `serveur.mjs` : le relais entre la page et le modèle. Il donne au modèle les règles de la boutique (`consignes.md`) et
  les seuls faits utiles à la question (les réponses de Bzzou, `abeille-savoir.mjs`). Il refuse une réponse qui enfreint
  le vocabulaire de la boutique ou qui contient un lien, limite chaque adresse IP à 20 questions par 10 minutes et répond
  à une question à la fois.
- `consignes.md` : les règles du modèle, en français, à retoucher librement (relancer le relais ensuite).
- `journal/` : les échanges sans nom ni adresse, un fichier par jour, jamais versionnés (porteur, 2 novembre : « tous les
  échanges sans nom sont gardés afin d'affiner Bzzou »).

Ne passent jamais par le modèle :
- une commande, un paiement, un lien perdu, un deuil : une personne de l'atelier ;
- les blagues évidentes et ce que Bzzou sait déjà.

Derrière Cloudflare Tunnel, lancer le relais avec `BZZOU_CLOUDFLARE=1`, pour que la limite par adresse lise la vraie adresse.
`BZZOU_PAR_HEURE` (120) plafonne les questions de tous les visiteurs, et `BZZOU_JOURS` (395) est la durée de conservation du journal,
d'où les adresses et les numéros écrits dans une question sont retirés.

Si le modèle ne répond pas (relais éteint, PC éteint), Bzzou fait comme avant : elle propose ses pistes, puis une
personne.

## Sur le PC du porteur

1. Installer Ollama, le logiciel qui fait tourner le modèle (gratuit, ollama.com) :

   ```
   winget install Ollama.Ollama
   ```

2. Télécharger le modèle, une fois (Qwen 2.5, multilingue ; environ 1 Go, 1,5 Go de mémoire quand il répond) :

   ```
   ollama pull qwen2.5:1.5b
   ```

   Le modèle `qwen2.5:3b` répond mieux, mais il demande environ 3 Go de mémoire : à réserver à une machine qui les a.
3. Lancer le relais depuis la racine du dépôt :

   ```
   node bzzou/serveur.mjs
   ```

   Avec un autre modèle : `BZZOU_MODELE=qwen2.5:3b node bzzou/serveur.mjs`.
4. Ouvrir la boutique en local (`http://localhost:8851/squelette/`) : Bzzou s'en sert d'elle-même quand elle hésite. Pour
   vérifier que le relais tourne : `http://127.0.0.1:8792/bzzou/etat`.

Le modèle se décharge de la mémoire dix minutes après la dernière question. Le relais n'écoute que sur la machine elle-même
(127.0.0.1) : depuis Internet, personne ne l'atteint.

## Plus tard, sur le serveur

Ce sont les mêmes pièces :
1. Installer Ollama et tirer le modèle. Une machine de 4 cœurs et 8 Go de mémoire suffit pour `qwen2.5:3b`. Avec une
   carte graphique, les réponses sont bien plus rapides.
2. Lancer le relais comme un service (systemd, pm2…), avec la page de la boutique comme seule origine admise :

   ```
   BZZOU_ORIGINES=https://<domaine de la boutique> BZZOU_MODELE=qwen2.5:3b node bzzou/serveur.mjs
   ```

3. Faire passer l'adresse `/bzzou` du site vers `http://127.0.0.1:8792/bzzou` (proxy du serveur web, ou Cloudflare Tunnel
   si la boutique reste sur Cloudflare). La page appelle `/bzzou` dès qu'elle n'est plus en local. Derrière Cloudflare, le
   relais lit l'adresse du visiteur dans `cf-connecting-ip` pour ses limites.
