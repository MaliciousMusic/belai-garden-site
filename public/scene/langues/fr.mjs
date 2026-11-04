// The site's words in French: the source of the other languages (fr, es, zh, de have the same keys). build.mjs writes
// the pages from gabarits/ with them; the runtime strings (js) go into each page as a JSON block read by entete.js and
// boutique.js. In the HTML strings: {{p}} is the page's language prefix ('' or 'fr/'...), {{legal}} the legal page with
// that prefix; in the runtime strings, {name} and the like are filled in by the scripts. Product names stay as they are.
export default {
  code: 'fr',
  name: 'Français',
  locale: 'fr-FR',
  ogLocale: 'fr_FR',
  // a list of words as the language writes it: "a, b et c"
  list: (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}`),
  more: 'autres',
  describe: ({ stems, flowers, vase }) =>
    `Un bouquet numérique unique de ${stems} tiges dessinées à la main (${flowers}) dans ${vase}. Il vit trente jours, puis reste fané pour de bon.`,

  pages: {
    index: {
      title: "Bouquet de fleurs numérique, dessiné tige à tige | Belai's Garden",
      description: 'Bouquets de fleurs numériques dessinés tige à tige d’après de vraies fleurs. Une collection par mois, à offrir et à poser sur votre écran.',
      ogTitle: 'Bouquets de fleurs numériques, dessinés tige à tige',
      ogDescription: 'Chaque mois, une collection de bouquets, chacun dans un vrai vase. Regardez-les fleurir, offrez-en un, posez-le sur votre écran.',
    },
    about: {
      title: "À propos : bouquets numériques d’après nature | Belai's Garden",
      description: 'Comment naissent nos bouquets numériques : des fleurs dessinées en code d’après de vraies photos, de vrais vases, le prix des tiges, trente jours de vie.',
      ogTitle: 'À propos de nos bouquets numériques',
      ogDescription: 'Chaque fleur dessinée en code d’après de vraies photos. Des bouquets uniques, dans de vrais vases, qui fleurissent puis fanent.',
    },
    desktop: {
      title: 'Widget bouquet de fleurs pour le bureau Windows | Belai Bureau',
      description: 'Belai Bureau, widget gratuit pour Windows 10 et 11 : posez sur votre bureau le bouquet de fleurs numérique que vous avez collectionné. Placez, ajustez, fixez.',
      ogTitle: 'Votre bouquet de fleurs sur votre bureau',
      ogDescription: 'Un widget Windows gratuit pour votre bouquet numérique : placez-le, ajustez sa taille, fixez-le.',
    },
    legal: {
      title: "Mentions légales, CGV et confidentialité | Belai's Garden",
      description: "Mentions légales, conditions générales de vente des bouquets numériques, politique de confidentialité, licence Belai Bureau et accessibilité de Belai's Garden.",
      ogTitle: 'Mentions légales, CGV et confidentialité',
      ogDescription: 'Qui nous sommes, comment un bouquet est vendu, ce que nous faisons des données.',
    },
  },
  shareAlt: 'Le bouquet Ronde bleue : lilas, iris, anémones et jacinthes dans un vase en verre dépoli aux danseuses',
  orgDescription: 'Des bouquets de fleurs numériques dessinés tige à tige d’après de vraies fleurs, à offrir et à poser sur votre écran.',
  listName: 'Bouquets du jour',

  // ---------- the shop page
  index: {
    h1: "Belai's Garden : des bouquets de fleurs numériques vivants",
    intro:
      'Des bouquets de fleurs numériques dessinés tige à tige d’après de vraies fleurs. Chaque mois, une nouvelle collection de bouquets, chacun dans un vrai vase. Un bouquet vit trente jours, puis reste fané pour toujours. Offrez-le, ou posez-le sur votre écran avec Belai Bureau.',
    noscript:
      'Ce jardin a besoin de JavaScript pour faire fleurir les bouquets. Lisez <a href="{{p}}about.html">la présentation des bouquets</a>, découvrez <a href="{{p}}desktop.html">comment en poser un sur votre bureau</a>, ou consultez les <a href="{{legal}}">mentions légales et conditions de vente</a>.',
    galleryLabel: 'Bouquets du jour',
    lookCloser: 'Regarder le bouquet de plus près',
    shelvesLabel: 'Étagères',
    budVases: 'Les soliflores arrivent bientôt : une seule fleur dans son vase.',
    noneCollected: 'Aucun bouquet n’a encore trouvé son collectionneur.',
    seeOpenSea: 'Voir la collection sur OpenSea',
    onDesktop: "Essayer sur votre bureau",
    buy: 'Acheter',
    // the purchase sheet: the express waiver of the right of withdrawal (French Consumer Code L221-28, 13°)
    sheetTitle: 'Avant de payer',
    waiver: 'Je demande que mon bouquet me soit livré immédiatement, et je reconnais perdre ainsi mon droit de rétractation de 14 jours.',
    accept: 'En payant, vous confirmez être majeur et accepter les <a href="{{legal}}#terms">conditions générales de vente</a>.',
    confirm: 'Confirmer et payer',
    cancel: 'Annuler',
    signInTitle: 'Votre compte, par SMS',
    phone: 'Numéro de mobile',
    sendCode: 'Recevoir le code',
    code: 'Code reçu',
    firstName: 'Prénom',
    giftsTitle: 'Mes cadeaux',
    giftsHelp: 'Saisissez le prénom de la personne qui vous offre un bouquet, et le code qu’elle vous a transmis.',
    giftSender: 'Son prénom',
    giftCode: 'Code',
    giftOpen: 'Ouvrir le cadeau',
    accountTitle: 'Mon compte',
    accountHelp: 'Votre prénom et votre numéro de mobile : un code vous est envoyé par SMS.',
    invoices: 'Factures',
    tabProfile: 'Profil',
    tabHelp: 'SAV',
    noInvoice: 'Aucune facture pour l’instant.',
    invoicePrint: 'Imprimer ou PDF',
    invoiceClose: 'Fermer la facture',
    helpExchangeTitle: 'Échange sous 24 heures.',
    helpExchange: 'Une fois, pour un bouquet acheté et jamais offert, contre un bouquet du jour pas plus cher, depuis l’onglet Profil. La différence va dans votre cagnotte.',
    helpDefectTitle: 'Un souci avec un bouquet ?',
    helpDefect: 'S’il ne s’affiche pas ou ne fonctionne pas, écrivez-nous : nous le réparons, et il regagne les jours perdus.',
    helpWrite: 'Écrire au service client',
    helpTerms: 'Conditions générales de vente',
    signIn: 'Se connecter',
    signOut: 'Se déconnecter',
  },

  // ---------- the About page
  about: {
    h1: 'À propos',
    lead: 'Des bouquets dessinés fleur par fleur, qui s’épanouissent sous vos yeux.',
    body: `<h2>Des fleurs dessinées d’après nature</h2>
  <p>Chaque fleur de ce jardin est dessinée en code, trait par trait, d’après de vraies photos : la forme des pétales, leurs
    couleurs mesurées sur chaque variété, les boutons, la fleur ouverte et la fleur fanée. Plus de cinq cents espèces
    poussent déjà dans le jardin.</p>

  <h2>Des bouquets composés tige à tige</h2>
  <p>Chaque bouquet est composé tige à tige, chacun dans un vrai vase, comme la carpe en bronze. La place de chaque tige, de chaque fleur et de chaque feuille ne se retrouve dans aucun autre bouquet.</p>

  <h2>Un bouquet vivant</h2>
  <p>Un bouquet vit trente jours à compter de son achat : un compte à rebours, en heures et en minutes, indique le temps qu’il lui reste. Il reste ensuite fané et immobile, pour de bon.</p>

  <h2>Le prix des vraies tiges</h2>
  <p>Le prix d’un bouquet est la somme de ce que coûtent ses tiges chez un fleuriste en France. Le vase est offert. Vous le réglez par carte bancaire.</p>

  <h2>Une collection par mois</h2>
  <p>Chaque mois a sa collection, et le bouquet que vous achetez est exactement celui que vous voyez.</p>

  <h2>Offrir un bouquet</h2>
  <p>À l’achat, vous pouvez offrir le bouquet : un court message porté par les insectes, une musique, et un code à transmettre. La personne à qui vous l’offrez le reçoit dans « Mes cadeaux » avec votre prénom et ce code.</p>

  <h2>Sur votre bureau</h2>
  <p>Avec <a href="{{p}}index.html?bureau">Belai Bureau</a>, un widget gratuit pour Windows, le bouquet que vous avez collectionné
    trône sur le bureau de votre ordinateur, à la taille de votre choix, devant ou derrière vos fenêtres.</p>

  <h2>Faire grandir le jardin</h2>
  <p>Chaque bouquet collectionné aide le jardin à grandir : de nouvelles espèces, de nouveaux vases, de nouveaux bouquets.</p>`,
    faqTitle: 'Questions',
    faq: [
      ['Qu’est-ce qu’un bouquet numérique ?', 'Un bouquet de fleurs dessiné en graphisme vectoriel d’après de vraies photos, tige à tige, dans un vrai vase. Il fleurit à l’écran, se balance dans la brise et fane au bout de trente jours.'],
      ['Puis-je mettre un bouquet de fleurs sur mon écran ?', 'Oui. Téléchargez Belai Bureau (gratuit), connectez-vous une fois avec votre numéro de téléphone et le code reçu par SMS : les bouquets de votre compte se posent sur votre écran, vous les placez, ajustez leur taille et les fixez.'],
      ['Comment le prix d’un bouquet est-il fixé ?', 'À la somme de ce que coûteraient ses tiges chez un fleuriste en France. Le vase est offert. Le prix est affiché en euros (en dollars américains hors de la zone euro) et se règle par carte bancaire.'],
      ['Que se passe-t-il au bout de trente jours ?', 'Le bouquet fane et reste fané, immobile, pour de bon. Il reste à vous.'],
      ['Comment offrir un bouquet ?', 'Au moment de l’achat, choisissez de l’offrir : écrivez un court message, choisissez une musique et les insectes qui le porteront. Vous recevez un lien et un code ; la personne les saisit dans « Mes cadeaux » avec votre prénom, et le bouquet passe sur son compte.'],
    ],
    back: '← Retour aux bouquets',
  },

  // ---------- the desktop page
  desktop: {
    h1: 'Votre bouquet sur votre bureau',
    lead: 'Posez le bouquet que vous avez collectionné sur le bureau de votre ordinateur, avec Belai Bureau, un widget gratuit pour Windows.',
    videoLabel: 'Vidéo explicative : poser votre bouquet sur votre bureau, pas à pas (musique seule ; les étapes sont écrites à côté)',
    stepsTitle: 'En cinq étapes',
    steps: [
      'Téléchargez et installez Belai Bureau.',
      'Liez votre portefeuille depuis l’icône Belai, à côté de l’horloge.',
      'Choisissez votre bouquet et affichez-le à l’écran : une signature, gratuite, sans transaction.',
      'Placez-le, ajustez sa taille, mettez-le devant ou derrière vos fenêtres, puis fixez-le avec ✓.',
      'Pour le déplacer à nouveau, maintenez le clic sur le bouquet pendant six secondes.',
    ],
    download: 'Télécharger Belai Bureau',
    downloadSmall: 'Windows 10 et 11 · 3 Mo · gratuit',
    winSmall: '10 et 11 · 3 Mo · gratuit',
    soon: 'Bientôt',
    note: 'Seul le portefeuille qui détient un bouquet peut l’afficher. Au premier lancement, Windows peut signaler qu’il ne connaît pas encore l’application : « Informations complémentaires », puis « Exécuter quand même ».',
    appLanguage: '',
    fingerprint: 'Version {v} · SHA-256',
    licence: 'Licence et confidentialité',
    back: '← Retour aux bouquets',
    appDescription: 'Un widget de bureau gratuit pour Windows qui affiche sur votre bureau le bouquet de fleurs numérique que vous avez collectionné : placez-le, ajustez sa taille, fixez-le, devant ou derrière vos fenêtres.',
    videoName: 'Comment poser votre bouquet sur votre bureau',
    videoDescription: 'Une minute pour tout comprendre : téléchargez Belai Bureau, liez votre portefeuille, affichez votre bouquet, placez-le, ajustez sa taille et fixez-le, maintenez six secondes pour le déplacer.',
    howToName: 'Comment poser un bouquet de fleurs numérique sur votre bureau Windows',
    howToTools: ['Belai Bureau (gratuit, Windows 10 et 11)', 'Un portefeuille qui détient un bouquet'],
  },

  // ---------- the legal page
  legal: {
    h1: 'Mentions légales',
    updated: 'Dernière mise à jour : 27 octobre 2026',
    onThisPage: 'Sur cette page',
    toc: { notice: 'Mentions légales', terms: 'Conditions générales de vente', privacy: 'Politique de confidentialité', app: 'Licence de Belai Bureau', ip: 'Propriété intellectuelle', accessibility: 'Accessibilité', contact: 'Contact' },
    reference: '',
    body: `<section id="notice" aria-labelledby="t-notice">
    <h2 id="t-notice">Mentions légales</h2>
    <h3>Éditeur</h3>
    <p>Hadrien Lonjaret, entrepreneur individuel, exerçant sous le nom commercial Agent 33<br>
      35 cours Sablon, 63000 Clermont-Ferrand, France<br>
      Courriel : <a href="mailto:lonjaret.hadrien@proton.me">lonjaret.hadrien@proton.me</a> · Téléphone : +33 6 18 55 81 22<br>
      SIREN 853 801 488 · RCS Clermont-Ferrand · N° de TVA intracommunautaire FR69853801488</p>
    <h3>Directeur de la publication</h3>
    <p>Hadrien Lonjaret</p>
    <h3>Hébergeur</h3>
    <p>GitHub, Inc. (GitHub Pages), 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis · github.com.
      Le serveur des comptes et des cadeaux est hébergé par Cloudflare, Inc., 101 Townsend Street, San Francisco,
      CA 94107, États-Unis · cloudflare.com</p>
  </section>

  <section id="terms" aria-labelledby="t-terms">
    <h2 id="t-terms">Conditions générales de vente</h2>

    <h3>1. Parties et champ d’application</h3>
    <p>Les présentes conditions générales de vente s’appliquent à tout bouquet vendu sur ce site par l’éditeur désigné
      dans les mentions légales (« nous ») à toute personne majeure (« vous »). Le paiement d’un bouquet emporte
      acceptation des présentes conditions, dans leur version en vigueur au jour de l’achat. Elles existent en plusieurs
      langues ; la version française prévaut.</p>

    <h3>2. Objet : le bouquet</h3>
    <p>Un bouquet est une œuvre numérique : des fleurs dessinées en graphisme vectoriel, dans un vase, animées à l’écran.
      Chaque bouquet appartient à la collection d’un mois. Le bouquet que vous achetez est exactement celui que vous
      voyez, sans variation. Sa page indique, avant l’achat, son nom, son vase, sa collection et son prix.</p>
    <p>Un bouquet vit trente jours à compter de son achat : il fleurit et se balance, et un compte à rebours indique le
      temps restant. Il fane ensuite et demeure définitivement fané et immobile. Cette évolution fait partie de l’œuvre
      et ne constitue pas un défaut.</p>
    <p>Un bouquet ne confère aucun droit à un revenu ni à une quelconque part, et ne se revend pas sur ce site.</p>

    <h3>3. Votre compte</h3>
    <p>Pour acheter ou recevoir un bouquet, vous créez un compte avec votre prénom et votre numéro de téléphone mobile,
      vérifié par un code envoyé par SMS. Vos bouquets, vos factures et votre cagnotte (article 11) sont attachés à ce
      compte. Vous êtes responsable de l’accès à votre numéro : prévenez-nous si vous en changez. Si vous supprimez votre
      compte, vos bouquets et votre cagnotte disparaissent avec lui.</p>

    <h3>4. Ce que vous obtenez</h3>
    <p>L’achat vous donne le droit personnel et non exclusif de regarder le bouquet sur ce site et de l’afficher sur vos
      écrans avec Belai Bureau, pour un usage privé. Ce droit ne se cède qu’en offrant le bouquet (article 8). Comme pour
      un tableau, l’achat n’emporte pas cession des droits d’auteur sur le dessin : la fabrication et la vente de copies
      ou de produits dérivés, comme tout usage commercial, n’y sont pas comprises.</p>

    <h3>5. Prix</h3>
    <p>Le prix est fixé en euros, sans TVA (TVA non applicable, art. 293 B du CGI), et affiché sur le bouquet avant
      l’achat ; il est la somme de ce que coûtent ses tiges chez un fleuriste en France, le vase étant offert. Hors de la
      zone euro, le montant indiqué en dollars américains est donné à titre indicatif : le paiement est effectué en
      euros, et votre banque peut y ajouter des frais de change.</p>

    <h3>6. Commande et paiement</h3>
    <p>Vous payez par carte bancaire, ou par Apple Pay ou Google Pay, sur la page de paiement de notre prestataire Stripe
      (Stripe Payments Europe, Ltd., Dublin, Irlande). Nous ne voyons ni ne conservons les numéros de votre carte. Avant
      de payer, vous cochez une case pour demander la livraison immédiate (voir l’article 9). La validation du paiement
      vaut commande avec obligation de paiement.</p>

    <h3>7. Livraison et facture</h3>
    <p>Le bouquet est ajouté à votre compte dès que Stripe confirme le paiement. Un reçu vous est remis : il indique le
      bouquet, son prix, la date et votre demande de livraison immédiate. Une facture numérotée est disponible dans votre
      compte, à imprimer ou à enregistrer.</p>

    <h3>8. Offrir un bouquet</h3>
    <p>Lors de l’achat, vous pouvez offrir le bouquet et composer son arrivée : un court message porté par les insectes,
      une musique et les insectes qui le portent. Vous recevez un lien et un code, que vous transmettez vous-même à la
      personne de votre choix. Le code est valable jusqu’à la fanaison du bouquet, pour un seul usage ; après cinq essais
      erronés, la saisie est bloquée pendant une heure. Lorsque la personne saisit votre prénom et le code, le bouquet
      passe sur son compte et quitte le vôtre ; tant que le code n’a pas servi, le bouquet reste sur votre compte. Vous
      êtes responsable du contenu du message, qui ne doit enfreindre ni la loi ni les droits de quiconque.</p>

    <h3>9. Droit de rétractation</h3>
    <p>Si vous êtes un consommateur résidant dans l’Union européenne, vous disposez en principe d’un délai de 14 jours
      pour exercer votre droit de rétractation à la suite d’un achat à distance. Un bouquet est un contenu numérique
      non fourni sur un support matériel et livré immédiatement : avant de payer, vous demandez expressément sa
      livraison immédiate et reconnaissez renoncer ainsi à votre droit de rétractation (Code de la consommation,
      article L221-28, 13° ; Directive 2011/83/UE, article 16(m)).</p>

    <h3>10. Conformité</h3>
    <p>Si vous êtes un consommateur, vous bénéficiez de la garantie légale de conformité applicable aux contenus
      numériques (Code de la consommation, articles L224-25-1 et suivants). Si le bouquet ne vous est pas fourni, ou s’il
      ne s’affiche pas ou ne fonctionne pas comme décrit pendant ses trente jours, écrivez-nous : nous le mettons en
      conformité sans frais dans un délai raisonnable, et nous repoussons sa fanaison d’autant de jours qu’il a été
      indisponible. Si la mise en conformité est impossible, échoue ou n’intervient pas dans ce délai, ou si le défaut
      est grave, vous pouvez obtenir une réduction du prix ou la résolution du contrat et son remboursement, dans les
      conditions prévues par la loi.</p>
    <p>En dehors de ces cas et de l’échange prévu à l’article 11, aucun remboursement n’est accordé.</p>

    <h3>11. Échange sous 24 heures et cagnotte</h3>
    <p>À titre commercial, sans que cela constitue un droit de rétractation, vous pouvez échanger une fois un bouquet
      que vous avez acheté, dans les 24 heures qui suivent son achat, s’il n’a pas été offert. L’échange se fait depuis
      votre compte, contre un bouquet du jour encore disponible dont le prix est égal ou inférieur. Le nouveau bouquet vit
      trente jours à compter de l’échange ; le bouquet rendu quitte votre compte et revient en vente.</p>
    <p>Si le nouveau bouquet coûte moins cher, la différence est portée sur votre cagnotte : aucune somme ne vous est
      versée. La cagnotte est déduite automatiquement de vos achats suivants ; elle n’est ni remboursable ni cessible, et
      disparaît avec le compte. Un échange donne lieu à un avoir pour le bouquet rendu et à une facture pour le nouveau.</p>

    <h3>12. Contestation d’un paiement</h3>
    <p>Si vous contestez auprès de votre banque le paiement d’un bouquet qui vous a été livré, nous transmettons à Stripe
      les preuves de la commande, dont votre demande datée de livraison immédiate. Si la contestation aboutit en votre
      faveur, le bouquet est retiré, ou celui reçu en échange, y compris du compte de la personne à qui il a été offert,
      et la cagnotte issue de cet échange est annulée. Écrivez-nous d’abord : une difficulté se règle souvent plus vite
      ainsi.</p>

    <h3>13. Responsabilité</h3>
    <p>Le paiement est opéré par Stripe et les SMS sont envoyés par OVHcloud. Nous ne sommes pas responsables de leurs
      interruptions ni de leurs modifications. Aucune stipulation des présentes conditions ne limite les droits que les
      consommateurs tiennent de la loi.</p>

    <h3>14. Réclamations et médiation</h3>
    <p>Écrivez-nous d’abord (voir <a href="{{legal}}#contact">Contact</a>) ; nous répondons sous 30 jours. À défaut de
      solution, le consommateur peut soumettre gratuitement le litige à notre médiateur de la consommation :
      <span class="a-remplir">[nom, site internet et adresse postale du médiateur]</span>.</p>

    <h3>15. Droit applicable</h3>
    <p>Les présentes conditions sont soumises au droit français. Le consommateur conserve la protection que lui assurent
      les dispositions impératives du droit du pays où il réside, et peut porter un litige devant les juridictions de
      ce pays ou de la France.</p>
  </section>

  <section id="privacy" aria-labelledby="t-privacy">
    <h2 id="t-privacy">Politique de confidentialité</h2>
    <p>Le responsable du traitement est l’éditeur désigné dans les <a href="{{legal}}#notice">mentions légales</a>. Nous
      collectons le moins de données possible, et aucune pour vous profiler.</p>
    <h3>Données traitées, finalités et bases légales</h3>
    <ul>
      <li><strong>Données de connexion</strong> (adresse IP, navigateur, pages demandées) : conservées par nos hébergeurs
        dans leurs journaux techniques, pour fournir le site et le protéger contre les abus. Base légale : notre intérêt
        légitime à disposer d’un site fonctionnel et sécurisé.</li>
      <li><strong>Votre langue et votre pays</strong>, déduits sur votre appareil des réglages de langue de votre
        navigateur, pour afficher le site dans votre langue et le prix dans votre devise. Rien n’est envoyé ni conservé.</li>
      <li><strong>Votre compte</strong> : votre numéro de téléphone mobile, le prénom que vous choisissez et la date de
        création du compte, pour vous identifier et attacher vos bouquets à votre compte. Le numéro est conservé chiffré ;
        une empreinte de ce numéro sert à retrouver votre compte. Il n’est jamais montré à une autre personne. Base
        légale : le contrat.</li>
      <li><strong>Les codes envoyés par SMS</strong>, pour vérifier votre numéro : valables dix minutes, puis effacés.
        Base légale : le contrat.</li>
      <li><strong>Vos achats</strong> : le bouquet, son prix, la date, la référence et le statut du paiement transmis par
        Stripe, et votre demande de livraison immédiate. Base légale : le contrat et nos obligations comptables.</li>
      <li><strong>Vos cadeaux</strong> : le message, la musique et les insectes choisis, le prénom de l’expéditeur et
        l’état du cadeau ; le code n’est conservé que sous forme d’empreinte. La personne qui reçoit le bouquet voit le
        prénom et le message ; l’expéditeur voit seulement que le bouquet a été réclamé. Base légale : le contrat.</li>
    </ul>
    <h3>Paiement</h3>
    <p>Les données de votre carte sont saisies sur la page de Stripe et traitées par Stripe, selon sa propre politique de
      confidentialité. Nous recevons seulement la référence du paiement, son montant et son statut.</p>
    <h3>Cookies</h3>
    <p>Si vous choisissez vous-même une langue, le site la retient dans un cookie nommé <code>lang</code>, pendant un an.
      Lorsque vous êtes connecté à votre compte, un cookie de session vous garde connecté. Si vous activez le son, votre navigateur retient ce choix dans son stockage local (clé <code>son</code>), sans rien nous envoyer. C’est tout : aucune mesure
      d’audience, aucune publicité. Ces cookies sont nécessaires au service que vous demandez ; ils ne requièrent donc
      pas de bandeau de consentement.</p>
    <h3>Destinataires et lieux de traitement</h3>
    <p>GitHub, Inc. (hébergement du site, États-Unis), Cloudflare, Inc. (serveur des comptes et des cadeaux,
      États-Unis), Stripe (paiement, Irlande et États-Unis) et OVHcloud (envoi des SMS, France). Les transferts hors de
      l’Union européenne reposent sur le cadre de protection des données UE–États-Unis (Data Privacy Framework) et sur
      les clauses contractuelles types de la Commission européenne.</p>
    <h3>Durées de conservation</h3>
    <p>Journaux techniques des hébergeurs : de quelques jours à quelques semaines, selon leurs paramètres. Compte : tant
      que vous le gardez ; à sa suppression, il est effacé sous 30 jours. Cadeaux : tant que le bouquet est sur un compte.
      Achats : dix ans, durée de conservation des pièces comptables (Code de commerce, article L123-22). Courriels que
      vous nous adressez : le temps nécessaire pour y répondre, puis trois ans.</p>
    <h3>Vos droits</h3>
    <p>Vous pouvez demander l’accès à vos données, leur rectification ou leur effacement, la limitation de leur
      traitement, vous opposer à celui-ci et recevoir vos données dans un format portable, en nous écrivant (voir
      <a href="{{legal}}#contact">Contact</a>). Vous pouvez supprimer votre compte à tout moment. Vous pouvez également
      introduire une réclamation auprès de la Commission nationale de l’informatique et des libertés, la CNIL (cnil.fr).</p>
  </section>

  <section id="app" aria-labelledby="t-app">
    <h2 id="t-app">Licence de Belai Bureau</h2>
    <p>Belai Bureau est un logiciel gratuit pour Windows 10 et 11 qui affiche sur votre bureau les bouquets détenus par
      un portefeuille que vous y liez. Nous vous concédons une licence gratuite, personnelle et non exclusive pour
      l’installer et l’utiliser. Vous ne pouvez ni le vendre ni en distribuer des copies modifiées.</p>
    <p><strong>Ce que l’application fait des données :</strong> elle conserve sur votre ordinateur un code aléatoire
      propre à cet ordinateur, l’adresse du portefeuille que vous liez et vos réglages. Elle interroge le réseau Base
      (mainnet.base.org, exploité par Base) pour savoir quels bouquets détient votre portefeuille, et ouvre ce site dans
      votre navigateur lorsque vous liez un portefeuille. Elle ne nous envoie rien et ne mesure rien.</p>
    <p>L’application est fournie en l’état. La désinstaller (Paramètres de Windows, Applications) la supprime ainsi que
      ses réglages.</p>
  </section>

  <section id="ip" aria-labelledby="t-ip">
    <h2 id="t-ip">Propriété intellectuelle</h2>
    <p>Les fleurs, vases, bouquets, décors, textes, vidéo et code de ce site et de Belai Bureau sont des œuvres
      originales. Toute reproduction sans autorisation est interdite, sauf dans les limites prévues par les
      <a href="{{legal}}#terms">conditions générales de vente</a>. Stripe, OVHcloud, GitHub, Cloudflare et Base sont des
      noms appartenant à leurs titulaires respectifs.</p>
  </section>

  <section id="accessibility" aria-labelledby="t-accessibility">
    <h2 id="t-accessibility">Accessibilité</h2>
    <p>Nous visons le niveau AA des règles pour l’accessibilité des contenus web (WCAG) 2.1. Le site s’utilise au
      clavier (flèches pour changer de bouquet, Échap pour prendre du recul), chaque bouton porte un nom pour les
      lecteurs d’écran, et les animations s’arrêtent lorsque votre système demande à réduire les animations. Limites
      connues : la prairie et les bouquets sont des œuvres, décrites par des mots plutôt que dans le détail ; la vidéo
      explicative n’a pas de voix, et ses étapes sont écrites à côté. Si quelque chose vous bloque, écrivez-nous et
      nous vous aiderons.</p>
  </section>

  <section id="contact" aria-labelledby="t-contact">
    <h2 id="t-contact">Contact</h2>
    <p>Courriel : <a href="mailto:lonjaret.hadrien@proton.me">lonjaret.hadrien@proton.me</a> · Téléphone : +33 6 18 55 81 22 ·
      Courrier : Hadrien Lonjaret, 35 cours Sablon, 63000 Clermont-Ferrand, France</p>
  </section>`,
    back: '← Retour aux bouquets',
  },

  // ---------- the strings of the scripts (entete.js, boutique.js), with {placeholders}
  js: {
    menu: 'Menu',
    shelves: { bouquets: 'Bouquets du jour', soliflores: 'Soliflores', vendus: 'Bouquets collectionnés', cadeaux: 'Mes cadeaux', profil: 'Mon compte' },
    desktopTitle: 'Sur mon bureau',
    desktopLabel: 'Votre bouquet sur votre bureau',
    appTitle: 'Belai Bureau',
    appLabel: 'Télécharger Belai Bureau, l’app qui pose votre bouquet sur votre écran',
    soundOn: 'Activer le son de la nature',
    soundOff: 'Couper le son de la nature',
    openSeaTitle: 'Notre collection sur OpenSea',
    openSeaLabel: 'Notre collection sur OpenSea (nouvel onglet)',
    about: 'À propos',
    legal: 'Mentions légales',
    closeLegal: 'Fermer le panneau des mentions légales',
    footer:
      '<p>Chaque bouquet est un bouquet numérique, payé par carte bancaire, sans TVA (TVA non applicable, art. 293 B du CGI). Il vit trente jours à compter de son achat, puis reste fané pour de bon. La livraison est immédiate : le droit de rétractation ne s’applique donc plus une fois votre achat confirmé.</p><p>Aucun pistage, aucune publicité : un cookie au plus, pour retenir la langue que vous avez choisie.</p>',
    links: { notice: 'Mentions légales', terms: 'Conditions générales de vente', privacy: 'Confidentialité', app: 'Licence de Belai Bureau', accessibility: 'Accessibilité', contact: 'Contact' },
    credit: '',
    language: 'Langue',
    lookCloser: 'Regarder le bouquet de plus près',
    stepBack: 'Prendre du recul',
    planeLabel: '{name}, sur le pilier. {alt}',
    frameLabel: '{name}, environ {fiat}, {life}. {alt}',
    buyLabel: 'Acheter « {name} », environ {fiat}',
    lifeLeft: '{h} h {m} min',
    fadesIn: 'Fane dans {t}',
    fadesInLower: 'fane dans {t}',
    faded: 'Fané',
    fadedLower: 'fané',
    fadedForGood: 'Fané pour toujours',
    // the month's collection and the copies left, under the bouquet's name ({month}: the month in the page's language)
    series: 'Collection {month}',
    fadeReminder: '(Les bouquets fanent en {n} jours)',
    fadeShort: 'Fane en {n} jours',
    collectionEnds: 'Collection {month}, se termine {when}',
    collectionDone: 'Collection {month}, terminée',
    buy: 'Acheter',
    soon: 'Bientôt',
    soonMessage: 'L’achat depuis le site arrive bientôt.',
    tickFirst: 'Cochez d’abord la case : votre bouquet est livré immédiatement.',
    signInFirst: 'Connectez-vous d’abord : votre bouquet sera attaché à votre numéro.',
    codeSent: 'Code envoyé par SMS : saisissez-le, puis confirmez.',
    wrongNumber: 'Ce numéro ne semble pas valide.',
    wrongCode: 'Code incorrect : encore {n} essai(s).',
    tooMany: 'Trop de tentatives : réessayez dans quelques minutes.',
    codeExpired: 'Ce code a expiré : demandez-en un nouveau.',
    soldOut: 'Plus aucun exemplaire de ce bouquet n’est disponible.',
    payError: 'Le paiement n’a pas pu aboutir. Réessayez dans un instant.',
    redirecting: 'Vers la page de paiement…',
    paid: 'Votre bouquet est à vous : exemplaire n° {n}.',
    paymentPending: 'Paiement en cours de confirmation…',
    cancelled: 'Paiement annulé.',
    accountSoon: 'Votre compte arrive bientôt : vous vous connecterez avec votre numéro de mobile, et retrouverez ici vos bouquets.',
    accountSignIn: 'Connexion',
    hello: 'Bonjour {name}',
    firstNameNeeded: 'Indiquez votre prénom pour créer votre compte.',
    creditBalance: 'Cagnotte : {amount}, déduite de votre prochain achat.',
    exchangeUntil: 'Échanger (jusqu’à {t})',
    exchangeFor: 'Échanger contre',
    exchangeConfirm: 'Confirmer l’échange',
    exchangeDiff: 'La différence, {amount}, ira dans votre cagnotte.',
    exchangeSame: 'Même prix : rien ne va dans la cagnotte.',
    exchangeNone: 'Aucun bouquet du jour à ce prix ou moins n’est disponible.',
    exchangeDone: 'Échange fait : votre nouveau bouquet vit trente jours.',
    exchangeRefused: 'Cet échange n’est pas possible.',
    helpSubject: 'Service client Belai’s Garden',
    essai: {
      titre: "Essayer le bouquet sur votre bureau",
      fermer: "Fermer",
      annuler: "Pas maintenant",
      partager: "Choisissez <b>Tout l’écran</b>, puis <b>Partager</b> : je ne le regarde qu’une fois, et rien ne quitte votre ordinateur.",
      partagerEncore: "Pour poser ce bouquet sur votre propre bureau, partagez <b>tout l’écran</b> : je ne le regarde qu’une fois, et rien ne quitte votre ordinateur.",
      partagerBouton: "Partager mon écran",
      pasEcran: "C’est une fenêtre, pas votre écran. Choisissez <b>Tout l’écran</b>, s’il vous plaît.",
      reduire: "Maintenant, <b>réduisez</b> cette fenêtre une seconde (le <b>–</b> en haut), puis revenez : je prends votre bureau tel qu’il est.",
      reduireWin: "Maintenant, appuyez sur <kbd>⊞</kbd> + <kbd>D</kbd> : je prends votre bureau. Puis de nouveau <kbd>⊞</kbd> + <kbd>D</kbd> pour revenir ici.",
      reduireMac: "Maintenant, appuyez sur <kbd>⌘</kbd> + <kbd>F3</kbd> pour montrer votre bureau : je le prends. Puis encore une fois pour revenir ici.",
      encore: "Je vois encore cette page. Encore une fois : votre bureau doit être à l’écran.",
      pret: "J’ai votre bureau. <b>Cliquez n’importe où</b> pour y poser le bouquet.",
      pretTel: "J’ai votre écran d’accueil. On y pose le bouquet ?",
      montrer: "Montrer",
      glisser: "Le voici sur votre bureau. <b>Faites-le glisser</b> où vous voulez.",
      glisserTel: "Le voici sur votre écran d’accueil. <b>Faites-le glisser</b> où vous voulez.",
      taille: "<b>Tirez un coin</b> pour l’agrandir ou le réduire.",
      ok: "C’est bien ainsi ? Appuyez sur <b>✓</b> pour le poser.",
      appui: "Il est posé. Pour le changer plus tard, comme dans Belai Bureau : <b>restez appuyé</b> sur le bouquet 6 secondes.",
      revalider: "Le voilà libre : déplacez-le ou changez sa taille, puis <b>✓</b> pour le reposer.",
      valider: "Le poser ici",
      fin: "Voilà comment il vit sur votre bureau, pendant {jours} jours. Pour l’y garder pour de vrai : <b>Belai Bureau</b>, gratuit pour Windows.",
      finAutre: "Voilà comment il vit sur votre bureau, pendant {jours} jours. Belai Bureau arrive bientôt sur votre système.",
      finTel: "Voilà ce que ça donnerait sur votre téléphone. Belai Bureau pour téléphone arrive bientôt.",
      telecharger: "Obtenir Belai Bureau",
      retour: "Retour aux bouquets",
      bureau: "Je le pose sur votre bureau avec <b>Belai Bureau</b>. Si votre navigateur vous le demande, choisissez <b>Ouvrir</b>.",
      bureauPose: "Le voilà, sur votre vrai bureau. <b>Faites-le glisser</b>, tirez son coin, puis <b>✓</b> pour le fixer. C’est un essai : il part quand Belai Bureau redémarre.",
      bureauAbsent: "Rien ne s’est ouvert ? Belai Bureau n’est pas encore sur cet ordinateur. Il est gratuit, pour Windows : installez-le, puis réessayez.",
      reessayer: "Réessayer",
      capture: "Voyons-le sur votre téléphone. Allez sur votre écran d’accueil, <b>faites une capture d’écran</b>, puis revenez ici et choisissez-la.<small>Elle reste sur votre téléphone : rien n’est envoyé.</small>",
      choisir: "Choisir ma capture",
    },
    copyNo: 'exemplaire n° {n}',
    noBouquet: 'Aucun bouquet sur votre compte pour l’instant.',
    giftsSoon: 'Les cadeaux arrivent bientôt : vous pourrez ouvrir ici le bouquet que l’on vous offre.',
    giftOpened: 'Votre cadeau est arrivé.',
    giftWrong: 'Ce prénom et ce code ne correspondent à aucun cadeau.',
    receipt: {
      title: 'Reçu',
      download: 'Télécharger votre reçu',
      bouquet: 'Bouquet',
      price: 'Prix',
      date: 'Date',
      seller: 'Vendeur',
      waiver: 'Avant de payer, vous avez demandé la livraison immédiate et reconnu renoncer ainsi à votre droit de rétractation (Code de la consommation, article L221-28, 13°).',
      terms: 'Conditions générales de vente acceptées à cette date : {url}',
      taxes: 'TVA non applicable, art. 293 B du CGI.',
      copy: 'Exemplaire',
      copyOf: 'n° {n}, {month}',
      order: 'Commande',
      payment: 'Paiement',
    },
  },

  // ---------- the names the bouquet descriptions use
  vases: {
    'bronze-carpe': 'un vase carpe en bronze coulé',
    'verre-danseuses': 'un vase en verre dépoli aux danseuses',
    'coupe-cobalt-mouchetee': 'une coupe cobalt mouchetée',
    'coupe-pied-blanche-mate': 'une coupe sur pied blanche mate',
    'cylindre-inox-miroir': 'un cylindre en inox poli miroir',
    'bulbe-pied-sable': 'un vase boule sur pied couleur sable',
    'calice-mouchete': 'un vase calice moucheté',
    'prisme-jaune': 'un prisme de verre citrine taillé à cœur suspendu',
    'jardiniere-cristaux': 'une jardinière Art nouveau aux cristallisations',
    'prismes-bronze': 'un vase de prismes en bronze vert-de-gris',
    'colonne-art-nouveau': 'une colonne Art nouveau en grès',
    'bouteille-dragon': 'une bouteille bleu nuit au dragon turquoise',
    'jarre-carpes': 'une jarre en terre cuite aux carpes en relief',
    'bronze-lys': 'un vase en bronze patiné aux lys',
    'gres-chauve-souris': 'un grès à la chauve-souris',
    'balustre-perce-neige': 'un balustre aux perce-neige',
  },
  flowers: {
    'cerisier-du-japon-sato-zakura': 'fleur de cerisier du Japon',
    'cognassier-du-japon': 'cognassier du Japon',
    forsythia: 'forsythia',
    'iris-hollandais': 'iris de Hollande',
    lilas: 'lilas',
    'tulipe-perroquet': 'tulipe perroquet',
    'tulipe-double': 'tulipe double',
    'tulipe-simple': 'tulipe',
    'tulipe-frangee': 'tulipe frangée',
    'renoncule-classique': 'renoncule',
    'narcisse-trompette': 'narcisse trompette',
    'narcisse-bouquet': 'narcisse à bouquet',
    jacinthe: 'jacinthe',
    'anemone-coronaria': 'anémone',
    'anemone-sauvage': 'anémone des bois',
    freesia: 'freesia',
    'pois-de-senteur': 'pois de senteur',
    muscari: 'muscari',
    'fritillaire-meleagris': 'fritillaire pintade',
    glycine: 'glycine',
    'viburnum-roseum': 'viorne boule-de-neige',
    alchemille: 'alchémille',
    'anthurium-obake': 'anthurium obake',
    'saule-a-chatons': 'chatons de saule',
    'liriope-lily-grass': 'liriope',
    'cymbidium-grandes-fleurs': 'orchidée cymbidium',
    'rose-de-jardin': 'rose de jardin',
    sanguisorbe: 'sanguisorbe',
    phalaenopsis: 'orchidée phalaenopsis',
    'arum-calla': 'arum',
    'hortensia-boule': 'hortensia',
    'giroflee-matthiole': 'giroflée',
    'oeillet-de-poete-dianthus': 'œillet de poète',
    'anthurium-cristal': 'anthurium cristal',
    'jasminum-liane-jasmin': 'jasmin',
    'cyclamen-fleur-coupee': 'cyclamen',
    'ruscus-seche-teint': 'ruscus teinté',
    lisianthus: 'lisianthus',
    germini: 'germini',
    'reine-marguerite': 'reine-marguerite',
    bromeliacees: 'broméliacée',
    'rose-standard': 'rose',
    'rose-aspect-jardin': 'rose d’aspect jardin',
    gerbera: 'gerbera',
    'dahlia-decoratif': 'dahlia',
    'chrysantheme-disbud': 'chrysanthème à grosse fleur',
    'anthurium-andraeanum': 'anthurium',
    'amarante-retombante': 'amarante queue-de-renard',
    nerine: 'nérine',
    'oeillet-standard': 'œillet',
    delphinium: 'delphinium',
    gloriosa: 'gloriosa',
    scabieuse: 'scabieuse',
  },
};
