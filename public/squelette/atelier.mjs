// atelier.mjs: the composer, a page of its own (retouche.html?b=<id>, owner 2026-10-31): the bouquet on two thirds, the
// composition on the right third, edge to edge (phone: the bouquet held at the top). « ← Retour à la fiche » goes back to
// the bouquet's product page.
//
// The bouquet stays alive and a colourway changes at once (owner, 2026-10-31): no flower engine on this page. Every
// colourway of every flower was drawn once, in the same places (predessin.mjs --coloris): atelier.json is the open bouquet
// with each piece its own image, each flower's piece marked with the colourway it stands for; a choice fetches the small
// file of that flower in that colourway (coloris/<own>__<chosen>.json) and puts its pieces in place of the flower's, in the
// swaying bouquet. The flower one points at stands out through a white veil over the bouquet, its own pieces copied above
// the veil, swaying with the originals.
import './cache.mjs';
import {
  $, botanical, chargeLatin, chargeSens, colourName, lienProduit, loupe, narrow, outerOf, plainBill, pourChoisi, price,
  produitDemande, projecteur, reading, said, SCENE, shop, spoken, stage, stubs, surLargeur,
} from './noyau.mjs';

const shown = produitDemande();
const use = pourChoisi || 'moi';
const shopStage = stage($('bouquet'), () => (narrow() ? innerHeight * 0.7 - 56 - 8 : innerHeight - 56 - 150));
const PACK = `${SCENE}bouquets/${shown.id}/atelier.json`;
const zoom = loupe($('bouquet'));
document.title = `Retouche de ${shown.nom} | Belai’s Garden`;
$('a-titre').textContent = `Retouche de ${shown.nom}`;
$('compose-retour').href = lienProduit(shown.id, pourChoisi);

// ---------- the price and what the colours changed in it, said in plain figures (never a surprise at the payment)
function setPrice(cts) {
  $('n-prix').textContent = price(cts);
  $('n-total').textContent = price(cts);
  const d = cts - shown.prix.centimes;
  $('n-ecart').textContent = d ? `${price(shown.prix.centimes)} → ${price(cts)} (${d > 0 ? '+' : '−'}${price(Math.abs(d))})` : 'Le prix du bouquet d’origine';
}

// ---------- the composition: the florist's bill, and the place where colours are chosen
const swaps = new Map(); // original colourway id -> chosen colourway id
let pack = null; // atelier.json: the open bouquet, each piece apart, the colourways of its flowers and their records
let PBY = {}; // each colourway's name, colour, price, sort and family (pack.fiches)
let live = null; // the bouquet posed and swaying (Eclosion.pose)
let lastOut = null; // the bouquet's flowers, one per stem: [{ orig }]
let byOrig = new Map(); // a flower's own colourway -> the indices of its pieces, in stacking order
let baseSrc = []; // each piece's image as drawn in the bouquet's own colours
const dressed = new Map(); // a flower's own colourway -> the colourway its pieces show now

// ---------- the colour atelier: a game, not a form (owner, 2026-10-31: "clearly not playful enough")
// Every choice answers at once, in the bill (the line, its swatch, its meaning and the price change, the swatch blooms) and
// in the living bouquet (the flower's pieces in their new colourway); hold to compare with the original. No proposals:
// the owner chooses flower by flower (2026-10-31); the bill is its lines alone (2026-11-01).
const colourways = (orig) => pack.coloris[orig] || [orig];

