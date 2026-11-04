// The bee's counter: a talk opened with what was said to the bee, the visitor's token, the atelier's panel (its secret,
// the new messages, the answer, closing), the limits.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { d1 } from './d1.mjs';

const ORIGINE = 'http://localhost:8851';
const SECRET = 'secret-du-guichet';
const envNeuf = () => ({ DB: d1(), POIVRE: 'poivre-de-test', GUICHET_JETON: SECRET, ORIGINES: ORIGINE });
const call = async (env, method, path, body, headers = {}) => {
  const r = await worker.fetch(
    new Request(`http://api.test${path}`, { method, headers: { 'content-type': 'application/json', origin: ORIGINE, ...headers }, body: body ? JSON.stringify(body) : undefined }),
    env,
  );
  return { r, j: await r.json() };
};
const cm = { authorization: `Bearer ${SECRET}` };

test('une conversation s’ouvre avec ce qui a été dit à l’abeille, le visiteur lit et écrit avec son jeton', async () => {
  const env = envNeuf();
  const { r, j } = await call(env, 'POST', '/api/guichet', {
    texte: 'Puis-je payer en bitcoin ?',
    langue: 'fr',
    page: '/squelette/index.html',
    avant: [{ de: 'visiteur', texte: 'bitcoin ?' }, { de: 'abeille', texte: 'Je ne sais pas.' }],
  });
  assert.equal(r.status, 200);
  assert.ok(j.id && j.jeton);
  const lu = await call(env, 'GET', `/api/guichet/${j.id}`, null, { 'x-guichet-jeton': j.jeton });
  assert.equal(lu.j.etat, 'ouvert');
  assert.deepEqual(lu.j.messages.map((m) => m.de), ['visiteur', 'abeille', 'visiteur']);
  assert.equal(lu.j.messages[2].texte, 'Puis-je payer en bitcoin ?');
  const n = lu.j.messages.at(-1).n;
  const ecrit = await call(env, 'POST', `/api/guichet/${j.id}/message`, { jeton: j.jeton, texte: 'Merci !' });
  assert.equal(ecrit.r.status, 200);
  const suite = await call(env, 'GET', `/api/guichet/${j.id}?depuis=${n}`, null, { 'x-guichet-jeton': j.jeton });
  assert.deepEqual(suite.j.messages.map((m) => m.texte), ['Merci !']);
  // the token is kept as a hash only
  assert.notEqual(env.DB.raw.prepare('SELECT jeton_hash FROM guichet').get().jeton_hash, j.jeton);
});

test('sans le bon jeton, rien ; texte vide refusé', async () => {
  const env = envNeuf();
  const { j } = await call(env, 'POST', '/api/guichet', { texte: 'Bonjour' });
  assert.equal((await call(env, 'GET', `/api/guichet/${j.id}`, null, { 'x-guichet-jeton': 'faux' })).r.status, 404);
  assert.equal((await call(env, 'POST', `/api/guichet/${j.id}/message`, { jeton: 'faux', texte: 'x' })).r.status, 404);
  assert.equal((await call(env, 'POST', '/api/guichet', { texte: '  ' })).j.erreur, 'texte');
});

test('le panneau de l’atelier : son secret, la liste et les nouveaux, la réponse, la clôture', async () => {
  const env = envNeuf();
  const { j } = await call(env, 'POST', '/api/guichet', { texte: 'Une question difficile' });
  assert.equal((await call(env, 'GET', '/api/guichet')).r.status, 401);
  assert.equal((await call(env, 'GET', '/api/guichet', null, { authorization: 'Bearer faux' })).r.status, 401);
  const liste = await call(env, 'GET', '/api/guichet', null, cm);
  assert.equal(liste.j.conversations.length, 1);
  assert.equal(liste.j.conversations[0].nouveaux, 1);
  assert.equal(liste.j.conversations[0].dernier, 'Une question difficile');
  const conv = await call(env, 'GET', `/api/guichet/${j.id}/tout`, null, cm);
  assert.equal(conv.j.messages.length, 1);
  // read: no new message left
  assert.equal((await call(env, 'GET', '/api/guichet', null, cm)).j.conversations[0].nouveaux, 0);
  const rep = await call(env, 'POST', `/api/guichet/${j.id}/reponse`, { texte: 'Bonjour, je regarde ça.' }, cm);
  assert.equal(rep.r.status, 200);
  const vu = await call(env, 'GET', `/api/guichet/${j.id}`, null, { 'x-guichet-jeton': j.jeton });
  assert.equal(vu.j.messages.at(-1).de, 'atelier');
  assert.equal(vu.j.messages.at(-1).texte, 'Bonjour, je regarde ça.');
  assert.equal((await call(env, 'POST', `/api/guichet/${j.id}/clos`, null, cm)).r.status, 200);
  assert.equal((await call(env, 'POST', `/api/guichet/${j.id}/message`, { jeton: j.jeton, texte: 'encore' })).j.erreur, 'clos');
});

test('limites : quatre conversations par heure pour une adresse', async () => {
  const env = envNeuf();
  const ip = { 'cf-connecting-ip': '198.51.100.4' };
  for (let i = 0; i < 4; i++) assert.equal((await call(env, 'POST', '/api/guichet', { texte: `q${i}` }, ip)).r.status, 200);
  assert.equal((await call(env, 'POST', '/api/guichet', { texte: 'q5' }, ip)).r.status, 429);
});

test('sans GUICHET_JETON : le panneau est une erreur de configuration', async () => {
  const env = envNeuf();
  delete env.GUICHET_JETON;
  const { r, j } = await call(env, 'GET', '/api/guichet', null, cm);
  assert.equal(r.status, 500);
  assert.equal(j.erreur, 'configuration');
});
