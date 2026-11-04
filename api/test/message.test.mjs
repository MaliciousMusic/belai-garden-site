// « Nous écrire »: a message kept with an e-mail address or a phone number, the robots' field, the limits, CORS.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { contact } from '../src/message.js';
import { d1 } from './d1.mjs';

const ORIGINE = 'http://localhost:8851';
const envNeuf = () => ({ DB: d1(), POIVRE: 'poivre-de-test', CLE_NUMEROS: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', PAYS: 'FR', ORIGINES: ORIGINE });
const req = (body, headers = {}) =>
  new Request('http://api.test/api/message', { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGINE, ...headers }, body: JSON.stringify(body) });
const call = async (env, body, headers) => {
  const r = await worker.fetch(req(body, headers), env);
  return { r, j: await r.json() };
};

test('contact : une adresse ou un numéro, rien d’autre', () => {
  assert.deepEqual(contact(' Lea@Exemple.fr '), { genre: 'mail', contact: 'lea@exemple.fr' });
  assert.deepEqual(contact('06 12 34 56 78'), { genre: 'tel', contact: '+33612345678' });
  assert.deepEqual(contact('+44 7700 900123'), { genre: 'tel', contact: '+447700900123' });
  assert.equal(contact('lea@'), null);
  assert.equal(contact('<b>@x.fr'), null);
  assert.equal(contact('12'), null);
  assert.equal(contact(undefined), null);
});

test('un message est gardé, avec sa page et sa langue', async () => {
  const env = envNeuf();
  const { r, j } = await call(env, { texte: '  Bonjour, un bouquet pour un deuil ?  ', contact: 'lea@exemple.fr', page: '/squelette/produit.html?b=x', langue: 'fr' });
  assert.equal(r.status, 200);
  assert.equal(j.ok, true);
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGINE);
  const row = env.DB.raw.prepare('SELECT * FROM messages').get();
  assert.equal(row.texte, 'Bonjour, un bouquet pour un deuil ?');
  assert.equal(row.genre, 'mail');
  assert.notEqual(row.contact, 'lea@exemple.fr'); // encrypted (audit.test.mjs)
  assert.equal(row.langue, 'fr');
  assert.equal(row.lu, null);
});

test('refusés : texte vide ou trop long, contact invalide ; le champ des robots ne garde rien', async () => {
  const env = envNeuf();
  assert.equal((await call(env, { texte: ' ', contact: 'lea@exemple.fr' })).j.erreur, 'texte');
  assert.equal((await call(env, { texte: 'x'.repeat(2001), contact: 'lea@exemple.fr' })).j.erreur, 'texte');
  assert.equal((await call(env, { texte: 'Bonjour', contact: 'pas un contact' })).j.erreur, 'contact');
  const { j } = await call(env, { texte: 'Achetez', contact: 'robot@spam.io', site: 'http://spam.io' });
  assert.equal(j.ok, true);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 0);
});

test('limites : trois messages par heure pour une adresse IP', async () => {
  const env = envNeuf();
  const ip = { 'cf-connecting-ip': '203.0.113.7' };
  for (let i = 0; i < 3; i++) assert.equal((await call(env, { texte: `Message ${i}`, contact: '0612345678' }, ip)).r.status, 200);
  const { r, j } = await call(env, { texte: 'Encore', contact: '0612345678' }, ip);
  assert.equal(r.status, 429);
  assert.ok(j.attendre > 0);
  // another address still writes
  assert.equal((await call(env, { texte: 'Bonjour', contact: '0612345678' }, { 'cf-connecting-ip': '203.0.113.8' })).r.status, 200);
});

test('sans POIVRE : erreur de configuration', async () => {
  const env = envNeuf();
  delete env.POIVRE;
  const { r, j } = await call(env, { texte: 'Bonjour', contact: 'lea@exemple.fr' });
  assert.equal(r.status, 500);
  assert.equal(j.erreur, 'configuration');
});

// the owner's mail (Cloudflare's send_email binding): a fake binding and EmailMessage stand in for the Worker's
class FauxMessage {
  constructor(from, to, raw) {
    Object.assign(this, { from, to, raw });
  }
}
const envCourrier = (envoi) => ({
  ...envNeuf(),
  EXPEDITEUR_MESSAGES: 'messages@belai.test',
  DESTINATAIRE_MESSAGES: 'porteur@exemple.fr',
  __EmailMessage: FauxMessage,
  COURRIER: { send: envoi },
});
const corpsDe = (raw) => Buffer.from(raw.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8');

test('le porteur reçoit un e-mail, avec l’adresse du visiteur en réponse', async () => {
  const envoyes = [];
  const env = envCourrier(async (m) => envoyes.push(m));
  const { r } = await call(env, { texte: 'Un bouquet de pivoines pour samedi ?', contact: 'Lea@Exemple.fr', page: '/squelette/produit.html?b=x', langue: 'en' });
  assert.equal(r.status, 200);
  assert.equal(envoyes.length, 1);
  const m = envoyes[0];
  assert.equal(m.from, 'messages@belai.test');
  assert.equal(m.to, 'porteur@exemple.fr');
  assert.match(m.raw, /^From: =\?UTF-8\?B\?[^?]+\?= <messages@belai\.test>\r\n/);
  assert.match(m.raw, /\r\nReply-To: <lea@exemple\.fr>\r\n/);
  assert.match(m.raw, /\r\nSubject: =\?UTF-8\?B\?/);
  assert.match(m.raw, /\r\nMessage-ID: <[\w-]+@belai\.test>\r\n/);
  assert.ok(m.raw.split('\r\n\r\n')[1].split('\r\n').every((l) => l.length <= 76));
  const corps = corpsDe(m.raw);
  assert.match(corps, /^Un bouquet de pivoines pour samedi \?/);
  assert.match(corps, /Répondre par e-mail : lea@exemple\.fr/);
  assert.match(corps, /Langue de la page : en/);
});

test('un numéro : pas de Reply-To, le numéro dans le corps', async () => {
  const envoyes = [];
  const env = envCourrier(async (m) => envoyes.push(m));
  await call(env, { texte: 'Rappelez-moi', contact: '06 12 34 56 78' });
  assert.doesNotMatch(envoyes[0].raw, /Reply-To/);
  assert.match(corpsDe(envoyes[0].raw), /Rappeler ou écrire au \+33612345678/);
});

test('un courrier qui échoue garde le message ; sans réglage, aucun courrier', async () => {
  const env = envCourrier(async () => {
    throw new Error('destination non vérifiée');
  });
  const { r } = await call(env, { texte: 'Bonjour', contact: 'lea@exemple.fr' });
  assert.equal(r.status, 200);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 1);
  const envoyes = [];
  const sans = { ...envCourrier(async (m) => envoyes.push(m)), EXPEDITEUR_MESSAGES: undefined };
  await call(sans, { texte: 'Bonjour', contact: 'lea@exemple.fr' });
  assert.equal(envoyes.length, 0);
});
