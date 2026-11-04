// compte.js: the account (decor/COMPTE.md, owner 2026-10-27), required to buy (owner, 2026-11-02: « afin de protéger les
// achats, le compte avec validation par mail ou numéro de téléphone est obligatoire »): a first name and a mobile number
// verified by a code sent by text message, or an e-mail address verified by a code sent by e-mail (the first name required
// for a new account), sessions for the site (a cookie) and for Belai Bureau (a bearer token, signed in once). The person
// who receives a gift needs none.
//
//   POST   /api/sms/demande    { numero, langue? }                  -> { ok, expire }         a code is sent by text
//   POST   /api/sms/verifie    { numero, code, prenom, client? }    -> { compte, jeton? }     signed in (account made if new;
//                                                                     without a first name, prenom_requis: the code holds)
//   POST   /api/mail/demande   { adresse, langue? }                 -> { ok, expire }         a code is sent by e-mail
//   POST   /api/mail/verifie   { adresse, code, prenom, client? }   -> { compte, jeton? }     the same, by e-mail
//   GET    /api/moi                                               -> { compte, bouquets }    its bouquets, its credit
//   POST   /api/moi           { prenom }                          -> { compte }
//   POST   /api/deconnexion                                      -> { ok }
//   DELETE /api/moi                                               -> { ok }                  erased 30 days later
import { cleIp, adresse, empreinte, chiffre, sha256, jeton, identifiant, codeChiffres, egal, numero, prenom, joignable, INDICATIFS_SMS, local, json, erreur, cookies } from './outils.js';
import { envoie } from './sms.js';
import { envoieCourriel } from './courriel.js';

const MIN = 60 * 1000;
const H = 60 * MIN;
const J = 24 * H;
export const COOKIE = 'belai_session';
const CODE_VIE = 10 * MIN;
const ESSAIS = 5;
const SESSION = { site: 30 * J, bureau: 365 * J };
// how many codes: one a minute, five an hour and ten a day for a number or an e-mail address, ten an hour for an IP address,
// and for the whole shop env.SMS_JOUR texts and env.COURRIEL_JOUR mails a day (a ceiling against SMS pumping from many
// numbers and addresses at once)
const LIMITES = [
  ['sms1', MIN, 1],
  ['sms60', H, 5],
  ['sms24', J, 10],
];
const LIMITE_IP = [H, 10];
const SMS_JOUR = 300;
const COURRIEL_JOUR = 300;
// wrong codes for a number in a day, whatever the number of codes asked for: past it, no more codes until the day is over
const FAUX_JOUR = 15;
// all addresses together, higher: one person's bad day locks nobody else out, a wide attack still stops
const FAUX_TOUT = 100;
const MESSAGES_VIE = 3 * 365;

