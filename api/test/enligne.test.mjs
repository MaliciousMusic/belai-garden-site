// The server as it is online: it starts only with whole, real settings, each answer carries its headers, robots and bursts are
// stopped before anything costs, and what is done is written down without a name.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { problemes } from '../src/reglages.js';
import { demande, verifie, menage } from '../src/compte.js';
import { livre, menageCommandes } from '../src/achat.js';
import { d1 } from './d1.mjs';

const SITE = 'https://belaisgarden.com';
const CATALOGUE = { collection: { mois: '2026-11' }, produits: [{ id: 'citrine', nom: 'Citrine', prix: { centimes: 9480 } }, { id: 'rare', nom: 'Rare', prix: { centimes: 5000 }, exemplaires: 3 }, { id: 'faux', nom: 'Faux', prix: { centimes: 12.5 } }] };
const passe = { limit: async () => ({ success: true }) };
// a production whose every door is open
const ouvert = (extra = {}) => ({
  ENVIRONNEMENT: 'production', SMS: 'ovh', COURRIEL_CODES: 'cloudflare', EXPEDITEUR_CODES: 'codes@belaisgarden.com', PAIEMENT: 'stripe', ORIGINES: SITE, CATALOGUE: `${SITE}/scene/boutique.json`,
  SMS_JOUR: '100', COURRIEL_JOUR: '300', MESSAGES_JOUR: '200', GUICHET_JOUR: '300', VENDEUR: '{"nom":"V","siren":"1"}', PAYS: 'FR',
  POIVRE: 'p'.repeat(43), CLE_NUMEROS: 'A'.repeat(43), GUICHET_JETON: 'g'.repeat(43), TURNSTILE_SECRET: '0x4AAA', STRIPE_SECRET: `sk_${'live'}_x`, STRIPE_WEBHOOK_SECRET: 'whsec_x',
  OVH_APP_KEY: 'a', OVH_APP_SECRET: 'b', OVH_CONSUMER_KEY: 'c', OVH_SERVICE: 'd',
  DB: d1(), DEBIT: passe, DEBIT_STRICT: passe, CODES: {}, __catalogue: CATALOGUE, ...extra,
});
// the developer's machine
const local = (extra = {}) => ({ DB: d1(), POIVRE: 'p', CLE_NUMEROS: 'A'.repeat(43), SMS: 'faux', COURRIEL_CODES: 'faux', PAIEMENT: 'faux', PAYS: 'FR', ORIGINES: 'http://localhost:8851', GUICHET_JETON: 'bon', __sms: [], __mails: [], __catalogue: CATALOGUE, ...extra });
const req = (method, url, body, headers = {}) => new Request(url, { method, headers: { 'content-type': 'application/json', origin: url.startsWith('https') ? SITE : 'http://localhost:8851', 'cf-connecting-ip': '203.0.113.7', ...headers }, body: body ? JSON.stringify(body) : undefined });
const L = 'http://api.test';
let h = Date.now();
async function cookie(env, numero = '0620000000') {
  h += 120_000;
  await demande(req('POST', L, { numero }), env, h);
  return (await verifie(req('POST', L, { numero, code: env.__sms.at(-1).message.match(/\d{6}/)[0], prenom: 'Léa' }), env, h)).headers.get('set-cookie').split(';')[0];
}
async function avecFetch(faux, fn) {
  const vrai = globalThis.fetch;
  globalThis.fetch = faux;
  try {
    return await fn();
  } finally {
    globalThis.fetch = vrai;
  }
}

