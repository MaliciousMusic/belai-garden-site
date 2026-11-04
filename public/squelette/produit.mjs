// produit.mjs: a bouquet's product page (produit.html?b=<id>): the bouquet alive with its magnifier, the card (name,
// price, gift or for me, the purchase, the gift's page), the bill folded, the try-on, what one receives, the questions.
// The previous and next bouquets are shown in place, the address following (history.replaceState). Composing the colours
// is a page of its own (retouche.html, owner 2026-10-31): the ways in on the scene and in the bill lead there.
import { vocal } from './vocal.mjs';
import {
  $, actions, botanical, chargeLatin, colourName, enPlusieursFois, essayer, chargeSens, flagship, lienAtelier, lienProduit, loupe, marquesPaiement, meta, narrow,
  ouvrirPanier, panier, plainBill, poseIn, pourChoisi, price, produitDemande, products, projecteur, reduced, said, SCENE, stage, stems, stubs, surLargeur, vaseName,
} from './noyau.mjs';

// on a phone the bouquet takes what is left of the first screen above the gift setting and the purchase (owner, 2026-11-01)
const shopStage = stage($('bouquet'), () => (narrow() ? innerHeight - 56 - 300 : innerHeight - 56 - 150));
const zoom = loupe($('bouquet'));
// the meanings and the botanical names of the bill come with the page, before the first card is filled
await Promise.all([chargeSens(), chargeLatin()]);

// ---------- gift, for me, or for several people: chosen at the door (?pour=), or here; the action says which
// « Pour moi » unless the visitor chose otherwise at the door (owner, 2026-11-01)
let use = pourChoisi || 'moi';
let chosen = !!pourChoisi; // carried to the composer only when the visitor chose it
let shown = null;
let qte = 2; // how many bouquets « Pour plusieurs » gives

// the ways of unwrapping (owner, 2026-11-01); their drawings are still to be made
const DEBALLAGES = [
  ['papillons', 'Papillons qui déballent', 'Des papillons soulèvent le papier et s’envolent.'],
  ['dechire', 'Papier déchiré', 'On tire un coin : le papier se déchire comme à la main.'],
  ['pliage', 'Pliage qui se déplie', 'Un papier plié qui s’ouvre pli par pli.'],
];
let deballage = 'papillons';
$('deballages').replaceChildren(
  ...DEBALLAGES.map(([k, n, d]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.deballage = k;
    b.innerHTML = '<i aria-hidden="true"></i><b></b><span></span>';
    b.querySelector('b').textContent = n;
    b.querySelector('span').textContent = d;
    b.addEventListener('click', () => {
      deballage = k;
      for (const o of $('deballages').children) o.setAttribute('aria-checked', String(o.dataset.deballage === k));
    });
    b.setAttribute('aria-checked', String(k === deballage));
    return b;
  }),
);

// the voice message, optional (owner, 2026-11-02)
vocal({ rec: $('vocal-rec'), ecoute: $('vocal-ecoute'), effacer: $('vocal-effacer'), etat: $('vocal-etat') });

// « Pour plusieurs »: one line per person, their name, their word, their way of unwrapping
function recipients() {
  const list = $('destinataires');
  while (list.children.length < qte) {
    const k = list.children.length + 1;
    const li = document.createElement('li');
    li.innerHTML = `<p class="dest-titre">Personne ${k}</p>
      <label>Son prénom (facultatif)<input type="text" maxlength="40" autocomplete="off" data-f="prenom"></label>
      <label>Votre mot<textarea rows="2" maxlength="280" data-f="mot"></textarea></label>
      <label>Le déballage<select data-f="deballage">${DEBALLAGES.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>`;
    list.append(li);
  }
  while (list.children.length > qte) list.lastElementChild.remove();
  $('qte').value = qte;
  $('qte-moins').disabled = qte <= 2;
  label();
}
// no limit on the number (owner, 2026-11-01): the steps, or a number typed in
$('qte-moins').addEventListener('click', () => ((qte = Math.max(2, qte - 1)), recipients()));
$('qte-plus').addEventListener('click', () => ((qte += 1), recipients()));
$('qte').addEventListener('change', () => {
  qte = Math.max(2, Math.round(Number($('qte').value)) || 2);
  recipients();
});
// a list pasted from a spreadsheet: one person a line, their name, their word, their way of unwrapping (tab or semicolon)
// (the French keyword, or the start of the option's name as the page shows it, in its own language)
const plainText = (x) => (x || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const unwrap = (w, sel) => {
  const t = plainText(w);
  if (!t) return deballage;
  const fr = DEBALLAGES.find(([k, n]) => t.startsWith(k.slice(0, 4)) || plainText(n).startsWith(t));
  // any word of the option's shown name will do (« rasgado » for « Papel rasgado »)
  const vu = (o) => plainText(o.textContent);
  return fr ? fr[0] : [...sel.options].find((o) => vu(o).startsWith(t) || vu(o).split(/\s+/).some((m) => m.startsWith(t)))?.value || deballage;
};
$('liste-remplir').addEventListener('click', () => {
  const rows = $('liste').value.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/\t|;/).map((x) => x.trim()));
  if (!rows.length) return;
  qte = Math.max(2, rows.length);
  recipients();
  [...$('destinataires').children].forEach((li, k) => {
    const [prenom = '', mot = '', w = ''] = rows[k] || [];
    li.querySelector('[data-f="prenom"]').value = prenom;
    li.querySelector('[data-f="mot"]').value = mot;
    const sel = li.querySelector('[data-f="deballage"]');
    sel.value = unwrap(w, sel);
  });
  $('liste-bilan').textContent = rows.length === 1 ? '1 personne : complétez la seconde carte.' : `${rows.length} cartes remplies.`;
});

