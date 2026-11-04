// noyau.mjs: the core every page of the shop skeleton shares (owner, 2026-10-31: one page per use, each loading only what
// it needs). It reads the shop's own data (../scene/boutique.json, ../scene/langues/fr.mjs); the meanings, the soliflores
// and the botanical names are fetched only by the pages that show them (chargeSens, chargeSoli, chargeLatin).
// Every bouquet on a page is the drawing itself, in SVG (Eclosion.pose): no raster still anywhere (owner, 2026-10-31:
// sharpness is our edge, it must be felt in every place). A box stays on its ground until its bouquet is ready, then shows
// it whole, at once.
// Also here: the header's behaviours (the section marked in the nav and the phone's bar), the stubs, and the « J'ai reçu
// un bouquet » window, which every page with the header carries. Buying, the try-on and the account are stubs: they plug
// into boutique.js and essai.mjs at integration.

// the service worker, and the breeze paused off screen or in a hidden tab (cache.mjs)
import { langue } from './traduction.mjs';
import './cache.mjs';

export const SCENE = '../scene/';
export const $ = (id) => document.getElementById(id);
export const [shop, { default: fr }] = await Promise.all([
  fetch(`${SCENE}boutique.json`).then((r) => r.json()),
  import(`${SCENE}langues/fr.mjs`),
]);

// sens.json: each flower's meaning, from catalogue/recettes/sens_prix_*.json (sens, and per colour family when it changes)
// soli.json: the soliflores, their price, meaning, colour and months (from catalogue/skus.csv mois_vente)
// latin.json: each flower's botanical name (catalogue/catalogue.json), shown with the cultivar in the bill
// Fetched once, on demand; the bindings below are filled when they arrive (ES modules export live bindings).
export let SENS = null;
export let SOLI = null;
export let LATIN = null;
const once = new Map();
const charge = (file, set) => {
  if (!once.has(file)) once.set(file, fetch(file).then((r) => r.json()).then((j) => (set(j), j)));
  return once.get(file);
};
export const chargeSens = () => charge('sens.json', (j) => (SENS = j));
export const chargeSoli = () => charge('soli.json', (j) => (SOLI = j));
// ---------- a soliflore (owner, 2026-11-01): one flower of the season at the price of its stem, the vase offered, fading
// over thirty days; its own page is fleur.html?f=<sid>
export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const moisSoli = (f) => (f.toute_annee ? 'Toute l’année' : f.mois.length ? `De ${MOIS[f.mois[0] - 1]} à ${MOIS[f.mois[f.mois.length - 1] - 1]}` : '');
export const lienFleur = (sid, pour, c) => `fleur.html${query({ f: sid, pour, c })}`;
// the soliflore drawn (owner, 2026-11-03): its colourway k alone in its vase, baked from the engine's drawing by
// decor/scene/soliflores.mjs (soliflores/<sid>/<k>.webp, every one at the same scale, so a card shows true sizes)
export const dessinSoli = (f, k = 0) =>
  `<img src="soliflores/${encodeURIComponent(f.sid)}/${k}.webp" alt="" loading="lazy" decoding="async" draggable="false">`;
// the two vases of the soliflores: the celadon bottle with its silver mistletoe, the Art nouveau column for the flowers
// too large for it (soli.json « vase », written by outils/soli.py from soliflores/index.json)
export const VASES_SOLI = { soliflore: 'une bouteille en céladon cerclée de gui d’argent', colonne: 'une colonne Art nouveau en grès' };
export const vaseSoli = (f) => VASES_SOLI[f.vase] || VASES_SOLI.soliflore;
export const chargeLatin = () => charge('latin.json', (j) => (LATIN = j));

// « Tulipa gesneriana ‘Voque’ »: the species, then the cultivar when the colourway names one (a capitalised name in
// brackets; « (meleagris) » or « (armeniacum) » are already part of the species)
// the colourway's name without its cultivar, which the botanical line already gives
export const colourName = (cn) => cn.replace(/\s*\([A-Z][^)]*\)/, '');
export const botanical = (sid, cn = '') => {
  const cv = /\(([A-Z][^)]*)\)/.exec(cn)?.[1];
  return [LATIN?.[sid], cv ? `‘${cv.split(',')[0].trim()}’` : ''].filter(Boolean).join(' ');
};

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const price = (cts) => euros.format(cts / 100);
// whole euros written without cents (the price range, the soliflore)
export const plain = (cts) => (cts % 100 ? price(cts) : euros.format(cts / 100).replace(/,00/, ''));
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const products = shop.produits;
export const stems = (p) => p.tiges.reduce((a, t) => a + t[1], 0);
export const vaseName = (p) => fr.vases[p.vase] || p.vase;
export const narrow = () => matchMedia('(max-width: 900px)').matches;
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const FLAGSHIP = 'printemps-a-la-carpe';
export const flagship = products.find((p) => p.id === FLAGSHIP) || products[0];
export const byId = (id) => products.find((p) => p.id === id);

// ---------- the pages' addresses: a bouquet's product page and its composer carry the bouquet and the chosen use
// (?pour=offrir or ?pour=moi, set by the landing's doors and kept through the collection)
const params = new URLSearchParams(location.search);
export const pourChoisi = ['offrir', 'moi', 'plusieurs'].includes(params.get('pour')) ? params.get('pour') : null;
const query = (o) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : '';
};
export const lienProduit = (id, pour, hash = '') => `produit.html${query({ b: id, pour })}${hash}`;
// the Retouche page (owner, 2026-11-01: « l'atelier » is the craft page now; the composer is renamed)
export const lienAtelier = (id, pour) => `retouche.html${query({ b: id, pour })}`;
export const lienCatalogue = (pour) => `index.html${query({ pour })}`;
// the bouquet named by ?b=, the month's flagship otherwise
export const produitDemande = () => byId(params.get('b')) || flagship;

