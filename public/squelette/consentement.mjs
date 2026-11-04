// consentement.mjs: the audience-measurement cookies, asked first (owner, 2026-11-02: « des cookies de mesure, assumés »;
// in Europe the visitor chooses, GDPR and ePrivacy, CNIL guidelines). Every page loads it. A card in the middle of the
// screen (owner, 2026-11-04: the welcome's own place, the welcome comes once it is answered; a band at the foot on the gift's
// page, over the flowers otherwise) says what they are for, with « Refuser » and « Accepter » side by side, as easy as one another; nothing is
// measured and no measurement cookie is set before « Accepter ». The choice is kept six months in this browser (a
// strictly necessary record, exempt from consent), then asked again; « Cookies » at the foot of every page reopens it, and
// a refusal after an acceptance takes the measurement cookies away at once.
// The measurement tool itself is not chosen yet (RAPPORT-DECISIONS-2NOV.md): whatever it is, it starts through
// quandMesure(), never before.

const CLE = 'belai-consentement';
const VIE = 182 * 24 * 60 * 60 * 1000; // six months
const listeners = [];

function lu() {
  try {
    const c = JSON.parse(localStorage.getItem(CLE));
    if (c && typeof c.mesure === 'boolean' && Date.now() - c.date < VIE) return c;
  } catch (_) {}
  return null;
}
let choix = lu();

// true once the visitor accepted the measurement, false otherwise (refused, or not asked yet)
export const mesureAutorisee = () => choix?.mesure === true;
// runs fn when the measurement may start: now if it was accepted, else on the day it is
export function quandMesure(fn) {
  if (mesureAutorisee()) fn();
  else listeners.push(fn);
}

// every cookie this page's scripts can see, but none of the shop's own: the account's session is HttpOnly, out of reach
function efface() {
  for (const c of document.cookie.split(';')) {
    const nom = c.split('=')[0].trim();
    if (!nom) continue;
    const domaines = ['', location.hostname, `.${location.hostname.split('.').slice(-2).join('.')}`];
    for (const d of domaines) document.cookie = `${nom}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ''}`;
  }
}

function retient(mesure) {
  const avant = mesureAutorisee();
  choix = { mesure, date: Date.now() };
  try {
    localStorage.setItem(CLE, JSON.stringify(choix));
  } catch (_) {}
  if (mesure) for (const fn of listeners.splice(0)) fn();
  else if (avant) efface();
  document.dispatchEvent(new CustomEvent('belai:consentement', { detail: { mesure } }));
}

let bande = null;
function construit() {
  bande = document.createElement('section');
  bande.className = 'consentement';
  bande.setAttribute('role', 'dialog');
  bande.setAttribute('aria-labelledby', 'consentement-titre');
  bande.tabIndex = -1;
  bande.innerHTML = `<h2 id="consentement-titre">Des cookies de mesure, si vous le voulez bien</h2>
    <p>Ils nous montrent comment le site est parcouru, pour le rendre plus simple, aux personnes âgées comme aux visiteurs de
      chaque pays. Rien n’est posé sans votre accord, et vous changez d’avis quand vous voulez : « Cookies », en bas de chaque page.
      <a href="legal.html#privacy">En savoir plus</a></p>
    <div class="consentement-choix">
      <button type="button" class="btn btn-trait btn-petit" data-mesure="non">Refuser</button>
      <button type="button" class="btn btn-trait btn-petit" data-mesure="oui">Accepter</button>
    </div>`;
  bande.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mesure]');
    if (!b) return;
    retient(b.dataset.mesure === 'oui');
    ferme();
  });
  document.body.append(bande);
}
let retour = null;
function ouvre() {
  if (!bande) construit();
  retour = document.activeElement;
  bande.hidden = false;
  document.body.classList.add('avec-consentement');
  // the keyboard starts here: the card comes first in what the page asks
  bande.focus({ preventScroll: true });
}
function ferme() {
  bande.hidden = true;
  document.body.classList.remove('avec-consentement');
  // back where one was when « Cookies » reopened it
  if (retour && retour !== document.body && document.contains(retour)) retour.focus({ preventScroll: true });
  retour = null;
}
// « Cookies », reopened from the foot of every page, beside « Confidentialité »
export function reouvre() {
  ouvre();
  bande.querySelector(`[data-mesure="${mesureAutorisee() ? 'oui' : 'non'}"]`).focus({ preventScroll: true });
}

function pose() {
  for (const conf of document.querySelectorAll('footer a[href$="#privacy"]')) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cookies-lien';
    b.textContent = 'Cookies';
    b.addEventListener('click', reouvre);
    conf.after(b);
  }
  if (choix) return;
  // the gift's page asks once the bouquet has bloomed: the band never stands between the envelope and its flowers
  if (document.body.classList.contains('page-recu')) document.addEventListener('cadeau:ouvert', ouvre, { once: true });
  else ouvre();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pose, { once: true });
else pose();
