// recolte.mjs: harvests every French sentence of the shop skeleton into langues/source.json, the list the phrase books
// translate (traduction.mjs). Three sources:
// - the pages as a visitor sees them, in French, for every bouquet and the states that write words (the gift's settings,
//   « Pour plusieurs », the basket, the gift's page): text, labels, titles (one headless Chrome);
// - the words the modules may write later (string literals and templates of the .mjs and .js files);
// - the data shown in the bill and the atelier (flower and colour names, meanings, soliflores).
// Each entry is a key of phrases.mjs with one example of where it was seen.
//
//   sh ../flower-atelier/ws/gate.sh node outils/recolte.mjs <base url of public/squelette/>
import { spawn } from 'node:child_process';
import { freemem } from 'node:os';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = join(dirname(dirname(fileURLToPath(import.meta.url))), 'public', 'squelette');
const { cle, aTraduire, propre } = await import(pathToFileURL(join(HERE, 'phrases.mjs')).href);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.RECOLTE_PORT || 9374);
const PROFILE = join(process.env.TEMP || '.', 'recolte-chrome');
const base = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const found = new Map(); // key -> where
const add = (text, where) => {
  const t = propre(text || '');
  if (!t || !aTraduire(t)) return;
  let i = 0;
  const k = cle(t).k.replace(/\u0005/g, () => `{x${++i}}`); // a template's free parts, marked without digits
  if (/[{}]/.test(k.replace(/\{[pdmnx]\d+\}/g, ''))) return; // a nested template, not a sentence
  // a template with free words must keep enough of its own words to be matched safely ({x1}, {x2} could be anything)
  if (/\{x\d+\}/.test(k) && ((k.replace(/\{[pdmnx]\d+\}/g, '').match(/\p{L}/gu) || []).length < 10 || /\{x\d+\}\s*\{x\d+\}/.test(k))) return;
  if (!found.has(k)) found.set(k, where);
};

// ---------- the modules' words
const CODE = /=>|\.\w+\(|^[.#[]|\.(m?js|json|svg|css|html|woff2|png|webp)\b|^[\w-]+(\s[\w-]+)*$/;
const WORDY = /[À-ÿ’«»]|[.,:;!?]\s|^[A-ZÀ-Ý][a-zà-ÿ]/;
for (const f of readdirSync(HERE).filter((f) => /\.(m?js)$/.test(f) && !['traduction.mjs', 'phrases.mjs', 'recu-langues.mjs'].includes(f))) {
  const src = readFileSync(join(HERE, f), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
    let s = m[1] ?? m[2];
    if (m[2] != null) {
      s = s.replace(/\$\{[^}]*\}/g, '\u0005');
    }
    // a template of markup: its words, between the tags
    const parts = s.includes('<') ? s.split(/<[^>]*>/) : [s];
    for (const p of parts) {
      const t = propre(p.replace(/\\n/g, ' '));
      if (t.length < 2 || CODE.test(t) || !WORDY.test(t)) continue;
      if (/^[\u0005\s]*$/.test(t)) continue;
      add(t, f);
    }
  }
}
// ---------- the data shown in the bill and the atelier
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const walk = (o, where, keys) => {
  if (Array.isArray(o)) for (const x of o) walk(x, where, keys);
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) typeof v === 'string' ? keys.includes(k) && add(v, where) : walk(v, where, keys);
};
walk(json(join(HERE, 'sens.json')), 'sens.json', ['sens', 'nom', 'note']);
for (const [k, v] of Object.entries(json(join(HERE, 'sens.json')))) for (const [c, t] of Object.entries(v.couleur || {})) t && add(t, 'sens.json');
walk(json(join(HERE, 'soli.json')), 'soli.json', ['nom', 'fleur', 'texte', 'saison', 'n', 'cn']);
const BQ = join(HERE, '../scene/bouquets');
for (const id of readdirSync(BQ)) {
  const a = join(BQ, id, 'atelier.json');
  if (!existsSync(a)) continue;
  for (const c of Object.values(json(a).fiches || {})) {
    add(c.n, `atelier ${id}`);
    add((c.cn || '').replace(/\s*\([A-Z][^)]*\)/, ''), `atelier ${id}`);
  }
}
const fr = await import(pathToFileURL(join(HERE, '../scene/langues/fr.mjs')).href);
for (const v of Object.values(fr.default.vases || {})) add(v, 'vases');
const shop = json(join(HERE, '../scene/boutique.json'));
console.log(`modules et données : ${found.size}`);

