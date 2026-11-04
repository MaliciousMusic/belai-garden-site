// serveur.mjs: Bzzou's conversation, a small language model run by the owner (owner, 2026-11-02: « la version hébergée
// sur mon PC, et plus tard sur mon serveur »), never a paid service: nothing is billed per message.
//
// The page asks it only when its own small network cannot answer (abeille.mjs): the visitor's words, the page's language,
// the bee's best guesses (pistes: intention ids) and the last turns. This relay gives the model the shop's rules
// (consignes.md) and only the facts those guesses point to (abeille-savoir.mjs, the same answers the bee gives), calls
// the model through Ollama on this machine, checks the answer, and keeps the exchange without name or address
// (journal/, owner: « tous les échanges sans nom sont gardés afin d'affiner Bzzou »).
//
//   node bzzou/serveur.mjs          (Ollama running, with the model pulled: see README.md)
//
// Settings (environment): BZZOU_PORT (8792), BZZOU_MODELE (qwen2.5:1.5b), OLLAMA (http://127.0.0.1:11434),
// BZZOU_ORIGINES (the pages allowed to ask, comma-separated), BZZOU_PAR_IP (questions per IP per 10 minutes, 20).
import { createServer } from 'node:http';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.BZZOU_PORT || 8792);
const MODELE = process.env.BZZOU_MODELE || 'qwen2.5:1.5b';
const OLLAMA = process.env.OLLAMA || 'http://127.0.0.1:11434';
const ORIGINES = (process.env.BZZOU_ORIGINES || 'http://localhost:8851,http://127.0.0.1:8851').split(',').map((s) => s.trim());
const PAR_IP = Number(process.env.BZZOU_PAR_IP || 20);
const LANGUES = { fr: 'français', en: 'anglais', es: 'espagnol', it: 'italien', de: 'allemand', ja: 'japonais', zh: 'chinois simplifié', fil: 'filipino', pt: 'portugais du Brésil', ko: 'coréen' };
// facts always given: what the shop is, how it is given, kept, paid and reached
const SOCLE = ['bouquet_numerique', 'soliflore', 'offrir', 'fin_trente_jours', 'appareils', 'payer', 'contact'];
// never in an answer (the shop's vocabulary rule), in the ten languages' usual forms
const INTERDITS = /investiss|rendement|plus-value|bourse|trading|spéculat|speculat|invest(ment|ing|ir|ieren)|inversi[oó]n|rendimiento|börse|borsa|投资|投資|투자/i;

const consignes = readFileSync(join(ICI, 'consignes.md'), 'utf8');
const { SAVOIR } = await import(pathToFileURL(join(ICI, '..', 'public', 'squelette', 'abeille-savoir.mjs')).href);
const savoir = new Map(SAVOIR.filter((s) => s.a).map((s) => [s.id, s]));

// ---------- limits: questions per address over ten minutes, one answer at a time (a small machine), a short queue
const vus = new Map();
const tropVite = (ip) => {
  const now = Date.now();
  const l = (vus.get(ip) || []).filter((t) => now - t < 600000);
  l.push(now);
  vus.set(ip, l);
  return l.length > PAR_IP;
};
let enCours = Promise.resolve();
let attente = 0;

function faits(pistes) {
  const ids = [...new Set([...(pistes || []).filter((x) => typeof x === 'string').slice(0, 5), ...SOCLE])];
  return ids
    .map((id) => savoir.get(id))
    .filter(Boolean)
    .map((s) => `- ${s.q} ${s.a}`)
    .join('\n');
}
const propre = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);

async function repond({ texte, langue, pistes, fil }) {
  const question = propre(texte, 500);
  if (!question) return null;
  const lg = LANGUES[langue] ? langue : 'fr';
  const messages = [
    { role: 'system', content: `${consignes}\nLANGUE : ${LANGUES[lg]}\n\nFAITS :\n${faits(pistes)}` },
    ...(Array.isArray(fil) ? fil.slice(-6) : [])
      .filter((m) => m && (m.de === 'visiteur' || m.de === 'abeille'))
      .map((m) => ({ role: m.de === 'visiteur' ? 'user' : 'assistant', content: propre(m.texte, 300) })),
    { role: 'user', content: question },
  ];
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODELE, messages, stream: false, keep_alive: '10m', options: { temperature: 0.3, num_predict: 180, num_ctx: 2048 } }),
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) throw new Error(`ollama ${r.status}`);
  const j = await r.json();
  let a = propre(j.message?.content, 600);
  // an answer that breaks the shop's rules, or carries a link or a list, is not given
  if (!a || INTERDITS.test(a) || /https?:\/\/|www\./i.test(a)) return null;
  a = a.replace(/^[-*#>\s]+/, '');
  return a;
}

function journal(e) {
  try {
    const d = join(ICI, 'journal');
    mkdirSync(d, { recursive: true });
    appendFileSync(join(d, `${new Date().toISOString().slice(0, 10)}.jsonl`), `${JSON.stringify(e)}\n`);
  } catch (_) {}
}

createServer((req, res) => {
  const origine = req.headers.origin;
  const cors = ORIGINES.includes(origine) ? { 'access-control-allow-origin': origine, vary: 'origin' } : {};
  const envoie = (code, corps) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...cors });
    res.end(JSON.stringify(corps));
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...cors, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' });
    return res.end();
  }
  if (req.method === 'GET' && req.url === '/bzzou/etat') return envoie(200, { modele: MODELE });
  if (req.method !== 'POST' || req.url !== '/bzzou') return envoie(404, { erreur: 'introuvable' });
  if (!cors['access-control-allow-origin']) return envoie(403, { erreur: 'origine' });
  const ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '';
  if (tropVite(ip)) return envoie(429, { erreur: 'trop' });
  if (attente >= 3) return envoie(503, { erreur: 'occupe' });
  let corps = '';
  req.on('data', (c) => {
    corps += c;
    if (corps.length > 8000) req.destroy();
  });
  req.on('end', () => {
    let q;
    try {
      q = JSON.parse(corps);
    } catch (_) {
      return envoie(400, { erreur: 'json' });
    }
    attente++;
    enCours = enCours
      .then(() => repond(q))
      .then((texte) => {
        journal({ t: Date.now(), langue: q.langue, texte: propre(q.texte, 500), pistes: q.pistes, reponse: texte });
        envoie(texte ? 200 : 204, texte ? { texte } : {});
      })
      .catch((err) => {
        console.error('[bzzou]', err.message);
        envoie(503, { erreur: 'modele' });
      })
      .finally(() => attente--);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`Bzzou écoute sur http://127.0.0.1:${PORT}/bzzou (modèle ${MODELE}, Ollama ${OLLAMA})`));
