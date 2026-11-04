// compte.js: the monthly-return page with a demo account (the account server plugs in at integration). Every date is
// computed from the shop's collection month, so the demo stays true: the flagship bloomed through the collection's month,
// one bouquet still lives, one soliflore never fades, two gifts were given.

import './cache.mjs';

const SCENE = '../scene/';
const $ = (id) => document.getElementById(id);
const [shop, SOLI] = await Promise.all([fetch(`${SCENE}boutique.json`).then((r) => r.json()), fetch('soli.json').then((r) => r.json())]);
const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const byId = (id) => shop.produits.find((p) => p.id === id);
const day = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

const [yy, mm] = shop.collection.mois.split('-').map(Number);
const start = new Date(yy, mm - 1, 1);
const end = new Date(yy, mm, 0);
const next = new Date(yy, mm, 1);
const nextMonth = next.toLocaleDateString('fr-FR', { month: 'long' });
for (const el of document.querySelectorAll('[data-mois-suivant]')) el.textContent = nextMonth;
for (const el of document.querySelectorAll('[data-de-mois]')) el.textContent = `${/^[aeiouy]/i.test(nextMonth) ? 'd’' : 'de '}${nextMonth}`;

// 1. the bouquet whose bloom just ended
const fini = byId('printemps-a-la-carpe');
$('f-nom').textContent = fini.nom;
$('f-debut').textContent = day(start);
$('f-fin').textContent = day(end);
// every bouquet here is the drawing itself (SVG), posed still and sized to its box, as it nears the view (a third of a
// screen ahead: a screen ahead fetched the 10 MB of nuit-d-ambre on a phone before anyone scrolled)
const vbOf = (id) => fetch(`${SCENE}bouquets/${id}/sprites/sprites.json`).then((r) => r.json()).then((m) => m.vb);
async function poseStill(box, id, maxW, maxH) {
  const vb = await vbOf(id);
  const w = Math.min(maxW, 420, (maxH * vb[2]) / vb[3]);
  box.style.width = `${w}px`;
  box.style.height = `${(w * vb[3]) / vb[2]}px`;
  const b = await Eclosion.pose(box, `${SCENE}bouquets/${id}/ouvert.json`, { final: true });
  await b.pret;
  b.montre();
}
const lazy = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      lazy.unobserve(e.target);
      const { id, w, h } = e.target.dataset;
      // a box without numbers takes its parent's content box (the tile's scene), measured now that it is laid out
      const par = getComputedStyle(e.target.parentElement);
      const room = (k, a, b) => e.target.parentElement[k] - parseFloat(par[a]) - parseFloat(par[b]);
      poseStill(e.target, id, +w || room('clientWidth', 'paddingLeft', 'paddingRight'), +h || room('clientHeight', 'paddingTop', 'paddingBottom')).catch((err) => console.error('[compte]', id, err));
    }
  },
  { rootMargin: '35% 0px' },
);
const later = (box, id, w, h) => {
  Object.assign(box.dataset, { id, w: w || '', h });
  lazy.observe(box);
};
$('f-image').setAttribute('aria-label', `${fini.nom}, fané`);
later($('f-image'), fini.id, 0, 520);

// 3. what one owns, each with its state
// the living first, then the soliflores, then the faded (retention ID-05); a day counted lived, never a countdown
const mes = [
  { p: byId('nuit-d-ambre'), etat: 'En fleur · jour 18 sur 30', cls: 'en-vie', href: 'recu.html?de=Jonas&b=nuit-d-ambre' },
  { soli: SOLI.fleurs.find((f) => f.sid === 'anemone-coronaria'), etat: 'Soliflore · jour 6 sur 30', cls: 'soli', href: 'fleur.html?f=anemone-coronaria' },
  { p: fini, etat: `A fleuri jusqu’au ${day(end)}`, cls: 'fane', href: 'recu.html?de=Claire' },
];
$('mes').replaceChildren(
  ...mes.map((x) => {
    const li = document.createElement('li');
    li.className = `ma-fleur ${x.cls}`;
    li.dataset.href = x.href;
    if (x.p) {
      li.innerHTML = `<span class="tuile-scene"><span class="tuile-bq"></span></span><span class="tuile-nom"></span><span class="etat"></span>`;
      li.querySelector('.tuile-nom').textContent = x.p.nom;
      later(li.querySelector('.tuile-bq'), x.p.id, 0, 0);
    } else {
      li.innerHTML = `<span class="tuile-scene soli-scene" style="--c:${x.soli.col}"><i></i></span><span class="tuile-nom"></span><span class="etat"></span>`;
      li.querySelector('.tuile-nom').textContent = x.soli.nom;
    }
    li.querySelector('.etat').textContent = x.etat;
    // the whole tile leads to its bouquet
    const a = document.createElement('a');
    a.href = x.href;
    a.className = 'ma-fleur-lien';
    a.append(...li.childNodes);
    li.append(a);
    return li;
  }),
);

