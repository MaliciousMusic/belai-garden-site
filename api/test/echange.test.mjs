// Lot C9: the invoices and credit notes, the exchange within 24 hours (once, never offered, price no higher, the difference in
// the account's credit, the copy given back on sale again and its number reused), purchases paid in part or whole by the
// credit (given back if not paid), a card dispute lost taking the bouquet back.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { demande, verifie } from '../src/compte.js';
import { livre } from '../src/achat.js';
import { echange } from '../src/echange.js';
import { d1 } from './d1.mjs';

const ORIGINE = 'http://localhost:8835';
const RETOUR = `${ORIGINE}/scene/fr/`;
const TEXTE = 'Je demande que mon bouquet me soit livré immédiatement, et je reconnais perdre ainsi mon droit de rétractation de 14 jours.';
const CATALOGUE = {
  vie: { jours: 30 },
  collection: { mois: '2026-10', exemplaires: 100 },
  produits: [
    { id: 'citrine', nom: 'Citrine', prix: { centimes: 9480 } },
    { id: 'douce', nom: 'Douce', prix: { centimes: 3000 } },
    { id: 'rare', nom: 'Rare', prix: { centimes: 5000 }, exemplaires: 1 },
    { id: 'chere', nom: 'Chère', prix: { centimes: 20000 } },
  ],
};
const VENDEUR = JSON.stringify({ nom: 'Vendeur test', adresse: '1 rue des Fleurs', siren: '000 000 000', courriel: 'v@test' });
function envNeuf(extra = {}) {
  const cle = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  return { DB: d1(), POIVRE: 'p', CLE_NUMEROS: cle, SMS: 'faux', PAYS: 'FR', ORIGINES: ORIGINE, PAIEMENT: 'faux', VENDEUR, __sms: [], __catalogue: CATALOGUE, ...extra };
}
const req = (method, path, body, headers = {}) =>
  new Request(`http://api.test${path}`, { method, headers: { 'content-type': 'application/json', origin: ORIGINE, ...headers }, body: body ? JSON.stringify(body) : undefined });
let horloge = Date.now();
async function cookie(env, n, prenom = 'Léa') {
  horloge += 2 * 60_000;
  await demande(req('POST', '/api/sms/demande', { numero: n }), env, horloge);
  const code = env.__sms.at(-1).message.match(/\d{6}/)[0];
  const r = await verifie(req('POST', '/api/sms/verifie', { numero: n, code, prenom }), env, horloge);
  return r.headers.get('set-cookie').split(';')[0];
}
const call = async (env, method, path, body, c) => {
  const r = await worker.fetch(req(method, path, body, c ? { cookie: c } : {}), env);
  return { r, j: r.headers.get('content-type').includes('json') ? await r.json() : await r.text() };
};
// a bouquet bought and paid on the simulated page: the order's id
async function achete(env, c, produit = 'citrine') {
  const { j } = await call(env, 'POST', '/api/achat', { produit, renonce: true, texte: TEXTE, langue: 'fr', retour: RETOUR }, c);
  if (j.url.includes('/api/faux-stripe/')) await livre(env, j.commande, `faux_${j.commande}`);
  return j.commande;
}
const moi = async (env, c) => (await call(env, 'GET', '/api/moi', null, c)).j;
const restants = async (env, p) => (await call(env, 'GET', `/api/collection?mois=2026-10&produits=${p}`)).j.restants[p].restants;

test('une facture numérotée pour chaque achat, lisible par son seul compte', async () => {
  const env = envNeuf();
  const c = await cookie(env, '0611111111', 'Zoé');
  await achete(env, c);
  const l = (await call(env, 'GET', '/api/factures', null, c)).j.factures;
  assert.equal(l.length, 1);
  assert.equal(l[0].ref, 'F-000001');
  assert.equal(l[0].total, 9480);
  assert.match(l[0].libelle, /Bouquet « Citrine », exemplaire n° 1 sur 100, collection d’octobre 2026/);
  const h = (await call(env, 'GET', '/api/facture/1', null, c)).j;
  assert.match(h, /Facture F-000001/);
  assert.match(h, /Zoé/);
  assert.match(h, /\+33 • •• •• •• 11/);
  assert.match(h, /TVA non applicable, art\. 293 B du CGI/);
  assert.match(h, /Vendeur test/);
  assert.ok(!h.includes('611111111'), 'le numéro ne doit pas apparaître en clair');
  const autre = await cookie(env, '0622222222');
  assert.equal((await call(env, 'GET', '/api/facture/1', null, autre)).r.status, 404);
  assert.equal((await call(env, 'GET', '/api/factures')).r.status, 401);
});