// the collection closes on the last day of its month; the next one opens the day after
export const [yy, mm] = shop.collection.mois.split('-').map(Number);
const lastDay = new Date(yy, mm, 0);
export const endTxt = lastDay.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
export const monthTxt = lastDay.toLocaleDateString('fr-FR', { month: 'long' });
export const deMois = (m) => `${/^[aeiouy]/i.test(m) ? 'd’' : 'de '}${m}`;
export const nextMonth = new Date(yy, mm, 1).toLocaleDateString('fr-FR', { month: 'long' });
for (const el of document.querySelectorAll('[data-fin]')) el.textContent = endTxt;
for (const el of document.querySelectorAll('[data-collection]')) el.textContent = `Collection ${deMois(monthTxt)}`;

// ---------- a live bouquet in a box: as large as its column allows, never taller than the screen leaves room for
const metaOf = new Map();
export const meta = (id) => {
  if (!metaOf.has(id)) metaOf.set(id, fetch(`${SCENE}bouquets/${id}/sprites/sprites.json`).then((r) => r.json()));
  return metaOf.get(id);
};
export function fit(box, vb, maxH) {
  // the parent's content width, its padding taken off (jury n2: the box overflowed the phone by 24 px)
  const cs = getComputedStyle(box.parentElement);
  const room = box.parentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const w = Math.min(room, (maxH * vb[2]) / vb[3]);
  box.style.width = `${w}px`;
  box.style.height = `${(w * vb[3]) / vb[2]}px`;
  return w;
}
const opened = new Map();
export const ouvert = (id) => {
  if (!opened.has(id)) opened.set(id, fetch(`${SCENE}bouquets/${id}/ouvert.json`).then((r) => r.json()));
  return opened.get(id);
};
// a swaying bouquet out of view holds its breeze (no work for what nobody sees)
export const offscreen = new IntersectionObserver((entries) => {
  for (const e of entries)
    for (const a of e.target.getAnimations({ subtree: true })) e.isIntersecting ? a.play() : a.pause();
});

// R13: the bouquet stands on something: a contact shadow and a warm pool of light under its foot (meta.pied, in the
// drawing's units), drawn under the vase, never over the flowers
export function ground(box, m, w) {
  const k = w / m.vb[2];
  const sol = document.createElement('span');
  sol.className = 'sol';
  sol.style.left = `${(m.pied[0] - m.vb[0]) * k}px`;
  sol.style.top = `${(m.pied[1] - m.vb[1]) * k}px`;
  sol.style.setProperty('--w', `${Math.min(w * 0.5, m.vb[2] * k * 0.42)}px`);
  box.prepend(sol);
}

// the hook frames a close-up of the bouquet, larger than its window, filling it (owner, 2026-10-31: it may pass the top a
// little, the space must be full). On a computer it stands in the middle, larger than the hook, the vase below the fold;
// on a phone it spans the width, centred, its lower part under the words, behind a veil.
// the hook's window on a phone runs this far under the middle of the title's first line, where its fade ends (squelette.css)
const PIED = 40;
// on a computer, where the bouquet stands in the hook (owner, 2026-11-01): the middle of its flowers between these two
// fractions of the width, and the height from its top to the upper third of its vase, in hook heights
const CADRE = { gauche: 0.41, droite: 0.96, taille: 1.45 };
// the span of a bouquet's flowers across, in the drawing's units: its heads and their stems (the pieces with a depth), not
// the vase nor the drawing's box, which often runs further on one side than the flowers do
function fleurs(vb, donnees) {
  const p = (donnees?.pieces || []).filter((x) => x.z && x.b);
  if (!p.length) return [vb[0], vb[0] + vb[2]];
  return [Math.min(...p.map((x) => x.b[0])), Math.max(...p.map((x) => x.b[0] + x.b[2]))];
}
export function closeUp(box, vb, donnees) {
  const fig = box.parentElement;
  const W = fig.clientWidth;
  // on a computer the window runs past the hook's foot (the fade); the scale is the hook's own height
  const H = narrow() ? fig.clientHeight : fig.parentElement.clientHeight;
  // the middle of the flowers is the middle of the window (owner, 2026-11-01), not the middle of the drawing's box
  const [x0, x1] = fleurs(vb, donnees);
  // on a phone the flowers span the width, a little past both edges, the same for every bouquet; the bouquet stands on the
  // fade's end, which is the middle of the title's first line (owner, 2026-11-01): its foot is anchored there, whatever the
  // screen, and it is never taller than the window above that point
  // on a computer (owner, 2026-11-01) the bouquet stands on the right, larger than the hook: its flowers may run past the
  // top and the sides (« quitte à ce qu'il déborde »), at least the upper third of its vase seen at the foot; no fade
  const vase = donnees?.orig?.find((o) => o.t === 'vase')?.b;
  const pied = vase ? vase[1] + vase[3] / 3 : vb[1] + vb[3];
  const k = narrow()
    ? Math.min((W * 1.12) / (x1 - x0), (H - PIED) / vb[3])
    : (CADRE.taille * H) / (pied - vb[1]);
  const [w, h] = [vb[2] * k, vb[3] * k];
  const centre = ((x0 + x1) / 2 - vb[0]) * k;
  const left = narrow() ? W / 2 - centre : (W * (CADRE.gauche + CADRE.droite)) / 2 - centre;
  const top = narrow() ? H - PIED - h : H - (pied - vb[1]) * k;
  Object.assign(box.style, { width: `${w}px`, height: `${h}px`, left: `${left}px`, top: `${top}px` });
  return w;
}

