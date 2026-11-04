// soliflore.mjs: the soliflores on sale (soliflore.html): the catalogue's flowers in their season, searched, by family,
// each at the price of its stem, fading over thirty days (owner, 2026-11-01). A card opens the soliflore's own page
// (fleur.html), where it is bought; here a quiet button only adds it to the basket. Answering a gift with a flower (soliflore.html?pour=Claire&g=…, from the gift's page): the
// flower reaches the giver through the gift (owner, 2026-10-31), never its code, which no link carries (owner, 2026-11-02).
// Three menus sort and sift them (owner, 2026-11-01): by price either way, by colour, by meaning in alphabetical order.
import './cache.mjs';
import { $, chargeSens, chargeSoli, dessinSoli, lienFleur, MOIS, moisSoli, panier, plain, reading, said, SOLI, SAC_PLUS } from './noyau.mjs';

await Promise.all([chargeSoli(), chargeSens()]);

const now = new Date().getMonth() + 1;
const PAGE = 12;
let famille = 'tout';
let shownN = PAGE;
let tri = 'atelier';
let couleur = '';
let sens = '';
const q = new URLSearchParams(location.search);
// ?pour= names the giver to answer; the shop's own uses (offrir, moi) are not names
const pour = ['offrir', 'moi'].includes(q.get('pour')) ? '' : (q.get('pour') || '').slice(0, 30);
const use = pour || q.get('pour') === 'offrir' ? 'offrir' : 'moi';
const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- the colour family of a colourway, from its hex (hue, saturation, lightness): the families a florist sorts by
const COULEURS = [
  ['blanc', 'Blanc et crème', '#f4efe2'], ['jaune', 'Jaune', '#f2cf3a'], ['orange', 'Orange', '#ea8233'], ['rouge', 'Rouge', '#b81d27'],
  ['rose', 'Rose et fuchsia', '#ec9ab4'], ['violet', 'Violet et lilas', '#8a5bb8'], ['bleu', 'Bleu', '#4f78c4'], ['vert', 'Vert', '#7fa64d'],
  ['sombre', 'Sombre et brun', '#4a2a22'],
];
function teinte(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((x) => x / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (l > 0.84 && (s < 0.55 || (h > 30 && h < 75))) return 'blanc';
  if (s < 0.14) return l > 0.6 ? 'blanc' : 'sombre';
  if (l < 0.2 || (h < 45 && l < 0.36 && s < 0.65)) return 'sombre';
  if (h < 14 || h >= 345) return l > 0.68 ? 'rose' : 'rouge';
  if (h < 22 && l > 0.68) return 'rose';
  if (h < 42) return 'orange';
  if (h < 68) return 'jaune';
  if (h < 165) return 'vert';
  if (h < 255) return 'bleu';
  if (h < 290) return 'violet';
  return l > 0.55 ? 'rose' : 'violet';
}
const teintes = new Map(SOLI.fleurs.map((f) => [f.sid, f.coloris.map(([, hex]) => teinte(hex))]));
// the first colourway of a flower in the chosen colour (its drawing and its page show that one)
const colorisDe = (f) => (couleur ? Math.max(0, teintes.get(f.sid).indexOf(couleur)) : 0);
const sensDe = (f) => reading(f.sid)?.t || '';

// the flowers that pass every filter, one of them set aside (to count what each choice of that menu would give)
const passe = (f, sauf) => {
  const s = norm($('soli-cherche').value.trim());
  return (
    (sauf === 'famille' || famille === 'tout' || f.famille === famille) &&
    (!$('soli-saison').checked || s || f.mois.includes(now)) &&
    (!s || norm(`${f.nom} ${f.latin} ${f.coloris.map((c) => c[0]).join(' ')}`).includes(s)) &&
    (sauf === 'couleur' || !couleur || teintes.get(f.sid).includes(couleur)) &&
    (sauf === 'sens' || !sens || sensDe(f) === sens)
  );
};
const list = () => {
  const all = SOLI.fleurs.filter((f) => passe(f));
  if (tri === 'croissant') all.sort((a, b) => a.prix - b.prix);
  if (tri === 'decroissant') all.sort((a, b) => b.prix - a.prix);
  return all;
};

// ---------- a drop-down of the shop's own hand: a button that says the menu and its choice, a list that opens under it
// (keys: arrows, Home/End, Enter or Space to choose, Escape to close); sorted alphabetically in the reader's language
// when asked (the meanings: their words are translated on the page, so they are sorted when the list opens)
const ouverts = new Set();
function menu({ id, nom, options, choix, trie = false }) {
  const box = document.createElement('div');
  box.className = 'menu';
  box.innerHTML = `<button type="button" class="menu-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-liste">
    <span class="menu-nom"></span><span class="menu-val"></span><svg class="menu-fleche" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg></button>
    <ul class="menu-liste" id="${id}-liste" role="listbox" tabindex="-1" hidden></ul>`;
  const btn = box.querySelector('button');
  const ul = box.querySelector('ul');
  btn.querySelector('.menu-nom').textContent = nom;
  ul.setAttribute('aria-label', nom);
  let valeur = options[0].v;
  const items = () => [...ul.children].filter((li) => li.getAttribute('aria-disabled') !== 'true');
  const pose = (opts) => {
    ul.replaceChildren(
      ...opts.map((o) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.tabIndex = -1;
        li.dataset.v = o.v;
        if (o.hex) li.insertAdjacentHTML('beforeend', `<i class="menu-pastille" style="--c:${o.hex}" aria-hidden="true"></i>`);
        const t = document.createElement('span');
        t.className = 'menu-texte';
        t.textContent = o.t;
        li.append(t);
        if (o.n != null) li.insertAdjacentHTML('beforeend', `<span class="menu-n" translate="no">${o.n}</span>`);
        li.setAttribute('aria-selected', String(o.v === valeur));
        if (o.n === 0 && o.v !== valeur) li.setAttribute('aria-disabled', 'true');
        return li;
      }),
    );
    const sel = opts.find((o) => o.v === valeur) || opts[0];
    btn.querySelector('.menu-val').textContent = sel.t;
    btn.classList.toggle('menu-actif', sel !== opts[0]);
  };
  const ferme = (rend = false) => {
    ul.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    ouverts.delete(ferme);
    if (rend) btn.focus();
  };
  const ouvre = () => {
    for (const f of [...ouverts]) f();
    if (trie) {
      const [tous, ...reste] = [...ul.children];
      const col = new Intl.Collator(document.documentElement.lang || 'fr', { sensitivity: 'base' });
      reste.sort((a, b) => col.compare(a.querySelector('.menu-texte').textContent, b.querySelector('.menu-texte').textContent));
      ul.replaceChildren(tous, ...reste);
    }
    ul.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    ouverts.add(ferme);
    // under its button, fixed to the screen (the bar of filters scrolls sideways on a phone, and would clip it), never off
    // the screen's side
    // (the bar's blurred backdrop makes it the frame of « fixed »: its origin is measured, not assumed)
    const r = btn.getBoundingClientRect();
    ul.style.top = ul.style.left = '0px';
    ul.style.minWidth = `${Math.round(r.width)}px`;
    const o = ul.getBoundingClientRect();
    ul.style.top = `${Math.round(r.bottom + 6 - o.top)}px`;
    ul.style.left = `${Math.round(Math.max(8, Math.min(r.left, innerWidth - ul.offsetWidth - 8)) - o.left)}px`;
    (ul.querySelector('[aria-selected="true"]') || items()[0])?.focus();
  };
  const prend = (li) => {
    if (!li || li.getAttribute('aria-disabled') === 'true') return;
    valeur = li.dataset.v;
    ferme(true);
    choix(valeur);
  };
  btn.addEventListener('click', () => (ul.hidden ? ouvre() : ferme()));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      ouvre();
    }
  });
  ul.addEventListener('click', (e) => prend(e.target.closest('li')));
  ul.addEventListener('keydown', (e) => {
    const l = items();
    const i = l.indexOf(document.activeElement);
    const va = (k) => (e.preventDefault(), l[(k + l.length) % l.length]?.focus());
    if (e.key === 'ArrowDown') va(i + 1);
    else if (e.key === 'ArrowUp') va(i - 1);
    else if (e.key === 'Home') va(0);
    else if (e.key === 'End') va(l.length - 1);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      prend(document.activeElement.closest('li'));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      ferme(true);
    } else if (e.key === 'Tab') ferme();
  });
  return { box, pose, remet: () => (valeur = options[0].v) };
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu')) for (const f of [...ouverts]) f();
});

