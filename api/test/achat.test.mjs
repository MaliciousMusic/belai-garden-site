// The purchase (lot C3): the waiver, the catalogue's price, a copy held while the payment page is open, the last copy
// taken once, the simulated payment page, Stripe's signed events (and forged ones refused), the bouquet's copy number.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { demande, verifie } from '../src/compte.js';
import { achat, livre } from '../src/achat.js';
import { d1 } from './d1.mjs';

const ORIGINE = 'http://localhost:8835';
const RETOUR = `${ORIGINE}/scene/fr/?b=citrine`;
const TEXTE = 'Je demande que mon bouquet me soit livré immédiatement, et je reconnais perdre ainsi mon droit de rétractation de 14 jours.';
const CATALOGUE = {
  vie: { jours: 30 },
  collection: { mois: '2026-10', exemplaires: 100 },
  produits: [
    { id: 'citrine', nom: 'Citrine', prix: { centimes: 9480 } },
    { id: 'rare', nom: 'Rare', prix: { centimes: 5000 }, exemplaires: 1 },
  ],
};
function envNeuf(extra = {}) {
  const cle = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  return { DB: d1(), POIVRE: 'p', CLE_NUMEROS: cle, SMS: 'faux', PAYS: 'FR', ORIGINES: ORIGINE, PAIEMENT: 'faux', __sms: [], __catalogue: CATALOGUE, ...extra };
}
const req = (method, path, body, headers = {}) =>
  new Request(`http://api.test${path}`, { method, headers: { 'content-type': 'application/json', origin: ORIGINE, ...headers }, body: body ? JSON.stringify(body) : undefined });
let horloge = Date.now();
async function cookie(env, n) {
  horloge += 2 * 60_000;
  await demande(req('POST', '/api/sms/demande', { numero: n }), env, horloge);
  const code = env.__sms.at(-1).message.match(/\d{6}/)[0];
  const r = await verifie(req('POST', '/api/sms/verifie', { numero: n, code, prenom: 'Léa' }), env, horloge);
  return r.headers.get('set-cookie').split(';')[0];
}
const acheter = (env, c, produit = 'citrine', extra = {}) => worker.fetch(req('POST', '/api/achat', { produit, renonce: true, texte: TEXTE, langue: 'fr', retour: RETOUR, ...extra }, { cookie: c }), env);

test('il faut être connecté, renoncer expressément et revenir sur le site', async () => {
  const env = envNeuf();
  assert.equal((await worker.fetch(req('POST', '/api/achat', { produit: 'citrine' }), env)).status, 401);
  const c = await cookie(env, '0612345678');
  assert.equal((await (await acheter(env, c, 'citrine', { renonce: false })).json()).erreur, 'renonciation_requise');
  assert.equal((await (await acheter(env, c, 'citrine', { retour: 'https://ailleurs.example/' })).json()).erreur, 'retour_invalide');
  assert.equal((await (await acheter(env, c, 'inconnu')).json()).erreur, 'produit_inconnu');
});

