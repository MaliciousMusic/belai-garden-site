// catalogue.mjs: the month's collection, which is the landing since 2026-11-01 (index.html; catalogue.html leads there).
// Each tile leads to its bouquet's product page, carrying the use chosen at the door (?pour=offrir|moi). Belai's Launcher
// follows the collection.
// Every bouquet stands still (owner, 2026-11-01: « les photos ne sont pas animées »): posed with its breeze held, it sways
// only while a pointer is on its card, its flowers brought close; a page of eleven bouquets costs nothing at rest. They are
// drawn from their baked sprites (Eclosion.sprites), the SVG never loaded here. Each
// tile is posed when it comes within a quarter screen of the view, one after the other, when the page is idle (its drawing
// is read and painted on the main thread: a scroll or a touch come first).
import { idle } from './cache.mjs';
import { $, deMois, fit, lienProduit, meta, monthTxt, panier, pourChoisi, price, products, SCENE, surLargeur } from './noyau.mjs';

$('c-titre').textContent = `La collection ${deMois(monthTxt)}`;

// the card (owner, 2026-11-01): its name above the bouquet, the bouquets standing still on a white ground, their feet on one
// line; a pointer on a card brings its flowers close and lets them sway. At the foot, one pill: the price and a « + » in a
// circle, which adds the bouquet to the basket
const plus = (p, li) => {
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'ajout-prix';
  const dit = (ok) => add.setAttribute('aria-label', `${ok ? 'Ajouté au panier' : 'Ajouter au panier'} : ${p.nom}, ${price(p.prix.centimes)}`);
  dit(false);
  add.innerHTML = `<span class="ajout-prix-montant">${price(p.prix.centimes)}</span><span class="ajout-prix-plus" aria-hidden="true"></span>`;
  add.addEventListener('click', () => {
    panier.ajoute({ id: p.id, nom: p.nom, centimes: p.prix.centimes, pour: pourChoisi === 'moi' ? 'moi' : 'offrir', qte: 1 });
    add.classList.add('ajoute');
    dit(true);
    setTimeout(() => {
      add.classList.remove('ajoute');
      dit(false);
    }, 1600);
  });
  li.append(add);
};
$('grille').replaceChildren(
  ...products.map((p) => {
    const li = document.createElement('li');
    li.dataset.id = p.id;
    li.innerHTML = `<a class="tuile">
      <span class="tuile-nom"></span>
      <span class="tuile-scene"><span class="tuile-bq"></span></span>
    </a>`;
    li.querySelector('a').href = lienProduit(p.id, pourChoisi);
    li.querySelector('.tuile-nom').textContent = p.nom;
    li.querySelector('.tuile-bq').setAttribute('role', 'img');
    li.querySelector('.tuile-bq').setAttribute('aria-label', p.nom);
    // a quick add to the basket, beside the link (owner, 2026-11-01: « s'il veut les 11, ça va vite »)
    plus(p, li);
    return li;
  }),
);

// where a bouquet's flowers are, in its drawing (fractions of its box): the close-up on hover is centred there. Its swaying
// images (sprites.json, in the world) tell it
function coeur(m) {
  const [vx, vy, vw, vh] = m.vb;
  const e = m.boite[2] / vw;
  const p = (m.proche?.frames || []).filter((f) => f.z).map((f) => [vx + (f.x - m.boite[0]) / e, vy + (f.y - m.boite[1]) / e, f.w / e]);
  if (!p.length) return [0.5, 0.35];
  const x0 = Math.min(...p.map((b) => b[0]));
  const x1 = Math.max(...p.map((b) => b[0] + b[2]));
  const y0 = Math.min(...p.map((b) => b[1]));
  const bouche = m.orig?.find((o) => o.t === 'vase')?.b?.[1] ?? vy + vh * 0.6;
  return [((x0 + x1) / 2 - vx) / vw, ((y0 + bouche) / 2 - vy) / vh];
}
// a tile's bouquet, sized to its scene and standing on its foot; posed with its breeze held, the breeze let go only while a
// pointer or the keyboard is on its card (one swaying bouquet at a time, none at rest)
async function poseTile(li) {
  const box = li.querySelector('.tuile-bq');
  const scene = box.parentElement;
  const m = await meta(li.dataset.id);
  const cs = getComputedStyle(scene);
  const h = scene.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  fit(box, m.vb, h);
  if (box.firstChild) return;
  await new Promise((ok) => idle(ok, 1500));
  const [ox, oy] = coeur(m);
  box.style.transformOrigin = `${(ox * 100).toFixed(1)}% ${(oy * 100).toFixed(1)}%`;
  // its baked sprites, not its SVG: about 300 KB instead of 1 to 10 MB (owner, 2026-11-02)
  const b = await Eclosion.sprites(box, `${SCENE}bouquets/${li.dataset.id}/sprites/sprites.json`, { donnees: m });
  await b.pret;
  b.montre();
  // (the breeze's own animations only: the close-up's transition on the box is left alone)
  const brise = (on) => {
    for (const a of box.getAnimations({ subtree: true })) if (a.effect?.target?.classList?.contains('bq-brise')) on ? a.play() : a.pause();
  };
  brise(false);
  const vers = (on) => () => {
    li.classList.toggle('proche', on);
    brise(on);
  };
  li.addEventListener('pointerenter', vers(true));
  li.addEventListener('pointerleave', vers(false));
  li.addEventListener('focusin', vers(true));
  li.addEventListener('focusout', vers(false));
}
let tiles = Promise.resolve();
const nearTiles = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      nearTiles.unobserve(e.target);
      tiles = tiles.then(() => poseTile(e.target)).catch((err) => console.error('[squelette] tile', e.target.dataset.id, err));
    }
  },
  { rootMargin: '25% 0px' },
);
for (const li of document.querySelectorAll('#grille li')) nearTiles.observe(li);

surLargeur(() => {
  for (const li of document.querySelectorAll('#grille li')) if (li.querySelector('.tuile-bq').firstChild) poseTile(li);
});

// ---------- Belai's Launcher: the visitor's own system comes first and is marked (the others stay, of equal weight)
{
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iphone' : /Android/.test(ua) ? 'android' : /Windows/.test(ua) ? 'windows' : /Mac OS X/.test(ua) ? 'mac' : /Linux|CrOS/.test(ua) ? 'linux' : null;
  const lien = os && document.querySelector(`.launcher-liens [data-os="${os}"]`);
  if (lien) {
    lien.classList.add('le-votre');
    lien.closest('ul').prepend(lien.closest('li'));
  }
}