const MESSAGES = {
  fr: (c) => `Belai's Garden : votre code est ${c}. Il est valable 10 minutes. Ne le donnez à personne.`,
  en: (c) => `Belai's Garden: your code is ${c}. It is valid for 10 minutes. Do not share it.`,
  es: (c) => `Belai's Garden: tu código es ${c}. Es válido durante 10 minutos. No lo compartas.`,
  de: (c) => `Belai's Garden: Ihr Code lautet ${c}. Er ist 10 Minuten gültig. Geben Sie ihn nicht weiter.`,
  zh: (c) => `Belai's Garden：你的验证码是 ${c}，10 分钟内有效。请勿告诉他人。`,
};
// the same code by e-mail: in the subject too, and what to do if one asked for nothing
const COURRIELS = {
  fr: (c) => ({ sujet: `${c} : votre code Belai's Garden`, texte: `Bonjour,\r\n\r\nVotre code est ${c}. Il est valable 10 minutes. Ne le donnez à personne : l'atelier ne vous le demandera jamais.\r\n\r\nSi vous n'avez rien demandé, ignorez ce message : aucun compte n'est ouvert sans ce code.\r\n\r\nBelai's Garden` }),
  en: (c) => ({ sujet: `${c}: your Belai's Garden code`, texte: `Hello,\r\n\r\nYour code is ${c}. It is valid for 10 minutes. Do not share it: the atelier will never ask you for it.\r\n\r\nIf you asked for nothing, ignore this message: no account is opened without this code.\r\n\r\nBelai's Garden` }),
  es: (c) => ({ sujet: `${c}: tu código de Belai's Garden`, texte: `Hola:\r\n\r\nTu código es ${c}. Es válido durante 10 minutos. No lo compartas: el taller nunca te lo pedirá.\r\n\r\nSi no has pedido nada, ignora este mensaje: no se abre ninguna cuenta sin este código.\r\n\r\nBelai's Garden` }),
  de: (c) => ({ sujet: `${c}: Ihr Code für Belai's Garden`, texte: `Guten Tag,\r\n\r\nIhr Code lautet ${c}. Er ist 10 Minuten gültig. Geben Sie ihn nicht weiter: Das Atelier wird Sie nie danach fragen.\r\n\r\nWenn Sie nichts angefordert haben, ignorieren Sie diese Nachricht: Ohne diesen Code wird kein Konto eröffnet.\r\n\r\nBelai's Garden` }),
  zh: (c) => ({ sujet: `${c}：你的 Belai's Garden 验证码`, texte: `你好：\r\n\r\n你的验证码是 ${c}，10 分钟内有效。请勿告诉他人：工作室绝不会向你索要。\r\n\r\n如果你没有申请，请忽略此邮件：没有此验证码不会开设任何账户。\r\n\r\nBelai's Garden` }),
};

// the two ways to validate an account (owner, 2026-11-02): each reads its own field, has its own sender and its own daily
// ceiling, and its own fingerprint (an address is keyed « mail: »), so a number and an address are two accounts
const CANAUX = {
  sms: {
    lit: (corps, env) => numero(corps.numero, env.PAYS),
    invalide: 'numero_invalide',
    cle: (n) => n,
    // the simulated texts write the code to the logs: on the developer's machine only
    pret: (req, env) => env.SMS === 'ovh' || (env.SMS === 'faux' && local(req)),
    reglage: (env) => `SMS « ${env.SMS} »`,
    desservi: (n, env) => joignable(n, env.INDICATIFS_SMS || INDICATIFS_SMS),
    plafond: (env) => Number(env.SMS_JOUR) || SMS_JOUR,
    envoie: (env, n, langue, code) => envoie(env, n, (MESSAGES[langue] || MESSAGES.fr)(code)),
  },
  mail: {
    lit: (corps) => adresse(corps.adresse),
    invalide: 'adresse_invalide',
    cle: (a) => `mail:${a}`,
    // the same for the simulated mails
    pret: (req, env) => env.COURRIEL_CODES === 'cloudflare' || (env.COURRIEL_CODES === 'faux' && local(req)),
    reglage: (env) => `Courriel « ${env.COURRIEL_CODES} »`,
    desservi: () => true,
    plafond: (env) => Number(env.COURRIEL_JOUR) || COURRIEL_JOUR,
    envoie: (env, a, langue, code, now) => envoieCourriel(env, a, (COURRIELS[langue] || COURRIELS.fr)(code), now),
  },
};

function secrets(env) {
  if (!env.POIVRE || !env.CLE_NUMEROS) throw Object.assign(new Error('POIVRE ou CLE_NUMEROS manquant'), { config: true });
  return env;
}

