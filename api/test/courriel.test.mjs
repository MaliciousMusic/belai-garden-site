// The account validated by e-mail (owner, 2026-11-02): the code by mail, its limits, an account of its own beside the
// number's, the simulated sender refused online, the mail itself; and the unsigned gift's table.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { demandeCourriel, verifieCourriel } from '../src/compte.js';
import { courrierCode, envoieCourriel } from '../src/courriel.js';
import { adresse, dechiffre } from '../src/outils.js';
import { d1 } from './d1.mjs';

const ORIGINE = 'http://localhost:8835';
function envNeuf() {
  const cle = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  return { DB: d1(), POIVRE: 'poivre-de-test', CLE_NUMEROS: cle, SMS: 'faux', COURRIEL_CODES: 'faux', PAYS: 'FR', ORIGINES: ORIGINE, __sms: [], __mails: [] };
}
const req = (method, path, body, host = 'api.test') =>
  new Request(`http://${host}${path}`, { method, headers: { 'content-type': 'application/json', origin: ORIGINE }, body: body ? JSON.stringify(body) : undefined });
const call = async (env, ...a) => {
  const r = await worker.fetch(req(...a), env);
  return { r, j: await r.json() };
};
const dernierCode = (env) => env.__mails.at(-1).texte.match(/\d{6}/)[0];

test('adresses : en minuscules, invalides refusées', () => {
  assert.equal(adresse('  Lea@Exemple.FR '), 'lea@exemple.fr');
  assert.equal(adresse('lea@exemple'), null);
  assert.equal(adresse('lea exemple.fr'), null);
  assert.equal(adresse(`${'a'.repeat(250)}@x.fr`), null);
  assert.equal(adresse(undefined), null);
});

test('un code part par e-mail, le compte se crée, l’adresse est gardée chiffrée', async () => {
  const env = envNeuf();
  const { r, j } = await call(env, 'POST', '/api/mail/demande', { adresse: 'Lea@Exemple.fr', langue: 'fr' });
  assert.equal(r.status, 200);
  assert.ok(j.expire > Date.now());
  assert.equal(env.__mails[0].a, 'lea@exemple.fr');
  assert.match(env.__mails[0].sujet, /^\d{6} : votre code/);
  assert.equal(env.__sms.length, 0);
  // a new account needs a first name: without one the code holds
  const sans = await call(env, 'POST', '/api/mail/verifie', { adresse: 'lea@exemple.fr', code: dernierCode(env) });
  assert.equal(sans.j.erreur, 'prenom_requis');
  const { r: v, j: jv } = await call(env, 'POST', '/api/mail/verifie', { adresse: 'lea@exemple.fr', code: dernierCode(env), prenom: 'Léa' });
  assert.equal(v.status, 200);
  assert.equal(jv.compte.prenom, 'Léa');
  assert.equal(jv.compte.nouveau, true);
  assert.match(v.headers.get('set-cookie'), /^belai_session=/);
  const row = env.DB.raw.prepare('SELECT * FROM comptes').get();
  assert.equal(row.canal, 'mail');
  assert.ok(!row.numero_chiffre.includes('exemple'));
  assert.equal(await dechiffre(env.CLE_NUMEROS, row.numero_chiffre), 'lea@exemple.fr');
  // the session opens the account
  const moi = await worker.fetch(new Request('http://api.test/api/moi', { headers: { cookie: v.headers.get('set-cookie').split(';')[0] } }), env);
  assert.equal((await moi.json()).compte.prenom, 'Léa');
});

test('une adresse et un numéro font deux comptes ; un code d’un canal ne vaut pas pour l’autre', async () => {
  const env = envNeuf();
  await call(env, 'POST', '/api/mail/demande', { adresse: 'lea@exemple.fr' });
  const code = dernierCode(env);
  // the e-mail's code, tried on a number: no code was asked for that number
  const { j } = await call(env, 'POST', '/api/sms/verifie', { numero: '06 12 34 56 78', code, prenom: 'Léa' });
  assert.equal(j.erreur, 'code_expire');
  await call(env, 'POST', '/api/mail/verifie', { adresse: 'lea@exemple.fr', code, prenom: 'Léa' });
  await call(env, 'POST', '/api/sms/demande', { numero: '06 12 34 56 78' });
  const sms = env.__sms.at(-1).message.match(/\d{6}/)[0];
  await call(env, 'POST', '/api/sms/verifie', { numero: '06 12 34 56 78', code: sms, prenom: 'Léa' });
  const rows = env.DB.raw.prepare('SELECT canal FROM comptes ORDER BY canal').all();
  assert.deepEqual(rows.map((x) => x.canal), ['mail', 'sms']);
});