export function stage(box, maxH, place) {
  offscreen.observe(box);
  let token = 0;
  let live = null;
  const s = {
    id: null,
    clear() {
      token++;
      if (live) live.arret();
      live = null;
      box.replaceChildren();
    },
    // src: another pack of the same bouquet to pose ({ url, donnees }: the atelier's, each piece apart), or a promise of it;
    // returns the pose. { sprites: true }: the bouquet shows at once from its baked sprites (300 KB), and gives way to its
    // SVG, in phase, once that is in (owner, 2026-11-02: « WebP d'abord, puis SVG »); without the pack, the sprites stay
    async show(id, src = null, { sprites = false } = {}) {
      s.clear();
      const my = token;
      s.id = id;
      const p = byId(id);
      const m = await meta(id);
      if (my !== token) return;
      if (sprites && !place) {
        const w = fit(box, m.vb, maxH());
        ground(box, m, w);
        const names = [...new Set(p.tiges.map((t) => fr.flowers[t[0]] || t[0]))];
        box.setAttribute('aria-label', `${p.nom} : ${fr.list(names)}, dans ${vaseName(p)}`);
        let first = null;
        try {
          first = await Eclosion.sprites(box, `${SCENE}bouquets/${id}/sprites/sprites.json`, { donnees: m });
          await first.pret;
          if (my !== token) return first.arret();
          live = first;
          first.montre();
        } catch (err) {
          console.error('[squelette] sprites', id, err);
        }
        const pack = await Promise.resolve(src).catch(() => null);
        if (my !== token) return;
        if (!pack) {
          if (!first) failed(box);
          return first;
        }
        const b = await Eclosion.pose(box, pack.url, { plans: 1, donnees: pack.donnees, debut: first?.debut() }).catch((err) => (console.error('[squelette] bouquet', id, err), null));
        if (!b) return first;
        await b.pret;
        if (my !== token) return b.arret();
        b.montre();
        first?.arret();
        live = b;
        return b;
      }
      // a placed bouquet is framed on its flowers, which its pieces tell
      const donnees = place ? (src ? src.donnees : await ouvert(id).catch(() => null)) : null;
      if (my !== token) return;
      const w = place ? place(box, m.vb, donnees) : fit(box, m.vb, maxH());
      if (!place) ground(box, m, w);
      const names = [...new Set(p.tiges.map((t) => fr.flowers[t[0]] || t[0]))];
      box.setAttribute('aria-label', `${p.nom} : ${fr.list(names)}, dans ${vaseName(p)}`);
      let b;
      try {
        b = await Eclosion.pose(box, src ? src.url : `${SCENE}bouquets/${id}/ouvert.json`, { plans: 1, donnees: src ? src.donnees : await ouvert(id) });
      } catch (err) {
        // M9: the visitor is told plainly, with a way to try again
        console.error('[squelette] bouquet', id, err);
        if (my === token) failed(box);
        return;
      }
      await b.pret;
      if (my !== token) return b.arret();
      live = b;
      b.montre();
      return b;
    },
    // the box's own svg, for a redrawn composition (the live bouquet goes)
    async svg(id) {
      s.clear();
      s.id = id;
      const m = await meta(id);
      ground(box, m, fit(box, m.vb, maxH()));
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      box.append(svg);
      return svg;
    },
  };
  return s;
}
function failed(box) {
  const p = document.createElement('p');
  p.className = 'echec';
  p.setAttribute('role', 'alert');
  p.innerHTML = 'Ce bouquet ne s’est pas chargé. <button type="button">Réessayer</button>';
  p.querySelector('button').addEventListener('click', () => location.reload());
  box.append(p);
}

// a bouquet posed at a given width, from its sprites (small pictures: the try-on's preview, the posters): swaying by
// default, still with { still: true } (no breeze, no animation at all: the drawing is simply there)
export async function poseIn(box, id, width, { still = false } = {}) {
  const m = await meta(id);
  box.replaceChildren();
  box.style.width = `${width}px`;
  box.style.height = `${(width * m.vb[3]) / m.vb[2]}px`;
  const b = await Eclosion.sprites(box, `${SCENE}bouquets/${id}/sprites/sprites.json`, { donnees: m, final: still });
  await b.pret;
  b.montre();
  return b;
}

