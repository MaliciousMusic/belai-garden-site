// message.js: « Nous écrire » (owner, 2026-11-01): a message written in the site's own window, kept here for the owner to
// answer, by e-mail or by phone as the visitor asked, and sent to the owner's mailbox by Cloudflare itself (Email Routing's
// send_email binding env.COURRIER, owner 2026-11-01: no other mail service), its Reply-To the visitor's address. Without the
// binding or env.EXPEDITEUR_MESSAGES the message is only kept (README, Les messages).
//
//   POST /api/message   { texte, contact, page?, langue?, site? }   -> { ok }
//
// contact is an e-mail address or a phone number; site is a field the page hides (a robot that fills it is thanked and
// forgotten). Limits: three messages an hour and ten a day for an address, env.MESSAGES_JOUR a day for the whole shop.
import { compte1, lireJson } from './compte.js';
import { adresse, chiffre, cleIp, empreinte, identifiant, numero, json, erreur } from './outils.js';

const H = 60 * 60 * 1000;
const J = 24 * H;
const LIMITES_IP = [
  ['msg60', H, 3],
  ['msg24', J, 10],
];
const MESSAGES_JOUR = 200;
const LANGUES = new Set(['fr', 'en', 'es', 'it', 'de', 'ja', 'zh', 'fil', 'pt', 'ko']);

// an e-mail address (outils.js) or a phone number
export function contact(brut, pays = 'FR') {
  if (typeof brut !== 'string') return null;
  const s = brut.trim();
  if (s.includes('@')) {
    const a = adresse(s);
    return a ? { genre: 'mail', contact: a } : null;
  }
  const n = numero(s, pays);
  return n ? { genre: 'tel', contact: n } : null;
}

export async function message(req, env, now = Date.now()) {
  if (!env.POIVRE) throw Object.assign(new Error('POIVRE manquant'), { config: true });
  const b = await lireJson(req);
  if (b.site) return json({ ok: true });
  const texte = typeof b.texte === 'string' ? b.texte.normalize('NFC').trim() : '';
  if (texte.length < 2 || texte.length > 2000) return erreur('texte');
  const c = contact(b.contact, env.PAYS);
  if (!c) return erreur('contact');
  const ip = req.headers.get('cf-connecting-ip') || '';
  if (ip) {
    const cle = await empreinte(env.POIVRE, `ip:${cleIp(ip)}`);
    for (const [nom, fenetre, max] of LIMITES_IP) {
      const r = await compte1(env.DB, `${nom}:${cle}`, fenetre, max, now);
      if (!r.ok) return erreur('trop', 429, { attendre: r.attendre });
    }
  }
  const jour = await compte1(env.DB, `msgjour:${new Date(now).toISOString().slice(0, 10)}`, J, Number(env.MESSAGES_JOUR) || MESSAGES_JOUR, now);
  if (!jour.ok) return erreur('trop', 429, { attendre: jour.attendre });
  const page = typeof b.page === 'string' ? b.page.slice(0, 200) : null;
  const langue = LANGUES.has(b.langue) ? b.langue : null;
  const id = identifiant();
  await env.DB.prepare('INSERT INTO messages (id, cree, texte, genre, contact, page, langue) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, now, texte, c.genre, await chiffre(env.CLE_NUMEROS, c.contact), page, langue)
    .run();
  // the owner is told at once; the message is kept whatever happens to the mail
  try {
    await previent(env, { id, now, texte, ...c, page, langue });
  } catch (err) {
    console.error('[message] courrier', err);
  }
  return json({ ok: true });
}

// ---------- the mail to the owner: plain text, UTF-8, the visitor's address as Reply-To (answered with one click)
const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const enTete = (s) => `=?UTF-8?B?${b64(s)}?=`;
const lignes76 = (s) => s.replace(/.{76}/g, '$&\r\n');
export function courrier({ de, a, id, now, texte, genre, contact, page, langue }) {
  const quand = new Date(now).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' });
  const corps = [
    texte,
    '',
    '—',
    genre === 'mail' ? `Répondre par e-mail : ${contact}` : `Rappeler ou écrire au ${contact}`,
    `Reçu le ${quand} (heure de Paris)`,
    page ? `Depuis ${page}` : null,
    langue ? `Langue de la page : ${langue}` : null,
    `Message ${id}`,
  ]
    .filter((x) => x !== null)
    .join('\r\n');
  const debut = texte.replace(/\s+/g, ' ').slice(0, 60);
  const domaine = de.split('@')[1];
  return [
    `From: ${enTete('Belai’s Garden')} <${de}>`,
    `To: <${a}>`,
    genre === 'mail' ? `Reply-To: <${contact}>` : null,
    `Subject: ${enTete(`Nous écrire : ${debut}${texte.length > 60 ? '…' : ''}`)}`,
    `Date: ${new Date(now).toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${id}@${domaine}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    lignes76(b64(corps)),
  ]
    .filter((x) => x !== null)
    .join('\r\n');
}
async function previent(env, m) {
  if (!env.COURRIER || !env.EXPEDITEUR_MESSAGES || !env.DESTINATAIRE_MESSAGES) return;
  const de = env.EXPEDITEUR_MESSAGES;
  const a = env.DESTINATAIRE_MESSAGES;
  // (the tests give their own EmailMessage: cloudflare:email exists only in a Worker)
  const EmailMessage = env.__EmailMessage || (await import('cloudflare:email')).EmailMessage;
  await env.COURRIER.send(new EmailMessage(de, a, courrier({ de, a, ...m })));
}
