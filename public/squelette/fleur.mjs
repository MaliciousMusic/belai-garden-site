// fleur.mjs: one soliflore's own page (fleur.html?f=<sid>, owner 2026-11-01): the purchase lives here, the soliflores'
// grid only adds to the basket. One flower of the season in a vase of the atelier's selection, at the price of its stem at
// a florist (soli.json, built by outils/soli.py), the vase offered; it fades over thirty days like a bouquet. Its
// colourway is chosen here; out of season it waits for its months. Answering a gift with a flower (?pour=Claire&g=…)
// carries on from the soliflores' page.
import './cache.mjs';
import { $, chargeSens, chargeSoli, dessinSoli, marquesPaiement, MOIS, moisSoli, panier, plain, price, said, SOLI, vaseSoli } from './noyau.mjs';

await Promise.all([chargeSoli(), chargeSens()]);
const q = new URLSearchParams(location.search);
const f = SOLI.fleurs.find((x) => x.sid === q.get('f')) || SOLI.fleurs[0];
// ?pour= names the giver to answer; the shop's own uses (offrir, moi) are not names
const pour = ['offrir', 'moi'].includes(q.get('pour')) ? '' : (q.get('pour') || '').slice(0, 30);
const now = new Date().getMonth() + 1;
const enSaison = f.mois.includes(now);
// « Pour moi » by default (owner, 2026-11-01); a gift when one was asked, or when a giver is answered
let use = pour || q.get('pour') === 'offrir' ? 'offrir' : 'moi';
// the colourway the soliflores' page was showing (?c=, its colour filter)
let coloris = Math.max(0, Math.min(parseInt(q.get('c'), 10) || 0, f.coloris.length - 1));

document.title = `${f.nom}, soliflore | Belai’s Garden`;
$('f-nom').textContent = f.nom;
$('f-latin').textContent = f.latin;
said($('f-sens'), '', f.sid);
$('f-mois').textContent = enSaison ? `De saison · ${moisSoli(f).toLowerCase()}` : `${moisSoli(f)} · de retour en ${MOIS[f.mois[0] - 1]}`;
$('f-jour').textContent = `soit ${price(Math.max(1, Math.round(f.prix / 30)))} par jour de floraison`;
if (pour) {
  $('pour-repondre').hidden = false;
  $('pour-repondre').textContent = `Pour répondre à ${pour} : ce soliflore arrive chez ${pour} par le code de son cadeau, sans adresse à échanger.`;
  $('f-retour').href = `soliflore.html${location.search.replace(/([?&])f=[^&]*&?/, '$1').replace(/[?&]$/, '')}`;
}

// the colourway: the flower drawn in it, alone in its vase
$('f-vase').textContent = `Son vase : ${vaseSoli(f)}.`;
function dessine() {
  const [nom] = f.coloris[coloris] || [f.coloris[0]?.[0]];
  $('f-dessin').innerHTML = dessinSoli(f, coloris);
  $('f-dessin').setAttribute('aria-label', `${f.nom}, ${nom}, dans ${vaseSoli(f)}`);
  for (const b of $('f-coloris').children) b.setAttribute('aria-checked', String(Number(b.dataset.k) === coloris));
}
$('f-coloris').replaceChildren(
  ...f.coloris.map(([nom, hex], k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.k = k;
    b.setAttribute('aria-label', nom);
    b.title = nom;
    b.innerHTML = `<i style="--c:${hex}" aria-hidden="true"></i>`;
    b.addEventListener('click', () => ((coloris = k), dessine()));
    return b;
  }),
);
dessine();

// gift or for me: the word only for a gift; the action says which, with the price in it
function label() {
  $('f-acheter-mot').textContent = pour ? `Envoyer à ${pour}` : use === 'offrir' ? 'Offrir ce soliflore' : 'Le garder pour moi';
  $('f-prix').textContent = plain(f.prix);
  $('cadeau').hidden = use !== 'offrir';
  for (const b of document.querySelectorAll('.fleur-usage button')) b.setAttribute('aria-checked', String(b.dataset.usage === use));
}
for (const b of document.querySelectorAll('.fleur-usage button')) b.addEventListener('click', () => ((use = b.dataset.usage), label()));
if (pour) document.querySelector('.fleur-usage').hidden = true;
label();
$('f-acheter').after(marquesPaiement());

// out of its season it cannot be had: it says when it comes back
if (!enSaison) {
  for (const id of ['f-acheter', 'f-panier']) $(id).disabled = true;
  $('f-acheter-mot').textContent = `De retour en ${MOIS[f.mois[0] - 1]}`;
  $('f-prix').textContent = plain(f.prix);
}

$('f-panier').addEventListener('click', () => {
  const [nom] = f.coloris[coloris] || [''];
  panier.ajoute({ id: `soli:${f.sid}:${coloris}`, soli: true, nom: `Soliflore · ${f.nom}`, coloris: nom, centimes: f.prix, pour: use, qte: 1, ...(use === 'offrir' ? { mot: $('mot').value.trim() } : {}) });
  $('f-panier').textContent = 'Ajouté au panier';
  setTimeout(() => ($('f-panier').textContent = 'Ajouter au panier'), 1600);
});
