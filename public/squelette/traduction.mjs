// traduction.mjs: the shop in ten languages (owner, 2026-11-01: English, Spanish, Italian, Japanese, German, Chinese,
// Filipino, then Brazilian Portuguese and Korean, and French, the language it is written in). Every page loads it first. It picks the language (?lang=, then
// the visitor's choice kept in this browser, then the browser's own language), loads that phrase book
// (langues/<code>.json, keys made by phrases.mjs) and translates the page's words and labels in place, then whatever the
// page writes later (a MutationObserver). Prices are written in the reader's way with an estimate in their own currency
// (owner: « monnaie locale estimée »), dates and months by Intl. The header's globe lists the languages; a choice rewrites
// the page in place, its visible words untyped then typed again, without reloading it (owner, 2026-11-03). `langue` and
// `locale` are live: a module reads them when it needs them, and hears 'langue:change' to redo what it wrote with them.
import { cle, aTraduire, propre } from './phrases.mjs';

export const LANGUES = [
  ['fr', 'Français', 'fr-FR'], ['en', 'English', 'en-GB'], ['es', 'Español', 'es-ES'], ['it', 'Italiano', 'it-IT'],
  ['de', 'Deutsch', 'de-DE'], ['ja', '日本語', 'ja-JP'], ['zh', '中文', 'zh-CN'], ['fil', 'Filipino', 'fil-PH'],
  ['pt', 'Português', 'pt-BR'], ['ko', '한국어', 'ko-KR'],
];
const CODES = LANGUES.map((l) => l[0]);
const KEY = 'belai-langue';
const choisie = (() => {
  const q = new URLSearchParams(location.search).get('lang');
  if (CODES.includes(q)) return q;
  try {
    const s = localStorage.getItem(KEY);
    if (CODES.includes(s)) return s;
  } catch (_) {}
  for (const l of navigator.languages || [navigator.language || 'fr']) {
    const c = l.toLowerCase().startsWith('tl') ? 'fil' : l.toLowerCase().split('-')[0];
    if (CODES.includes(c)) return c;
  }
  return 'fr';
})();
export let langue = choisie;
export let locale = LANGUES.find((l) => l[0] === langue)[2];

// the reader's currency, from their region, at a rate fixed with the collection (an estimate: Stripe charges in that
// currency at the checkout's own rate)
const DEVISES = {
  US: ['USD', 1.08], GB: ['GBP', 0.85], CA: ['CAD', 1.5], AU: ['AUD', 1.65], JP: ['JPY', 165], CN: ['CNY', 7.8], HK: ['HKD', 8.4],
  TW: ['TWD', 35], PH: ['PHP', 62], CH: ['CHF', 0.95], MX: ['MXN', 19.5], BR: ['BRL', 6], KR: ['KRW', 1480], IN: ['INR', 92],
  SG: ['SGD', 1.45], AE: ['AED', 4], SE: ['SEK', 11.5], NO: ['NOK', 11.8], PL: ['PLN', 4.3], MA: ['MAD', 10.8],
};
const region = (() => {
  try {
    return new Intl.Locale(navigator.languages?.[0] || navigator.language || locale).maximize().region || '';
  } catch (_) {
    return '';
  }
})();
const devise = DEVISES[region];
let eur2, eur0, loc; // the formats of the language shown
const formats = () => {
  eur2 = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' });
  // a round price without its cents (« €82 », as the French shop writes « 82 € »)
  eur0 = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  loc = devise && new Intl.NumberFormat(locale, { style: 'currency', currency: devise[0], maximumFractionDigits: 0 });
};
formats();
const eur = { format: (e) => (Math.abs(e - Math.round(e)) < 0.005 ? eur0 : eur2).format(e) };
const prix = (e) => (loc ? `${eur.format(e)} (≈ ${loc.format(e * devise[1])})` : eur.format(e));
const date = ([d, m]) => new Date(2026, m, d).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
const mois = (m) => new Date(2026, m, 1).toLocaleDateString(locale, { month: 'long' });

let LIVRE = null; // key -> translation
let MOTIFS = []; // keys with free words ({x1}), as patterns
const fait = new WeakMap(); // node -> the text we wrote, so our own writes are not translated again
const source = new WeakMap(); // node -> its French, as the page wrote it
const attrSource = new WeakMap(); // element -> { attribute: [its French, what we wrote] }