// ---------- the meanings (sens.json, built by outils/sens.py from SENS-SOURCES.md): two readings, chosen with a toggle
// - one country's reading: the meaning as that country's old books give it, a taboo marked as such; the visitor's own
//   country first when it has a book;
// - otherwise the atelier's choice: the favourable meaning a source gives, with its citation, or none (owner, 2026-10-31).
//   It has no button of its own any more (owner, 2026-11-01: « bouton inutile »).
// The pages that show meanings await chargeSens() first.
// the reading follows the page's language (owner, 2026-11-02: « met automatiquement celui de la langue choisie »): its
// country's old book, or the atelier's choice for a language without one
const PAR_LANGUE = { fr: 'FR', en: 'UK', de: 'DE', es: 'ES', zh: 'CN', ja: 'JP' };
let pays = PAR_LANGUE[langue] || 'atelier';
export const paysChoisi = () => pays;
// another language chosen in place: its book, the meanings shown repainted, the pages that sort by meaning told
document.addEventListener('langue:change', () => {
  const p = PAR_LANGUE[langue] || 'atelier';
  if (p === pays) return;
  pays = p;
  for (const el of document.querySelectorAll('[data-sens]')) paint(el);
  document.dispatchEvent(new CustomEvent('sens:pays'));
});
// { t: text, s: citation, tabou } of a flower (sid), of one of its colours (fam) when it has its own, or null
export function reading(sid, fam) {
  const e = SENS?.[sid];
  if (!e) return null;
  if (pays === 'atelier') {
    if (fam && e.couleur && fam in e.couleur) return e.couleur[fam] ? { t: e.couleur[fam], s: e.source } : null;
    return e.sens ? { t: e.sens, s: e.source } : null;
  }
  const r = e.pays?.[pays];
  const c = fam && r?.couleur?.[fam];
  if (c) return { t: c.sens, s: c.source, tabou: c.tabou };
  if (r?.sens) return { t: r.sens, s: r.source, tabou: r.tabou };
  // a book that gives the flower only by colour (La Tour's lilacs): its first colour, named
  const [k, first] = Object.entries(r?.couleur || {})[0] || [];
  return first ? { t: `${k[0].toUpperCase() + k.slice(1)} : ${first.sens.toLowerCase()}`, s: first.source, tabou: first.tabou } : null;
}
// a line that shows a meaning: what comes before (the colour's name), the meaning, its citation in small, what comes after
export function said(el, pre, sid, fam, post = '') {
  Object.assign(el.dataset, { sens: sid, pre: pre || '', fam: fam || '', post });
  paint(el);
}
function paint(el) {
  const { sens: sid, pre, fam, post } = el.dataset;
  const r = reading(sid, fam);
  el.textContent = `${pre}${r ? `${pre ? ' · ' : ''}${r.t}` : ''}${post}`;
  el.classList.toggle('sens-tabou', !!r?.tabou);
  if (r?.tabou) el.insertAdjacentHTML('afterbegin', '<span class="tabou">à éviter en cadeau</span> ');
  if (!r?.s) return;
  const c = document.createElement('cite');
  c.className = 'sens-source';
  c.textContent = r.s;
  el.append(' ', c);
}
export const spoken = (c) => reading(c.sid, c.fam)?.t || '';
// ---------- the florist's bill before the engine: one line per flower, from the shop's data (the product page and the
// composer, which first shows it while the engine loads). Needs chargeSens() and chargeLatin().
export function plainBill(p) {
  $('n-lignes').replaceChildren(
    ...p.tiges.map(([sid, n, cts]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td><span class="fleur"><span><span></span><em class="latin"></em><small class="sens-fleur"></small></span></span></td><td></td><td></td>';
      tr.querySelector('.fleur > span > span').textContent = cap(fr.flowers[sid] || sid);
      said(tr.querySelector('.sens-fleur'), '', sid);
      tr.querySelector('.latin').textContent = botanical(sid);
      tr.children[1].textContent = n;
      tr.children[2].textContent = price(n * cts);
      return tr;
    }),
  );
  if ($('n-fleurs')) $('n-fleurs').textContent = p.tiges.length;
  if ($('note-aide')) $('note-aide').textContent = 'Chaque tige au prix d’un fleuriste en France en 2026.';
}

// ---------- the flower one points at stands out in the drawing (owner, 2026-10-31): a white veil over the whole bouquet,
// and the flower's own pieces copied above it, swaying in step with the originals. The composer and the product page pose
// the atelier's pack (each piece apart, each flower's pieces marked with its colourway) to have them.
export const outerOf = (img) => (img.parentElement?.classList.contains('bq-brise') ? img.parentElement : img);
export function projecteur() {
  let veil = null;
  let copies = [];
  // live: the posed bouquet; indices: the pieces to light, or nothing to give the bouquet back whole
  return (live, indices) => {
    for (const c of copies) c.remove();
    copies = [];
    if (!live || !indices) {
      veil?.remove();
      veil = null;
      return;
    }
    const host = live.el;
    veil ||= Object.assign(document.createElement('div'), { className: 'atelier-voile' });
    host.append(veil);
    for (const i of indices) {
      const outer = outerOf(live.pieces[i]);
      const c = outer.cloneNode(true);
      host.append(c);
      copies.push(c);
      const a = outer.getAnimations()[0];
      if (a) c.animate(a.effect.getKeyframes(), a.effect.getTiming()).currentTime = a.currentTime;
    }
  };
}

// ---------- the magnifier: the bouquet zoomed in its own window, dragged to look around (owner, 2026-10-31). The SVG is
// scaled by a plain transform (no will-change), so the browser draws it again sharp at each level.
export function loupe(box) {
  const LEVELS = [1, 1.6, 2, 2.5, 4];
  const scene = box.parentElement;
  let z = 1;
  let x = 0;
  let y = 0;
  const clamp = () => {
    // the drawing never leaves its window: at most half its zoomed overhang either way
    const mx = (box.clientWidth * (z - 1)) / 2;
    const my = (box.clientHeight * (z - 1)) / 2;
    x = Math.max(-mx, Math.min(mx, x));
    y = Math.max(-my, Math.min(my, y));
  };
  const paint = () => {
    clamp();
    box.style.transform = z === 1 ? '' : `translate(${x}px, ${y}px) scale(${z})`;
    scene.classList.toggle('zoome', z > 1);
    $('loupe-taux').textContent = `${z.toString().replace('.', ',')}×`;
    $('loupe-moins').disabled = z === 1;
    $('loupe-plus').disabled = z === LEVELS.at(-1);
  };
  // a new level, keeping the point under (px, py) (offsets from the bouquet's centre) where it was
  const set = (next, px = 0, py = 0) => {
    const k = next / z;
    x = px - (px - x) * k;
    y = py - (py - y) * k;
    z = next;
    if (z === 1) x = y = 0;
    paint();
  };
  const step = (d, px, py) => set(LEVELS[Math.max(0, Math.min(LEVELS.length - 1, LEVELS.indexOf(z) + d))], px, py);
  const fromCentre = (e) => {
    const r = scene.getBoundingClientRect();
    return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2];
  };
  $('loupe-plus').addEventListener('click', () => step(1));
  $('loupe-moins').addEventListener('click', () => step(-1));
  $('loupe-taux').addEventListener('click', () => set(1));
  box.addEventListener('dblclick', (e) => (z === LEVELS.at(-1) ? set(1) : step(1, ...fromCentre(e))));
  // a trackpad's pinch (and ctrl + wheel) zooms the bouquet, not the page
  scene.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    step(e.deltaY < 0 ? 1 : -1, ...fromCentre(e));
  }, { passive: false });
  let drag = null;
  scene.addEventListener('pointerdown', (e) => {
    if (z === 1 || e.target.closest('button, a')) return;
    drag = { id: e.pointerId, sx: e.clientX - x, sy: e.clientY - y };
    scene.setPointerCapture(e.pointerId);
  });
  scene.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    x = e.clientX - drag.sx;
    y = e.clientY - drag.sy;
    paint();
  });
  for (const ev of ['pointerup', 'pointercancel']) scene.addEventListener(ev, () => (drag = null));
  return { set };
}

