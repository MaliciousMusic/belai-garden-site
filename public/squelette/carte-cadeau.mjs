// carte-cadeau.mjs: the gift card of a free amount (owner, 2026-11-02). The amount, from a proposal or typed in; the word,
// signed or not; the language of its page. The purchase asks for the account (connexion.mjs), then says the payment is not
// open in this preview. The bounds (10 € to 500 €) are a proposal for the owner (RAPPORT-DECISIONS-2NOV.md).
import './cache.mjs';
import { exigeCompte } from './connexion.mjs';

const $ = (id) => document.getElementById(id);
const MIN = 10;
const MAX = 500;
const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const montant = () => Math.round(Number($('c-montant').value));
const valide = (m) => Number.isFinite(m) && m >= MIN && m <= MAX;
function montre() {
  const m = montant();
  $('c-prix').textContent = valide(m) ? euros.format(m) : '…';
  for (const b of document.querySelectorAll('[data-montant]')) b.setAttribute('aria-pressed', String(Number(b.dataset.montant) === m));
}
for (const b of document.querySelectorAll('[data-montant]'))
  b.addEventListener('click', () => {
    $('c-montant').value = b.dataset.montant;
    montre();
  });
$('c-montant').addEventListener('input', montre);
montre();

$('carte').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const m = montant();
  if (!valide(m)) {
    $('c-etat').textContent = `Un montant de ${euros.format(MIN)} à ${euros.format(MAX)}, en euros ronds.`;
    return void $('c-montant').focus();
  }
  $('c-etat').textContent = '';
  if (!(await exigeCompte())) return;
  $('bouchon-texte').textContent = `La carte cadeau n’est pas encore branchée au paiement dans cet aperçu. Sa carte de ${euros.format(m)} vous attend ici.`;
  $('bouchon').showModal();
});
