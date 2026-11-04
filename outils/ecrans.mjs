// ecrans.mjs: captures every screen of the shop skeleton for the audit (AUDIT.md), at a computer's size and a phone's, with
// the boxes of its named elements, so outils/regard.py can say in which order the eye meets them. One headless Chrome, run
// through the gate (one heavy job at a time, RAM floor):
//
//   sh ../flower-atelier/ws/gate.sh node outils/ecrans.mjs <url> <out dir> [--formats ordinateur,telephone]
//
// For each format it writes <out>/<format>-<nn>-<screen>.png (the viewport, the screen's section at its top) and
// <format>-<nn>-<screen>.json (the viewport's size and every named element seen, with its label and box in pixels).
// Its own throwaway profile and port (ECRANS_PORT, 9371); Chrome is closed at the end, whatever happens.
import { spawn } from 'node:child_process';
import { freemem } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.ECRANS_PORT || 9371);
const PROFILE = join(process.env.TEMP || '.', 'ecrans-chrome');
const args = process.argv.slice(2);
const fi = args.indexOf('--formats');
const wanted = fi < 0 ? ['ordinateur', 'telephone'] : args.splice(fi, 2)[1].split(',');
const ti = args.indexOf('--temps');
// --temps 300,800,1400,2600: the first screen captured at those instants (ms after the navigation), for the choreography
const TIMES = ti < 0 ? [] : args.splice(ti, 2)[1].split(',').map(Number);
const [url, out] = args;
const FORMATS = {
  ordinateur: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  telephone: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
};
// what the eye may meet, by role (the first label that matches an element wins)
const NAMED = [
  ['.tete', 'en-tête'],
  ['.accroche .sur-titre', 'étiquette accroche'],
  ['.accroche-titre', 'titre accroche'],
  ['.accroche-sous', 'phrase accroche'],
  ['.promesses', 'trois promesses'],
  ['.accroche .btn-plein', 'action offrir'],
  ['.accroche .btn-trait', 'action essayer'],
  ['.asterisque', 'astérisque'],
  ['[data-porte="offrir"]', 'porte offrir'],
  ['[data-porte="moi"]', 'porte pour moi'],
  ['.fourchette', 'fourchette de prix'],
  ['.compat', 'compatibilité'],
  ['.sens', 'sens des fleurs'],
  ['.surligne', 'mot surligné'],
  ['.recu-lien', "j'ai reçu (en-tête)"],
  ['.suivante', 'collection suivante'],
  ['.confiance', 'confiance'],
  ['.composition summary', 'ouvrir la composition'],
  ['#bouquet-accroche', 'bouquet accroche'],
  ['.accroche-bouquet figcaption', 'légende bouquet'],
  ['.bloc-tete .sur-titre', 'étiquette section'],
  ['.bloc-tete .titre, .vivant-texte .titre, .jardin .titre', 'titre section'],
  ['.bloc-tete .chapo', 'chapô section'],
  ['.grille li', 'tuile'],
  ['#bouquet', 'bouquet fiche'],
  ['.fiche .sur-titre', 'étiquette fiche'],
  ['.nom', 'nom bouquet'],
  ['.compo', 'composition'],
  ['.prix', 'prix'],
  ['.prix-sous', 'origine du prix'],
  ['.usage', 'bascule offrir/moi'],
  ['.fiche .btn-achat', 'action fiche'],
  ['.moyens', 'moyens de paiement'],
  ['.apercu-lien', 'ce qu’elle reçoit'],
  ['.composer-scene', 'composer (bouquet)'],
  ['.fiche .btn-trait', 'essayer fiche'],
  ['.faits', 'faits'],
  ['.note', 'note'],
  ['#demo', 'bouquet démo'],
  ['.etapes', 'étapes'],
  ['.essai-encart', 'encart essai'],
  ['.recu', 'ce que vous recevez'],
  ['.chiffres', 'chiffres'],
  ['.faq', 'questions'],
  ['.barre', 'barre fixe'],
  ['.onglets', 'onglets'],
  ['.poincon', 'poinçon atelier'],
  ['.film', 'film atelier'],
  ['.pays', 'sens par pays'],
  ['.soli-grille', 'soliflores à choisir'],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!url || !out) {
  console.error('usage: node ecrans.mjs <url> <out dir> [--formats ordinateur,telephone]');
  process.exit(1);
}
if (freemem() < 2.5 * 2 ** 30) {
  console.error(`mémoire libre ${(freemem() / 2 ** 30).toFixed(1)} Go < 2,5 Go : pas de Chrome`);
  process.exit(2);
}
mkdirSync(out, { recursive: true });
mkdirSync(PROFILE, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
let exited = false;
chrome.on('exit', () => (exited = true));

let ws;
let id = 0;
const wait = new Map();
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
          } else if (m.method === 'Runtime.exceptionThrown') console.error('[page]', m.params.exceptionDetails.exception?.description);
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
async function until(expr, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await evaluate(`!!(${expr})`)) return;
    await sleep(150);
  }
  throw new Error(`délai dépassé : ${expr}`);
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