// ---------- the ways to pay, in small black marks (owner, 2026-11-01: « discrètement, en noir »): cards, the two wallets,
// PayPal, and the local ways of the visitor's country (Stripe's own methods). The marks are simple-icons' (CC0), in
// paiements.svg; a way without a mark is named in words.
// Only Stripe's ways, as Stripe opens them to a business in France (owner, 2026-11-01: « toutes les options Stripe », no
// other provider; docs.stripe.com/payments/payment-methods/payment-method-support, read 2026-11-01). Pix, OXXO, GCash,
// PayNow, PromptPay and Kakao Pay are not open to it; Klarna only in its customers' countries.
const LOCAL = {
  CN: ['alipay', 'wechat'], HK: ['alipay', 'wechat'], TW: ['alipay'], JP: ['jcb'], IN: ['UPI'], DE: ['klarna', 'sepa'],
  AT: ['klarna', 'sepa', 'EPS'], NL: ['sepa', 'iDEAL'], BE: ['klarna', 'Bancontact'], FI: ['klarna', 'MobilePay'], DK: ['MobilePay'],
  SE: ['Swish'], PL: ['BLIK', 'P24'], CH: ['klarna', 'TWINT'], PT: ['MB WAY', 'Multibanco'], FR: ['CB', 'klarna', 'Alma'],
  ES: ['sepa'], IT: ['sepa'], CA: ['klarna'], AU: ['klarna'],
};
// paying in instalments (owner, 2026-11-01): Alma and Klarna in France, Klarna in its other countries; chosen at the checkout
export const enPlusieursFois = () =>
  region === 'FR' ? 'Payable en 3 ou 4 fois avec Alma ou Klarna, à la caisse.' : (LOCAL[region] || []).includes('klarna') ? 'Payable en plusieurs fois avec Klarna, à la caisse.' : '';
const MARQUES = new Set(['visa', 'mastercard', 'americanexpress', 'jcb', 'applepay', 'googlepay', 'paypal', 'klarna', 'sepa', 'alipay', 'wechat', 'pix']);
export const region = (() => {
  try {
    return new Intl.Locale(navigator.languages?.[0] || navigator.language || 'fr-FR').maximize().region || '';
  } catch (_) {
    return '';
  }
})();
export function marquesPaiement() {
  const el = document.createElement('p');
  el.className = 'moyens';
  const ways = ['visa', 'mastercard', 'americanexpress', 'applepay', 'googlepay', 'paypal', ...(LOCAL[region] || [])];
  const names = { americanexpress: 'American Express', applepay: 'Apple Pay', googlepay: 'Google Pay', paypal: 'PayPal', wechat: 'WeChat Pay', sepa: 'SEPA' };
  el.setAttribute('aria-label', `Paiement par ${ways.map((w) => names[w] || (MARQUES.has(w) ? cap(w) : w)).join(', ')}, chez Stripe`);
  for (const w of ways) {
    if (MARQUES.has(w)) el.insertAdjacentHTML('beforeend', `<svg class="marque-paiement m-${w}" aria-hidden="true"><use href="paiements.svg#${w}"/></svg>`);
    else el.insertAdjacentHTML('beforeend', `<span class="marque-mot" aria-hidden="true">${w}</span>`);
  }
  return el;
}

