// banc.mjs: the test bench of the persona army (audit n7), on the site split into pages. For every page, at a computer's
// size and a phone's, it captures the screens top to bottom (with the boxes of their named elements, for regard.py) and
// measures what each kind of tester looks at with their own bias (lentilles.py turns the measures into their lenses):
// - reading: every text's size (as drawn, with the fonts' size-adjust), its contrast on its real background, the words
//   before the first purchase button, the reading time;
// - hands: the touch targets under 44 and 24 px;
// - money: every price on the page, where the first one and the first purchase button stand (which screen);
// - trust: the legal, contact, refund and review links;
// - access: images without text, nameless buttons, the page's language, its headings;
// - energy: the share of the processor busy at rest, the animations running, the memory;
// - weight: bytes and requests of a cold load, the moment the first bouquet shows, the largest paint;
// and some biased views: colour blindness (deuteranopia), blurred sight, a 200 % zoom, a slow phone on a slow network
// (frozen at 1, 3 and 8 s), reduced motion.
//
//   sh ../flower-atelier/ws/gate.sh node outils/banc.mjs <base url of public/squelette/> <out dir> [--formats ordinateur,telephone]
//
// Writes <out>/<format>-<nn>-<page>-<k>.png (+ .json boxes), <out>/<format>-<nn>-<page>-<view>.png for the biased views,
// and <out>/mesures.json. One headless Chrome, its own profile and port (BANC_PORT, 9373), closed at the end whatever happens.
import { spawn } from 'node:child_process';
import { freemem } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.BANC_PORT || 9373);
const PROFILE = join(process.env.TEMP || '.', 'banc-chrome');
const args = process.argv.slice(2);
const fi = args.indexOf('--formats');
const wanted = fi < 0 ? ['ordinateur', 'telephone'] : args.splice(fi, 2)[1].split(',');
const [base, out] = args;
const FORMATS = {
  ordinateur: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  telephone: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
};
const B = 'citrine';
// the pages, in a visit's order; `then` is what a visitor does before the page is looked at
const PAGES = [
  { name: 'accueil', path: 'index.html', views: true },
  { name: 'catalogue', path: 'catalogue.html', views: true },
  { name: 'fiche', path: `produit.html?b=${B}`, views: true },
  { name: 'fiche-offrir', path: `produit.html?b=${B}`, then: `document.querySelector('.usage [data-usage="offrir"]').click()`, at: '#cadeau', screens: 1 },
  { name: 'apercu', path: `produit.html?b=${B}`, then: `document.querySelector('[data-apercu]').click()`, screens: 1 },
  { name: 'atelier', path: `retouche.html?b=${B}`, views: true, screens: 2 },
  { name: 'atelier-fleur', path: `retouche.html?b=${B}`, then: `document.querySelector('#n-lignes tr').click()`, screens: 1 },
  { name: 'soliflore', path: 'soliflore.html' },
  { name: 'savoir-faire', path: 'savoir-faire.html' },
  { name: 'recu', path: 'recu.html', screens: 2 },
  { name: 'compte', path: 'compte.html', screens: 2 },
];
// what the eye may meet, by role (the first label that matches an element wins), then any heading, button or link by its words
const NAMED = [
  ['.tete', 'en-tête'],
  ['.accroche .sur-titre', 'étiquette accroche'],
  ['.accroche-titre', 'titre accroche'],
  ['.accroche-sous', 'phrase accroche'],
  ['[data-porte="offrir"]', 'porte offrir'],
  ['[data-porte="moi"]', 'porte pour moi'],
  ['.fourchette', 'fourchette de prix'],
  ['.compat', 'compatibilité'],
  ['.recu-lien', "j'ai reçu (en-tête)"],
  ['.retour-lien', 'retour (en-tête)'],
  ['#bouquet-accroche', 'bouquet accroche'],
  ['.cycle-boite', 'bloc cycle'],
  ['.cycle-etats', 'boutons du cycle'],
  ['.bloc-tete .sur-titre', 'étiquette section'],
  ['.bloc-tete .titre, .vivant-texte .titre', 'titre section'],
  ['.bloc-tete .chapo', 'chapô section'],
  ['.grille li', 'tuile'],
  ['.scene-titre', 'titre sur la scène'],
  ['.loupe', 'loupe'],
  ['.composer-scene', 'retouche (bouquet)'],
  ['.comparer-scene', 'maintenir pour comparer'],
  ['.retour-scene', 'retour à la fiche'],
  ['#bouquet', 'bouquet'],
  ['.nom', 'nom bouquet'],
  ['.compo', 'composition'],
  ['.prix', 'prix'],
  ['.prix-sous', 'origine du prix'],
  ['.usage', 'bascule offrir/moi'],
  ['.cadeau', 'réglages du cadeau'],
  ['.btn-achat', 'achat'],
  ['.apercu-lien', 'voir la page du cadeau'],
  ['#n-lignes tr', 'ligne fleur'],
  ['.note', 'note'],
  ['.recu', 'ce que vous recevez'],
  ['.faq', 'questions'],
  ['.onglets', 'onglets'],
  ['.soli-grille', 'soliflores à choisir'],
  ['dialog[open]', 'fenêtre'],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!base || !out) {
  console.error('usage: node banc.mjs <base url> <out dir> [--formats ordinateur,telephone]');
  process.exit(1);
}
if (freemem() < 2.5 * 2 ** 30) {
  console.error(`mémoire libre ${(freemem() / 2 ** 30).toFixed(1)} Go < 2,5 Go : pas de Chrome`);
  process.exit(2);
}
mkdirSync(out, { recursive: true });
mkdirSync(PROFILE, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
let exited = false;
chrome.on('exit', () => (exited = true));

let ws;
let id = 0;
const wait = new Map();
const errors = [];
function send(method, params = {}) {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((res, rej) => wait.set(i, { res, rej, method }));
}
async function connect() {
  for (let k = 0; k < 60; k++) {
    try {
      const page = (await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())).find((t) => t.type === 'page');
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => {
          ws.onopen = res;
          ws.onerror = rej;
        });
        ws.onmessage = (e) => {
          const m = JSON.parse(e.data);
          if (m.id && wait.has(m.id)) {
            const w = wait.get(m.id);
            wait.delete(m.id);
            if (m.error) w.rej(new Error(`${w.method}: ${m.error.message}`));
            else w.res(m.result);
          } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0]);
        };
        return;
      }
    } catch (_) {}
    await sleep(250);
  }
  throw new Error('Chrome ne répond pas');
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function until(expr, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      if (await evaluate(`!!(${expr})`)) return true;
    } catch (_) {}
    await sleep(150);
  }
  return false;
}
async function close() {
  try {
    const v = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json());
    const b = new WebSocket(v.webSocketDebuggerUrl);
    await new Promise((res) => (b.onopen = res));
    b.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
  } catch (_) {}
  for (let k = 0; k < 40 && !exited; k++) await sleep(100);
  if (!exited) chrome.kill();
}
async function shot(file) {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, file), Buffer.from(s.data, 'base64'));
}
async function metric(name) {
  return (await send('Performance.getMetrics')).metrics.find((m) => m.name === name)?.value || 0;
}

