// What a hostile or a clumsy client sends: bodies that are not objects, too large, cookies badly written, the same phone or
// mailbox written differently, ceilings set to zero.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { demande, demandeCourriel } from '../src/compte.js';
import { numero, joignable, adresse, boiteDe, plafond, cookies } from '../src/outils.js';
import { d1 } from './d1.mjs';

const ORIGINE = 'http://localhost:8851';
const cle = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const envNeuf = (extra = {}) => ({ DB: d1(), POIVRE: 'poivre', CLE_NUMEROS: cle, SMS: 'faux', COURRIEL_CODES: 'faux', PAIEMENT: 'faux', PAYS: 'FR', ORIGINES: ORIGINE, GUICHET_JETON: 'g', __sms: [], __mails: [], __catalogue: { produits: [] }, ...extra });
const brut = (path, body, headers = {}) => new Request(`http://api.test${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGINE, ...headers }, body });
const post = (path, o) => brut(path, JSON.stringify(o));

test('un corps qui n’est pas un objet JSON n’est jamais une erreur du serveur', async () => {
  for (const path of ['/api/sms/demande', '/api/sms/verifie', '/api/mail/demande', '/api/mail/verifie', '/api/message', '/api/guichet', '/api/achat', '/api/echange', '/api/moi'])
    for (const corps of ['null', '[]', '5', '"x"', '{', '']) {
      const r = await worker.fetch(brut(path, corps || undefined), envNeuf());
      assert.ok(r.status < 500, `${path} ${corps} : ${r.status}`);
    }
});

test('un corps trop grand est refusé, même sans longueur annoncée', async () => {
  assert.equal((await worker.fetch(post('/api/message', { texte: 'x'.repeat(40000), contact: 'a@b.fr' }), envNeuf())).status, 413);
  const flux = new ReadableStream({ start(c) { for (let i = 0; i < 50; i++) c.enqueue(new Uint8Array(1024)); c.close(); } });
  const r = await worker.fetch(new Request('http://api.test/api/message', { method: 'POST', headers: { 'content-type': 'application/json' }, body: flux, duplex: 'half' }), envNeuf());
  assert.equal(r.status, 413);
});

test('un cookie mal écrit par un autre script ne ferme pas la session', () => {
  const c = cookies(new Request('http://api.test/', { headers: { cookie: 'autre=%E0%A4%A; vide; s=ok%20' } }));
  assert.equal(c.s, 'ok ');
  assert.equal(c.autre, '%E0%A4%A');
});

test('un même téléphone, un seul numéro ; les SMS ne vont qu’à des mobiles', () => {
  for (const n of ['+330612345678', '0033 06 12 34 56 78', '+33 (0)6 12 34 56 78']) assert.equal(numero(n), '+33612345678');
  assert.equal(numero('+39 06 1234567'), '+39061234567'); // a landline in Rome keeps its 0
  for (const n of ['+33899701234', '+33123456789', '+447012345678', '+447612345678', '+3361234567', '+33612345678901']) assert.equal(joignable(n), false, n);
  for (const n of ['+33712345678', '+447911123456', '+4915112345678', '+393331234567', '+41791234567', '+32470123456', '+34612345678']) assert.equal(joignable(n), true, n);
});

test('une même boîte, une seule limite : lea+1@ et lea+2@', async () => {
  assert.equal(boiteDe('lea+1@exemple.fr'), 'lea@exemple.fr');
  const env = envNeuf();
  const t = Date.now();
  assert.equal((await demandeCourriel(post('/', { adresse: 'lea+1@exemple.fr' }), env, t)).status, 200);
  assert.equal((await demandeCourriel(post('/', { adresse: 'Lea+2@Exemple.fr' }), env, t)).status, 429);
  assert.equal(env.__mails[0].a, 'lea+1@exemple.fr');
});

test('adresses : caractères de contrôle et invisibles refusés, formes courantes acceptées', () => {
  for (const a of ['a\u0001@b.fr', 'a​@b.fr', 'a\r\nBcc: z@z.fr@x.fr', 'a\\b@c.fr']) assert.equal(adresse(a), null);
  for (const a of ["o'neil@exemple.fr", 'x@privaterelay.appleid.com', 'a+b@sous.domaine.museum', 'é@exemple.fr']) assert.equal(adresse(a), a);
});

test('un plafond à zéro ferme les envois', async () => {
  assert.equal(plafond('0', 300), 0);
  for (const v of [undefined, '', '-5', 'beaucoup']) assert.equal(plafond(v, 300), 300);
  const env = envNeuf({ SMS_JOUR: '0' });
  assert.equal((await demande(post('/', { numero: '0612345678' }), env)).status, 429);
  assert.equal(env.__sms.length, 0);
});
