// The account (lot C2): numbers, text-message codes and their limits, sessions for the site and for Belai Bureau,
// first name, sign-out, deletion, the daily clean-up, the copies left, CORS.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { demande, verifie, menage } from '../src/compte.js';
import { numero, prenom, dechiffre } from '../src/outils.js';
import { d1 } from './d1.mjs';

const ORIGINE = 'http://localhost:8835';
function envNeuf() {
  const cle = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  return { DB: d1(), POIVRE: 'poivre-de-test', CLE_NUMEROS: cle, SMS: 'faux', PAYS: 'FR', ORIGINES: ORIGINE, __sms: [] };
}
const req = (method, path, body, headers = {}) =>
  new Request(`http://api.test${path}`, { method, headers: { 'content-type': 'application/json', origin: ORIGINE, ...headers }, body: body ? JSON.stringify(body) : undefined });
const call = async (env, ...a) => {
  const r = await worker.fetch(req(...a), env);
  return { r, j: await r.json() };
};
const dernierCode = (env) => env.__sms.at(-1).message.match(/\d{6}/)[0];
const cookieDe = (r) => r.headers.get('set-cookie').split(';')[0];
// (a number may ask for one code a minute: each sign-in of a test comes two minutes after the one before)
let horloge = Date.now();
async function connecte(env, n = '06 12 34 56 78', extra = {}) {
  horloge += 2 * 60_000;
  await demande(req('POST', '/api/sms/demande', { numero: n }), env, horloge);
  const r = await verifie(req('POST', '/api/sms/verifie', { numero: n, code: dernierCode(env), prenom: 'Léa', ...extra }), env, horloge);
  return { r, j: await r.json() };
}

test('numéros : national, international, invalides', () => {
  assert.equal(numero('06 12 34 56 78'), '+33612345678');
  assert.equal(numero('+33 6 12 34 56 78'), '+33612345678');
  assert.equal(numero('0033612345678'), '+33612345678');
  assert.equal(numero('0470 12 34 56', 'BE'), '+32470123456');
  assert.equal(numero('12'), null);
  assert.equal(numero('+33 abc'), null);
  assert.equal(numero(undefined), null);
});

test('prénoms : lettres, espaces, apostrophes, traits d’union', () => {
  assert.equal(prenom('  Anne-Sophie '), 'Anne-Sophie');
  assert.equal(prenom('Zoé'), 'Zoé');
  assert.equal(prenom('<script>'), null);
  assert.equal(prenom(''), null);
  assert.equal(prenom('a'.repeat(41)), null);
});

test('un code est envoyé, le numéro est gardé chiffré', async () => {
  const env = envNeuf();
  const { r, j } = await call(env, 'POST', '/api/sms/demande', { numero: '06 12 34 56 78', langue: 'fr' });
  assert.equal(r.status, 200);
  assert.ok(j.expire > Date.now());
  assert.match(env.__sms[0].message, /votre code est \d{6}/);
  assert.equal(env.__sms[0].a, '+33612345678');
  const { j: v } = await call(env, 'POST', '/api/sms/verifie', { numero: '0612345678', code: dernierCode(env), prenom: 'Zoé' });
  assert.equal(v.compte.prenom, 'Zoé');
  assert.equal(v.compte.nouveau, true);
  const row = env.DB.raw.prepare('SELECT * FROM comptes').get();
  assert.ok(!JSON.stringify(row).includes('612345678'), 'le numéro ne doit pas apparaître en clair');
  assert.equal(await dechiffre(env.CLE_NUMEROS, row.numero_chiffre), '+33612345678');
});

test('numéro invalide refusé', async () => {
  const env = envNeuf();
  const { r, j } = await call(env, 'POST', '/api/sms/demande', { numero: '12' });
  assert.equal(r.status, 400);
  assert.equal(j.erreur, 'numero_invalide');
});