// in every page, from its first line: when the first bouquet shows, and the largest paint
const PROBE = `window.__banc = {};
new PerformanceObserver((l) => { const e = l.getEntries().at(-1); if (e) window.__banc.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
const __t = setInterval(() => {
  const p = [...document.querySelectorAll('.bq-pose')].find((x) => x.style.visibility !== 'hidden' && x.getBoundingClientRect().height > 20);
  if (p) { window.__banc.bouquet = performance.now(); clearInterval(__t); }
}, 50);
try { localStorage.removeItem('scene-vue'); localStorage.setItem('belai-langue', '${process.env.BANC_LANGUE || 'fr'}') } catch (_) {}`;
// a page counts as ready when it is loaded and its bouquets (if any) are drawn, or after the time given
const READY = `document.readyState === 'complete' && (!document.querySelector('#bouquet, #bouquet-accroche, #demo') || !!window.__banc.bouquet)`;
const BOXES = `(() => {
  const named = ${JSON.stringify(NAMED)};
  const seen = new Set();
  const out = [];
  const add = (el, label) => {
    if (seen.has(el) || el.closest('[hidden]')) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    for (let e = el; e; e = e.parentElement) seen.add(e);
    out.push({ label, box: [r.left, r.top, r.width, r.height].map((v) => Math.round(v)) });
  };
  for (const [sel, label] of named) for (const el of document.querySelectorAll(sel)) add(el, label);
  for (const el of document.querySelectorAll('h1, h2, h3, button, a, .btn'))
    add(el, (el.matches('h1, h2, h3') ? 'titre : ' : 'bouton : ') + (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 40));
  return { w: innerWidth, h: innerHeight, boxes: out };
})()`;
// what a biased eye measures on the whole page (the page scrolled to its top)
const MEASURE = `(async () => {
  const rgba = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ground = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const c = rgba(getComputedStyle(e).backgroundColor);
      if (c.length >= 3 && (c[3] ?? 1) > 0) { layers.push(c); if ((c[3] ?? 1) >= 1) break; }
    }
    let g = [255, 255, 255];
    for (const c of layers.reverse()) { const a = c[3] ?? 1; g = g.map((v, i) => v * (1 - a) + c[i] * a); }
    return g;
  };
  const visible = (el) => el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : el.offsetParent !== null;
  const words = (s) => (s.match(/[\\p{L}\\p{N}’'-]+/gu) || []).length;
  const top = (el) => el.getBoundingClientRect().top + scrollY;
  const screenOf = (y) => 1 + Math.floor(y / innerHeight);
  // the size the eye sees: the fonts carry a size-adjust (Italianno 150 %, Cormorant 132 %)
  const adjust = (ff) => (/italianno/i.test(ff) ? 1.5 : /cormorant/i.test(ff) ? 1.32 : 1);
  const texts = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const parents = new Map();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n.textContent.replace(/\\s+/g, ' ').trim();
    if (t.length < 2) continue;
    const el = n.parentElement;
    if (!el || el.closest('script, style, noscript, [hidden], [aria-hidden="true"]') || !visible(el)) continue;
    parents.set(el, (parents.get(el) || '') + ' ' + t);
  }
  for (const [el, t] of parents) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    // a text drawn at size 0 (the logotype's words under its drawing) is not read by the eye
    if (r.width < 1 || r.height < 1 || parseFloat(cs.fontSize) < 1) continue;
    const c = rgba(cs.color);
    const g = ground(el);
    const a = c[3] ?? 1;
    const fg = g.map((v, i) => v * (1 - a) + c[i] * a);
    const L1 = lum(fg), L2 = lum(g);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize);
    const seen = size * adjust(cs.fontFamily);
    const bold = Number(cs.fontWeight) >= 700;
    const large = seen >= 24 || (seen >= 18.66 && bold);
    texts.push({ t: t.trim().slice(0, 60), size, seen: Math.round(seen * 10) / 10, weight: Number(cs.fontWeight), ratio: Math.round(ratio * 100) / 100,
      ok: ratio >= (large ? 3 : 4.5), y: Math.round(top(el)), words: words(t), font: cs.fontFamily.split(',')[0].replace(/["']/g, '') });
  }
  texts.sort((a, b) => a.y - b.y);
  const allWords = texts.reduce((s, x) => s + x.words, 0);
  const buy = [...document.querySelectorAll('.btn-achat, .btn-plein')].find(visible);
  const buyY = buy ? top(buy) : null;
  const before = buyY == null ? allWords : texts.filter((x) => x.y < buyY).reduce((s, x) => s + x.words, 0);
  // hands: what can be touched, and how big
  const hits = [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [role="button"], [role="radio"], [tabindex]:not([tabindex="-1"]), #n-lignes tr')]
    .filter((el) => visible(el) && !el.closest('[hidden]'))
    .map((el) => { const r = el.getBoundingClientRect(); return { t: (el.innerText || el.getAttribute('aria-label') || el.title || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(top(el)) }; })
    .filter((x) => x.w > 0 && x.h > 0);
  // money: every price written on the page
  const prices = texts.flatMap((x) => [...x.t.matchAll(/(\\d[\\d\\s.,]*)\\s?€|€\\s?(\\d[\\d.,]*)|\\$\\s?(\\d[\\d.,]*)/g)]
    .map((m) => ({ v: parseFloat((m[1] || m[2] || m[3]).replace(/\\s/g, '').replace(',', '.')), y: x.y, t: x.t })));
  // trust: what says who sells, how to reach them, how to get one's money back
  const trust = [...document.querySelectorAll('a[href]')].map((a) => ({ t: a.innerText.trim().replace(/\\s+/g, ' ').slice(0, 50), href: a.getAttribute('href') }))
    .filter((a) => /mention|l[ée]gal|cgv|conditions|confidential|contact|mailto|rembours|retour|avis|qui sommes|à propos|about|cookies|siret|soci[ée]t[ée]/i.test(a.t + ' ' + a.href));
  const body = document.body.innerText;
  // access
  const imgs = [...document.querySelectorAll('img')].filter((i) => visible(i) && !i.closest('[aria-hidden="true"]') && !i.hasAttribute('alt'));
  const nameless = [...document.querySelectorAll('button, a[href]')].filter((el) => visible(el) && !(el.innerText.trim() || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.title));
  const heads = [...document.querySelectorAll('h1, h2, h3')].map((h) => h.tagName + ' ' + h.innerText.trim().replace(/\\s+/g, ' ').slice(0, 40));
  return {
    titre: document.title,
    langue: document.documentElement.lang,
    choix_langue: !!document.querySelector('[hreflang], select[id*="langue"], .langues'),
    hauteur_ecrans: Math.round(document.documentElement.scrollHeight / innerHeight * 10) / 10,
    mots: allWords,
    mots_avant_achat: before,
    lecture_s: Math.round(allWords / 200 * 60),
    achat: buy ? { texte: buy.innerText.trim().replace(/\\s+/g, ' '), ecran: screenOf(buyY), y: Math.round(buyY) } : null,
    textes: { n: texts.length, sous_16: texts.filter((x) => x.seen < 16).length, sous_14: texts.filter((x) => x.seen < 14).length,
      taille_min: Math.min(...texts.map((x) => x.seen)), contraste_rate: texts.filter((x) => !x.ok).length,
      pires: texts.filter((x) => !x.ok || x.seen < 14).sort((a, b) => a.ratio - b.ratio || a.seen - b.seen).slice(0, 12) },
    cibles: { n: hits.length, sous_44: hits.filter((x) => Math.min(x.w, x.h) < 44).length, sous_24: hits.filter((x) => Math.min(x.w, x.h) < 24).length,
      petites: hits.filter((x) => Math.min(x.w, x.h) < 44).sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h)).slice(0, 12) },
    prix: { n: prices.length, min: prices.length ? Math.min(...prices.map((p) => p.v)) : null, max: prices.length ? Math.max(...prices.map((p) => p.v)) : null,
      premier_ecran: prices.length ? screenOf(Math.min(...prices.map((p) => p.y))) : null, liste: prices.slice(0, 12) },
    confiance: { liens: trust, societe: /SIRE[NT]|SAS|SARL|EI |entreprise individuelle|RCS/i.test(body), avis: /avis|témoignage|★/i.test(body), contact: trust.some((a) => /mailto|contact/i.test(a.t + a.href)) },
    acces: { images_sans_alt: imgs.length, boutons_sans_nom: nameless.length, h1: document.querySelectorAll('h1').length, titres: heads.slice(0, 20), lien_evitement: !!document.querySelector('a[href="#contenu"], .evitement') },
    mouvement: { animations: document.getAnimations().filter((a) => a.playState === 'running').length, videos: [...document.querySelectorAll('video')].filter((v) => !v.paused).length, canvas: document.querySelectorAll('canvas').length },
  };
})()`;

