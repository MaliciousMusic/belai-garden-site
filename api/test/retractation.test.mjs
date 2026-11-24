// The withdrawal on line (received, dated, acknowledged, once; nothing moves by itself), the collection's month at the shop's own time,
// and an account that goes with no payment page left open.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { demandeCourriel, verifieCourriel } from '../src/compte.js';
import { achat, livre } from '../src/achat.js';
import { echange } from '../src/echange.js';
import { moisCourant } from '../src/catalogue.js';
import { d1 } from './d1.mjs';

const ORIGINE = 'http://localhost:8851';
const cat = (mois) => ({ collection: { mois }, produits: [{ id: 'citrine', nom: 'Citrine', prix: { centimes: 9480 } }, { id: 'douce', nom: 'Douce', prix: { centimes: 3000 } }] });
const envNeuf = (extra = {}) => ({ DB: d1(), POIVRE: 'p', CLE_NUMEROS: 'A'.repeat(43), SMS: 'faux', COURRIEL_CODES: 'faux', PAIEMENT: 'faux', PAYS: 'FR', ORIGINES: ORIGINE, __mails: [], __catalogue: cat(moisCourant()), ...extra });
const req = (method, path, body, headers = {}) => new Request(`http://api.test${path}`, { method, headers: { 'content-type': 'application/json', origin: ORIGINE, ...headers }, body: body ? JSON.stringify(body) : undefined });
async function cookie(env, adresse = 'lea@exemple.fr') {
  await demandeCourriel(req('POST', '/', { adresse }), env);
  const r = await verifieCourriel(req('POST', '/', { adresse, code: env.__mails.at(-1).sujet.match(/\d{6}/)[0], prenom: 'Léa' }), env);
  return r.headers.get('set-cookie').split(';')[0];
}
const corps = { produit: 'citrine', renonce: true, retour: `${ORIGINE}/` };
const appel = async (env, c, m, p, b) => {
  const r = await worker.fetch(req(m, p, b, { cookie: c }), env);
  return { s: r.status, j: await r.json() };
};
async function achete(env, c) {
  const { j } = await appel(env, c, 'POST', '/api/achat', corps);
  await livre(env, j.commande, 'pi');
  return j.commande;
}

test('rétractation : reçue, datée, accusée par e-mail, une fois ; rien n’est remboursé ni retiré tout seul', async () => {
  const env = envNeuf();
  const c = await cookie(env);
  const commande = await achete(env, c);
  assert.equal((await appel(env, c, 'POST', '/api/retractation', { commande })).j.erreur, 'confirmation_requise');
  const avant = env.__mails.length;
  const a = await appel(env, c, 'POST', '/api/retractation', { commande, confirme: true });
  assert.equal(a.s, 200);
  assert.match(a.j.accuse, /reçue le \d{1,2} \S+ \d{4} à \d{2}:\d{2}:\d{2} \(heure de Paris\).*Bouquet « Citrine ».*facture F-000001/);
  const m = env.__mails.at(-1);
  assert.equal(m.a, 'lea@exemple.fr');
  assert.ok(m.texte.includes(a.j.accuse));
  // asked again, at once or later: the same one, no second mail
  const rs = await Promise.all(Array.from({ length: 10 }, () => appel(env, c, 'POST', '/api/retractation', { commande, confirme: true })));
  assert.ok(rs.every((r) => r.j.id === a.j.id && r.j.le === a.j.le));
  assert.equal(env.__mails.length, avant + 1);
  assert.equal(env.DB.raw.prepare('SELECT etat FROM bouquets').get().etat, 'actif');
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM factures').get().n, 1);
  assert.equal((await appel(env, c, 'GET', '/api/retractations')).j.retractations.length, 1);
  assert.equal((await appel(env, c, 'GET', '/api/moi/export')).j.retractations.length, 1);
});

test('rétractation : jamais sur la commande d’un autre, ni sans session, ni sans achat', async () => {
  const env = envNeuf();
  const a = await cookie(env);
  const commande = await achete(env, a);
  const b = await cookie(env, 'bob@exemple.fr');
  assert.equal((await appel(env, b, 'POST', '/api/retractation', { commande, confirme: true })).s, 404);
  assert.equal((await appel(env, 'x=y', 'POST', '/api/retractation', { commande, confirme: true })).s, 401);
  const { j } = await appel(env, b, 'POST', '/api/achat', corps);
  assert.equal((await appel(env, b, 'POST', '/api/retractation', { commande: j.commande, confirme: true })).s, 404);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM retractations').get().n, 0);
});

test('un e-mail qui ne part pas n’empêche pas la rétractation', async () => {
  const env = envNeuf();
  const c = await cookie(env);
  const commande = await achete(env, c);
  const r = await appel({ ...env, COURRIEL_CODES: 'cloudflare' }, c, 'POST', '/api/retractation', { commande, confirme: true });
  assert.equal(r.s, 200);
  assert.ok(r.j.accuse);
});

test('la collection : le mois de Paris, ni celui du serveur ni celui du visiteur', async () => {
  assert.equal(moisCourant(Date.UTC(2026, 10, 30, 22, 59, 59)), '2026-11');
  assert.equal(moisCourant(Date.UTC(2026, 10, 30, 23, 0, 0)), '2026-12'); // midnight in Paris, winter time
  assert.equal(moisCourant(Date.UTC(2026, 5, 30, 21, 59, 59)), '2026-06');
  assert.equal(moisCourant(Date.UTC(2026, 5, 30, 22, 0, 0)), '2026-07'); // summer time
  assert.equal(moisCourant(Date.UTC(2028, 1, 29, 12)), '2028-02');
});

test('une collection close, ou pas encore ouverte, ne se vend ni ne s’échange', async () => {
  const env = envNeuf();
  const c = await cookie(env);
  const commande = await achete(env, c);
  const bouquet = env.DB.raw.prepare('SELECT bouquet FROM commandes WHERE id = ?').get(commande).bouquet;
  const now = Date.now();
  for (const mois of ['2020-01', '2099-12']) {
    const e2 = { ...env, __catalogue: cat(mois) };
    const a = await achat(req('POST', '/', corps, { cookie: c }), e2, now);
    assert.deepEqual([a.status, (await a.json()).erreur], [409, 'collection_close']);
    const x = await echange(req('POST', '/', { bouquet, produit: 'douce' }, { cookie: c }), e2, now);
    assert.deepEqual([x.status, (await x.json()).erreur], [409, 'collection_close']);
  }
  assert.equal(env.DB.raw.prepare('SELECT etat FROM bouquets').get().etat, 'actif');
});

test('un compte supprimé ne laisse aucune commande ouverte, et rend sa cagnotte avant de partir', async () => {
  const env = envNeuf();
  const c = await cookie(env);
  env.DB.raw.prepare('UPDATE comptes SET cagnotte = 500').run();
  await appel(env, c, 'POST', '/api/achat', corps);
  assert.equal((await appel(env, c, 'DELETE', '/api/moi')).s, 200);
  assert.equal(env.DB.raw.prepare('SELECT etat FROM commandes').get().etat, 'expiree');
  assert.equal(env.DB.raw.prepare('SELECT cagnotte FROM comptes').get().cagnotte, 500);
});