const count = () => (use === 'plusieurs' ? qte : 1);
function label() {
  $('v-acheter-mot').textContent = use === 'offrir' ? 'Offrir ce bouquet' : use === 'moi' ? 'Le garder pour moi' : `Offrir ${qte} bouquets`;
  $('b-acheter').textContent = use === 'moi' ? 'Le garder' : 'Offrir';
  if (shown) for (const id of ['v-prix', 'b-prix']) $(id).textContent = price(shown.prix.centimes * count());
  if (shown) $('v-jour').textContent = `soit ${price(Math.round(shown.prix.centimes / 30))} par jour de floraison`;
}
function setUse(u) {
  use = u;
  for (const o of document.querySelectorAll('.usage button')) o.setAttribute('aria-checked', String(o.dataset.usage === use));
  for (const t of document.querySelectorAll('.fiche [data-pour]')) t.hidden = t.dataset.pour !== use;
  if (use !== 'offrir') $('cadeau').hidden = true;
  $('plusieurs').hidden = use !== 'plusieurs';
  if (use === 'plusieurs') recipients();
  label();
}
// « Pour offrir » opens what makes it a gift (a second touch folds it); « Pour moi » closes it; « Pour plusieurs » opens
// the people one gives to
for (const btn of document.querySelectorAll('.usage button')) {
  btn.addEventListener('click', () => {
    chosen = true;
    if (btn.dataset.usage === 'offrir') $('cadeau').hidden = use === 'offrir' && !$('cadeau').hidden;
    setUse(btn.dataset.usage);
    links();
    history.replaceState(history.state, '', lienProduit(shown.id, use, location.hash));
  });
}

// the page's own links carry the bouquet shown: the composer, the group purchase, and the nav's links to this page's
// sections (« Essayer », « Questions »), which would otherwise load the month's flagship
function links() {
  const pour = chosen ? use : null;
  for (const a of document.querySelectorAll('a[data-composer]')) a.href = lienAtelier(shown.id, pour);
  const g = document.querySelector('.autres-achats a[href^="groupe.html"]');
  if (g) g.href = `groupe.html?b=${encodeURIComponent(shown.id)}`;
  for (const a of document.querySelectorAll('.nav a, .onglets a')) {
    const u = new URL(a.getAttribute('href'), location.href);
    if (u.pathname.endsWith('/produit.html') && u.hash) a.href = lienProduit(shown.id, pour, u.hash);
  }
}

// ---------- the card
function fill(p) {
  shown = p;
  document.title = `${p.nom}, bouquet numérique | Belai’s Garden`;
  $('v-nom').textContent = p.nom;
  $('v-compo').textContent = `${stems(p)} tiges de ${p.tiges.length} sortes de fleurs · ${vaseName(p).replace(/^une? /, '')}`;
  $('s-nom').textContent = p.nom;
  $('s-compo').textContent = $('v-compo').textContent;
  $('v-tiges').textContent = stems(p);
  $('n-total').textContent = price(p.prix.centimes);
  $('b-nom').textContent = p.nom;
  label();
  links();
}
function pick(p) {
  zoom.set(1);
  fill(p);
  plainBill(p);
  poser(p);
}

