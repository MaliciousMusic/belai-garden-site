// groupe.js: the group purchase. One bouquet for each person, the rows added on demand, the total said as it is (the
// bouquet's price times the people, no discount promised); the order itself plugs into the shop at integration.

const SCENE = '../scene/';
const $ = (id) => document.getElementById(id);
const shop = await fetch(`${SCENE}boutique.json`).then((r) => r.json());
const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const price = (cts) => euros.format(cts / 100);

$('g-bouquet').replaceChildren(
  ...shop.produits.map((p) => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.nom} · ${price(p.prix.centimes)}`;
    return o;
  }),
);
const wanted = new URLSearchParams(location.search).get('b');
if (wanted) $('g-bouquet').value = wanted;

// one row per person: a first name, where to send the link, and a word of their own
let n = 0;
function person() {
  n++;
  const li = document.createElement('li');
  li.className = 'personne';
  li.innerHTML = `<p class="personne-n">Personne ${n}</p>
    <label class="champ">Prénom<input name="prenom" autocomplete="off"></label>
    <label class="champ">E-mail ou mobile<input name="contact" autocomplete="off" inputmode="email" autocapitalize="off" spellcheck="false"></label>
    <label class="champ champ-large">Son mot<input name="mot" maxlength="280" placeholder="Laissez vide pour le mot commun"></label>
    <button type="button" class="retirer" aria-label="Retirer cette personne">Retirer</button>`;
  li.querySelector('.retirer').addEventListener('click', () => {
    if ($('personnes').children.length > 2) li.remove();
    total();
  });
  $('personnes').append(li);
  total();
  return li;
}
function total() {
  const p = shop.produits.find((x) => x.id === $('g-bouquet').value);
  const k = $('personnes').children.length;
  $('g-calc').textContent = `${k} × ${p.nom}`;
  $('g-total').textContent = price(k * p.prix.centimes);
}
$('ajouter').addEventListener('click', () => person().querySelector('input').focus());
$('g-bouquet').addEventListener('change', total);
person();
person();

// the first day one can send on is today
const today = new Date();
$('g-date').min = $('g-date').value = today.toISOString().slice(0, 10);

$('groupe').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const rows = [...$('personnes').children].filter((li) => li.querySelector('[name=prenom]').value.trim());
  const empty = [...$('personnes').children].map((li) => li.querySelector('[name=prenom]')).find((i) => !i.value.trim());
  if (rows.length < 2 && empty) {
    empty.setAttribute('aria-invalid', 'true');
    empty.focus();
  }
  $('g-etat').textContent = rows.length < 2
    ? 'Ajoutez au moins deux personnes avec leur prénom.'
    : `Commande prête : ${rows.length} bouquets, envoyés le ${new Date($('g-date').value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}. Le paiement n’est pas encore ouvert dans cet aperçu.`;
});