// a counter in its window: true while under the limit (counts this one), false once over. Counted and read in one statement,
// so that requests sent all at once cannot all read the same count and slip under the limit together
export async function compte1(db, cle, fenetre, max, now) {
  const row = await db
    .prepare(
      `INSERT INTO limites (cle, nombre, debut) VALUES (?1, 1, ?2)
       ON CONFLICT(cle) DO UPDATE SET nombre = CASE WHEN ?2 - debut >= ?3 THEN 1 ELSE nombre + 1 END,
                                      debut = CASE WHEN ?2 - debut >= ?3 THEN ?2 ELSE debut END
       RETURNING nombre, debut`,
    )
    .bind(cle, now, fenetre)
    .first();
  if (row.nombre <= max) return { ok: true };
  return { ok: false, attendre: Math.ceil((row.debut + fenetre - now) / 1000) };
}
// a counter read without counting: { ok: false, attendre } once it has reached its limit
async function depasse(db, cle, fenetre, max, now) {
  const row = await db.prepare('SELECT nombre, debut FROM limites WHERE cle = ?').bind(cle).first();
  if (!row || now - row.debut >= fenetre || row.nombre < max) return { ok: true };
  return { ok: false, attendre: Math.ceil((row.debut + fenetre - now) / 1000) };
}

export const lireJson = async (req) => {
  try {
    return await req.json();
  } catch (_) {
    return {};
  }
};
const vueCompte = (c) => ({ prenom: c.prenom || null, depuis: c.cree, cagnotte: c.cagnotte || 0 });
const J30 = 30 * 24 * 60 * 60 * 1000;
const ECHANGE = 24 * 60 * 60 * 1000;

export const demande = (req, env, now) => demandeCode('sms', req, env, now);
export const verifie = (req, env, now) => verifieCode('sms', req, env, now);
export const demandeCourriel = (req, env, now) => demandeCode('mail', req, env, now);
export const verifieCourriel = (req, env, now) => verifieCode('mail', req, env, now);

async function demandeCode(canal, req, env, now = Date.now()) {
  secrets(env);
  const k = CANAUX[canal];
  if (!k.pret(req, env)) throw Object.assign(new Error(`${k.reglage(env)} refusé ici`), { config: true });
  const corps = await lireJson(req);
  const n = k.lit(corps, env);
  if (!n) return erreur(k.invalide);
  if (!k.desservi(n, env)) return erreur('pays_non_desservi');
  const fp = await empreinte(env.POIVRE, k.cle(n));
  const fauxCle = `faux:${fp}:${await empreinte(env.POIVRE, `ip:${cleIp(req.headers.get('cf-connecting-ip'))}`)}`;
  for (const [cle, max] of [[fauxCle, FAUX_JOUR], [`fauxtout:${fp}`, FAUX_TOUT]]) {
    const f = await depasse(env.DB, cle, J, max, now);
    if (!f.ok) return erreur('trop_de_demandes', 429, { attendre: f.attendre });
  }
  for (const [nom, fenetre, max] of LIMITES) {
    const r = await compte1(env.DB, `${nom}:${fp}`, fenetre, max, now);
    if (!r.ok) return erreur('trop_de_demandes', 429, { attendre: r.attendre });
  }
  const ip = req.headers.get('cf-connecting-ip') || '';
  if (ip) {
    // (the address keyed with the pepper, as the numbers: a plain hash of an IPv4 address is reversed in minutes)
    const r = await compte1(env.DB, `ip:${await empreinte(env.POIVRE, `ip:${cleIp(ip)}`)}`, LIMITE_IP[0], LIMITE_IP[1], now);
    if (!r.ok) return erreur('trop_de_demandes', 429, { attendre: r.attendre });
  }
  // the shop's ceiling, counted last: only the codes that would really go out
  const g = await compte1(env.DB, `${canal}:boutique`, J, k.plafond(env), now);
  if (!g.ok) {
    console.error(`[${canal}] plafond du jour atteint`);
    return erreur('trop_de_demandes', 429, { attendre: g.attendre });
  }
  const code = codeChiffres(6);
  const expire = now + CODE_VIE;
  await env.DB.prepare('INSERT INTO codes_sms (empreinte, code_hash, expire, essais) VALUES (?, ?, ?, 0) ON CONFLICT(empreinte) DO UPDATE SET code_hash = excluded.code_hash, expire = excluded.expire, essais = 0')
    .bind(fp, await sha256(`${fp}:${code}`), expire)
    .run();
  await k.envoie(env, n, corps.langue, code, now);
  return json({ ok: true, expire });
}

