// Orders, credit and Stripe under stress: pressed twice, the same bouquet asked again while its page is open, a payment whose
// event is lost, late, doubled, out of order or of the wrong amount, the credit never spent twice, an exchange done whole.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { demande, verifie } from '../src/compte.js';
import { livre, abandon, menageCommandes } from '../src/achat.js';
import { d1 } from './d1.mjs';

const ORIGINE = 'http://localhost:8851';
const RETOUR = `${ORIGINE}/squelette/produit.html?b=citrine#haut`;
const SECRET = 'whsec_test_local';
const CATALOGUE = {
  collection: { mois: '2026-11' },
  produits: [
    { id: 'citrine', nom: 'Citrine', prix: { centimes: 9480 } },
    { id: 'douce', nom: 'Douce', prix: { centimes: 3000 } },
    { id: 'rare', nom: 'Rare', prix: { centimes: 5000 }, exemplaires: 1 },
  ],
};
const envNeuf = (extra = {}) => ({ DB: d1(), POIVRE: 'p', CLE_NUMEROS: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', SMS: 'faux', PAYS: 'FR', ORIGINES: ORIGINE, PAIEMENT: 'faux', STRIPE_SECRET: 'sk_test_local', STRIPE_WEBHOOK_SECRET: SECRET, __sms: [], __catalogue: CATALOGUE, ...extra });
const req = (method, path, body, headers = {}) => new Request(`http://api.test${path}`, { method, headers: { 'content-type': 'application/json', origin: ORIGINE, ...headers }, body: body ? JSON.stringify(body) : undefined });
let h = Date.now();
let n = 0;
async function cookie(env) {
  h += 120_000;
  const numero = `06200000${String(n++).padStart(2, '0')}`;
  await demande(req('POST', '/', { numero }), env, h);
  const r = await verifie(req('POST', '/', { numero, code: env.__sms.at(-1).message.match(/\d{6}/)[0], prenom: "O'Brien" }), env, h);
  return r.headers.get('set-cookie').split(';')[0];
}
const acheter = async (env, c, produit = 'citrine') => {
  const r = await worker.fetch(req('POST', '/api/achat', { produit, renonce: true, langue: 'fr', retour: RETOUR }, { cookie: c }), env);
  return { s: r.status, ...(await r.json()) };
};
const lire = async (env, c, id) => (await worker.fetch(req('GET', `/api/commande/${id}`, null, { cookie: c }), env)).json();
const un = (env, sql, ...a) => env.DB.raw.prepare(sql).get(...a);
async function evenement(env, type, object, plus = {}) {
  const body = JSON.stringify({ id: `evt_${Math.random()}`, type, data: { object }, ...plus });
  const t = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`))).toString('hex');
  return (await worker.fetch(new Request('http://api.test/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${mac}` }, body }), env)).status;
}
// Stripe, in memory
async function avecStripe(fn) {
  const vrai = globalThis.fetch;
  const pages = new Map();
  const st = { pages, panne: false, paie: (id) => Object.assign(pages.get(id), { status: 'complete', payment_status: 'paid', payment_intent: `pi_${id}` }) };
  globalThis.fetch = async (url, init = {}) => {
    if (st.panne) throw new Error('Stripe ne répond pas');
    const u = String(url).replace('https://api.stripe.com/v1/checkout/sessions', '');
    const rend = (o, status = 200) => new Response(JSON.stringify(o), { status });
    if (u === '') {
      const f = new URLSearchParams(init.body);
      const id = `cs_test_${pages.size + 1}`;
      pages.set(id, { id, url: `https://checkout.stripe.com/${id}`, status: 'open', payment_status: 'unpaid', currency: f.get('line_items[0][price_data][currency]'), amount_total: Number(f.get('line_items[0][price_data][unit_amount]')), metadata: { commande: f.get('metadata[commande]') }, success_url: f.get('success_url'), adaptive: f.get('adaptive_pricing[enabled]') });
      return rend(pages.get(id));
    }
    const p = pages.get(decodeURIComponent(u.split('/')[1]));
    if (u.endsWith('/expire')) {
      if (p.status !== 'open') return rend({ error: { message: 'not open' } }, 400);
      p.status = 'expired';
    }
    return rend(p);
  };
  try {
    await fn(st);
  } finally {
    globalThis.fetch = vrai;
  }
}

