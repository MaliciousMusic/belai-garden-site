// connexion.mjs: the account, asked before any purchase (owner, 2026-11-02: « afin de protéger les achats, le compte avec
// validation par mail ou numéro de téléphone est obligatoire »). exigeCompte() resolves true once the visitor is signed in:
// at once when a session is open, else after the site's own window (same look as « Nous écrire »): an e-mail address or a
// phone number, a code received there, and a first name for a new account; no password. The person who receives a gift
// needs none of it (recu.html never loads this).
// The server is api/src/compte.js (POST /api/mail|sms/demande, then /verifie; GET /api/moi). In a preview without it, the
// window says so and the purchase waits.
import { API } from './ecrire.mjs';
import { langue } from './traduction.mjs';

const $ = (id) => document.getElementById(id);
const appel = (chemin, corps) =>
  fetch(`${API}${chemin}`, {
    method: corps ? 'POST' : 'GET',
    credentials: 'include',
    headers: corps ? { 'content-type': 'application/json' } : {},
    body: corps ? JSON.stringify(corps) : undefined,
  });

// a session already open on this browser (the account server's cookie)
async function connecte() {
  try {
    return (await appel('/moi')).ok;
  } catch (_) {
    return false;
  }
}

const ERREURS = {
  adresse_invalide: 'Cette adresse e-mail ne semble pas complète.',
  numero_invalide: 'Ce numéro ne semble pas complet.',
  pays_non_desservi: 'Les SMS ne partent pas encore vers ce pays : choisissez l’e-mail.',
  code_faux: 'Ce code n’est pas le bon. Vérifiez-le, chiffre par chiffre.',
  code_expire: 'Ce code a expiré : demandez-en un autre.',
  trop_d_essais: 'Trop d’essais : demandez un autre code.',
  prenom_invalide: 'Écrivez votre prénom en lettres.',
};
const attente = (s) => (s > 90 ? `Trop de demandes : réessayez dans ${Math.ceil(s / 60)} minutes.` : `Trop de demandes : réessayez dans ${s} secondes.`);

