// guichet.js: the bee's counter (owner, 2026-11-02: « hang on, I'm putting someone on the line, et le CM reçoit les tickets
// en direct sur son panel admin »). When the bee does not know, the visitor's page opens a talk with what was said to the
// bee; the visitor and the atelier then write in it, the page and the panel (guichet.html) asking for what is new every few
// seconds. No account for the visitor: a token given when the talk opens, kept as a hash. The atelier's panel signs with
// env.GUICHET_JETON (a secret, wrangler secret put), compared in constant time.
//
//   POST /api/guichet                  { texte, langue?, page?, avant? }  -> { id, jeton }       a talk opens
//   GET  /api/guichet/<id>?jeton=&depuis=n                                -> { etat, messages }   the visitor reads
//   POST /api/guichet/<id>/message     { jeton, texte }                   -> { ok, n }            the visitor writes
//   GET  /api/guichet                  (atelier)                          -> { conversations }    the panel's list
//   GET  /api/guichet/<id>/tout        (atelier)                          -> { conv, messages }   a talk, all of it
//   POST /api/guichet/<id>/reponse     (atelier) { texte }                -> { ok, n }            the atelier answers
//   POST /api/guichet/<id>/clos        (atelier)                          -> { ok }               the talk is closed
import { compte1, lireJson } from './compte.js';
import { cleIp, empreinte, sha256, egal, identifiant, jeton, json, erreur } from './outils.js';

const H = 60 * 60 * 1000;
const J = 24 * H;
const LANGUES = new Set(['fr', 'en', 'es', 'it', 'de', 'ja', 'zh', 'fil', 'pt', 'ko']);
// limits: talks an address opens, messages a talk takes, talks the whole shop takes in a day
const OUVERTES = [
  ['guichet60', H, 4],
  ['guichet24', J, 12],
];
const MESSAGES_H = 40;
const GUICHET_JOUR = 300;
const texteDe = (t, max = 1000) => (typeof t === 'string' ? t.normalize('NFC').trim().slice(0, max) : '');

function atelier(req, env) {
  if (!env.GUICHET_JETON) throw Object.assign(new Error('GUICHET_JETON manquant'), { config: true });
  const a = req.headers.get('authorization') || '';
  return a.startsWith('Bearer ') && egal(a.slice(7), env.GUICHET_JETON);
}
async function visiteur(env, id, jt) {
  const c = await env.DB.prepare('SELECT * FROM guichet WHERE id = ?').bind(id).first();
  if (!c || typeof jt !== 'string' || !egal(await sha256(jt), c.jeton_hash)) return null;
  return c;
}
async function ecrit(env, id, de, texte, now) {
  const r = await env.DB.prepare('INSERT INTO guichet_messages (conv, cree, de, texte) VALUES (?, ?, ?, ?) RETURNING n').bind(id, now, de, texte).first();
  await env.DB.prepare('UPDATE guichet SET maj = ? WHERE id = ?').bind(now, id).run();
  return r.n;
}