// ---------- the composition, folded among the details (owner, 2026-11-01): the retouche's bill, each flower in its
// colourway; a touch on a flower lights it in the bouquet, a second touch or a touch elsewhere gives the bouquet back whole.
// The bouquet is posed from the atelier's pack (each piece apart, each flower's pieces marked with its colourway), the same
// drawing as the open bouquet; without it, the open bouquet and the plain bill.
const packs = new Map();
const paquet = (id) => {
  if (!packs.has(id))
    packs.set(
      id,
      fetch(`${SCENE}bouquets/${id}/atelier.json`).then((r) => {
        if (!r.ok) throw new Error(`atelier ${r.status}`);
        return r.json();
      }),
    );
  return packs.get(id);
};
let live = null; // the bouquet posed from the pack
let byOrig = new Map(); // a flower's colourway -> the indices of its pieces
let vise = null; // the flower lit
const eclaire = projecteur();
async function poser(p) {
  live = null;
  vise = null;
  eclaire(null);
  // its sprites at once, its SVG (the atelier's pack) when it is in
  const enAttente = paquet(p.id).then((donnees) => ({ url: `${SCENE}bouquets/${p.id}/atelier.json`, donnees }));
  const b = await shopStage.show(p.id, enAttente, { sprites: true });
  const pack = (await enAttente.catch((err) => (console.error('[squelette] atelier', p.id, err), null)))?.donnees;
  if (shown !== p || !b || !pack || b.sprites) return;
  live = b;
  byOrig = new Map();
  const tiges = new Map(); // stem -> its flower's colourway
  pack.pieces.forEach((x, i) => {
    if (!x.c) return;
    (byOrig.get(x.c) || byOrig.set(x.c, []).get(x.c)).push(i);
    if (x.e != null) tiges.set(x.e, x.c);
  });
  facture(pack, tiges);
}
function facture(pack, tiges) {
  const rows = new Map();
  for (const orig of tiges.values()) rows.set(orig, (rows.get(orig) || 0) + 1);
  $('n-lignes').replaceChildren(
    ...[...rows].map(([orig, n]) => {
      const c = pack.fiches[orig];
      const tr = document.createElement('tr');
      tr.dataset.orig = orig;
      tr.innerHTML = '<td><button type="button" class="fleur" aria-pressed="false"><span class="pastille" aria-hidden="true"></span><span><span></span><em class="latin"></em><small></small></span></button></td><td></td><td></td>';
      tr.querySelector('.pastille').style.background = c.col;
      tr.querySelector('.fleur > span:last-child > span').textContent = c.n;
      tr.querySelector('.latin').textContent = botanical(c.sid, c.cn);
      said(tr.querySelector('small'), colourName(c.cn), c.sid, c.fam);
      tr.children[1].textContent = n;
      tr.children[2].textContent = price(n * c.price);
      return tr;
    }),
  );
}
function viser(orig) {
  vise = orig;
  for (const tr of document.querySelectorAll('#n-lignes tr[data-orig]')) {
    tr.classList.toggle('vise', tr.dataset.orig === orig);
    tr.querySelector('.fleur').setAttribute('aria-pressed', String(tr.dataset.orig === orig));
  }
  eclaire(live, orig ? byOrig.get(orig) || [] : null);
  // on a phone the bouquet is above the details: it comes into view, lit
  if (orig && narrow()) {
    const r = document.querySelector('.vitrine-scene').getBoundingClientRect();
    if (r.bottom < 80) document.querySelector('.vitrine-scene').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }
}
$('n-lignes').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-orig]');
  if (tr && live) viser(vise === tr.dataset.orig ? null : tr.dataset.orig);
});
document.addEventListener('click', (e) => {
  if (vise && !e.composedPath().some((n) => n.id === 'n-lignes')) viser(null);
});
$('composition').addEventListener('toggle', () => !$('composition').open && vise && viser(null));
// the toggle of the meanings sits above the list