// the live bouquets of a screen are drawn when no box of theirs is still hidden and no still stands in for them
const LIVE = `[...document.querySelectorAll('#bouquet-accroche, #bouquet')].every((b) => b.querySelector('.bq-pose') && ![...b.querySelectorAll('.bq-pose')].some((x) => x.style.visibility === 'hidden') && !b.querySelector(':scope > img'))`;
const BOXES = `(() => {
  const named = ${JSON.stringify(NAMED)};
  const seen = new Set();
  const out = [];
  for (const [sel, label] of named)
    for (const el of document.querySelectorAll(sel)) {
      if (seen.has(el) || el.closest('[hidden]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
      if (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') continue;
      seen.add(el);
      out.push({ label, box: [r.left, r.top, r.width, r.height].map((v) => Math.round(v)) });
    }
  return { w: innerWidth, h: innerHeight, boxes: out };
})()`;

try {
  await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  // every capture is a first visit (the choreography plays, no returning line): the flag is cleared before each page runs
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try { localStorage.removeItem('scene-vue') } catch (_) {}" });
  for (const f of wanted) {
    const fm = FORMATS[f];
    await send('Emulation.setDeviceMetricsOverride', fm);
    await send('Emulation.setTouchEmulationEnabled', { enabled: fm.mobile });
    await send('Page.navigate', { url });
    // the first screen's choreography, frozen at a few instants after the navigation (no box file: regard.py skips them)
    const t0 = Date.now();
    for (const t of TIMES) {
      await sleep(Math.max(0, t - (Date.now() - t0)));
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(out, `${f}-00-sequence-${String(t).padStart(4, '0')}ms.png`), Buffer.from(shot.data, 'base64'));
    }
    await until(`document.readyState === 'complete' && document.querySelectorAll('#grille li').length > 0`);
    await until(LIVE, 90000);
    // the screens: the first one as it opens, then every section brought to the top under the header
    const n = await evaluate(`document.querySelectorAll('main > section').length`);
    for (let k = -1; k < n; k++) {
      const name = await evaluate(`(() => {
        document.documentElement.style.scrollBehavior = 'auto';
        if (${k} < 0) { scrollTo(0, 0); return 'premier-ecran'; }
        const s = document.querySelectorAll('main > section')[${k}];
        scrollTo(0, s.getBoundingClientRect().top + scrollY - (${k} === 0 ? 56 : 56));
        return s.id || s.className.split(' ').pop();
      })()`);
      // lazy tiles, the growth demo and the section's choreography (mise-en-scene.js) get their time
      await sleep(3200);
      await evaluate(`Promise.all([...document.images].filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).map((i) => i.decode().catch(() => {})))`);
      if (name === 'vivant') await sleep(6000);
      const tag = `${f}-${String(k + 1).padStart(2, '0')}-${name}`;
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(out, `${tag}.png`), Buffer.from(shot.data, 'base64'));
      writeFileSync(join(out, `${tag}.json`), JSON.stringify(await evaluate(BOXES)));
      console.log(tag);
    }
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await close();
}