test('dix appuis à la fois : une seule commande ouverte', async () => {
  const env = envNeuf();
  const c = await cookie(env);
  const rs = await Promise.all(Array.from({ length: 10 }, () => acheter(env, c)));
  assert.ok(rs.every((r) => r.s === 200 || r.erreur === 'commande_en_cours'));
  assert.equal(un(env, "SELECT COUNT(*) AS n FROM commandes WHERE etat = 'en_attente'").n, 1);
});

test('dix appuis à la fois chez Stripe : une seule page de paiement peut encore être payée', async () =>
  avecStripe(async (st) => {
    const env = envNeuf({ PAIEMENT: 'stripe' });
    const c = await cookie(env);
    await Promise.all(Array.from({ length: 10 }, () => acheter(env, c)));
    assert.equal([...st.pages.values()].filter((p) => p.status === 'open').length, 1);
  }));

test('redemander le même bouquet ferme la page de paiement d’avant', async () =>
  avecStripe(async (st) => {
    const env = envNeuf({ PAIEMENT: 'stripe' });
    const c = await cookie(env);
    env.DB.raw.prepare('UPDATE comptes SET cagnotte = 1000').run();
    for (let i = 1; i <= 4; i++) {
      const r = await acheter(env, c);
      assert.equal(r.s, 200);
      assert.equal(st.pages.get(`cs_test_${i}`).amount_total, 8480);
    }
    assert.deepEqual([...st.pages.values()].map((p) => p.status), ['expired', 'expired', 'expired', 'open']);
    assert.equal(un(env, 'SELECT cagnotte FROM comptes').cagnotte, 0);
    assert.equal(st.pages.get('cs_test_1').adaptive, 'false');
    assert.match(st.pages.get('cs_test_1').success_url, /\?b=citrine&commande=[\w-]+&paiement=ok#haut$/);
  }));

test('la page d’avant vient d’être payée : elle est livrée, aucune autre ne s’ouvre', async () =>
  avecStripe(async (st) => {
    const env = envNeuf({ PAIEMENT: 'stripe' });
    const c = await cookie(env);
    const a = await acheter(env, c);
    st.paie('cs_test_1');
    const b = await acheter(env, c);
    assert.equal(b.erreur, 'deja_payee');
    assert.equal(b.commande, a.commande);
    assert.equal((await lire(env, c, a.commande)).etat, 'payee');
    assert.equal(st.pages.size, 1);
  }));

test('Stripe ne répond pas : la commande d’avant reste, rien n’est perdu', async () =>
  avecStripe(async (st) => {
    const env = envNeuf({ PAIEMENT: 'stripe' });
    const c = await cookie(env);
    env.DB.raw.prepare('UPDATE comptes SET cagnotte = 1000').run();
    const a = await acheter(env, c);
    st.panne = true;
    assert.equal((await acheter(env, c)).s, 500);
    assert.equal(un(env, 'SELECT etat FROM commandes WHERE id = ?', a.commande).etat, 'en_attente');
    assert.equal((await acheter(env, c, 'douce')).s, 500);
    assert.equal(un(env, "SELECT etat FROM commandes WHERE produit = 'douce'").etat, 'echec');
    assert.equal((await lire(env, c, a.commande)).etat, 'en_attente');
  }));

test('signal perdu après le paiement : la commande est livrée au retour, ou par le ménage du jour', async () =>
  avecStripe(async (st) => {
    const env = envNeuf({ PAIEMENT: 'stripe' });
    const c = await cookie(env);
    const a = await acheter(env, c);
    assert.equal((await lire(env, c, a.commande)).etat, 'en_attente');
    st.paie('cs_test_1');
    // (asked again at most once every fifteen seconds)
    assert.equal((await lire(env, c, a.commande)).etat, 'en_attente');
    env.DB.raw.prepare('DELETE FROM limites').run();
    assert.equal((await lire(env, c, a.commande)).etat, 'payee');
    const b = await acheter(env, c, 'douce');
    st.paie('cs_test_2');
    await menageCommandes(env, Date.now() + 3 * 3600_000);
    assert.equal(un(env, 'SELECT etat FROM commandes WHERE id = ?', b.commande).etat, 'payee');
    const d = await acheter(env, c, 'rare');
    st.pages.get('cs_test_3').status = 'expired';
    await menageCommandes(env, Date.now() + 3 * 3600_000);
    assert.equal(un(env, 'SELECT etat FROM commandes WHERE id = ?', d.commande).etat, 'expiree');
    // the event comes at last, then again: nothing more
    for (let i = 0; i < 3; i++) assert.equal(await evenement(env, 'checkout.session.completed', st.pages.get('cs_test_1')), 200);
    assert.equal(un(env, 'SELECT COUNT(*) AS n FROM bouquets').n, 2);
    assert.equal(un(env, 'SELECT COUNT(*) AS n FROM factures').n, 2);
  }));

test('montant, devise ou page qui ne sont pas ceux de la commande : rien n’est livré, à vérifier', async () => {
  for (const faux of [{ amount_total: 1 }, { currency: 'jpy' }, { amount_total: undefined }, { amount_total: -9480 }]) {
    const env = envNeuf();
    const { commande } = await acheter(env, await cookie(env));
    await evenement(env, 'checkout.session.completed', { id: 'cs', payment_status: 'paid', payment_intent: 'pi', amount_total: 9480, currency: 'eur', metadata: { commande }, ...faux });
    assert.equal(un(env, 'SELECT etat FROM commandes').etat, 'a_verifier');
    assert.equal(un(env, 'SELECT COUNT(*) AS n FROM bouquets').n, 0);
  }
  // an event of the page of another order
  await avecStripe(async (st) => {
    const env = envNeuf({ PAIEMENT: 'stripe' });
    const c = await cookie(env);
    const a = await acheter(env, c);
    await acheter(env, c, 'douce');
    st.paie('cs_test_2');
    st.pages.get('cs_test_2').metadata.commande = a.commande;
    st.pages.get('cs_test_2').amount_total = 9480;
    await evenement(env, 'checkout.session.completed', st.pages.get('cs_test_2'));
    assert.equal(un(env, 'SELECT etat FROM commandes WHERE id = ?', a.commande).etat, 'a_verifier');
  });
});

test('chez Stripe, ce qui est livré est ce que Stripe confirme, pas ce que dit l’événement', async () =>
  avecStripe(async (st) => {
    const env = envNeuf({ PAIEMENT: 'stripe' });
    const { commande } = await acheter(env, await cookie(env));
    const dit = { ...st.pages.get('cs_test_1'), payment_status: 'paid', payment_intent: 'pi' };
    st.pages.get('cs_test_1').amount_total = 5;
    await evenement(env, 'checkout.session.completed', dit);
    assert.notEqual(un(env, 'SELECT etat FROM commandes WHERE id = ?', commande).etat, 'payee');
    // another mode's event, another shop's payment: ignored
    await evenement(env, 'checkout.session.completed', dit, { livemode: true });
    assert.equal(await evenement(env, 'checkout.session.completed', { ...dit, metadata: { commande: 'inconnue' }, id: 'cs_test_1' }), 200);
  }));

test('une commande annulée puis payée n’est pas oubliée', async () => {
  const env = envNeuf();
  const { commande } = await acheter(env, await cookie(env));
  await abandon(env, commande, 'annulee');
  assert.equal(await livre(env, commande, 'pi'), false);
  assert.equal(un(env, 'SELECT etat FROM commandes').etat, 'a_verifier');
});

test('la cagnotte n’est jamais négative, ni dépensée deux fois', async () => {
  const env = envNeuf();
  const c = await cookie(env);
  env.DB.raw.prepare('UPDATE comptes SET cagnotte = 1000').run();
  const a = await acheter(env, c);
  await abandon(env, a.commande, 'expiree');
  await abandon(env, a.commande, 'expiree');
  assert.equal(un(env, 'SELECT cagnotte FROM comptes').cagnotte, 1000, 'rendue une fois');
  // spent on another, then the first is paid after all: a person looks
  const b = await acheter(env, c, 'douce');
  await livre(env, b.commande, 'pi_b');
  assert.equal(await livre(env, a.commande, 'pi_a'), false);
  assert.equal(un(env, 'SELECT etat FROM commandes WHERE id = ?', a.commande).etat, 'a_verifier');
  assert.equal(un(env, 'SELECT cagnotte FROM comptes').cagnotte, 0);
  assert.throws(() => env.DB.raw.prepare('UPDATE comptes SET cagnotte = -1').run(), /cagnotte negative/);
  // still there: paid late, it is taken again
  const env2 = envNeuf();
  const c2 = await cookie(env2);
  env2.DB.raw.prepare('UPDATE comptes SET cagnotte = 1000').run();
  const d = await acheter(env2, c2);
  await abandon(env2, d.commande, 'expiree');
  const rs = await Promise.all(Array.from({ length: 20 }, () => livre(env2, d.commande, 'pi')));
  assert.equal(rs.filter(Boolean).length, 1);
  assert.equal(un(env2, 'SELECT cagnotte FROM comptes').cagnotte, 0);
  assert.equal(un(env2, 'SELECT COUNT(*) AS n FROM factures').n, 1);
});

test('contestations : dans le désordre, rejouées, avant le paiement', async () => {
  const env = envNeuf();
  const c = await cookie(env);
  const a = await acheter(env, c);
  // told before the payment itself
  await evenement(env, 'charge.dispute.created', { payment_intent: 'pi_a', status: 'needs_response' });
  await livre(env, a.commande, 'pi_a');
  assert.equal(un(env, 'SELECT litige FROM commandes WHERE id = ?', a.commande).litige, 'ouvert');
  await evenement(env, 'charge.dispute.closed', { payment_intent: 'pi_a', status: 'won' });
  for (const t of ['charge.dispute.created', 'charge.dispute.funds_reinstated', 'charge.dispute.updated']) await evenement(env, t, { payment_intent: 'pi_a' });
  assert.equal(un(env, 'SELECT litige FROM commandes WHERE id = ?', a.commande).litige, 'gagne');
  // lost and told three times: the credit it left goes once
  const b = await acheter(env, c);
  await livre(env, b.commande, 'pi_b');
  const bq = un(env, 'SELECT bouquet FROM commandes WHERE id = ?', b.commande).bouquet;
  await worker.fetch(req('POST', '/api/echange', { bouquet: bq, produit: 'douce' }, { cookie: c }), env);
  assert.equal(un(env, 'SELECT cagnotte FROM comptes').cagnotte, 6480);
  env.DB.raw.prepare('UPDATE comptes SET cagnotte = cagnotte + 10000').run();
  for (let i = 0; i < 3; i++) await evenement(env, 'charge.dispute.closed', { payment_intent: 'pi_b', status: 'lost' });
  await evenement(env, 'charge.dispute.created', { payment_intent: 'pi_b' });
  assert.equal(un(env, 'SELECT cagnotte FROM comptes').cagnotte, 10000);
  assert.equal(un(env, 'SELECT litige FROM commandes WHERE id = ?', b.commande).litige, 'perdu');
  env.DB.raw.prepare('UPDATE comptes SET cagnotte = 0').run();
  // lost before the payment is known: the bouquet does not stay
  const d = await acheter(env, c, 'rare');
  await evenement(env, 'charge.dispute.closed', { payment_intent: 'pi_d', status: 'lost' });
  await livre(env, d.commande, 'pi_d');
  assert.equal(un(env, "SELECT etat FROM bouquets WHERE commande = ?", d.commande).etat, 'retire');
});

test('un échange se fait en entier ou pas du tout, et une fois', async () => {
  const env = envNeuf();
  const c = await cookie(env);
  const a = await acheter(env, c);
  await livre(env, a.commande, 'pi');
  const bq = un(env, 'SELECT bouquet FROM commandes').bouquet;
  const echange = (produit) => worker.fetch(req('POST', '/api/echange', { bouquet: bq, produit }, { cookie: c }), env);
  // the papers cannot be issued: nothing at all is done
  env.DB.raw.exec("CREATE TRIGGER panne BEFORE INSERT ON factures WHEN NEW.type = 'avoir' BEGIN SELECT RAISE(ABORT, 'panne'); END");
  assert.equal((await echange('douce')).status, 500);
  assert.equal(un(env, 'SELECT etat FROM bouquets WHERE id = ?', bq).etat, 'actif');
  assert.equal(un(env, 'SELECT COUNT(*) AS n FROM bouquets').n, 1);
  assert.equal(un(env, 'SELECT cagnotte FROM comptes').cagnotte, 0);
  env.DB.raw.exec('DROP TRIGGER panne');
  const rs = await Promise.all(Array.from({ length: 50 }, (_, i) => echange(i % 2 ? 'douce' : 'rare')));
  assert.equal(rs.filter((r) => r.status === 200).length, 1);
  assert.equal(un(env, "SELECT COUNT(*) AS n FROM bouquets WHERE etat = 'actif'").n, 1);
  assert.deepEqual(env.DB.raw.prepare('SELECT numero, type FROM factures ORDER BY numero').all().map((x) => `${x.numero}${x.type}`), ['1facture', '2avoir', '3facture']);
});

test('une facture émise ne change pas et ne s’efface pas', async () => {
  const env = envNeuf();
  const a = await acheter(env, await cookie(env));
  await livre(env, a.commande, 'pi');
  assert.equal(un(env, 'SELECT prenom FROM factures').prenom, "O'Brien");
  assert.throws(() => env.DB.raw.prepare('UPDATE factures SET total = 1').run(), /figee/);
  assert.throws(() => env.DB.raw.prepare('DELETE FROM factures').run(), /figee/);
});
