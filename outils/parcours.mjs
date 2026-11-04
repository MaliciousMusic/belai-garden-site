// parcours.mjs (from ecrans.mjs): captures the two level-2 journeys, recu.html and compte.html, step by step,
// for the personas. Run through the gate like ecrans.mjs:
//   sh ../flower-atelier/ws/gate.sh node outils/parcours.mjs <base url of public/squelette/> <out dir>
// Below, the header of ecrans.mjs, kept as is (CDP helpers).
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
const PORT = Number(process.env.ECRANS_PORT || 9372);
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
  ['.fiche .btn-plein', 'action fiche'],
  ['.fiche .btn-trait', 'essayer fiche'],
  ['.faits', 'faits'],
  ['.note', 'note'],
  ['#demo', 'bouquet démo'],
  ['.etapes', 'étapes'],
  ['.essai', 'encart essai'],
  ['.recu', 'ce que vous recevez'],
  ['.chiffres', 'chiffres'],
  ['.faq', 'questions'],
  ['.barre', 'barre fixe'],
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


const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log(name);
};
const top = (sel) => evaluate(`(() => { document.documentElement.style.scrollBehavior = 'auto'; const e = document.querySelector('${sel}'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 56); return true; })()`);

try {
  await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  for (const f of wanted) {
    const fm = FORMATS[f];
    await send('Emulation.setDeviceMetricsOverride', fm);
    await send('Emulation.setTouchEmulationEnabled', { enabled: fm.mobile });
    // the gift received: the envelope, the reveal at three instants, then what comes after
    await send('Page.navigate', { url: `${url}recu.html?de=Claire&code=AB12` });
    await until(`document.readyState === 'complete' && document.getElementById('ouvrir')`);
    await sleep(800);
    await shot(`${f}-recu-1-enveloppe`);
    await evaluate(`document.getElementById('ouvrir').click(), true`);
    await sleep(1500);
    await shot(`${f}-recu-2-eclosion-debut`);
    await sleep(3500);
    await shot(`${f}-recu-3-eclosion-mot`);
    await until(`!document.getElementById('apres').hidden`, 60000);
    await sleep(1500);
    await top('#apres');
    await sleep(600);
    await shot(`${f}-recu-4-apres`);
    await evaluate(`scrollBy(0, innerHeight * 0.8), true`);
    await sleep(500);
    await shot(`${f}-recu-5-suite`);
    // the monthly return: each section brought to the top
    await send('Page.navigate', { url: `${url}compte.html` });
    await until(`document.readyState === 'complete' && document.querySelectorAll('#mes li').length > 0`);
    await sleep(1200);
    const n = await evaluate(`document.querySelectorAll('main > section').length`);
    for (let k = 0; k < n; k++) {
      await evaluate(`(() => { document.documentElement.style.scrollBehavior = 'auto'; const s = document.querySelectorAll('main > section')[${k}]; scrollTo(0, ${k} ? s.getBoundingClientRect().top + scrollY - 56 : 0); return true; })()`);
      await sleep(900);
      await evaluate(`Promise.all([...document.images].map((i) => i.decode().catch(() => {})))`);
      await shot(`${f}-compte-${k + 1}`);
    }
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await close();
}