let boite = null;
let fin = null; // resolves the pending exigeCompte()
function construit() {
  boite = document.createElement('dialog');
  boite.className = 'ecrire connexion';
  boite.setAttribute('aria-labelledby', 'cx-titre');
  boite.innerHTML = `<form class="ecrire-form" id="cx-demande" novalidate>
      <h2 id="cx-titre">Votre compte, pour acheter</h2>
      <p class="ecrire-delai">Il protège vos achats : vos bouquets, vos factures et vos cadeaux y sont gardés. Pas de mot de passe, un code
        suffit. La personne à qui vous offrez n’a besoin de rien.</p>
      <fieldset class="ecrire-par">
        <legend>Recevoir le code</legend>
        <div class="ecrire-choix" role="radiogroup" aria-label="Recevoir le code">
          <button type="button" role="radio" aria-checked="true" data-par="mail">Par e-mail</button><button type="button" role="radio" aria-checked="false" data-par="sms">Par SMS</button>
        </div>
        <label class="ecrire-champ"><span id="cx-id-mot">Votre e-mail</span><input id="cx-id" type="email" autocomplete="email" inputmode="email" maxlength="254" required></label>
      </fieldset>
      <button type="submit" class="btn btn-achat ecrire-envoyer" id="cx-envoyer">Recevoir un code</button>
    </form>
    <form class="ecrire-form" id="cx-verifie" novalidate hidden>
      <p class="ecrire-delai" id="cx-envoye"></p>
      <label class="ecrire-champ">Le code reçu<input id="cx-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
      <label class="ecrire-champ" id="cx-prenom-champ" hidden>Votre prénom, pour un nouveau compte<input id="cx-prenom" autocomplete="given-name" maxlength="40"></label>
      <button type="submit" class="btn btn-achat ecrire-envoyer" id="cx-valider">Valider</button>
      <button type="button" class="btn btn-lien" id="cx-retour">Changer d’adresse ou de numéro</button>
    </form>
    <p class="ecrire-etat" id="cx-etat" role="status" aria-live="polite"></p>
    <p class="ecrire-note">Votre adresse ou votre numéro sert à vous connecter et à vous écrire au sujet de vos achats, rien d’autre. <a href="legal.html#privacy">Confidentialité</a></p>
    <form method="dialog"><button class="ecrire-fermer" aria-label="Fermer">×</button></form>`;
  document.body.append(boite);
  const champ = $('cx-id');
  let par = 'mail';
  let ident = '';
  const dit = (t) => ($('cx-etat').textContent = t);
  for (const b of boite.querySelectorAll('[data-par]'))
    b.addEventListener('click', () => {
      par = b.dataset.par;
      for (const x of boite.querySelectorAll('[data-par]')) x.setAttribute('aria-checked', String(x === b));
      Object.assign(champ, par === 'mail' ? { type: 'email', autocomplete: 'email', inputMode: 'email' } : { type: 'tel', autocomplete: 'tel', inputMode: 'tel' });
      $('cx-id-mot').textContent = par === 'mail' ? 'Votre e-mail' : 'Votre numéro de mobile';
      // an address is not a number: the field starts again empty
      champ.value = '';
      champ.focus();
    });
  // the server's answer, or what to say when it cannot be reached (this preview)
  const reponse = async (chemin, corps, bouton) => {
    bouton.disabled = true;
    try {
      const r = await appel(chemin, corps);
      return { ok: r.ok, j: await r.json().catch(() => ({})) };
    } catch (_) {
      dit('Le serveur des comptes ne répond pas : dans cet aperçu, l’achat s’arrête ici.');
      return null;
    } finally {
      bouton.disabled = false;
    }
  };
  const corpsDe = (plus = {}) => ({ [par === 'mail' ? 'adresse' : 'numero']: ident, langue, ...plus });
  $('cx-demande').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    ident = champ.value.trim();
    if (par === 'mail' ? !/^\S+@\S+\.\S{2,}$/.test(ident) : ident.replace(/\D/g, '').length < 8)
      return void (dit(ERREURS[par === 'mail' ? 'adresse_invalide' : 'numero_invalide']), champ.focus());
    const res = await reponse(`/${par}/demande`, corpsDe(), $('cx-envoyer'));
    if (!res) return;
    if (!res.ok) return void dit(res.j.erreur === 'trop_de_demandes' ? attente(res.j.attendre || 60) : ERREURS[res.j.erreur] || 'Le code n’a pas pu partir. Réessayez dans un instant.');
    dit('');
    // (the address or the number stays out of the sentence: one sentence per way, for the phrase books)
    $('cx-envoye').textContent = par === 'mail' ? 'Un code vient de partir à cette adresse. Il vaut 10 minutes.' : 'Un code vient de partir par SMS à ce numéro. Il vaut 10 minutes.';
    $('cx-demande').hidden = true;
    $('cx-verifie').hidden = false;
    $('cx-code').focus();
  });
  $('cx-verifie').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const code = $('cx-code').value.replace(/\D/g, '');
    if (code.length !== 6) return void (dit('Le code a six chiffres.'), $('cx-code').focus());
    const prenom = $('cx-prenom').value.trim();
    const res = await reponse(`/${par}/verifie`, corpsDe({ code, ...(prenom ? { prenom } : {}) }), $('cx-valider'));
    if (!res) return;
    if (res.ok) {
      dit('');
      fin?.(true);
      fin = null;
      return void boite.close();
    }
    // a new account: its first name, and the same code sent again with it
    if (res.j.erreur === 'prenom_requis') {
      $('cx-prenom-champ').hidden = false;
      dit('Bienvenue : votre prénom, et votre compte est ouvert.');
      return void $('cx-prenom').focus();
    }
    const reste = res.j.erreur === 'code_faux' ? res.j.reste : null;
    dit(reste != null ? (reste > 1 ? `Ce code n’est pas le bon : encore ${reste} essais.` : `Ce code n’est pas le bon : encore ${reste} essai.`) : ERREURS[res.j.erreur] || 'La vérification n’a pas abouti. Réessayez.');
  });
  $('cx-retour').addEventListener('click', () => {
    $('cx-verifie').hidden = true;
    $('cx-demande').hidden = false;
    dit('');
    champ.focus();
  });
  boite.addEventListener('close', () => {
    fin?.(false);
    fin = null;
  });
}

// true once signed in; false if the window was closed without it
export async function exigeCompte() {
  if (await connecte()) return true;
  if (!boite) construit();
  $('cx-verifie').hidden = true;
  $('cx-demande').hidden = false;
  $('cx-etat').textContent = '';
  boite.showModal();
  return new Promise((ok) => (fin = ok));
}