// ---------- the basket (owner, 2026-11-01): several bouquets, each with its quantity, before the checkout. It lives in
// this browser (localStorage) until the checkout; the header shows how many bouquets wait in it.
const PANIER = 'belai-panier';
export const panier = {
  lire() {
    try {
      return JSON.parse(localStorage.getItem(PANIER)) || [];
    } catch (_) {
      return [];
    }
  },
  ecrire(items) {
    try {
      localStorage.setItem(PANIER, JSON.stringify(items));
    } catch (_) {}
    panierCompte();
  },
  // the same bouquet for the same use adds up; a group gift keeps its own recipients
  ajoute(item) {
    const items = panier.lire();
    const same = items.find((x) => x.id === item.id && x.pour === item.pour && item.pour !== 'plusieurs');
    if (same) same.qte += item.qte;
    else items.push(item);
    panier.ecrire(items);
  },
};
const panierTotal = (items) => items.reduce((a, x) => a + x.centimes * x.qte, 0);
// a soliflore given for every 100 € of bouquets in one order (owner, 2026-11-01), to keep or to give: so a buyer rallies
// someone to give it to
export const SOLI_PALIER = 10000;
export const solisOfferts = (centimes) => Math.floor(centimes / SOLI_PALIER);
export const solisTexte = (n) => (n === 1 ? 'Un soliflore offert, à garder ou à offrir' : `${n} soliflores offerts, à garder ou à offrir`);
const POUR = { offrir: 'à offrir', moi: 'pour moi', plusieurs: 'pour plusieurs' };
// (a soliflore in the basket carries soli: true, its name « Soliflore · <flower> », its colourway)
function panierCompte() {
  const n = panier.lire().reduce((a, x) => a + x.qte, 0);
  for (const c of document.querySelectorAll('.panier-compte')) {
    c.textContent = n || '';
    c.hidden = !n;
  }
  // an empty basket has no button (owner, 2026-11-01): it comes with the first bouquet put in it
  for (const b of document.querySelectorAll('.panier-btn')) b.hidden = !n;
  // whole sentences, for the phrase books
  for (const b of document.querySelectorAll('.panier-btn')) b.setAttribute('aria-label', !n ? 'Panier vide' : n === 1 ? 'Panier, 1 bouquet' : `Panier, ${n} bouquets`);
}
function panierFenetre() {
  let d = $('panier');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'panier';
    d.className = 'panier';
    d.setAttribute('aria-labelledby', 'panier-titre');
    d.innerHTML = `<div class="panier-tete"><h2 id="panier-titre">Votre panier</h2><button type="button" class="panier-fermer" aria-label="Fermer le panier">×</button></div>
      <ul class="panier-liste" id="panier-liste"></ul>
      <p class="panier-vide" id="panier-vide">Votre panier est vide. Choisissez un bouquet, puis « Ajouter au panier ».</p>
      <div class="panier-pied" id="panier-pied">
        <p class="panier-offert" id="panier-offert" hidden></p>
        <p class="panier-total"><span>Total</span><span id="panier-total"></span></p>
        <p class="plusieurs-fois" id="panier-fois" hidden></p>
        <label class="case pro-case"><input type="checkbox" id="pro"> Facture au nom d’une entreprise</label>
        <div class="pro" id="pro-champs" hidden>
          <label>Raison sociale<input type="text" maxlength="80" autocomplete="organization" data-pro="societe"></label>
          <label>SIRET ou numéro de TVA intracommunautaire<input type="text" maxlength="40" data-pro="numero"></label>
          <label>Adresse de facturation<textarea rows="2" maxlength="200" autocomplete="street-address" data-pro="adresse"></textarea></label>
          <label>Votre référence (bon de commande, service)<input type="text" maxlength="60" data-pro="reference"></label>
          <label class="case"><input type="checkbox" data-pro="cadeau" checked> Mentionner « cadeaux professionnels » sur la facture, avec la liste des bénéficiaires</label>
          <p class="pro-note">Une facture détaillée par bouquet, envoyée avec la confirmation et gardée dans votre compte. TVA non applicable, article 293 B du CGI.</p>
        </div>
        <label class="case age-case"><input type="checkbox" id="age"> J’ai 16 ans ou plus.</label>
        <p class="age-note" id="age-note" hidden>Cochez « J’ai 16 ans ou plus » pour continuer.</p>
        <button type="button" class="btn btn-achat" data-bouchon="achat">Passer à la caisse</button>
      </div>`;
    document.body.append(d);
    $('panier-pied').append(marquesPaiement());
    // the minimum age (owner, 2026-11-01: 16, the age that covers every EU country for the data of a minor): asked at
    // every checkout, not kept; the checkout waits for it
    const pay = d.querySelector('[data-bouchon="achat"]');
    pay.addEventListener('click', (e) => {
      if ($('age').checked) return;
      e.stopPropagation();
      $('age-note').hidden = false;
      $('age').focus();
    });
    $('age').addEventListener('change', () => $('age').checked && ($('age-note').hidden = true));
    // the business invoice (owner, 2026-11-01): kept in this browser with the basket, until the checkout
    const PRO = 'belai-facture';
    let pro = {};
    try {
      pro = JSON.parse(localStorage.getItem(PRO)) || {};
    } catch (_) {}
    $('pro').checked = !!pro.on;
    $('pro-champs').hidden = !pro.on;
    for (const f of d.querySelectorAll('[data-pro]')) {
      if (f.type === 'checkbox') f.checked = pro[f.dataset.pro] ?? true;
      else f.value = pro[f.dataset.pro] || '';
    }
    const save = () => {
      pro = { on: $('pro').checked };
      for (const f of d.querySelectorAll('[data-pro]')) pro[f.dataset.pro] = f.type === 'checkbox' ? f.checked : f.value.trim();
      try {
        localStorage.setItem(PRO, JSON.stringify(pro));
      } catch (_) {}
    };
    $('pro').addEventListener('change', () => {
      $('pro-champs').hidden = !$('pro').checked;
      save();
    });
    $('pro-champs').addEventListener('input', save);
    d.querySelector('.panier-fermer').addEventListener('click', () => d.close());
    d.addEventListener('click', (e) => e.target === d && d.close());
    $('panier-liste').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-k]');
      if (!b) return;
      const items = panier.lire();
      const it = items[Number(b.dataset.k)];
      if (!it) return;
      if (b.dataset.f === 'moins') it.qte = Math.max(it.pour === 'plusieurs' ? 2 : 1, it.qte - 1);
      if (b.dataset.f === 'plus') it.qte += 1;
      if (b.dataset.f === 'retirer') items.splice(Number(b.dataset.k), 1);
      panier.ecrire(items);
      panierListe();
    });
  }
  panierListe();
  return d;
}
function panierListe() {
  const items = panier.lire();
  $('panier-liste').replaceChildren(
    ...items.map((x, k) => {
      const li = document.createElement('li');
      li.innerHTML = `<div class="panier-quoi"><b></b><span></span></div>
        <div class="pas" role="group" aria-label="Quantité"><button type="button" data-k="${k}" data-f="moins" aria-label="Un de moins">−</button><output>${x.qte}</output><button type="button" data-k="${k}" data-f="plus" aria-label="Un de plus">+</button></div>
        <span class="panier-prix">${price(x.centimes * x.qte)}</span>
        <button type="button" class="panier-retirer" data-k="${k}" data-f="retirer">Retirer</button>`;
      li.querySelector('b').textContent = x.nom;
      li.querySelector('.panier-quoi span').textContent = `${POUR[x.pour] || ''}${x.destinataires?.length ? ` · ${x.destinataires.filter((r) => r.prenom).map((r) => r.prenom).join(', ')}` : ''}`;
      return li;
    }),
  );
  $('panier-vide').hidden = items.length > 0;
  $('panier-pied').hidden = !items.length;
  $('panier-total').textContent = price(panierTotal(items));
  // the soliflores it gives, and how far the next one is: counted on its bouquets only
  const total = panierTotal(items.filter((x) => !x.soli));
  const n = solisOfferts(total);
  const reste = SOLI_PALIER - (total % SOLI_PALIER);
  $('panier-offert').textContent = n ? solisTexte(n) : `Encore ${price(reste)} de bouquets, et un soliflore vous est offert.`;
  $('panier-offert').classList.toggle('acquis', n > 0);
  $('panier-offert').hidden = !items.length;
  $('panier-fois').textContent = enPlusieursFois();
  $('panier-fois').hidden = !items.length || !enPlusieursFois();
  const pay = $('panier-pied').querySelector('[data-bouchon="achat"]');
  pay.textContent = items.length ? `Passer à la caisse · ${price(panierTotal(items))}` : 'Passer à la caisse';
}
export const ouvrirPanier = () => panierFenetre().showModal();