test('en ligne, réglages entiers : le serveur répond ; un seul qui manque, est simulé ou d’essai : plus aucune route', async () => {
  assert.deepEqual(problemes(ouvert()), []);
  assert.equal((await worker.fetch(req('GET', `${SITE}/api/moi`), ouvert())).status, 401);
  const mauvais = {
    SMS: ['faux', '', undefined, 'OVH'], COURRIEL_CODES: ['faux', '', undefined], PAIEMENT: ['faux', '', undefined, 'Stripe'], ENVIRONNEMENT: ['', undefined, 'local'],
    ORIGINES: ['', 'http://localhost:8851', 'https://belaisgarden.com,http://localhost:8851', 'http://belaisgarden.com', '*', 'https://belaisgarden.com/'],
    CATALOGUE: ['http://localhost:8851/scene/boutique.json', '', 'https://ailleurs.example/boutique.json'],
    POIVRE: ['', 'court', undefined], CLE_NUMEROS: ['', 'x'.repeat(42)], GUICHET_JETON: ['', 'secret'], TURNSTILE_SECRET: ['', undefined, '1x0000000000000000000000000000000AA', '2x0000000000000000000000000000000AA'],
    STRIPE_SECRET: ['', `sk_${'test'}_x`], STRIPE_WEBHOOK_SECRET: ['', 'x'], OVH_APP_KEY: [''], OVH_CONSUMER_KEY: [undefined], EXPEDITEUR_CODES: [''], CODES: [undefined], DEBIT: [undefined], DEBIT_STRICT: [undefined], DB: [undefined],
    SMS_JOUR: ['beaucoup', undefined], VENDEUR: ['', '{}'],
  };
  for (const [k, vs] of Object.entries(mauvais))
    for (const v of vs) {
      const env = ouvert({ [k]: v });
      assert.ok(problemes(env).length, `${k}=${v}`);
      for (const [m, p] of [['GET', '/api/moi'], ['POST', '/api/mail/demande'], ['GET', '/api/collection?mois=2026-11&produits=citrine'], ['GET', '/api/guichet']]) {
        const r = await worker.fetch(req(m, SITE + p, m === 'POST' ? { adresse: 'a@b.fr' } : null), env);
        assert.equal(r.status, 500, `${k}=${v} ${p}`);
        assert.deepEqual(await r.json(), { erreur: 'configuration' });
      }
    }
  // test keys have their own place
  assert.deepEqual(problemes(ouvert({ ENVIRONNEMENT: 'preproduction', STRIPE_SECRET: `sk_${'test'}_x` })), []);
  assert.ok(problemes(ouvert({ ENVIRONNEMENT: 'preproduction' })).length, 'une clé réelle en préproduction');
  // a problem says its name, never its value
  assert.ok(!problemes(ouvert({ POIVRE: 'ceci-est-secret' })).join().includes('ceci-est-secret'));
});

test('une porte fermée exprès reste fermée, sans clé à poser', async () => {
  const env = ouvert({ SMS: 'ferme', COURRIEL_CODES: 'ferme', PAIEMENT: 'ferme', STRIPE_SECRET: undefined, STRIPE_WEBHOOK_SECRET: undefined, OVH_APP_KEY: undefined, CODES: undefined, EXPEDITEUR_CODES: '' });
  assert.deepEqual(problemes(env), []);
  for (const [p, e, b] of [['/api/sms/demande', 'canal_ferme', { numero: '0612345678' }], ['/api/mail/demande', 'canal_ferme', { adresse: 'a@b.fr' }], ['/api/achat', 'vente_fermee', { produit: 'citrine', renonce: true }]]) {
    const r = await worker.fetch(req('POST', SITE + p, b), env);
    assert.equal(r.status, 503);
    assert.equal((await r.json()).erreur, e);
  }
  assert.equal((await worker.fetch(req('GET', `${SITE}/api/faux-stripe/abcdefgh`), env)).status, 404);
});