function rendre(k, v) {
  // a text of tokens and signs only (a price alone, « 94,80 € ») needs no phrase book, only the reader's way of writing it
  const t = LIVRE[k] ?? (/\{[pdm]\d+\}/.test(k) && !/\p{L}/u.test(k.replace(/\{[pdmn]\d+\}/g, '')) ? k : null);
  if (t == null) return null;
  return t.replace(/\{([pdmn])(\d+)\}/g, (s, kind, i) => {
    const x = v[kind][Number(i) - 1];
    if (x == null) return s;
    return kind === 'p' ? prix(x) : kind === 'd' ? date(x) : kind === 'm' ? mois(x) : x;
  });
}
// the translation of one text (its surrounding spaces kept), or null
export function traduire(texte) {
  if (!LIVRE || !(aTraduire(texte) || /\d[\s  ]?€/.test(texte))) return null;
  const { k, v } = cle(texte);
  let out = rendre(k, v);
  if (out == null)
    for (const [re, key, names] of MOTIFS) {
      const m = k.match(re);
      if (!m) continue;
      out = LIVRE[key].replace(/\{x(\d+)\}/g, (s, i) => {
        const part = m[names.indexOf(`x${i}`) + 1] || '';
        return traduire(part) ?? part;
      });
      out = out.replace(/\{([pdmn])(\d+)\}/g, (s, kind, i) => {
        const x = v[kind][Number(i) - 1];
        return x == null ? s : kind === 'p' ? prix(x) : kind === 'd' ? date(x) : kind === 'm' ? mois(x) : x;
      });
      break;
    }
  // a line of parts joined by « · » (a colourway and its meaning, met in no harvest): each part on its own
  if (out == null && k.includes(' · ')) {
    const parts = propre(texte).split(' · ');
    const tr = parts.map((x) => traduire(x));
    if (tr.some((x) => x != null)) out = parts.map((x, i) => tr[i] ?? x).join(' · ');
  }
  if (out == null) return null;
  const lead = texte.match(/^\s*/)[0];
  const tail = texte.match(/\s*$/)[0];
  return lead + out + tail;
}

const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
const ecrit = (n, t) => {
  fait.set(n, t);
  n.nodeValue = t;
};
const libre = (n) => n.parentElement && !n.parentElement.closest('script, style, [translate="no"], textarea');
// a text node's French: the page's own words, or what they were before we wrote over them
const francais = (n) => (fait.get(n) === n.nodeValue && source.has(n) ? source.get(n) : n.nodeValue);
function texteNoeud(n) {
  if (fait.get(n) === n.nodeValue || !libre(n)) return;
  source.set(n, n.nodeValue);
  const t = traduire(n.nodeValue);
  if (t != null && t !== n.nodeValue) ecrit(n, t);
}
function attributs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    if (!v) continue;
    const m = attrSource.get(el) || {};
    const fr = m[a]?.[1] === v ? m[a][0] : v;
    const t = (LIVRE && traduire(fr)) ?? fr;
    m[a] = [fr, t];
    attrSource.set(el, m);
    if (t !== v) el.setAttribute(a, t);
  }
}
function arbre(root) {
  if (root.nodeType === 3) return texteNoeud(root);
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  if (root.nodeType === 1) attributs(root);
  for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? texteNoeud(n) : attributs(n);
}
let titre = [document.title, document.title]; // [its French, what we wrote]
const metaSource = new WeakMap();
function meta() {
  // written only when it changes: a title the page sets is watched, and a translated title can match its own pattern
  // again (« {x1}, soliflore | … »), which would rewrite it for ever
  if (document.title !== titre[1]) titre = [document.title, document.title];
  const t = (LIVRE && traduire(titre[0])) ?? titre[0];
  titre[1] = t;
  if (t !== document.title) document.title = t;
  for (const m of document.querySelectorAll('meta[name="description"], meta[property^="og:"][content]')) {
    const w = metaSource.get(m);
    const fr = w?.[1] === m.content ? w[0] : m.content;
    const c = (LIVRE && traduire(fr)) ?? fr;
    metaSource.set(m, [fr, c]);
    if (c !== m.content) m.content = c;
  }
}