// ---------- one theme only (owner, 2026-11-01: « on n'a que le mode blanc avec pointe de couleur »): the dark one is
// gone, and a choice an earlier visit kept in this browser is forgotten
delete document.documentElement.dataset.theme;
try {
  localStorage.removeItem('belai-theme');
} catch (_) {}

// ---------- the framed buttons (owner, 2026-11-01): « Essayer » in every header; « J'ai reçu un bouquet » at the foot, in the
// phone's bar and in the footer. The latter opens the code's window where the page has it, else the landing's
// (index.html#recu)
{
  document
    .querySelector('.tete-droite')
    ?.insertAdjacentHTML('afterbegin', '<a class="essayer-bouton" href="produit.html#essayer" data-bouchon="essai-direct">Essayer</a>');
  const RECU = '<a class="recu-bouton" href="index.html#recu">J’ai reçu un bouquet</a>';
  document.querySelector('.onglets')?.insertAdjacentHTML('beforeend', RECU);
  document.querySelector('.pied-marque')?.insertAdjacentHTML('beforeend', RECU);
  for (const b of document.querySelectorAll('.recu-bouton'))
    b.addEventListener('click', (ev) => {
      if (!$('recu-boite')) return;
      ev.preventDefault();
      $('recu-boite').showModal();
    });
  if (location.hash === '#recu' && $('recu-boite')) $('recu-boite').showModal();
}
{
  // the basket's button in every header, before the account; it shows only once something is in it (owner, 2026-11-01)
  const right = document.querySelector('.tete-droite');
  if (right) {
    right.querySelector('.compte-lien')?.insertAdjacentHTML(
      'beforebegin',
      `<button type="button" class="discret panier-btn" aria-label="Panier vide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.3 11.2a1 1 0 01-1 .8H7.3a1 1 0 01-1-.8z"/><path d="M9 8V6.5a3 3 0 016 0V8"/></svg><span class="panier-compte" hidden></span></button>`,
    );
    right.querySelector('.panier-btn')?.addEventListener('click', ouvrirPanier);
  }
  panierCompte();
  addEventListener('storage', (e) => e.key === PANIER && panierCompte());
}


// ---------- stubs: what is not plugged in yet says so in a small window. A page may add its own (stubs.x = (el) => text)
// or take a stub over with a real action (actions.x = (el) => {...}, e.g. the try-on on the product page).
export const stubs = {
  achat: () => 'Le paiement n’est pas encore ouvert dans cet aperçu.',
  film: () => 'Le film de l’atelier arrive sur la chaîne YouTube de Belai’s Garden : ce lien y mènera, dans un nouvel onglet.',
  essai: () => 'Bientôt dans cet aperçu : vous partagez votre écran, l’abeille vous guide, et le bouquet se pose sur votre bureau.',
  compte: () => 'Bientôt dans cet aperçu : votre compte, avec votre prénom et un code reçu par e-mail ou par SMS. Pas de mot de passe.',
  recu: () => 'Bientôt dans cet aperçu : vous entrez le code reçu, et le bouquet qu’on vous offre éclôt avec son mot.',
  communaute: () => 'La communauté Belai’s Garden sur Discord ouvre bientôt.',
  launcher: () => 'Belai’s Launcher se télécharge ici, gratuitement, le jour de sa sortie.',
  'mes-bouquets': () => 'Bientôt dans cet aperçu : tous vos bouquets, vivants et fanés, dans votre compte.',
};
export const actions = {};
// every purchase asks for the account first (owner, 2026-11-02: required, validated by e-mail or phone; connexion.mjs); the
// payment itself is still a stub, said once the visitor is signed in
actions.achat = async (btn) => {
  const { exigeCompte } = await import('./connexion.mjs');
  if (!(await exigeCompte()) || !$('bouchon')) return;
  $('bouchon-texte').textContent = stubs.achat(btn);
  $('bouchon').showModal();
};