// ---------- what the person who receives it sees: the gift's page, on a phone (it grows) and on a computer (posed)
let apGrow = null;
let apPose = null;
$('apercu').addEventListener('close', () => {
  apPose?.arret?.();
  apGrow?.arret?.();
  apPose = apGrow = null;
});
document.querySelector('[data-apercu]').addEventListener('click', async (ev) => {
  ev.preventDefault();
  // the gift's page as it will be received: the link carries no code (the page asks for it), and the signature only if
  // one was written (in this preview the word and the signature ride in the link; online they come from the server)
  const signe = $('signe').value.trim();
  const mot = $('mot').value.trim();
  const u = new URLSearchParams({ b: shown.id, lang: $('sa-langue').value, ...(signe ? { de: signe } : {}), ...(mot ? { mot } : {}) });
  $('ap-ouvrir').href = `recu.html?${u}`;
  for (const el of document.querySelectorAll('#apercu .ap-mot')) el.textContent = `« ${mot || $('mot').placeholder} »`;
  for (const el of document.querySelectorAll('#apercu .ap-de')) {
    if (!signe) el.textContent = 'Un bouquet pour vous';
    else el.replaceChildren('De la part de ', Object.assign(document.createElement('b'), { textContent: signe }));
  }
  for (const el of document.querySelectorAll('#apercu .ap-musique')) el.hidden = !$('musique').value;
  $('apercu').showModal();
  const box = $('ap-eclosion');
  const id = shown.id;
  poseIn($('ap-ordi-bq'), id, 120).then((b) => (apPose = b)).catch(() => {});
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return void poseIn(box, id, 140).catch(() => {});
  const m = await meta(id);
  if (apGrow) apGrow.arret?.();
  box.replaceChildren();
  box.style.width = '140px';
  box.style.height = `${(140 * m.vb[3]) / m.vb[2]}px`;
  apGrow = await Eclosion.ouvre(box, `${SCENE}bouquets/${id}/manifeste.json`).catch(() => null);
});

// ---------- « L'essayer sur mon bureau »: the shop's own try-on (../scene/essai.mjs): the visitor's desktop, the live SVG
// bouquet framed on it, the bee giving each step (owner, 2026-10-31: « mets-la »), with the bouquet being looked at
actions.essai = (btn) =>
  essayer(btn, {
    p: shown || flagship,
    evite: () => {
      const el = $('bouquet');
      return el.getBoundingClientRect().height > 0 ? el.getBoundingClientRect() : null;
    },
  });
stubs.achat = () => `Le paiement n’est pas encore ouvert dans cet aperçu. ${shown.nom} vous attend ici, à ${$('v-prix').textContent}.`;

// ---------- the basket: this bouquet, for this use, in this quantity (with its people when given to several)
$('v-acheter').after(marquesPaiement());
// paying in instalments, where Stripe opens it (owner, 2026-11-01)
if (enPlusieursFois()) {
  const fois = document.createElement('p');
  fois.className = 'plusieurs-fois';
  fois.textContent = enPlusieursFois();
  document.querySelector('.fiche .moyens').after(fois);
}
$('v-panier').addEventListener('click', () => {
  const people = use !== 'plusieurs' ? undefined
    : [...$('destinataires').children].map((li) => Object.fromEntries([...li.querySelectorAll('[data-f]')].map((f) => [f.dataset.f, f.value.trim()])));
  panier.ajoute({ id: shown.id, nom: shown.nom, centimes: shown.prix.centimes, pour: use, qte: count(),
    // the signature may stay empty (an unsigned gift); the voice message is not in the basket yet (vocal.mjs)
    ...(use === 'offrir' ? { mot: $('mot').value.trim(), signe: $('signe').value.trim(), musique: $('musique').value, deballage } : {}),
    ...(people ? { destinataires: people } : {}) });
  ouvrirPanier();
});

// ---------- the bar keeps the price and the action at hand while the card's own buttons are out of sight (phone), and
// only while the card fills the middle of the screen (n4: it offered the 300 € bouquet to visitors reading further down)
const io = new IntersectionObserver(([e]) => ($('barre').hidden = e.isIntersecting || e.boundingClientRect.top > 0));
io.observe(document.querySelector('.fiche .actions'));
new IntersectionObserver(([e]) => $('barre').classList.toggle('hors', !e.isIntersecting), { rootMargin: '-45% 0px -45% 0px' }).observe($('vitrine'));

setUse(use);
pick(produitDemande());

surLargeur(() => poser(shown));

// « ← Retour » in the header: the page one came from on this site, else the collection
$('retour-lien').addEventListener('click', (ev) => {
  let from = null;
  try {
    from = document.referrer ? new URL(document.referrer) : null;
  } catch (_) {}
  if (from && from.origin === location.origin && history.length > 1) {
    ev.preventDefault();
    history.back();
  }
});