// a flower's pieces in another colourway, fetched once (each piece's image made once too)
const variants = new Map();
function variant(orig, k) {
  const key = `${orig}__${k}`;
  if (!variants.has(key))
    variants.set(
      key,
      fetch(`${SCENE}bouquets/${shown.id}/coloris/${encodeURIComponent(key)}.json`)
        .then((r) => {
          if (!r.ok) throw new Error(`coloris ${key} ${r.status}`);
          return r.json();
        })
        .then((v) => v.pieces.map((x) => ({ ...x, url: URL.createObjectURL(new Blob([x.s], { type: 'image/svg+xml' })) }))),
    );
  return variants.get(key);
}
// a piece's image and frame: its box in the drawing's units, the joint it sways round kept where it was
function place(i, b, src) {
  const img = live.pieces[i];
  const outer = outerOf(img);
  const X0 = Math.floor(pack.vb[0]);
  const Y0 = Math.floor(pack.vb[1]);
  Object.assign(outer.style, { left: `${b[0] - X0}px`, top: `${b[1] - Y0}px`, width: `${b[2]}px`, height: `${b[3]}px`, visibility: '' });
  const o = pack.pieces[i].o;
  if (outer !== img && o) outer.style.transformOrigin = `${+(o[0] - b[0]).toFixed(2)}px ${+(o[1] - b[1]).toFixed(2)}px`;
  if (img.src !== src) img.src = src;
}
// one flower in one colourway: its pieces matched element by element, in stacking order
async function dress(orig, k) {
  if ((dressed.get(orig) || orig) === k) return;
  const mine = byOrig.get(orig) || [];
  if (k === orig) {
    for (const i of mine) place(i, pack.pieces[i].b, baseSrc[i]);
  } else {
    const got = await variant(orig, k);
    const byE = new Map();
    for (const x of got) (byE.get(x.e) || byE.set(x.e, []).get(x.e)).push(x);
    const used = new Map();
    for (const i of mine) {
      const e = pack.pieces[i].e;
      const n = used.get(e) || 0;
      used.set(e, n + 1);
      const x = byE.get(e)?.[n];
      if (x) place(i, x.b, x.url);
      else outerOf(live.pieces[i]).style.visibility = 'hidden'; // a piece this colourway does not draw
    }
  }
  dressed.set(orig, k);
}
// the whole bouquet as a set of choices shows it (the originals for the flowers not chosen)
let dressing = Promise.resolve();
function dressAll(target) {
  const want = new Map(target);
  dressing = dressing.then(() => Promise.all([...byOrig.keys()].map((o) => dress(o, want.get(o) || o)))).then(() => light(lit));
  return dressing;
}

// one line per colourway of the bouquet, as last drawn, with the current choices applied at once
function colourBill(bloom) {
  const rows = new Map(); // original id -> { id, n }
  for (const o of lastOut) {
    const r = rows.get(o.orig) || { id: swaps.get(o.orig) || o.orig, n: 0 };
    r.n++;
    rows.set(o.orig, r);
  }
  let sum = 0;
  const trs = [];
  for (const [orig, { id, n }] of rows) {
    const c = PBY[id];
    sum += n * c.price;
    const tr = document.createElement('tr');
    tr.dataset.orig = orig;
    if (id !== orig) tr.className = 'change';
    tr.innerHTML = '<td><span class="fleur"><button type="button" class="pastille"></button><span><span></span><em class="latin"></em><small></small></span></span></td><td></td><td></td>';
    const sw = tr.querySelector('.pastille');
    sw.style.background = c.col;
    sw.setAttribute('aria-label', `Changer le coloris : ${c.n}, ${c.cn}`);
    sw.setAttribute('aria-expanded', 'false');
    if (bloom && bloom.has(orig)) sw.classList.add('eclot');
    tr.querySelector('.fleur > span > span').textContent = c.n;
    tr.querySelector('.latin').textContent = botanical(c.sid, c.cn);
    said(tr.querySelector('small'), colourName(c.cn), c.sid, c.fam);
    tr.children[1].textContent = n;
    tr.children[2].textContent = price(n * c.price);
    sw.addEventListener('click', () => palette(tr, orig, id));
    // the whole line opens the colourways, not only its swatch (owner, 2026-10-31)
    tr.addEventListener('click', (e) => {
      if (!e.target.closest('.pastille')) palette(tr, orig, id);
    });
    trs.push(tr);
  }
  const focused = document.activeElement?.closest?.('#n-lignes tr')?.dataset.orig;
  $('n-lignes').replaceChildren(...trs);
  if (focused) document.querySelector(`#n-lignes tr[data-orig="${CSS.escape(focused)}"] .pastille`)?.focus({ preventScroll: true });
  setPrice(sum);
  const k = swaps.size;
  label();
}