// ---------- the try-on (../scene/essai.mjs): the visitor's desktop, the live SVG bouquet framed on it, the bee giving each
// step. From a product page, its bouquet; from the header's « Essayer » (owner, 2026-10-31), the screen's sharing at once
// (no Belai’s Launcher), the bouquet of the page or the flagship first, and every bouquet of the collection behind the frame's
// arrows. The module and the bouquets' player are fetched ahead, at idle: the sharing must be asked on the very click.
let essaiMod = null;
const essaiPret = () =>
  Promise.all([
    (essaiMod ||= import(`${SCENE}essai.mjs`)),
    // its own stylesheet, on every page that has the header (the product page links it already)
    document.querySelector('link[href$="essai.css"]')
      ? null
      : new Promise((ok) => {
          const el = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `${SCENE}essai.css` });
          el.onload = el.onerror = ok;
          document.head.append(el);
        }),
    window.Eclosion
      ? null
      : new Promise((ok, ko) => {
          const el = document.createElement('script');
          el.src = `${SCENE}eclosion.js`;
          el.onload = ok;
          el.onerror = ko;
          document.head.append(el);
        }),
  ]).then(([m]) => m);
(window.requestIdleCallback || setTimeout)(() => essaiPret().catch(() => {}));
const enSvg = (q) => ({
  vb: () => meta(q.id).then((m) => m.vb),
  poser: async (el) => Eclosion.pose(el, `${SCENE}bouquets/${q.id}/ouvert.json`, { donnees: await ouvert(q.id) }),
});
export function essayer(btn, { p = flagship, partage = false, tous = false, evite = null } = {}) {
  const url = new URL(`${SCENE}bouquets/${p.id}/ouvert.json`, document.baseURI).href;
  essaiPret()
    .then((m) =>
      m.ouvrir({
        T: fr.js,
        I18N: { bureau: { installer: 'Belai-Bureau-0.1.0-x64-setup.exe', win: fr.desktop.winSmall, soon: fr.desktop.soon } },
        jours: 30,
        index: () => fetch(`${SCENE}bouquets/${p.id}/sprites/sprites.json`).then((r) => r.json()),
        base: `${SCENE}bouquets/${p.id}/sprites/`,
        svg: enSvg(p),
        racine: SCENE,
        ouvert: url,
        nom: p.nom,
        partage,
        bouquets: tous ? products.map((q) => ({ nom: q.nom, svg: enSvg(q) })) : null,
        indice: tous ? Math.max(0, products.indexOf(p)) : 0,
        evite: evite || (() => null),
        focusBack: () => btn && btn.focus({ preventScroll: true }),
      }),
    )
    .catch((err) => console.error('[essai]', err));
}
actions['essai-direct'] = (btn) => essayer(btn, { p: products.find((q) => q.id === params.get('b')) || flagship, partage: true, tous: true });
document.addEventListener('click', (ev) => {
  const r = ev.target.closest('[data-bouchon="recu"]');
  if (r && $('recu-boite')) {
    ev.preventDefault();
    $('recu-boite').showModal();
    return;
  }
  const t = ev.target.closest('[data-bouchon]');
  if (!t) return;
  ev.preventDefault();
  const k = t.dataset.bouchon;
  if (actions[k]) return void actions[k](t);
  if (!stubs[k] || !$('bouchon')) return;
  $('bouchon-texte').textContent = stubs[k](t);
  $('bouchon').showModal();
});

// ---------- « J'ai reçu un bouquet »: the link received opens the gift's own page (recu.html), which asks for the code sent
// apart (owner, 2026-11-02: a link alone opens nothing, and the code is never put in a link). The giver's name is not asked:
// a gift may be unsigned. Only a link to this shop's gift page is followed (no open redirect), and a code pasted in it goes.
if ($('recu-boite')) {
  $('recu-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const texte = $('rb-lien').value.trim();
    let u = null;
    try {
      // the link is often pasted with the words around it: its first address is taken
      u = new URL((texte.match(/https?:\/\/\S+/) || [texte])[0], location.href);
    } catch (_) {}
    if (!u || u.origin !== location.origin || !u.pathname.endsWith('/recu.html')) {
      $('rb-etat').textContent = 'Collez le lien en entier, tel qu’on vous l’a transmis : il mène à la page du cadeau.';
      return;
    }
    u.searchParams.delete('code');
    location.href = `${u.pathname}${u.search}`;
  });
}

// ---------- the header's nav and the phone's section bar: the link of this page is marked; a link to a section of this
// page is marked while that section fills the middle of the screen
{
  const page = (u) => u.pathname.split('/').pop() || 'index.html';
  const here = page(location);
  const watched = new Map(); // section -> its links
  for (const a of document.querySelectorAll('.nav a, .onglets a')) {
    const u = new URL(a.getAttribute('href'), location.href);
    if (page(u) !== here) continue;
    if (!u.hash) {
      a.setAttribute('aria-current', 'page');
      continue;
    }
    const sec = document.querySelector(u.hash);
    if (!sec) continue;
    if (!watched.has(sec)) watched.set(sec, []);
    watched.get(sec).push(a);
  }
  if (watched.size) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          for (const a of watched.get(e.target)) e.isIntersecting ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current');
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    for (const sec of watched.keys()) io.observe(sec);
  }
}

// a new width redraws the boxes (a phone's toolbar changing the height alone does not); each page says what to redraw
export function surLargeur(fn) {
  let t = 0;
  let lastW = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === lastW) return;
    lastW = innerWidth;
    clearTimeout(t);
    t = setTimeout(fn, 250);
  });
}

// ---------- the phone's section bar eases in three seconds after the page opens, wherever one is on it (owner, 2026-11-01)
setTimeout(() => document.body.classList.add('onglets-prets'), 3000);
