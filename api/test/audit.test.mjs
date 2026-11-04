// audit.test.mjs: what the security audit of 2026-11-04 found, kept found: each case fails on the code as it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { d1 } from './d1.mjs';
import worker from '../src/index.js';
import { cleIp, dechiffre } from '../src/outils.js';
import { livre } from '../src/achat.js';
import { menage } from '../src/compte.js';

const ORIGINE = 'http://localhost:8851';
const cle = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const envNeuf = () => ({ DB: d1(), POIVRE: 'poivre-de-test', CLE_NUMEROS: cle, SMS: 'faux', PAYS: 'FR', ORIGINES: ORIGINE, __sms: [] });
const post = (path, body, headers = {}) =>
  new Request(`http://localhost:8790${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('une page d’un autre site ne peut pas écrire, ni un formulaire', async () => {
  const env = envNeuf();
  const autre = await worker.fetch(post('/api/sms/demande', { numero: '0612345678' }, { origin: 'https://evil.example' }), env);
  assert.equal(autre.status, 403);
  const form = new Request('http://localhost:8790/api/sms/verifie', {
    method: 'POST',
    headers: { 'content-type': 'text/plain', origin: ORIGINE },
    body: '{"numero":"0612345678","code":"000000","prenom":"Eve","z":"=y"}',
  });
  assert.equal((await worker.fetch(form, env)).status, 415);
  const site = await worker.fetch(post('/api/sms/demande', { numero: '0612345678' }, { origin: ORIGINE }), env);
  assert.equal(site.status, 200);
  // Belai Bureau is no browser page: no origin
  assert.equal((await worker.fetch(post('/api/sms/demande', { numero: '0612345679' }), env)).status, 200);
});

test('IPv6 : un abonné compte pour un, quelle que soit la fin de son adresse', () => {
  assert.equal(cleIp('2001:db8:1:2:aaaa::1'), cleIp('2001:db8:1:2:bbbb:cccc:dddd:eeee'));
  assert.equal(cleIp('2001:0db8:0001:0002::1'), '2001:db8:1:2::/64');
  assert.notEqual(cleIp('2001:db8:1:2::1'), cleIp('2001:db8:1:3::1'));
  assert.equal(cleIp('203.0.113.9'), '203.0.113.9');
  assert.equal(cleIp('::ffff:203.0.113.9'), '203.0.113.9');
  assert.equal(cleIp(null), '');
});

test('la limite par adresse tient sur tout un /64', async () => {
  const env = envNeuf();
  let refuse = 0;
  for (let i = 0; i < 12; i++) {
    const r = await worker.fetch(post('/api/sms/demande', { numero: `06123400${String(i).padStart(2, '0')}` }, { 'cf-connecting-ip': `2001:db8:1:2::${i + 1}` }), env);
    if (r.status === 429) refuse++;
  }
  assert.equal(refuse, 2);
});

test('le service worker ne garde rien de /api ni de /bzzou', () => {
  const ecoute = {};
  const sw = { addEventListener: (k, f) => (ecoute[k] = f), location: { origin: 'https://boutique.test' }, skipWaiting() {}, clients: { claim() {} } };
  vm.runInNewContext(readFileSync(new URL('../../public/squelette/sw.js', import.meta.url), 'utf8'), { self: sw, URL, caches: {}, fetch: () => {}, console });
  const repond = (url) => {
    let pris = false;
    ecoute.fetch({ request: { method: 'GET', url, headers: new Headers(), mode: 'cors', destination: '' }, respondWith: () => (pris = true), waitUntil() {} });
    return pris;
  };
  assert.equal(repond('https://boutique.test/api/moi'), false);
  assert.equal(repond('https://boutique.test/api/facture/F-000001'), false);
  assert.equal(repond('https://boutique.test/bzzou'), false);
  assert.equal(repond('https://boutique.test/squelette/index.html'), true);
});

test('une livraison arrêtée à mi-chemin reprend quand Stripe renvoie l’événement', async () => {
  const env = envNeuf();
  env.CATALOGUE = 'http://localhost/x';
  const db = env.DB.raw;
  db.prepare("INSERT INTO comptes (id, empreinte, numero_chiffre, cree) VALUES ('c1', 'e1', 'x', 0)").run();
  db.prepare("INSERT INTO commandes (id, compte, produit, mois, centimes, etat, cree, expire, paye, paiement, cagnotte) VALUES ('o1', 'c1', 'citrine', '2026-11', 9480, 'payee', 0, 0, 1000, 'pi', 0)").run();
  const f = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('pas de réseau');
  };
  try {
    // the same event at the same moment: the first one is still working
    assert.equal(await livre(env, 'o1', 'pi', 1000 + 1000), false);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM bouquets').get().n, 0);
    // minutes later: the bouquet comes, with its invoice, once
    assert.equal(await livre(env, 'o1', 'pi', 1000 + 300000), true);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM bouquets').get().n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM factures WHERE commande = 'o1'").get().n, 1);
    assert.equal(await livre(env, 'o1', 'pi', 1000 + 600000), false);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM bouquets').get().n, 1);
  } finally {
    globalThis.fetch = f;
  }
});

test('le ménage garde les compteurs d’un jour et efface ce que la politique promet d’effacer', async () => {
  const env = envNeuf();
  const db = env.DB.raw;
  const J = 86400000;
  const now = 4000 * J;
  db.prepare("INSERT INTO limites (cle, nombre, debut) VALUES ('sms:boutique', 299, ?)").run(now - 5 * 3600000);
  db.prepare("INSERT INTO limites (cle, nombre, debut) VALUES ('vieux', 1, ?)").run(now - 3 * J);
  db.prepare("INSERT INTO messages (id, cree, texte, genre, contact) VALUES ('m1', ?, 'x', 'mail', 'y')").run(now - 1100 * J);
  db.prepare("INSERT INTO messages (id, cree, texte, genre, contact) VALUES ('m2', ?, 'x', 'mail', 'y')").run(now - 10 * J);
  db.prepare("INSERT INTO guichet (id, cree, maj, jeton_hash) VALUES ('g1', 0, ?, 'h')").run(now - 1100 * J);
  db.prepare("INSERT INTO guichet_messages (conv, cree, de, texte) VALUES ('g1', 0, 'visiteur', 'x')").run();
  await menage(env, now);
  assert.deepEqual(db.prepare('SELECT cle FROM limites').all().map((x) => x.cle), ['sms:boutique']);
  assert.deepEqual(db.prepare('SELECT id FROM messages').all().map((x) => x.id), ['m2']);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM guichet').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM guichet_messages').get().n, 0);
});

test('l’adresse laissée dans un message est chiffrée', async () => {
  const env = { ...envNeuf(), COURRIEL_MESSAGES: undefined };
  const r = await worker.fetch(post('/api/message', { texte: 'Bonjour', contact: 'lea@exemple.fr' }, { origin: ORIGINE }), env);
  assert.equal(r.status, 200);
  const { contact } = env.DB.raw.prepare('SELECT contact FROM messages').get();
  assert.notEqual(contact, 'lea@exemple.fr');
  assert.equal(await dechiffre(cle, contact), 'lea@exemple.fr');
});