// the header's globe: the ten languages, the one shown marked; a choice is kept and the page is rewritten in it
function globe() {
  for (const d of document.querySelectorAll('details.langues')) remplir(d);
}
function remplir(d) {
  const ul = d.querySelector('ul');
  if (!ul) return;
  ul.replaceChildren(
    ...LANGUES.map(([c, nom]) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#';
      a.lang = c;
      a.textContent = nom;
      a.setAttribute('translate', 'no');
      if (c === langue) a.setAttribute('aria-current', 'true');
      a.addEventListener('click', (e) => {
        e.preventDefault();
        d.open = false;
        changeLangue(c);
      });
      li.append(a);
      return li;
    }),
  );
  const s = d.querySelector('summary span');
  if (s) s.textContent = langue === 'fil' ? 'FIL' : langue.toUpperCase();
  d.querySelector('summary')?.setAttribute('aria-label', `Langue : ${LANGUES.find((l) => l[0] === langue)[1]}`);
}

// a globe of its own, for a place outside the header (Bzzou's welcome, owner 2026-11-03)
export function choixLangue() {
  const d = document.createElement('details');
  d.className = 'langues';
  d.innerHTML = '<summary><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.8 2.6 14.2 0 17M12 3.5c-2.6 2.8-2.6 14.2 0 17"/></svg><span translate="no"></span></summary><ul></ul>';
  remplir(d);
  return d;
}

