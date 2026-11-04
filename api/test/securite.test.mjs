// The server's defences (audit of 2026-10-29): requests sent all at once against the code's attempts and the limits, the
// countries a text may go to, the shop's daily ceiling, the wrong codes of a day, and the simulated texts and payment
// refused anywhere but on the developer's machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { demande, verifie } from '../src/compte.js';
import { joignable } from '../src/outils.js';
import { d1 } from './d1.mjs';

const ORIGINE = 'http://localhost:8835';
const CATALOGUE = { collection: { mois: '2026-10' }, produits: [{ id: 'neige-de-mars', nom: 'Neige de mars', prix: { centimes: 15000 } }] };
function envNeuf(extra = {}) {
  const cle = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  return { DB: d1(), POIVRE: 'p', CLE_NUMEROS: cle, SMS: 'faux', PAYS: 'FR', ORIGINES: ORIGINE, PAIEMENT: 'faux', __sms: [], __catalogue: CATALOGUE, ...extra };
}
const req = (path, body, { hote = 'http://api.test', ...headers } = {}) =>
  new Request(`${hote}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGINE, ...headers }, body: JSON.stringify(body) });
const dernierCode = (env) => env.__sms.at(-1).message.match(/\d{6}/)[0];
const N = '06 12 34 56 78';

test('codes envoyés tous à la fois : chacun compte un essai, cinq au plus sont comparés', async () => {
  const env = envNeuf();
  const t = Date.now();
  await demande(req('/api/sms/demande', { numero: N }), env, t);
  const bon = dernierCode(env);
  // 300 wrong codes at once, then the right one: before the fix, they all read « 0 attempts » and were all compared
  const faux = Array.from({ length: 300 }, (_, i) => String((Number(bon) + 1 + i) % 1e6).padStart(6, '0'));
  const rs = await Promise.all(faux.map((code) => verifie(req('/api/sms/verifie', { numero: N, code, prenom: 'Léa' }), env, t)));
  const statuts = await Promise.all(rs.map(async (r) => (await r.json()).erreur));
  assert.equal(statuts.filter((e) => e === 'code_faux').length, 5);
  const r = await verifie(req('/api/sms/verifie', { numero: N, code: bon, prenom: 'Léa' }), env, t);
  assert.notEqual(r.status, 200);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
});

test('le bon code envoyé deux fois à la fois n’ouvre qu’une session', async () => {
  const env = envNeuf();
  const t = Date.now();
  await demande(req('/api/sms/demande', { numero: N }), env, t);
  const code = dernierCode(env);
  const rs = await Promise.all([1, 2, 3].map(() => verifie(req('/api/sms/verifie', { numero: N, code, prenom: 'Léa' }), env, t)));
  assert.equal(rs.filter((r) => r.status === 200).length, 1);
});

test('demandes de SMS envoyées toutes à la fois : la limite tient', async () => {
  const env = envNeuf();
  const t = Date.now();
  const rs = await Promise.all(Array.from({ length: 40 }, () => demande(req('/api/sms/demande', { numero: N }), env, t)));
  assert.equal(rs.filter((r) => r.status === 200).length, 1);
  assert.equal(env.__sms.length, 1);
});

test('pays desservis : la liste du porteur, sans les Caraïbes de la zone +1', () => {
  assert.equal(joignable('+33612345678'), true);
  assert.equal(joignable('+3524621123456'), true);
  assert.equal(joignable('+12125550123'), true); // New York
  assert.equal(joignable('+14165550123'), true); // Toronto
  assert.equal(joignable('+18765550123'), false); // Jamaica
  assert.equal(joignable('+18095550123'), false); // Dominican Republic
  assert.equal(joignable('+23480312345678'), false); // Nigeria
  assert.equal(joignable('+88216000000'), false); // satellite
  assert.equal(joignable('+33612345678', '32,49'), false);
});

test('un numéro hors des pays desservis ne reçoit rien', async () => {
  const env = envNeuf();
  const r = await demande(req('/api/sms/demande', { numero: '+234 803 123 4567' }), env);
  assert.equal(r.status, 400);
  assert.equal((await r.json()).erreur, 'pays_non_desservi');
  assert.equal(env.__sms.length, 0);
});

test('plafond de la boutique : SMS_JOUR textos par jour, tous numéros confondus', async () => {
  const env = envNeuf({ SMS_JOUR: '3' });
  const t = Date.now();
  const ok = [];
  for (let i = 0; i < 5; i++) ok.push((await demande(req('/api/sms/demande', { numero: `06 12 34 56 7${i}` }), env, t)).status);
  assert.deepEqual(ok, [200, 200, 200, 429, 429]);
  assert.equal(env.__sms.length, 3);
  // the next day, it opens again
  assert.equal((await demande(req('/api/sms/demande', { numero: '06 12 34 56 79' }), env, t + 24 * 3600_000)).status, 200);
});

test('codes faux du jour : au-delà de quinze, plus de code jusqu’au lendemain', async () => {
  const env = envNeuf();
  let t = Date.now();
  let refus = null;
  for (let k = 0; k < 6 && !refus; k++) {
    const d = await demande(req('/api/sms/demande', { numero: N }), env, t);
    if (d.status !== 200) refus = await d.json();
    else for (let i = 0; i < 5; i++) await verifie(req('/api/sms/verifie', { numero: N, code: '000000' === dernierCode(env) ? '000001' : '000000' }), env, t);
    t += 61 * 60_000; // past the hour's limit of texts
  }
  assert.equal(refus && refus.erreur, 'trop_de_demandes');
  // tomorrow
  assert.equal((await demande(req('/api/sms/demande', { numero: N }), env, t + 24 * 3600_000)).status, 200);
});

test('SMS simulés : refusés en ligne, même réglés ainsi', async () => {
  for (const SMS of ['faux', undefined, '']) {
    const env = envNeuf({ SMS });
    const r = await worker.fetch(req('/api/sms/demande', { numero: N }, { hote: 'https://belai-api.example.workers.dev' }), env);
    assert.equal(r.status, 500);
    assert.equal((await r.json()).erreur, 'configuration');
    assert.equal(env.__sms.length, 0);
  }
});

test('paiement simulé : refusé en ligne, et aucun réglage ne vaut « faux »', async () => {
  // signed in on the developer's machine first, then the same session sent to an online address
  for (const PAIEMENT of ['faux', undefined, '', 'Stripe']) {
    const env = envNeuf({ PAIEMENT });
    const t = Date.now();
    await demande(req('/api/sms/demande', { numero: N }), env, t);
    const v = await verifie(req('/api/sms/verifie', { numero: N, code: dernierCode(env), prenom: 'Léa' }), env, t);
    const cookie = v.headers.get('set-cookie').split(';')[0];
    const corps = { produit: 'neige-de-mars', renonce: true, texte: 'Je demande la livraison immédiate.', retour: `${ORIGINE}/scene/` };
    const hote = PAIEMENT === 'faux' ? 'https://belai-api.example.workers.dev' : 'http://api.test';
    const r = await worker.fetch(req('/api/achat', corps, { hote, cookie }), env);
    assert.equal(r.status, 500, `PAIEMENT=${PAIEMENT}`);
    assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM commandes').get().n, 0);
  }
  // the simulated page is not there online
  const env = envNeuf();
  const r = await worker.fetch(new Request('https://belai-api.example.workers.dev/api/faux-stripe/abcdefghij', { method: 'POST', body: new URLSearchParams({ action: 'payer' }) }), env);
  assert.equal(r.status, 404);
});