const TRIS = [
  { v: 'atelier', t: 'Ordre de l’atelier' },
  { v: 'croissant', t: 'Prix croissant' },
  { v: 'decroissant', t: 'Prix décroissant' },
];
const FAMILLES = [
  { v: 'tout', t: 'Toutes les familles' },
  { v: 'Printemps & bulbes', t: 'Printemps et bulbes' },
  { v: 'Été & classiques', t: 'Été et classiques' },
  { v: 'Roses', t: 'Roses' },
  { v: 'Exotiques', t: 'Exotiques' },
  { v: 'Orchidées', t: 'Orchidées' },
  { v: 'Branches & baies', t: 'Branches et baies' },
];
const mFamille = menu({ id: 'soli-famille', nom: 'Famille', options: FAMILLES, choix: (v) => ((famille = v), (shownN = PAGE), render()) });
const mTri = menu({ id: 'soli-tri', nom: 'Trier', options: TRIS, choix: (v) => ((tri = v), (shownN = PAGE), render()) });
const mCouleur = menu({ id: 'soli-couleur', nom: 'Couleur', options: [{ v: '' }], choix: (v) => ((couleur = v), (shownN = PAGE), render()) });
const mSens = menu({ id: 'soli-sens', nom: 'Signification', options: [{ v: '' }], choix: (v) => ((sens = v), (shownN = PAGE), render()), trie: true });
const menus = document.querySelector('.soli-menus');
menus.prepend(mFamille.box, mCouleur.box, mSens.box, mTri.box);
// a sideways scroll of the bar closes an open list (it is fixed to the screen)
menus.addEventListener('scroll', () => document.body.click(), { passive: true });
addEventListener('scroll', () => document.querySelector('.menu-liste:not([hidden])') && document.body.click(), { passive: true });
// the bar is held just under « Bouquets / Soliflores », wherever that bar ends
{
  const bascule = document.querySelector('.bascule');
  const place = () => document.documentElement.style.setProperty('--sous-bascule', `${Math.round(parseFloat(getComputedStyle(bascule).top) + bascule.offsetHeight)}px`);
  place();
  addEventListener('resize', place);
}
// each menu's choices, with how many flowers each would show among the other filters
function menusAJour() {
  const pourFamille = SOLI.fleurs.filter((f) => passe(f, 'famille'));
  mFamille.pose(FAMILLES.map((o) => ({ ...o, n: o.v === 'tout' ? pourFamille.length : pourFamille.filter((f) => f.famille === o.v).length })));
  mTri.pose(TRIS);
  const pourCouleur = SOLI.fleurs.filter((f) => passe(f, 'couleur'));
  mCouleur.pose([
    { v: '', t: 'Toutes les couleurs', n: pourCouleur.length },
    ...COULEURS.map(([v, t, hex]) => ({ v, t, hex, n: pourCouleur.filter((f) => teintes.get(f.sid).includes(v)).length })),
  ]);
  const pourSens = SOLI.fleurs.filter((f) => passe(f, 'sens'));
  const tous = [...new Set(SOLI.fleurs.map(sensDe).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  mSens.pose([{ v: '', t: 'Toutes les significations', n: pourSens.length }, ...tous.map((t) => ({ v: t, t, n: pourSens.filter((f) => sensDe(f) === t).length }))]);
}

function render() {
  menusAJour();
  const all = list();
  $('soli-compte').textContent = `${all.length} fleur${all.length > 1 ? 's' : ''}${$('soli-saison').checked && !$('soli-cherche').value ? ` de saison en ${MOIS[now - 1]}` : ''}`;
  $('soli-grille').replaceChildren(
    ...all.slice(0, shownN).map((f) => {
      const k = colorisDe(f);
      const li = document.createElement('li');
      li.className = `soli${f.mois.includes(now) ? '' : ' hors-saison'}`;
      li.dataset.sid = f.sid;
      // the same card as a bouquet's (owner, 2026-11-01): the name above the flower, on a white ground; at the foot, in season,
      // one pill with the price and a « + » that adds it to the basket
      li.innerHTML = `<a class="soli-lien"><b></b><em class="latin"></em><span class="soli-dessin">${dessinSoli(f, k)}</span><small class="soli-sens"></small>
        <span class="soli-coloris"></span><span class="soli-mois"></span><span class="soli-prix"></span></a>`;
      li.querySelector('a').href = lienFleur(f.sid, pour || (q.get('pour') === 'offrir' ? 'offrir' : null), k || null);
      li.querySelector('b').textContent = f.nom;
      li.querySelector('.latin').textContent = f.latin;
      said(li.querySelector('.soli-sens'), '', f.sid);
      li.querySelector('.soli-coloris').replaceChildren(
        ...f.coloris.slice(0, 6).map(([n, hex]) => Object.assign(document.createElement('i'), { title: n, style: `--c:${hex}` })),
      );
      li.querySelector('.soli-mois').textContent = f.mois.includes(now) ? `De saison · ${moisSoli(f).toLowerCase()}` : moisSoli(f);
      // (in season the price is in the pill; out of it, when the flower comes back)
      li.querySelector('.soli-prix').textContent = f.mois.includes(now) ? '' : `De retour en ${MOIS[f.mois[0] - 1]}`;
      // a quiet add to the basket (owner, 2026-11-01: « add to bag discret »; the purchase is on its own page)
      if (f.mois.includes(now)) {
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'ajout-prix';
        const dit = (ok) => add.setAttribute('aria-label', `${ok ? 'Ajouté au panier' : 'Ajouter au panier'} : ${f.nom}, ${plain(f.prix)}`);
        dit(false);
        add.innerHTML = `<span class="ajout-prix-montant">${plain(f.prix)}</span><span class="ajout-prix-plus">${SAC_PLUS}</span>`;
        add.addEventListener('click', () => {
          panier.ajoute({ id: `soli:${f.sid}:${k}`, soli: true, nom: `Soliflore · ${f.nom}`, coloris: f.coloris[k]?.[0] || '', centimes: f.prix, pour: use, qte: 1 });
          add.classList.add('ajoute');
          dit(true);
          setTimeout(() => {
            add.classList.remove('ajoute');
            dit(false);
          }, 1600);
        });
        li.append(add);
      }
      return li;
    }),
  );
  $('soli-plus').hidden = all.length <= shownN;
}
if (pour) {
  $('pour-repondre').hidden = false;
  $('pour-repondre').textContent = `Pour répondre à ${pour} : choisissez une fleur. Elle arrive chez ${pour} par le code de son cadeau, sans adresse à échanger.`;
}
$('soli-cherche').addEventListener('input', () => ((shownN = PAGE), render()));
$('soli-saison').addEventListener('change', () => ((shownN = PAGE), render()));
// another book of meanings: the meanings change, the one chosen is let go
document.addEventListener('sens:pays', () => {
  sens = '';
  mSens.remet();
  render();
});
$('soli-plus').addEventListener('click', () => ((shownN += PAGE), render()));
render();