// a fan of petals under the line: every colourway of the flower, its name and meaning shown as the finger or the eye lands
function palette(tr, orig, cur) {
  const open = tr.nextElementSibling && tr.nextElementSibling.classList.contains('ligne-palette');
  for (const x of document.querySelectorAll('.ligne-palette')) x.remove();
  for (const b of document.querySelectorAll('.pastille')) b.setAttribute('aria-expanded', 'false');
  if (open) return void light(null);
  const row = document.createElement('tr');
  row.className = 'ligne-palette';
  row.innerHTML = '<td colspan="3"><div class="palette" role="group"></div><p class="palette-nom"></p></td>';
  const box = row.querySelector('.palette');
  const say = row.querySelector('.palette-nom');
  box.setAttribute('aria-label', `Coloris de ${PBY[orig].n}`);
  const show = (k) => {
    const c = PBY[k];
    said(say, colourName(c.cn), c.sid, c.fam, c.price !== PBY[cur].price ? ` · ${price(c.price)} la tige` : '');
  };
  // the flower's colourways are fetched as the fan opens: a touch then shows at once
  for (const k of colourways(orig)) if (k !== orig) variant(orig, k).catch(() => {});
  colourways(orig).forEach((k, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'petale-choix';
    b.innerHTML = '<i class="petale"></i><span></span>';
    b.querySelector('i').style.background = PBY[k].col;
    b.querySelector('i').style.setProperty('--i', i);
    b.querySelector('span').textContent = PBY[k].cn.replace(/\s*\(.*$/, '');
    Object.assign(b.dataset, { k, nom: PBY[k].cn });
    b.setAttribute('aria-label', `${PBY[k].cn}${spoken(PBY[k]) ? `, ${spoken(PBY[k])}` : ''}`);
    b.setAttribute('aria-pressed', String(k === cur));
    b.addEventListener('pointerenter', () => show(k));
    b.addEventListener('focus', () => show(k));
    b.addEventListener('click', () => {
      const next = new Map(swaps);
      if (k === orig) next.delete(orig);
      else next.set(orig, k);
      choose(next, new Set([orig]));
    });
    box.append(b);
  });
  show(cur);
  tr.after(row);
  tr.querySelector('.pastille').setAttribute('aria-expanded', 'true');
  light(orig);
}
// another reading of the meanings names the petals again
document.addEventListener('sens:pays', () => {
  for (const p of document.querySelectorAll('.palette .petale-choix')) p.setAttribute('aria-label', p.dataset.nom + (spoken(PBY[p.dataset.k]) ? `, ${spoken(PBY[p.dataset.k])}` : ''));
});

// the flower one is changing stands out in the drawing: a white veil over the whole bouquet, and the flower's own pieces
// copied above it, swaying in step with the originals (owner, 2026-10-31). Pointing at a line lights its flower; an open
// fan of colourways keeps it lit.
let lit = null;
const eclaire = projecteur();
function light(orig) {
  lit = orig;
  for (const tr of document.querySelectorAll('#n-lignes tr[data-orig]')) tr.classList.toggle('vise', tr.dataset.orig === orig);
  eclaire(live, orig && !$('bouquet').classList.contains('compare') ? byOrig.get(orig) || [] : null);
}
// a line is chosen by a click and let go by a second click on it or a click anywhere else (owner, 2026-10-31): the
// bouquet is then whole again, without the veil
function letGo() {
  for (const x of document.querySelectorAll('.ligne-palette')) x.remove();
  for (const b of document.querySelectorAll('.pastille')) b.setAttribute('aria-expanded', 'false');
  light(null);
}
// (the click's path as it started: a colourway's petal is redrawn with its line at once, so by the time the click reaches
// the page the petal has left it, yet it was inside)
document.addEventListener('click', (e) => {
  if (lit && !e.composedPath().some((n) => n.id === 'n-lignes')) letGo();
});

// a new set of choices: answered at once in the bill and in the bouquet
function choose(next, bloom) {
  swaps.clear();
  for (const [a, b] of next) swaps.set(a, b);
  const openOrig = document.querySelector('.ligne-palette')?.previousElementSibling?.dataset.orig;
  const petal = document.activeElement?.closest?.('.petale-choix')?.dataset.k;
  colourBill(bloom);
  if (openOrig) {
    const tr = document.querySelector(`#n-lignes tr[data-orig="${CSS.escape(openOrig)}"]`);
    if (tr) palette(tr, openOrig, swaps.get(openOrig) || openOrig);
    if (petal) tr?.nextElementSibling?.querySelector(`[data-k="${CSS.escape(petal)}"]`)?.focus({ preventScroll: true });
  }
  dressAll(swaps).catch((err) => console.error('[atelier] coloris', err));
}

// the atelier opens by itself: its pack read, the bouquet posed alive, the bill becomes the place where colours are chosen
async function ouvrir() {
  const btn = $('composer');
  btn.hidden = true;
  $('attente').hidden = false;
  try {
    pack = await fetch(PACK).then((r) => {
      if (!r.ok) throw new Error(`atelier ${r.status}`);
      return r.json();
    });
    PBY = pack.fiches;
    byOrig = new Map();
    const stems = new Map();
    pack.pieces.forEach((x, i) => {
      if (!x.c) return;
      (byOrig.get(x.c) || byOrig.set(x.c, []).get(x.c)).push(i);
      if (x.e != null) stems.set(x.e, x.c);
    });
    lastOut = [...stems.values()].map((orig) => ({ orig }));
    await poser();
  } catch (err) {
    console.error('[atelier]', err);
    btn.hidden = false;
    btn.textContent = 'La retouche ne s’est pas ouverte. Réessayer';
    $('attente').hidden = true;
    return;
  }
  colourBill();
  $('attente').hidden = true;
  $('comparer').hidden = false;
  $('note-achat').hidden = false;
  $('note').classList.remove('repliee');
  $('v-etat').textContent = 'En direct, dans la brise.';
}
// the bouquet posed from the atelier's pack, then dressed in the current choices
async function poser() {
  live = await shopStage.show(shown.id, { url: PACK, donnees: pack });
  if (!live) throw new Error('bouquet');
  baseSrc = live.pieces.map((img) => img.src);
  zoom.set(1);
  dressed.clear();
  await dressAll(swaps);
}
$('composer').addEventListener('click', ouvrir);

// leaving the composer: back to the card, with the browser's own back when we came from it
$('compose-retour').addEventListener('click', (ev) => {
  let from = null;
  try {
    from = document.referrer ? new URL(document.referrer) : null;
  } catch (_) {}
  if (from && from.origin === location.origin && from.pathname.endsWith('/produit.html') && history.length > 1) {
    ev.preventDefault();
    history.back();
  }
});
// hold to compare: the original drawing over the composition while pressed (pointer or keyboard)
const compare = (on) => {
  if ($('bouquet').classList.contains('compare') === on) return;
  $('bouquet').classList.toggle('compare', on);
  dressAll(on ? new Map() : swaps);
};
$('comparer').addEventListener('pointerdown', () => compare(true));
for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) $('comparer').addEventListener(ev, () => compare(false));
$('comparer').addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    compare(true);
  }
});
$('comparer').addEventListener('keyup', () => compare(false));
// back to the bouquet as it was drawn, in one step
$('origine').addEventListener('click', () => lastOut && choose(new Map(), new Set(lastOut.map((o) => o.orig))));

// ---------- gift or for me (chosen on the card or at the door): the action says which, and whether the bouquet was recoloured
function label() {
  const what = swaps.size ? 'cette composition' : 'ce bouquet';
  $('n-acheter-mot').textContent = use === 'offrir' ? `Offrir ${what}` : what === 'ce bouquet' ? 'Le garder pour moi' : `Garder ${what}`;
}
stubs.achat = () => `Le paiement n’est pas encore ouvert dans cet aperçu. ${shown.nom}${swaps.size ? ', avec vos coloris,' : ''} vous attend ici, à ${$('n-prix').textContent}.`;

// the bill as the shop gives it while the atelier's pack loads: never a blank
await Promise.all([chargeSens(), chargeLatin()]);
plainBill(shown);
setPrice(shown.prix.centimes);
label();
ouvrir();

surLargeur(() => (pack ? poser() : null));