// 4. the soliflores in season next month
const m = next.getMonth() + 1;
$('saison').replaceChildren(
  ...SOLI.fleurs
    .filter((f) => f.mois.includes(m))
    // the eight first (those with a sourced meaning come first in soli.json); the rest on the shop's page
    .slice(0, 8)
    .map((f) => {
      const li = document.createElement('li');
      li.style.setProperty('--c', f.col);
      li.innerHTML = '<i></i><b></b><small></small><span></span>';
      li.querySelector('b').textContent = f.nom;
      li.querySelector('small').textContent = f.sens;
      if (f.source) li.querySelector('small').insertAdjacentHTML('beforeend', ' <cite class="sens-source"></cite>');
      if (f.source) li.querySelector('.sens-source').textContent = f.source;
      li.querySelector('span').textContent = euros.format(f.prix / 100).replace(/,00/, '');
      return li;
    }),
);

// 5. what one gave
const offerts = [
  { a: 'Claire', p: byId('citrine'), etat: `Ouvert le 12 ${start.toLocaleDateString('fr-FR', { month: 'long' })}`, merci: 'Merci, il est magnifique. Je l’ai posé à côté de mon calendrier.', action: ['Lui offrir de nouveau', 'index.html?pour=offrir'] },
  { a: 'Maman', p: byId('ronde-bleue'), etat: 'Pas encore ouvert · ses trente jours attendent', action: ['Copier son lien', '#'] },
];
$('offerts').replaceChildren(
  ...offerts.map((o) => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="offert-bq"></span><span><b></b><small></small><q hidden></q></span><a class="btn btn-lien btn-petit"></a>';
    if (o.merci) Object.assign(li.querySelector('q'), { hidden: false, textContent: o.merci });
    Object.assign(li.querySelector('a'), { textContent: o.action[0], href: o.action[1] });
    later(li.querySelector('.offert-bq'), o.p.id, 64, 80);
    li.querySelector('b').textContent = `${o.p.nom}, pour ${o.a}`;
    li.querySelector('small').textContent = o.etat;
    return li;
  }),
);

$('rappel').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const c = new FormData($('rappel')).get('canal');
  $('rappel-etat').textContent =
    c === 'rien' ? 'Entendu : aucun message.' : `Entendu : un ${c === 'sms' ? 'SMS' : 'e-mail'} le 1er ${nextMonth}, et rien d’autre. (Aperçu : rien n’est encore envoyé.)`;
});
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-bouchon]');
  if (!t) return;
  ev.preventDefault();
  $('bouchon-texte').textContent = 'Le compte de démonstration ne se déconnecte pas encore dans cet aperçu.';
  $('bouchon').showModal();
});

// the reminder: nothing ticked, the button waits for a choice (retention ID-03, Planet49); or a calendar entry, no data
for (const r of document.querySelectorAll('[name=canal]')) r.addEventListener('change', () => ($('rappel-ok').disabled = false));
{
  const d = next.toISOString().slice(0, 10).replace(/-/g, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Belai’s Garden//Collection//FR', 'BEGIN:VEVENT', `UID:collection-${d}@belaisgarden`,
    `DTSTART;VALUE=DATE:${d}`, `SUMMARY:La collection ${nextMonth} de Belai’s Garden ouvre`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  $('agenda').href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

// the rest of the month's soliflores, on the shop's page
{
  const n = SOLI.fleurs.filter((f) => f.mois.includes(m)).length;
  const a = document.createElement('a');
  a.className = 'saison-plus';
  a.href = 'soliflore.html';
  a.textContent = `Voir les ${n} fleurs de saison`;
  $('saison').after(a);
}