// ---------- the pages
if (base) {
  if (freemem() < 2.5 * 2 ** 30) throw new Error('mémoire libre < 2,5 Go : pas de Chrome');
  mkdirSync(PROFILE, { recursive: true });
  const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', '--disable-extensions', '--mute-audio', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' });
  let ws;
  let id = 0;
  const wait = new Map();
  const send = (method, params = {}) => {
    const i = ++id;
    ws.send(JSON.stringify({ id: i, method, params }));
    return new Promise((res, rej) => wait.set(i, { res, rej }));
  };
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
  try {
    for (let k = 0; k < 60 && !ws; k++) {
      try {
        const page = (await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())).find((t) => t.type === 'page');
        if (page) {
          ws = new WebSocket(page.webSocketDebuggerUrl);
          await new Promise((res) => (ws.onopen = res));
          ws.onmessage = (e) => {
            const m = JSON.parse(e.data);
            if (m.id && wait.has(m.id)) (m.error ? wait.get(m.id).rej : wait.get(m.id).res)(m.error || m.result), wait.delete(m.id);
          };
        }
      } catch (_) {}
      if (!ws) await sleep(250);
    }
    await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: "try { localStorage.setItem('belai-langue', 'fr') } catch (_) {}" });
    const COLLECT = `(() => {
      const out = [document.title, ...[...document.querySelectorAll('meta[name="description"], meta[property^="og:"][content]')].map((m) => m.content)];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (n.nodeType === 3) { if (!n.parentElement.closest('script, style, [translate="no"]')) out.push(n.nodeValue); continue; }
        for (const a of ['aria-label', 'placeholder', 'title', 'alt']) if (n.getAttribute(a)) out.push(n.getAttribute(a));
      }
      return out;
    })()`;
    const visit = async (path, then = []) => {
      await send('Page.navigate', { url: new URL(path, base).href });
      await sleep(3500);
      for (const t of [null, ...then]) {
        if (t) {
          await evaluate(`(() => { try { ${t} } catch (_) {} })()`);
          await sleep(1200);
        }
        for (const s of (await evaluate(COLLECT)) || []) add(s, path);
      }
    };
    const PAGES = ['index.html', 'catalogue.html', 'soliflore.html', 'savoir-faire.html', 'recu.html', 'compte.html', 'groupe.html', 'sur-mesure.html'];
    for (const p of PAGES) await visit(p, [`document.querySelector('.panier-btn').click()`]);
    for (const p of shop.produits) {
      await visit(`produit.html?b=${p.id}`, [
        `document.querySelector('[data-usage="offrir"]').click()`,
        `document.querySelector('#composition summary').click()`,
        `document.querySelector('[data-usage="plusieurs"]').click()`,
        `document.querySelector('[data-apercu]').click()`,
      ]);
      await visit(`retouche.html?b=${p.id}`, [`document.querySelector('#n-lignes tr').click()`]);
      console.log(p.id, found.size);
    }
  } finally {
    try {
      const v = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json());
      const b = new WebSocket(v.webSocketDebuggerUrl);
      await new Promise((res) => (b.onopen = res));
      b.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    } catch (_) {}
    await sleep(800);
    chrome.kill();
  }
}
mkdirSync(join(HERE, 'langues'), { recursive: true });
const out = Object.fromEntries([...found.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr')));
writeFileSync(join(HERE, 'langues', 'source.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`langues/source.json : ${found.size} phrases`);
