// phrases.mjs: how a French sentence of the site becomes a key of the phrase books (langues/<code>.json), shared by the
// translation at run time (traduction.mjs) and the harvest of the sentences (outils/recolte.mjs). The site is written in
// French; a key is the sentence with its whitespace collapsed and its variable parts numbered tokens, so one key serves
// every bouquet: prices {p1}, dates {d1}, months {m1}, numbers {n1}, in their order of appearance (a translation may
// move them). Free words inside a key written by hand ({x1}) are matched by translation.
export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const M = MOIS.join('|');
// a price as the French shop writes it (« 94,80 € », « 300 € », « 25 € »)
const PRIX = /(\d{1,3}(?:[\s  ]\d{3})*(?:,\d{2})?)[\s  ]?€/g;
const DATE = new RegExp(`(?<![\\p{L}\\d])(1er|\\d{1,2})[\\s\\u00a0](${M})(?![\\p{L}])`, 'giu');
const MONTH = new RegExp(`(?<![\\p{L}])(${M})(?![\\p{L}])`, 'giu');
const NUM = /\d+(?:[.,]\d+)?/g;

export const propre = (t) => t.replace(/[\s  ]+/g, ' ').trim();

// the key of a sentence, and the values its tokens stand for (by kind, in order); tokens are first written as markers
// without digits, so the numbers' pass does not see them, then numbered by kind
export function cle(texte) {
  const v = { p: [], d: [], m: [], n: [] };
  let k = propre(texte);
  k = k.replace(PRIX, (s, a) => (v.p.push(Number(a.replace(/[\s  ]/g, '').replace(',', '.'))), '\u0001p\u0002'));
  k = k.replace(DATE, (s, d, m) => (v.d.push([d === '1er' ? 1 : Number(d), MOIS.indexOf(m.toLowerCase())]), '\u0001d\u0002'));
  k = k.replace(MONTH, (s, m) => (v.m.push(MOIS.indexOf(m.toLowerCase())), '\u0001m\u0002'));
  k = k.replace(NUM, (s) => (v.n.push(s), '\u0001n\u0002'));
  const seen = { p: 0, d: 0, m: 0, n: 0 };
  return { k: k.replace(/\u0001([pdmn])\u0002/g, (s, kind) => `{${kind}${++seen[kind]}}`), v };
}

// is this text worth translating (a word of two letters at least, not only numbers or signs)?
export const aTraduire = (t) => /\p{L}{2}/u.test(t) && /\p{Ll}/u.test(t) && !/^[\s\d.,:;·•\-–—+×()€$%/]*$/.test(t);