// ---------- the language changed in place (owner, 2026-11-03: « pas de reload, une animation typewrite qui untype tous
// les textes pour les remplacer par ceux de la bonne langue »)
const livres = {}; // code -> [book, patterns], kept once loaded
async function livre(c) {
  if (c === 'fr') return [null, []];
  if (!livres[c]) {
    const L = await fetch(`langues/${c}.json`).then((r) => r.json());
    const M = Object.keys(L)
      .filter((k) => /\{x\d+\}/.test(k))
      .map((k) => {
        const names = [];
        const src = k.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&').replace(/\\\{(x\d+)\\\}/g, (s, x) => (names.push(x), '(.+?)'));
        return [new RegExp(`^${src}$`), k, names];
      });
    livres[c] = [L, M];
  }
  return livres[c];
}
const attribut = (c) => (c === 'zh' ? 'zh-Hans' : c === 'pt' ? 'pt-BR' : c);
const calme = matchMedia('(prefers-reduced-motion: reduce)');
let frappe = null; // the typing under way: { fin() } writes every node's last text at once
// whether a node shows on the screen (its parent's box): only the words in view are typed, the others change at once
const enVue = (n) => {
  const r = n.parentElement.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
};
// untyped from the end, then typed again; each node at its own pace (about 9 ms a letter out, 16 in, within bounds)
function tape(liste) {
  const t0 = performance.now();
  for (const x of liste) {
    x.sortie = Math.min(420, Math.max(120, x.de.length * 9));
    x.entree = Math.min(900, Math.max(180, x.a.length * 16));
  }
  let id = 0;
  // a tab that draws no frames (in the background) still ends in the right words
  const garde = setTimeout(() => fin(), 1800);
  const fin = () => {
    cancelAnimationFrame(id);
    clearTimeout(garde);
    for (const x of liste) if (fait.get(x.n) === x.n.nodeValue) ecrit(x.n, x.a);
    frappe = null;
  };
  const image = (now) => {
    const t = now - t0;
    let encore = false;
    for (const x of liste) {
      if (x.fini || fait.get(x.n) !== x.n.nodeValue) continue; // the page wrote it meanwhile: its own words win
      let v;
      if (t < x.sortie) v = x.de.slice(0, Math.ceil(x.de.length * (1 - t / x.sortie)));
      else if (t < x.sortie + x.entree) v = x.a.slice(0, Math.floor((x.a.length * (t - x.sortie)) / x.entree));
      else v = x.a;
      // never quite empty: the line keeps its height while its words change
      ecrit(x.n, v || '​');
      if (v === x.a) x.fini = true;
      else encore = true;
    }
    if (encore) id = requestAnimationFrame(image);
    else fin();
  };
  id = requestAnimationFrame(image);
  frappe = { fin };
}
// words typed in from nothing, one node after the other, a letter every PAS ms (Bzzou's welcome, owner 2026-11-04: « une
// animation de type in »); each node keeps its French, so a change of language still finds it. At once when the system asks
// for less motion. Returns what stops it and writes the words whole; fini is told in every case.
const PAS = 14;
export function tapeDedans(noeuds, fini = () => {}) {
  const liste = noeuds.map((n) => ({ n, a: n.nodeValue }));
  const total = liste.reduce((s, x) => s + x.a.length, 0);
  if (calme.matches || !total) {
    fini();
    return () => {};
  }
  let id = 0;
  let parti = true;
  const fin = () => {
    if (!parti) return;
    parti = false;
    cancelAnimationFrame(id);
    clearTimeout(garde);
    for (const x of liste) if (fait.get(x.n) === x.n.nodeValue) ecrit(x.n, x.a);
    if (frappe === ici) frappe = null;
    fini();
  };
  const ici = { fin };
  // a tab that draws no frames (in the background) still ends in the right words
  const garde = setTimeout(fin, total * PAS + 1000);
  frappe?.fin();
  frappe = ici;
  // never quite empty: each line keeps its height while its words come
  for (const x of liste) ecrit(x.n, '\u200b');
  const t0 = performance.now();
  const image = (now) => {
    let reste = Math.floor((now - t0) / PAS);
    for (const x of liste) {
      if (fait.get(x.n) !== x.n.nodeValue) continue; // the page wrote it meanwhile: its own words win
      const v = reste >= x.a.length ? x.a : x.a.slice(0, reste) || '\u200b';
      if (v !== x.n.nodeValue) ecrit(x.n, v);
      reste = Math.max(0, reste - x.a.length);
    }
    if ((now - t0) / PAS >= total) fin();
    else id = requestAnimationFrame(image);
  };
  id = requestAnimationFrame(image);
  return fin;
}
export async function changeLangue(c) {
  if (!CODES.includes(c) || c === langue) return;
  try {
    localStorage.setItem(KEY, c);
  } catch (_) {}
  let L;
  try {
    L = await livre(c);
  } catch (_) {
    // the book did not come: the old way, the page reopened in that language
    const u = new URL(location.href);
    u.searchParams.delete('lang');
    location.href = u.href;
    return;
  }
  frappe?.fin();
  [LIVRE, MOTIFS] = L;
  langue = c;
  locale = LANGUES.find((l) => l[0] === c)[2];
  formats();
  document.documentElement.lang = attribut(c);
  const u = new URL(location.href);
  if (u.searchParams.has('lang')) {
    u.searchParams.delete('lang');
    history.replaceState(history.state, '', u.href);
  }
  globe();
  // what the modules wrote with the language (the meanings' book, say) is redone first, then every word is rewritten
  document.dispatchEvent(new CustomEvent('langue:change', { detail: c }));
  const liste = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 1) {
      attributs(n);
      continue;
    }
    if (!libre(n)) continue;
    const fr = francais(n);
    source.set(n, fr);
    const a = (LIVRE && traduire(fr)) ?? fr;
    if (a === n.nodeValue) continue;
    if (!calme.matches && n.nodeValue.trim() && enVue(n)) {
      fait.set(n, n.nodeValue);
      liste.push({ n, de: n.nodeValue, a });
    } else ecrit(n, a);
  }
  meta();
  if (liste.length) tape(liste);
}

const montrer = () => document.documentElement.classList.remove('traduction');
document.documentElement.lang = attribut(langue);
globe();
// whatever the page writes later, in the language shown (its French kept, for a change of language)
const veille = () => {
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') texteNoeud(m.target);
      else if (m.type === 'attributes') attributs(m.target);
      else for (const n of m.addedNodes) arbre(n);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  new MutationObserver(meta).observe(document.querySelector('title'), { childList: true });
};
if (langue === 'fr') {
  veille();
  montrer();
} else {
  setTimeout(montrer, 2500); // never a blank page for long, even if the phrase book is late
  try {
    [LIVRE, MOTIFS] = await livre(langue);
    arbre(document.body);
    meta();
    globe();
  } catch (_) {}
  veille();
  montrer();
}
export { propre };