test('adresse invalide, code faux, trop de demandes', async () => {
  const env = envNeuf();
  assert.equal((await call(env, 'POST', '/api/mail/demande', { adresse: 'pas-une-adresse' })).j.erreur, 'adresse_invalide');
  const t = Date.now();
  await demandeCourriel(req('POST', '/api/mail/demande', { adresse: 'zoe@exemple.fr' }), env, t);
  const faux = await (await verifieCourriel(req('POST', '/api/mail/verifie', { adresse: 'zoe@exemple.fr', code: '000000', prenom: 'Zoé' }), env, t)).json();
  assert.equal(faux.erreur, dernierCode(env) === '000000' ? undefined : 'code_faux');
  // one code a minute for an address
  const r = await demandeCourriel(req('POST', '/api/mail/demande', { adresse: 'zoe@exemple.fr' }), env, t + 1000);
  assert.equal(r.status, 429);
  // the shop's own ceiling of mails a day
  const env2 = { ...envNeuf(), COURRIEL_JOUR: '2' };
  for (const [k, a] of ['a@x.fr', 'b@x.fr', 'c@x.fr'].entries()) {
    const res = await demandeCourriel(req('POST', '/api/mail/demande', { adresse: a }), env2, t + k);
    assert.equal(res.status, k < 2 ? 200 : 429);
  }
});

test('l’e-mail simulé est refusé en ligne, et sans réglage rien ne part', async () => {
  const env = envNeuf();
  const enLigne = await worker.fetch(req('POST', '/api/mail/demande', { adresse: 'lea@exemple.fr' }, 'belai.garden'), env);
  assert.equal(enLigne.status, 500);
  assert.equal((await enLigne.json()).erreur, 'configuration');
  assert.equal(env.__mails.length, 0);
  const sans = await worker.fetch(req('POST', '/api/mail/demande', { adresse: 'lea@exemple.fr' }), { ...env, COURRIEL_CODES: undefined });
  assert.equal(sans.status, 500);
});

test('le courrier Cloudflare : expéditeur, destinataire, sujet et code', async () => {
  const envoyes = [];
  class EmailMessage {
    constructor(de, a, brut) {
      Object.assign(this, { de, a, brut });
    }
  }
  const env = { COURRIEL_CODES: 'cloudflare', EXPEDITEUR_CODES: 'codes@belai.garden', CODES: { send: async (m) => envoyes.push(m) }, __EmailMessage: EmailMessage };
  await envoieCourriel(env, 'lea@exemple.fr', { sujet: '123456 : votre code', texte: 'Votre code est 123456.' });
  assert.equal(envoyes.length, 1);
  assert.equal(envoyes[0].de, 'codes@belai.garden');
  assert.equal(envoyes[0].a, 'lea@exemple.fr');
  assert.match(envoyes[0].brut, /^From: =\?UTF-8\?B\?/);
  assert.match(envoyes[0].brut, /\r\nTo: <lea@exemple\.fr>\r\n/);
  const corps = envoyes[0].brut.split('\r\n\r\n')[1].replace(/\r\n/g, '');
  assert.equal(Buffer.from(corps, 'base64').toString('utf8'), 'Votre code est 123456.');
  await assert.rejects(envoieCourriel({ COURRIEL_CODES: 'cloudflare' }, 'a@b.fr', { sujet: 's', texte: 't' }), /CODES ou EXPEDITEUR_CODES manquant/);
  assert.match(courrierCode({ de: 'a@b.fr', a: 'c@d.fr', sujet: 'x', texte: 'y', now: 0, id: 'i' }), /Message-ID: <i@b\.fr>/);
});

test('un cadeau peut ne pas être signé', async () => {
  const env = envNeuf();
  const db = env.DB.raw;
  db.prepare("INSERT INTO comptes (id, empreinte, numero_chiffre, cree) VALUES ('c1', 'e1', '', 0)").run();
  db.prepare("INSERT INTO bouquets (id, compte, produit, mois, numero, achat, origine) VALUES ('b1', 'c1', 'p', '2026-11', 1, 0, 'achat')").run();
  db.prepare("INSERT INTO cadeaux (id, bouquet, expediteur, code_hash, etat, expire) VALUES ('k1', 'b1', 'c1', 'h', 'attente', 1)").run();
  assert.equal(db.prepare("SELECT signature FROM cadeaux WHERE id = 'k1'").get().signature, null);
});