test('échange sous 24 h : moins cher, la différence en cagnotte, un avoir et une facture, une seule fois', async () => {
  const env = envNeuf();
  const c = await cookie(env, '0633333333');
  await achete(env, c);
  let m = await moi(env, c);
  const b = m.bouquets[0];
  assert.ok(b.echangeable > Date.now());
  assert.equal((await call(env, 'POST', '/api/echange', { bouquet: b.id, produit: 'chere' }, c)).j.erreur, 'trop_cher');
  assert.equal((await call(env, 'POST', '/api/echange', { bouquet: b.id, produit: 'citrine' }, c)).j.erreur, 'meme_bouquet');
  assert.equal(await restants(env, 'citrine'), 99);
  const e = await call(env, 'POST', '/api/echange', { bouquet: b.id, produit: 'douce' }, c);
  assert.equal(e.r.status, 200);
  assert.equal(e.j.cagnotte, 9480 - 3000);
  assert.equal(e.j.bouquet.produit, 'douce');
  assert.ok(e.j.bouquet.fin - e.j.bouquet.achat === 30 * 864e5, 'le nouveau bouquet repart pour 30 jours');
  // the copy given back is on sale again
  assert.equal(await restants(env, 'citrine'), 100);
  m = await moi(env, c);
  assert.deepEqual(m.bouquets.map((x) => x.produit), ['douce']);
  assert.equal(m.bouquets[0].echangeable, null, 'un bouquet reçu en échange ne s’échange plus');
  assert.equal(m.compte.cagnotte, 6480);
  const l = (await call(env, 'GET', '/api/factures', null, c)).j.factures;
  assert.deepEqual(l.map((f) => [f.ref, f.total]), [['F-000003', 3000], ['A-000002', -9480], ['F-000001', 9480]]);
  const avoir = (await call(env, 'GET', '/api/facture/2', null, c)).j;
  assert.match(avoir, /annule la facture F-000001/);
  assert.match(avoir, /Crédité sur votre cagnotte/);
  assert.equal((await call(env, 'POST', '/api/echange', { bouquet: m.bouquets[0].id, produit: 'rare' }, c)).j.erreur, 'echange_impossible');
});

test('échange refusé après 24 h, ou pour un bouquet offert', async () => {
  const env = envNeuf();
  const c = await cookie(env, '0644444444');
  await achete(env, c);
  await achete(env, c, 'douce');
  const bs = (await moi(env, c)).bouquets;
  const b = bs.find((x) => x.produit === 'citrine');
  const d = bs.find((x) => x.produit === 'douce');
  const tard = await echange(req('POST', '/api/echange', { bouquet: b.id, produit: 'rare' }, { cookie: c }), env, b.achat + 24 * 3600_000 + 1);
  assert.equal((await tard.json()).raison, 'delai');
  // an offered bouquet (lots C4, C5: a gift row) is not exchanged
  const compte = env.DB.raw.prepare('SELECT compte FROM bouquets WHERE id = ?').get(d.id).compte;
  env.DB.raw.prepare("INSERT INTO cadeaux (id, bouquet, expediteur, signature, code_hash, etat, expire) VALUES ('k1', ?, ?, 'Léa', 'h', 'en_attente', ?)").run(d.id, compte, Date.now() + 864e5);
  assert.equal((await call(env, 'POST', '/api/echange', { bouquet: d.id, produit: 'rare' }, c)).j.raison, 'offert');
});

test('échange vers une série pleine : rien ne change', async () => {
  const env = envNeuf();
  const a = await cookie(env, '0655555551');
  const b = await cookie(env, '0655555552');
  await achete(env, a, 'rare');
  await achete(env, b);
  const bq = (await moi(env, b)).bouquets[0];
  assert.equal((await call(env, 'POST', '/api/echange', { bouquet: bq.id, produit: 'rare' }, b)).j.erreur, 'epuise');
  assert.equal((await moi(env, b)).bouquets[0].id, bq.id);
  assert.equal((await moi(env, b)).compte.cagnotte, 0);
});