test('un SMS par minute et cinq par heure pour un numéro', async () => {
  const env = envNeuf();
  const n = { numero: '0611111111' };
  const t0 = 1_800_000_000_000;
  const at = (t) => demande(req('POST', '/api/sms/demande', n), env, t);
  assert.equal((await at(t0)).status, 200);
  const r2 = await at(t0 + 10_000);
  assert.equal(r2.status, 429);
  assert.ok((await r2.json()).attendre > 0);
  for (let k = 1; k < 5; k++) assert.equal((await at(t0 + k * 61_000)).status, 200, `envoi ${k + 1}`);
  assert.equal((await at(t0 + 5 * 61_000)).status, 429, 'le sixième dans l’heure est refusé');
  assert.equal((await at(t0 + 61 * 60_000)).status, 200, 'une heure plus tard, de nouveau');
});

test('code faux : il reste des essais, puis tout est bloqué', async () => {
  const env = envNeuf();
  await call(env, 'POST', '/api/sms/demande', { numero: '0622222222' });
  const bon = dernierCode(env);
  const faux = bon === '000000' ? '111111' : '000000';
  for (let k = 4; k >= 0; k--) {
    const { r, j } = await call(env, 'POST', '/api/sms/verifie', { numero: '0622222222', code: faux });
    assert.equal(r.status, 400);
    assert.equal(j.reste, k);
  }
  const { r, j } = await call(env, 'POST', '/api/sms/verifie', { numero: '0622222222', code: bon });
  assert.equal(r.status, 429);
  assert.equal(j.erreur, 'trop_d_essais');
});

test('code expiré après dix minutes', async () => {
  const env = envNeuf();
  const t0 = 1_800_000_000_000;
  await demande(req('POST', '/api/sms/demande', { numero: '0633333333' }), env, t0);
  const r = await verifie(req('POST', '/api/sms/verifie', { numero: '0633333333', code: dernierCode(env) }), env, t0 + 10 * 60_000 + 1);
  assert.equal((await r.json()).erreur, 'code_expire');
});

test('le site : un cookie de session, /api/moi, le prénom, la déconnexion', async () => {
  const env = envNeuf();
  const { r } = await connecte(env, '0644444444');
  const set = r.headers.get('set-cookie');
  assert.match(set, /belai_session=[\w-]{40,}; Path=\/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax/);
  const c = cookieDe(r);
  let m = await call(env, 'GET', '/api/moi', null, { cookie: c });
  assert.equal(m.r.status, 200);
  assert.equal(m.j.compte.prenom, 'Léa');
  assert.equal(m.j.compte.cagnotte, 0);
  assert.deepEqual(m.j.bouquets, []);
  assert.equal((await call(env, 'POST', '/api/moi', { prenom: '<b>' }, { cookie: c })).j.erreur, 'prenom_invalide');
  assert.equal((await call(env, 'POST', '/api/moi', { prenom: 'Hadrien' }, { cookie: c })).j.compte.prenom, 'Hadrien');
  await call(env, 'POST', '/api/deconnexion', null, { cookie: c });
  m = await call(env, 'GET', '/api/moi', null, { cookie: c });
  assert.equal(m.r.status, 401);
});

test('Belai Bureau : un jeton porteur d’un an, sans cookie', async () => {
  const env = envNeuf();
  const { r, j } = await connecte(env, '0655555555', { client: 'bureau' });
  assert.equal(r.headers.get('set-cookie'), null);
  assert.match(j.jeton, /^[\w-]{40,}$/);
  assert.ok(j.expire - Date.now() > 360 * 24 * 3600 * 1000);
  const m = await call(env, 'GET', '/api/moi', null, { authorization: `Bearer ${j.jeton}` });
  assert.equal(m.r.status, 200);
});

test('le même numéro retrouve le même compte', async () => {
  const env = envNeuf();
  await connecte(env, '0666666666', { prenom: 'Lou' });
  const { j } = await connecte(env, '+33 6 66 66 66 66');
  assert.equal(j.compte.nouveau, false);
  assert.equal(j.compte.prenom, 'Lou');
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM comptes').get().n, 1);
});