async function open(p, f, ms = 45000) {
  await send('Page.navigate', { url: new URL(p.path, base).href });
  await sleep(400);
  const t0 = Date.now();
  const ok = await until(READY, ms);
  return { ok, s: Date.now() - t0 };
}

const mesures = {};
try {
  await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Performance.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });
  for (const f of wanted) {
    const fm = FORMATS[f];
    for (const [nn, p] of PAGES.entries()) {
      const tag = `${f}-${String(nn + 1).padStart(2, '0')}-${p.name}`;
      const m = (mesures[p.name] ||= {})[f] = {};
      await send('Emulation.setDeviceMetricsOverride', fm);
      await send('Emulation.setTouchEmulationEnabled', { enabled: fm.mobile });
      // a cold load, for the weight and the times
      await send('Network.setCacheDisabled', { cacheDisabled: !p.then });
      errors.length = 0;
      const o = await open(p, f);
      await sleep(2500);
      if (p.then) {
        await evaluate(`(() => { ${p.then} })()`).catch((e) => errors.push(`action : ${e.message.split('\n')[0]}`));
        await sleep(1800);
        if (p.at) await evaluate(`document.querySelector('${p.at}')?.scrollIntoView({ block: 'start' }); scrollBy(0, -64)`);
        await sleep(600);
      }
      const times = await evaluate(`(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const res = performance.getEntriesByType('resource');
        const kinds = {};
        for (const r of res) { const k = r.initiatorType; kinds[k] = (kinds[k] || 0) + (r.transferSize || r.encodedBodySize || 0); }
        const big = res.map((r) => ({ url: r.name.replace(location.origin, ''), ko: Math.round((r.transferSize || r.encodedBodySize || 0) / 1024) })).sort((a, b) => b.ko - a.ko).slice(0, 6);
        return { pret_ms: Math.round(nav.loadEventEnd), contenu_ms: Math.round(nav.domContentLoadedEventEnd), bouquet_ms: window.__banc.bouquet ? Math.round(window.__banc.bouquet) : null,
          lcp_ms: window.__banc.lcp ? Math.round(window.__banc.lcp) : null, requetes: res.length + 1,
          ko: Math.round((res.reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0) + (nav.transferSize || 0)) / 1024),
          ko_par_type: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, Math.round(v / 1024)])), plus_lourds: big };
      })()`);
      Object.assign(m, { charge: { ...times, attente_s: Math.round(o.s / 100) / 10, prete: o.ok } });
      // energy: the processor at rest for 5 s, the memory
      const t1 = await metric('TaskDuration');
      await sleep(5000);
      m.energie = { cpu_repos_pct: Math.round(((await metric('TaskDuration')) - t1) / 5 * 1000) / 10, tas_mo: Math.round((await metric('JSHeapUsedSize')) / 2 ** 20) };
      if (!p.then) {
        await evaluate(`document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, 0)`);
        Object.assign(m, await evaluate(MEASURE));
      } else m.mouvement = await evaluate(`({ animations: document.getAnimations().filter((a) => a.playState === 'running').length })`);
      // the screens, top to bottom
      const H = await evaluate(`document.documentElement.scrollHeight`);
      const step = fm.height - 64;
      const n = p.screens || Math.min(5, Math.max(1, Math.ceil((H - fm.height) / step) + 1));
      for (let k = 0; k < n; k++) {
        if (!p.then || k > 0) await evaluate(`scrollTo(0, ${k * step})`);
        await sleep(k === 0 ? 300 : 1600);
        await shot(`${tag}-${k + 1}.png`);
        writeFileSync(join(out, `${tag}-${k + 1}.json`), JSON.stringify(await evaluate(BOXES)));
      }
      // the biased views of the first screen
      if (p.views) {
        await evaluate(`scrollTo(0, 0)`);
        await sleep(500);
        for (const [type, view] of [['deuteranopia', 'daltonien'], ['blurredVision', 'vue-floue']]) {
          await send('Emulation.setEmulatedVisionDeficiency', { type });
          await sleep(300);
          await shot(`${tag}-${view}.png`);
        }
        await send('Emulation.setEmulatedVisionDeficiency', { type: 'none' });
        // reduced motion: does the page calm down?
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await open(p, f, 20000);
        await sleep(2500);
        m.mouvement_reduit = await evaluate(`({ animations: document.getAnimations().filter((a) => a.playState === 'running').length, videos: [...document.querySelectorAll('video')].filter((v) => !v.paused).length })`);
        await send('Emulation.setEmulatedMedia', { features: [] });
        // a 200 % zoom on the computer: the same page at half the width
        if (f === 'ordinateur') {
          await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 450, deviceScaleFactor: 2, mobile: false });
          await open(p, f, 20000);
          await sleep(2500);
          await shot(`${tag}-zoom200.png`);
          m.zoom200 = await evaluate(`({ deborde: document.documentElement.scrollWidth > innerWidth + 1, achat_ecran: (() => { const b = document.querySelector('.btn-achat, .btn-plein'); return b ? 1 + Math.floor((b.getBoundingClientRect().top + scrollY) / innerHeight) : null; })() })`);
        }
        // a slow phone on a slow network: what one sees at 1, 3 and 8 s
        if (f === 'telephone') {
          await send('Network.setCacheDisabled', { cacheDisabled: true });
          await send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (1.6 * 1e6) / 8, uploadThroughput: (0.75 * 1e6) / 8 });
          await send('Emulation.setCPUThrottlingRate', { rate: 4 });
          await send('Page.navigate', { url: new URL(p.path, base).href });
          const t0 = Date.now();
          for (const t of [1000, 3000, 8000]) {
            await sleep(Math.max(0, t - (Date.now() - t0)));
            await shot(`${tag}-lent-${t / 1000}s.png`);
          }
          const done = await until(READY, 40000);
          m.lent = { bouquet_ms: await evaluate(`window.__banc.bouquet ? Math.round(window.__banc.bouquet) : null`).catch(() => null), pret_en_48s: done,
            lcp_ms: await evaluate(`window.__banc.lcp ? Math.round(window.__banc.lcp) : null`).catch(() => null) };
          await send('Emulation.setCPUThrottlingRate', { rate: 1 });
          await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
        }
      }
      m.erreurs = [...new Set(errors)].slice(0, 5);
      console.log(tag, JSON.stringify(m.charge));
    }
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'mesures.json'), JSON.stringify(mesures, null, 1));
  await close();
}