async function verifieCode(canal, req, env, now = Date.now()) {
  secrets(env);
  const k = CANAUX[canal];
  const corps = await lireJson(req);
  const n = k.lit(corps, env);
  if (!n) return erreur(k.invalide);
  const client = corps.client === 'bureau' ? 'bureau' : 'site';
  const fp = await empreinte(env.POIVRE, k.cle(n));
  // the attempt is counted before the code is compared, in one statement: requests sent all at once each take their own
  // attempt, and none is compared once the five are used
  const row = await env.DB.prepare('UPDATE codes_sms SET essais = essais + 1 WHERE empreinte = ? AND expire > ? AND essais < ? RETURNING code_hash, essais')
    .bind(fp, now, ESSAIS)
    .first();
  if (!row) {
    const r = await env.DB.prepare('SELECT expire FROM codes_sms WHERE empreinte = ?').bind(fp).first();
    if (!r || r.expire <= now) return erreur('code_expire');
    await env.DB.prepare('DELETE FROM codes_sms WHERE empreinte = ?').bind(fp).run();
    return erreur('trop_d_essais', 429);
  }
  const code = String(corps.code || '').replace(/\D/g, '');
  if (!egal(await sha256(`${fp}:${code}`), row.code_hash)) {
    // the wrong codes of the day, all codes together: past them the code goes, and no other is sent until the day is over
    const fauxCle = `faux:${fp}:${await empreinte(env.POIVRE, `ip:${cleIp(req.headers.get('cf-connecting-ip'))}`)}`;
    const f = await compte1(env.DB, fauxCle, J, FAUX_JOUR, now);
    const g = await compte1(env.DB, `fauxtout:${fp}`, J, FAUX_TOUT, now);
    if (!f.ok || !g.ok) {
      await env.DB.prepare('DELETE FROM codes_sms WHERE empreinte = ?').bind(fp).run();
      return erreur('trop_d_essais', 429);
    }
    return erreur('code_faux', 400, { reste: Math.max(0, ESSAIS - row.essais) });
  }
  // the account: found by its fingerprint, made if new (a deletion asked for is cancelled by signing in again). A new one
  // needs a first name: without one the code is kept (and this attempt given back), to be sent again with it
  let c = await env.DB.prepare('SELECT * FROM comptes WHERE empreinte = ?').bind(fp).first();
  if (!c && !prenom(corps.prenom)) {
    await env.DB.prepare('UPDATE codes_sms SET essais = essais - 1 WHERE empreinte = ? AND essais > 0').bind(fp).run();
    return erreur('prenom_requis');
  }
  // the code used once: of two right requests at the same time, only one signs in
  const pris = await env.DB.prepare('DELETE FROM codes_sms WHERE empreinte = ? AND code_hash = ? RETURNING empreinte').bind(fp, row.code_hash).first();
  if (!pris) return erreur('code_expire');
  let nouveau = false;
  if (!c) {
    nouveau = true;
    c = { id: identifiant(), prenom: prenom(corps.prenom), cree: now };
    // (numero_chiffre holds the number or the address, encrypted alike; canal says which)
    await env.DB.prepare('INSERT INTO comptes (id, empreinte, numero_chiffre, prenom, cree, canal) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(c.id, fp, await chiffre(env.CLE_NUMEROS, n), c.prenom, now, canal)
      .run();
  } else if (c.supprime) {
    await env.DB.prepare('UPDATE comptes SET supprime = NULL WHERE id = ?').bind(c.id).run();
  }

  const t = jeton();
  const expire = now + SESSION[client];
  await env.DB.prepare('INSERT INTO sessions (jeton_hash, compte, client, cree, expire) VALUES (?, ?, ?, ?, ?)').bind(await sha256(t), c.id, client, now, expire).run();
  const corpsOut = { compte: { ...vueCompte(c), nouveau } };
  if (client === 'bureau') return json({ ...corpsOut, jeton: t, expire });
  return json(corpsOut, 200, { 'set-cookie': cookie(t, SESSION.site / 1000) });
}

const cookie = (valeur, age) => `${COOKIE}=${valeur}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;

// the session behind a request: its cookie (the site) or its bearer token (Belai Bureau)
export async function session(req, env, now = Date.now()) {
  const auth = req.headers.get('authorization') || '';
  const t = auth.startsWith('Bearer ') ? auth.slice(7).trim() : cookies(req)[COOKIE];
  if (!t) return null;
  const h = await sha256(t);
  const s = await env.DB.prepare('SELECT s.jeton_hash, s.expire, c.* FROM sessions s JOIN comptes c ON c.id = s.compte WHERE s.jeton_hash = ?').bind(h).first();
  if (!s || s.expire <= now || s.supprime) return null;
  return { hash: h, compte: s };
}

export async function moi(req, env, now = Date.now()) {
  const s = await session(req, env, now);
  if (!s) return erreur('non_connecte', 401);
  if (req.method === 'POST') {
    const corps = await lireJson(req);
    const p = prenom(corps.prenom);
    if (!p) return erreur('prenom_invalide');
    await env.DB.prepare('UPDATE comptes SET prenom = ? WHERE id = ?').bind(p, s.compte.id).run();
    return json({ compte: vueCompte({ ...s.compte, prenom: p }) });
  }
  if (req.method === 'DELETE') {
    await env.DB.prepare('UPDATE comptes SET supprime = ? WHERE id = ?').bind(now, s.compte.id).run();
    await env.DB.prepare('DELETE FROM sessions WHERE compte = ?').bind(s.compte.id).run();
    return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });
  }
  // the bouquets it holds (not those given back or taken back), each with its fading and whether it may still be exchanged
  // (echange.js: within 24 hours, once, never offered)
  const { results } = await env.DB.prepare(
    `SELECT b.id, b.produit, b.mois, b.numero, b.achat, b.origine, b.fin, b.echange_de,
            (SELECT COUNT(*) FROM cadeaux k WHERE k.bouquet = b.id) AS offert
     FROM bouquets b WHERE b.compte = ? AND b.etat = 'actif' ORDER BY b.achat DESC`,
  )
    .bind(s.compte.id)
    .all();
  const bouquets = (results || []).map(({ offert, echange_de, ...b }) => ({
    ...b,
    fin: b.fin || b.achat + J30,
    echangeable: b.origine === 'achat' && !echange_de && !offert && now - b.achat < ECHANGE ? b.achat + ECHANGE : null,
  }));
  return json({ compte: vueCompte(s.compte), bouquets });
}

export async function deconnexion(req, env, now = Date.now()) {
  const s = await session(req, env, now);
  if (s) await env.DB.prepare('DELETE FROM sessions WHERE jeton_hash = ?').bind(s.hash).run();
  return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });
}

// once a day: expired codes, sessions and counters go; an account deleted 30 days ago is anonymised (its purchases are
// kept ten years for the accounts, without the number or the name)
export async function menage(env, now = Date.now()) {
  await env.DB.prepare('DELETE FROM codes_sms WHERE expire <= ?').bind(now).run();
  await env.DB.prepare('DELETE FROM sessions WHERE expire <= ?').bind(now).run();
  await env.DB.prepare('DELETE FROM limites WHERE debut <= ?').bind(now - 2 * J).run();
  // what visitors wrote, as long as the privacy policy says
  const vieux = now - MESSAGES_VIE * J;
  await env.DB.prepare('DELETE FROM messages WHERE cree <= ?').bind(vieux).run();
  await env.DB.prepare('DELETE FROM guichet_messages WHERE conv IN (SELECT id FROM guichet WHERE maj <= ?)').bind(vieux).run();
  await env.DB.prepare('DELETE FROM guichet WHERE maj <= ?').bind(vieux).run();
  await env.DB.prepare("UPDATE comptes SET empreinte = 'efface:' || id, numero_chiffre = '', prenom = NULL WHERE supprime IS NOT NULL AND supprime <= ? AND empreinte NOT LIKE 'efface:%'")
    .bind(now - 30 * J)
    .run();
}