test('chaque réponse porte ses en-têtes : erreurs, page, refus et réponse préalable compris', async () => {
  const env = ouvert();
  for (const [m, p, x] of [['GET', '/api/moi'], ['GET', '/api/rien'], ['OPTIONS', '/api/moi'], ['POST', '/api/moi', { origin: 'https://evil.example' }], ['GET', '/api/collection?mois=2026-11&produits=citrine']]) {
    const r = await worker.fetch(req(m, SITE + p, null, x), env);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff', p);
    assert.match(r.headers.get('content-security-policy'), /default-src 'none'.*frame-ancestors 'none'/);
    assert.match(r.headers.get('strict-transport-security'), /max-age=31536000/);
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(r.headers.get('vary'), 'origin');
    assert.ok(r.headers.get('permissions-policy'));
  }
  const r = await worker.fetch(req('GET', `${SITE}/api/moi`), env);
  assert.equal(r.headers.get('access-control-allow-origin'), SITE);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('la facture : sa propre politique, aucun script sans son jeton, rien d’interprété', async () => {
  const env = local({ VENDEUR: JSON.stringify({ nom: '<img src=x onerror=alert(1)>' }) });
  env.__catalogue = { ...CATALOGUE, produits: [{ id: 'citrine', nom: '</td><script>alert(1)</script>', prix: { centimes: 9480 } }] };
  const c = await cookie(env);
  const o = await (await worker.fetch(req('POST', `${L}/api/achat`, { produit: 'citrine', renonce: true, retour: 'http://localhost:8851/' }, { cookie: c }), env)).json();
  await livre(env, o.commande, '"><svg onload=alert(1)>');
  const r = await worker.fetch(req('GET', `${L}/api/facture/1`, null, { cookie: c }), env);
  const html = await r.text();
  const csp = r.headers.get('content-security-policy');
  const nonce = csp.match(/script-src 'nonce-([\w-]{43})'/)[1];
  assert.ok(!/unsafe/.test(csp));
  assert.match(csp, /frame-ancestors 'self' http:\/\/localhost:8851/);
  for (const t of html.match(/<(script|style)[^>]*>/g)) assert.ok(t.includes(`nonce="${nonce}"`), t);
  assert.ok(!/ on[a-z]+="/.test(html));
  for (const x of ['<img', '<svg', '<script>alert']) assert.ok(!html.includes(x), x);
  const r2 = await worker.fetch(req('GET', `${L}/api/facture/1`, null, { cookie: c }), env);
  assert.ok(!r2.headers.get('content-security-policy').includes(nonce), 'un jeton par page');
});

test('anti-robot : vérifié ici, avec son action et son site ; sans réponse, rien ne part', async () => {
  const adresse = { adresse: 'lea@exemple.fr' };
  const essai = async (reponse, corps, chemin = '/api/mail/demande') => {
    const env = ouvert({ COURRIEL_CODES: 'cloudflare', CODES: { send: async () => env.envoyes++ }, envoyes: 0, __EmailMessage: class {} });
    let vu = null;
    const r = await avecFetch(async (url, init) => {
      assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
      vu = JSON.parse(init.body);
      if (reponse === null) throw new Error('panne');
      return new Response(JSON.stringify(reponse));
    }, () => worker.fetch(req('POST', SITE + chemin, corps), env));
    return { s: r.status, j: await r.json(), vu, envoyes: env.envoyes, limites: env.DB.raw.prepare('SELECT COUNT(*) AS n FROM limites').get().n };
  };
  const bon = { success: true, action: 'code', hostname: 'belaisgarden.com' };
  const ok = await essai(bon, { ...adresse, antirobot: 'jeton' });
  assert.deepEqual([ok.s, ok.envoyes, ok.vu.response, ok.vu.remoteip], [200, 1, 'jeton', '203.0.113.7']);
  for (const [rep, jeton] of [[bon, undefined], [bon, ''], [bon, 'x'.repeat(3000)], [bon, 5], [{ ...bon, success: false }, 'j'], [{ ...bon, action: 'message' }, 'j'], [{ ...bon, hostname: 'evil.example' }, 'j'], [{}, 'j']]) {
    const r = await essai(rep, { ...adresse, antirobot: jeton });
    // refused before any count: somebody's codes of the day are not used up by a robot
    assert.deepEqual([r.s, r.j.erreur, r.envoyes, r.limites], [403, 'antirobot', 0, 0]);
  }
  const panne = await essai(null, { ...adresse, antirobot: 'j' });
  assert.deepEqual([panne.s, panne.envoyes], [503, 0]);
  assert.equal((await essai({ ...bon, action: 'guichet' }, { texte: 'bonjour' }, '/api/guichet')).s, 403);
  assert.equal((await essai({ ...bon, action: 'message' }, { texte: 'bonjour', contact: 'a@b.fr' }, '/api/message')).s, 403);
});

test('débit : compté par abonné, plus serré pour l’argent et les codes ; les événements signés de Stripe n’attendent pas', async () => {
  const cles = [];
  const compteur = (nom, ok) => ({ limit: async ({ key }) => (cles.push(`${nom}:${key}`), { success: ok }) });
  const env = ouvert({ DEBIT: compteur('large', true), DEBIT_STRICT: compteur('serre', false) });
  const refuse = await worker.fetch(req('POST', `${SITE}/api/achat`, {}, { 'cf-connecting-ip': '2001:db8:1:2::9' }), env);
  assert.equal(refuse.status, 429);
  assert.equal(refuse.headers.get('retry-after'), '60');
  assert.equal((await worker.fetch(req('GET', `${SITE}/api/moi`), env)).status, 401);
  assert.equal((await worker.fetch(req('POST', `${SITE}/api/stripe/webhook`, {}), env)).status, 400);
  assert.deepEqual(cles, ['serre:2001:db8:1:2::/64', 'large:203.0.113.7']);
});

test('le panneau du guichet : un mauvais secret est compté et noté, le bon passe', async () => {
  const env = local();
  const s = (jeton) => worker.fetch(req('GET', `${L}/api/guichet`, null, jeton === null ? {} : { authorization: `Bearer ${jeton}` }), env).then((r) => r.status);
  assert.equal(await s(null), 401);
  assert.equal(await s('bon'), 200);
  for (let i = 0; i < 20; i++) assert.equal(await s(`faux${i}`), 401);
  assert.equal(await s('faux'), 429);
  assert.equal(await s('bon'), 200, 'l’atelier n’est pas enfermé dehors');
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM journal WHERE action = 'guichet_refuse'").get().n, 20);
});

test('le journal dit ce qui est fait, sans nom ni contact ni code ; un an, puis plus rien', async () => {
  const env = local();
  const c = await cookie(env);
  const o = await (await worker.fetch(req('POST', `${L}/api/achat`, { produit: 'citrine', renonce: true, retour: 'http://localhost:8851/' }, { cookie: c }), env)).json();
  await livre(env, o.commande, 'pi');
  await worker.fetch(req('DELETE', `${L}/api/moi`, null, { cookie: c }), env);
  const j = env.DB.raw.prepare('SELECT * FROM journal ORDER BY n').all();
  assert.deepEqual(j.map((x) => x.action), ['compte_cree', 'commande_payee', 'suppression_demandee']);
  assert.ok(!/Léa|620000000|\d{6}"/.test(JSON.stringify(j.map(({ acteur, objet }) => [acteur, objet]))));
  // the old cookie opens nothing any more
  assert.equal((await worker.fetch(req('GET', `${L}/api/moi`, null, { cookie: c }), env)).status, 401);
  await menage(env, h + 366 * 86400000);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM journal').get().n, 0);
});

test('l’export : toutes les données du compte, et d’aucun autre', async () => {
  const env = local();
  const a = await cookie(env, '0620000001');
  const b = await cookie(env, '0620000002');
  for (const c of [a, b]) {
    const o = await (await worker.fetch(req('POST', `${L}/api/achat`, { produit: 'citrine', renonce: true, retour: 'http://localhost:8851/' }, { cookie: c }), env)).json();
    await livre(env, o.commande, 'pi');
  }
  assert.equal((await worker.fetch(req('GET', `${L}/api/moi/export`), env)).status, 401);
  const r = await worker.fetch(req('GET', `${L}/api/moi/export`, null, { cookie: a }), env);
  assert.match(r.headers.get('content-disposition'), /attachment/);
  const j = await r.json();
  assert.equal(j.compte.contact, '+33620000001');
  for (const k of ['bouquets', 'commandes', 'factures', 'sessions']) assert.equal(j[k].length, 1, k);
  assert.ok(!/620000002|empreinte|jeton|hash/.test(JSON.stringify(j)));
});

test('le code d’une personne ne se retrouve pas à partir de la base seule', async () => {
  const env = local();
  await demande(req('POST', L, { numero: '0620000003' }), env);
  const code = env.__sms[0].message.match(/\d{6}/)[0];
  const row = env.DB.raw.prepare('SELECT * FROM codes_sms').get();
  const { sha256 } = await import('../src/outils.js');
  assert.notEqual(row.code_hash, await sha256(`${row.empreinte}:${code}`));
});

test('les exemplaires de toute une collection : quatre questions à la base, quel que soit le nombre', async () => {
  const env = local();
  let n = 0;
  const prepare = env.DB.prepare;
  env.DB = { ...env.DB, prepare: (s) => (n++, prepare(s)) };
  const r = await worker.fetch(req('GET', `${L}/api/collection?mois=2026-11&produits=${Array.from({ length: 60 }, () => 'rare').join()},citrine,inconnu`), env);
  assert.deepEqual((await r.json()).restants.rare, { total: 3, restants: 3 });
  assert.equal(n, 4);
});

test('le ménage : une tâche qui échoue n’arrête pas l’autre, et se voit', async () => {
  const env = local();
  env.DB.raw.exec('DROP TABLE messages');
  env.DB.raw.prepare("INSERT INTO comptes (id, empreinte, numero_chiffre, cree) VALUES ('c', 'e', 'x', 0)").run();
  env.DB.raw.prepare("INSERT INTO commandes (id, compte, produit, mois, centimes, etat, cree, expire) VALUES ('o', 'c', 'citrine', '2026-11', 1, 'en_attente', 0, 1)").run();
  await assert.rejects(worker.scheduled({}, env));
  assert.equal(env.DB.raw.prepare('SELECT etat FROM commandes').get().etat, 'expiree');
});

test('le rapprochement du jour : une commande payée sans bouquet ni facture est reprise', async () => {
  const env = local();
  env.DB.raw.prepare("INSERT INTO comptes (id, empreinte, numero_chiffre, cree) VALUES ('c', 'e', 'x', 0)").run();
  env.DB.raw.prepare("INSERT INTO commandes (id, compte, produit, mois, centimes, etat, cree, expire, paye, paiement) VALUES ('o', 'c', 'citrine', '2026-11', 9480, 'payee', 0, 1, 1, 'pi')").run();
  await menageCommandes(env);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM factures').get().n, 1);
  assert.ok(env.DB.raw.prepare('SELECT bouquet FROM commandes').get().bouquet);
});

test('un prix qui n’est pas un nombre entier de centimes ne se vend pas', async () => {
  const env = local();
  const c = await cookie(env);
  const r = await worker.fetch(req('POST', `${L}/api/achat`, { produit: 'faux', renonce: true, retour: 'http://localhost:8851/' }, { cookie: c }), env);
  assert.equal(r.status, 404);
});

test('compte supprimé : anonymisé au bout de trente jours, à la seconde près, jamais avant', async () => {
  const env = local();
  const c = await cookie(env);
  const t = Date.UTC(2026, 9, 25, 0, 30); // the night the clocks go back
  env.DB.raw.prepare('UPDATE comptes SET supprime = ?').run(t);
  const prenom = () => env.DB.raw.prepare('SELECT prenom FROM comptes').get().prenom;
  await menage(env, t + 30 * 86400000 - 1);
  assert.equal(prenom(), 'Léa');
  await menage(env, t + 30 * 86400000);
  assert.equal(prenom(), null);
  assert.match(env.DB.raw.prepare('SELECT empreinte FROM comptes').get().empreinte, /^efface:/);
  assert.equal((await worker.fetch(req('GET', `${L}/api/moi`, null, { cookie: c }), env)).status, 401);
});