test('le numéro d’un exemplaire rendu est repris par le prochain acheteur', async () => {
  const env = envNeuf();
  const a = await cookie(env, '0666666661');
  const b = await cookie(env, '0666666662');
  const c = await cookie(env, '0666666663');
  await achete(env, a);
  await achete(env, b);
  const ba = (await moi(env, a)).bouquets[0];
  assert.equal(ba.numero, 1);
  await call(env, 'POST', '/api/echange', { bouquet: ba.id, produit: 'douce' }, a);
  await achete(env, c);
  assert.equal((await moi(env, c)).bouquets[0].numero, 1);
});

test('la cagnotte paie une partie du prochain achat, revient si on annule, paie tout si elle suffit', async () => {
  const env = envNeuf();
  const c = await cookie(env, '0677777777');
  await achete(env, c);
  const b = (await moi(env, c)).bouquets[0];
  await call(env, 'POST', '/api/echange', { bouquet: b.id, produit: 'douce' }, c);
  assert.equal((await moi(env, c)).compte.cagnotte, 6480);
  // citrine (94,80 €): 64,80 € from the credit, 30 € by card; cancelled, the credit comes back
  let { j } = await call(env, 'POST', '/api/achat', { produit: 'citrine', renonce: true, texte: TEXTE, langue: 'fr', retour: RETOUR }, c);
  assert.equal((await moi(env, c)).compte.cagnotte, 0);
  const page = await (await worker.fetch(new Request(j.url), env)).text();
  assert.match(page, /Payer 30,00/);
  const fd = new FormData();
  fd.set('action', 'annuler');
  await worker.fetch(new Request(j.url, { method: 'POST', body: fd }), env);
  assert.equal((await moi(env, c)).compte.cagnotte, 6480);
  // rare (50 €): paid whole by the credit, delivered at once, no payment page
  ({ j } = await call(env, 'POST', '/api/achat', { produit: 'rare', renonce: true, texte: TEXTE, langue: 'fr', retour: RETOUR }, c));
  assert.match(j.url, /paiement=ok/);
  const m = await moi(env, c);
  assert.equal(m.compte.cagnotte, 1480);
  assert.ok(m.bouquets.some((x) => x.produit === 'rare'));
  const f = (await call(env, 'GET', '/api/factures', null, c)).j.factures[0];
  const h = (await call(env, 'GET', `/api/facture/${f.numero}`, null, c)).j;
  assert.match(h, /Cagnotte du compte/);
  assert.ok(!h.includes('Carte bancaire'));
});

// ---------- card disputes
const SECRET = 'whsec_test_local';
async function signe(body, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`))).toString('hex');
  return `t=${t},v1=${mac}`;
}
const litige = (type, pi, status) => JSON.stringify({ id: 'evt_d', type, data: { object: { id: 'dp_1', object: 'dispute', payment_intent: pi, status } } });
const poste = async (env, body) => worker.fetch(new Request('http://api.test/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': await signe(body) }, body }), env);

test('contestation : gagnée, le bouquet reste ; perdue, il est retiré, même échangé', async () => {
  const env = envNeuf({ STRIPE_WEBHOOK_SECRET: SECRET });
  const c = await cookie(env, '0688888888');
  const o1 = await achete(env, c);
  const o2 = await achete(env, c, 'douce');
  const pi = (o) => env.DB.raw.prepare('SELECT paiement FROM commandes WHERE id = ?').get(o).paiement;
  await poste(env, litige('charge.dispute.created', pi(o2)));
  assert.equal(env.DB.raw.prepare('SELECT litige FROM commandes WHERE id = ?').get(o2).litige, 'ouvert');
  await poste(env, litige('charge.dispute.closed', pi(o2), 'won'));
  assert.equal((await moi(env, c)).bouquets.length, 2);
  // the citrine exchanged for rare, then its payment disputed and lost: rare goes, and the credit the exchange left
  const citrine = (await moi(env, c)).bouquets.find((x) => x.produit === 'citrine');
  await call(env, 'POST', '/api/echange', { bouquet: citrine.id, produit: 'rare' }, c);
  assert.equal((await moi(env, c)).compte.cagnotte, 4480);
  await poste(env, litige('charge.dispute.closed', pi(o1), 'lost'));
  const m = await moi(env, c);
  assert.deepEqual(m.bouquets.map((x) => x.produit), ['douce']);
  assert.equal(m.compte.cagnotte, 0);
  assert.equal(env.DB.raw.prepare('SELECT litige FROM commandes WHERE id = ?').get(o1).litige, 'perdu');
});