test('suppression : sessions fermées, annulée en se reconnectant, anonymisée après 30 jours', async () => {
  const env = envNeuf();
  const { r } = await connecte(env, '0677777777', { prenom: 'Max' });
  const c = cookieDe(r);
  assert.equal((await call(env, 'DELETE', '/api/moi', null, { cookie: c })).r.status, 200);
  assert.equal((await call(env, 'GET', '/api/moi', null, { cookie: c })).r.status, 401);
  // signing in again within 30 days cancels it
  const { j } = await connecte(env, '0677777777');
  assert.equal(j.compte.prenom, 'Max');
  assert.equal(env.DB.raw.prepare('SELECT supprime FROM comptes').get().supprime, null);
  // deleted again, then the daily clean-up 31 days later
  const c2 = cookieDe((await connecte(env, '0677777777')).r);
  await call(env, 'DELETE', '/api/moi', null, { cookie: c2 });
  await menage(env, Date.now() + 31 * 24 * 3600 * 1000);
  const row = env.DB.raw.prepare('SELECT * FROM comptes').get();
  assert.match(row.empreinte, /^efface:/);
  assert.equal(row.numero_chiffre, '');
  assert.equal(row.prenom, null);
});

test('exemplaires restants d’une collection', async () => {
  const env = envNeuf();
  const db = env.DB.raw;
  db.prepare("INSERT INTO collections (mois, exemplaires) VALUES ('2026-10', 100)").run();
  db.prepare("INSERT INTO exemplaires (produit, mois, nombre) VALUES ('citrine', '2026-10', 10)").run();
  db.prepare("INSERT INTO comptes (id, empreinte, numero_chiffre, cree) VALUES ('c1', 'e1', 'x', 0)").run();
  for (let i = 0; i < 3; i++) db.prepare(`INSERT INTO bouquets (id, compte, produit, mois, numero, achat, origine) VALUES ('b${i}', 'c1', 'citrine', '2026-10', ${i + 1}, 0, 'achat')`).run();
  // a payment page still open holds a copy; an expired one does not
  db.prepare(`INSERT INTO commandes (id, compte, produit, mois, centimes, etat, cree, expire) VALUES ('o1', 'c1', 'citrine', '2026-10', 9480, 'en_attente', 0, ${Date.now() + 60_000})`).run();
  db.prepare(`INSERT INTO commandes (id, compte, produit, mois, centimes, etat, cree, expire) VALUES ('o2', 'c1', 'citrine', '2026-10', 9480, 'en_attente', 0, ${Date.now() - 1})`).run();
  const { j } = await call(env, 'GET', '/api/collection?mois=2026-10&produits=citrine,nuit-d-ambre');
  assert.deepEqual(j.restants.citrine, { total: 10, restants: 6 });
  assert.deepEqual(j.restants['nuit-d-ambre'], { total: 100, restants: 100 });
});

test('CORS : les pages du site seulement', async () => {
  const env = envNeuf();
  const ok = await worker.fetch(req('OPTIONS', '/api/moi'), env);
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('access-control-allow-origin'), ORIGINE);
  assert.equal(ok.headers.get('access-control-allow-credentials'), 'true');
  const autre = await worker.fetch(req('OPTIONS', '/api/moi', null, { origin: 'https://ailleurs.example' }), env);
  assert.equal(autre.headers.get('access-control-allow-origin'), null);
});

test('configuration incomplète : une erreur claire, jamais de secret par défaut', async () => {
  const env = { ...envNeuf(), POIVRE: '' };
  const { r, j } = await call(env, 'POST', '/api/sms/demande', { numero: '0612345678' });
  assert.equal(r.status, 500);
  assert.equal(j.erreur, 'configuration');
});

test('inscription : un nouveau numéro sans prénom garde son code et demande le prénom', async () => {
  const env = envNeuf();
  await call(env, 'POST', '/api/sms/demande', { numero: '0655555555' });
  const code = dernierCode(env);
  let v = await call(env, 'POST', '/api/sms/verifie', { numero: '0655555555', code });
  assert.equal(v.r.status, 400);
  assert.equal(v.j.erreur, 'prenom_requis');
  v = await call(env, 'POST', '/api/sms/verifie', { numero: '0655555555', code, prenom: 'Inès' });
  assert.equal(v.r.status, 200);
  assert.equal(v.j.compte.prenom, 'Inès');
  // a known number signs in again without its first name
  const { r } = await connecte(env, '0655555555', { prenom: undefined });
  assert.equal(r.status, 200);
});