export async function ouvre(req, env, now = Date.now()) {
  if (!env.POIVRE) throw Object.assign(new Error('POIVRE manquant'), { config: true });
  const b = await lireJson(req);
  const texte = texteDe(b.texte);
  if (texte.length < 1) return erreur('texte');
  const ip = req.headers.get('cf-connecting-ip') || '';
  if (ip) {
    const cle = await empreinte(env.POIVRE, `ip:${cleIp(ip)}`);
    for (const [nom, fenetre, max] of OUVERTES) {
      const r = await compte1(env.DB, `${nom}:${cle}`, fenetre, max, now);
      if (!r.ok) return erreur('trop', 429, { attendre: r.attendre });
    }
  }
  const jour = await compte1(env.DB, `guichetjour:${new Date(now).toISOString().slice(0, 10)}`, J, Number(env.GUICHET_JOUR) || GUICHET_JOUR, now);
  if (!jour.ok) return erreur('trop', 429, { attendre: jour.attendre });
  const id = identifiant();
  const jt = jeton();
  await env.DB.prepare('INSERT INTO guichet (id, cree, maj, jeton_hash, langue, page) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, now, now, await sha256(jt), LANGUES.has(b.langue) ? b.langue : null, typeof b.page === 'string' ? b.page.slice(0, 200) : null)
    .run();
  // what was said to the bee before, so the atelier knows where the visitor is (at most ten lines)
  const avant = Array.isArray(b.avant) ? b.avant.slice(-10) : [];
  for (const m of avant) {
    const t = texteDe(m?.texte, 600);
    if (t) await ecrit(env, id, m.de === 'abeille' ? 'abeille' : 'visiteur', t, now);
  }
  await ecrit(env, id, 'visiteur', texte, now);
  return json({ id, jeton: jt });
}

export async function lit(req, env, id) {
  const u = new URL(req.url);
  const c = await visiteur(env, id, req.headers.get('x-guichet-jeton'));
  if (!c) return erreur('introuvable', 404);
  const depuis = Number(u.searchParams.get('depuis')) || 0;
  const { results } = await env.DB.prepare('SELECT n, de, texte, cree FROM guichet_messages WHERE conv = ? AND n > ? ORDER BY n').bind(id, depuis).all();
  return json({ etat: c.etat, messages: results });
}

export async function message(req, env, id, now = Date.now()) {
  const b = await lireJson(req);
  const c = await visiteur(env, id, b.jeton);
  if (!c) return erreur('introuvable', 404);
  if (c.etat !== 'ouvert') return erreur('clos', 409);
  const texte = texteDe(b.texte);
  if (!texte) return erreur('texte');
  const r = await compte1(env.DB, `guichetmsg:${id}`, H, MESSAGES_H, now);
  if (!r.ok) return erreur('trop', 429, { attendre: r.attendre });
  return json({ ok: true, n: await ecrit(env, id, 'visiteur', texte, now) });
}

// ---------- the atelier's panel
export async function liste(req, env) {
  if (!atelier(req, env)) return erreur('interdit', 401);
  const { results } = await env.DB.prepare(
    `SELECT g.id, g.cree, g.maj, g.etat, g.langue, g.page,
            (SELECT COUNT(*) FROM guichet_messages m WHERE m.conv = g.id AND m.n > g.lu AND m.de = 'visiteur') AS nouveaux,
            (SELECT texte FROM guichet_messages m WHERE m.conv = g.id ORDER BY n DESC LIMIT 1) AS dernier
     FROM guichet g ORDER BY (g.etat = 'ouvert') DESC, g.maj DESC LIMIT 60`,
  ).all();
  return json({ conversations: results });
}

export async function tout(req, env, id) {
  if (!atelier(req, env)) return erreur('interdit', 401);
  const c = await env.DB.prepare('SELECT id, cree, maj, etat, langue, page FROM guichet WHERE id = ?').bind(id).first();
  if (!c) return erreur('introuvable', 404);
  const { results } = await env.DB.prepare('SELECT n, de, texte, cree FROM guichet_messages WHERE conv = ? ORDER BY n').bind(id).all();
  // read: the panel has seen everything up to the last message
  if (results.length) await env.DB.prepare('UPDATE guichet SET lu = ? WHERE id = ?').bind(results[results.length - 1].n, id).run();
  return json({ conv: c, messages: results });
}

export async function reponse(req, env, id, now = Date.now()) {
  if (!atelier(req, env)) return erreur('interdit', 401);
  const c = await env.DB.prepare('SELECT etat FROM guichet WHERE id = ?').bind(id).first();
  if (!c) return erreur('introuvable', 404);
  const b = await lireJson(req);
  const texte = texteDe(b.texte, 2000);
  if (!texte) return erreur('texte');
  if (c.etat !== 'ouvert') await env.DB.prepare("UPDATE guichet SET etat = 'ouvert' WHERE id = ?").bind(id).run();
  const n = await ecrit(env, id, 'atelier', texte, now);
  await env.DB.prepare('UPDATE guichet SET lu = ? WHERE id = ?').bind(n, id).run();
  return json({ ok: true, n });
}

export async function clos(req, env, id) {
  if (!atelier(req, env)) return erreur('interdit', 401);
  const r = await env.DB.prepare("UPDATE guichet SET etat = 'clos' WHERE id = ?").bind(id).run();
  return r.meta.changes ? json({ ok: true }) : erreur('introuvable', 404);
}