test('le prix vient du catalogue, la commande retient le renoncement', async () => {
  const env = envNeuf();
  const c = await cookie(env, '0612345679');
  const r = await acheter(env, c, 'citrine', { centimes: 1 });
  assert.equal(r.status, 200);
  const { commande, url } = await r.json();
  assert.match(url, /\/api\/faux-stripe\//);
  const row = env.DB.raw.prepare('SELECT * FROM commandes WHERE id = ?').get(commande);
  assert.equal(row.centimes, 9480);
  assert.equal(row.etat, 'en_attente');
  assert.equal(JSON.parse(row.consentement).texte, TEXTE);
});

test('page de paiement simulée : payer donne le bouquet, numéroté dans sa série', async () => {
  const env = envNeuf();
  const c = await cookie(env, '0612345680');
  const { commande, url } = await (await acheter(env, c)).json();
  const page = await worker.fetch(new Request(url), env);
  assert.match(await page.text(), /Paiement simulé/);
  const fd = new FormData();
  fd.set('action', 'payer');
  const r = await worker.fetch(new Request(url, { method: 'POST', body: fd }), env);
  assert.equal(r.status, 303);
  assert.match(r.headers.get('location'), /\?b=citrine&commande=.+&paiement=ok$/);
  const o = await (await worker.fetch(req('GET', `/api/commande/${commande}`, null, { cookie: c }), env)).json();
  assert.equal(o.etat, 'payee');
  assert.equal(o.bouquet.numero, 1);
  const moi = await (await worker.fetch(req('GET', '/api/moi', null, { cookie: c }), env)).json();
  assert.equal(moi.bouquets.length, 1);
  assert.equal(moi.bouquets[0].produit, 'citrine');
  // a second buyer gets copy number 2
  const c2 = await cookie(env, '0612345681');
  const o2 = await (await acheter(env, c2)).json();
  await livre(env, o2.commande, 'faux');
  const b2 = await (await worker.fetch(req('GET', `/api/commande/${o2.commande}`, null, { cookie: c2 }), env)).json();
  assert.equal(b2.bouquet.numero, 2);
});

test('annuler rend l’exemplaire ; une commande n’est lisible que par son acheteur', async () => {
  const env = envNeuf();
  const c = await cookie(env, '0612345682');
  const { commande, url } = await (await acheter(env, c, 'rare')).json();
  const autre = await cookie(env, '0612345683');
  assert.equal((await worker.fetch(req('GET', `/api/commande/${commande}`, null, { cookie: autre }), env)).status, 404);
  // the only copy is held: nobody else can buy it meanwhile
  assert.equal((await acheter(env, autre, 'rare')).status, 409);
  const fd = new FormData();
  fd.set('action', 'annuler');
  await worker.fetch(new Request(url, { method: 'POST', body: fd }), env);
  assert.equal((await acheter(env, autre, 'rare')).status, 200);
});

test('le dernier exemplaire ne se vend qu’une fois, même si deux personnes paient au même moment', async () => {
  const env = envNeuf();
  const a = await cookie(env, '0612345684');
  const b = await cookie(env, '0612345685');
  const [ra, rb] = await Promise.all([acheter(env, a, 'rare'), acheter(env, b, 'rare')]);
  assert.deepEqual([ra.status, rb.status].sort(), [200, 409]);
});

test('une réservation expirée rend l’exemplaire', async () => {
  const env = envNeuf();
  const a = await cookie(env, '0612345686');
  const t = Date.now();
  await achat(req('POST', '/api/achat', { produit: 'rare', renonce: true, texte: TEXTE, retour: RETOUR }, { cookie: a }), env, t);
  const b = await cookie(env, '0612345687');
  const r = await achat(req('POST', '/api/achat', { produit: 'rare', renonce: true, texte: TEXTE, retour: RETOUR }, { cookie: b }), env, t + 32 * 60_000);
  assert.equal(r.status, 200);
});

// ---------- Stripe's events
const SECRET = 'whsec_test_local';
async function signe(body, t = Math.floor(Date.now() / 1000), secret = SECRET) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`))).toString('hex');
  return `t=${t},v1=${mac}`;
}
const evt = (type, commande, extra = {}) => JSON.stringify({ id: 'evt_1', type, data: { object: { id: 'cs_test_1', client_reference_id: commande, metadata: { commande }, payment_status: 'paid', payment_intent: 'pi_test_1', ...extra } } });

test('Stripe : un événement signé livre une fois, un faux est refusé, un vieux aussi', async () => {
  const env = envNeuf({ STRIPE_WEBHOOK_SECRET: SECRET });
  const c = await cookie(env, '0612345688');
  const { commande } = await (await acheter(env, c)).json();
  const body = evt('checkout.session.completed', commande);
  const post = async (sig, b = body) => worker.fetch(new Request('http://api.test/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': sig }, body: b }), env);
  assert.equal((await post(await signe(body, undefined, 'whsec_autre'))).status, 400, 'mauvaise clé');
  assert.equal((await post(await signe(body, Math.floor(Date.now() / 1000) - 600))).status, 400, 'trop vieux');
  assert.equal((await post(await signe(body), body.replace('pi_test_1', 'pi_test_2'))).status, 400, 'corps modifié');
  assert.equal((await post(await signe(body))).status, 200);
  assert.equal((await post(await signe(body))).status, 200, 'rejoué : accepté mais sans effet');
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM bouquets').get().n, 1);
  assert.equal(env.DB.raw.prepare('SELECT paiement FROM commandes').get().paiement, 'pi_test_1');
});

test('Stripe : une session expirée rend l’exemplaire', async () => {
  const env = envNeuf({ STRIPE_WEBHOOK_SECRET: SECRET });
  const c = await cookie(env, '0612345689');
  const { commande } = await (await acheter(env, c, 'rare')).json();
  const body = evt('checkout.session.expired', commande, { payment_status: 'unpaid' });
  await worker.fetch(new Request('http://api.test/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': await signe(body) }, body }), env);
  assert.equal(env.DB.raw.prepare('SELECT etat FROM commandes').get().etat, 'expiree');
  assert.equal((await acheter(env, await cookie(env, '0612345690'), 'rare')).status, 200);
});

test('Stripe : la session Checkout demandée (prix, renvoi, expiration, idempotence)', async () => {
  const env = envNeuf({ PAIEMENT: 'stripe', STRIPE_SECRET: 'sk_test_local' });
  const c = await cookie(env, '0612345691');
  const vrai = globalThis.fetch;
  let vu = null;
  globalThis.fetch = async (url, init) => {
    vu = { url, init };
    return new Response(JSON.stringify({ id: 'cs_test_9', url: 'https://checkout.stripe.com/c/pay/cs_test_9' }), { status: 200 });
  };
  try {
    const r = await acheter(env, c);
    const j = await r.json();
    assert.equal(j.url, 'https://checkout.stripe.com/c/pay/cs_test_9');
    assert.equal(vu.url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(vu.init.headers.authorization, 'Bearer sk_test_local');
    assert.equal(vu.init.headers['idempotency-key'], `commande-${j.commande}`);
    const f = new URLSearchParams(vu.init.body);
    assert.equal(f.get('line_items[0][price_data][unit_amount]'), '9480');
    assert.equal(f.get('line_items[0][price_data][currency]'), 'eur');
    assert.equal(f.get('metadata[commande]'), j.commande);
    assert.match(f.get('success_url'), /paiement=ok$/);
    assert.ok(Number(f.get('expires_at')) - Date.now() / 1000 >= 30 * 60);
    assert.equal(env.DB.raw.prepare('SELECT session_stripe FROM commandes').get().session_stripe, 'cs_test_9');
  } finally {
    globalThis.fetch = vrai;
  }
});
