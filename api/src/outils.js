// outils.js: the small pieces every route uses: hashing and encryption (Web Crypto, as in a Worker and in Node), random
// identifiers, phone numbers, JSON answers and cookies.

const enc = new TextEncoder();
const dec = new TextDecoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export const sha256 = async (text) => hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));

// a keyed fingerprint (HMAC-SHA-256 with the server's pepper): the same number always gives the same fingerprint, and
// nobody without the pepper can test a number against the table
export async function empreinte(poivre, texte) {
  const key = await crypto.subtle.importKey('raw', enc.encode(poivre), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(texte)));
}

// the phone number encrypted with the server's key (AES-GCM, a fresh nonce each time): "<nonce>.<cipher>" in base64url
async function cleAes(cle) {
  const raw = unb64u(cle);
  if (raw.length !== 32) throw new Error('CLE_NUMEROS : 32 octets en base64url attendus');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function chiffre(cle, texte) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cleAes(cle), enc.encode(texte));
  return `${b64u(iv)}.${b64u(c)}`;
}
export async function dechiffre(cle, boite) {
  const [iv, c] = boite.split('.');
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv) }, await cleAes(cle), unb64u(c)));
}

// random: an identifier, a session token, a numeric code
export const identifiant = () => b64u(crypto.getRandomValues(new Uint8Array(12)));
export const jeton = () => b64u(crypto.getRandomValues(new Uint8Array(32)));
export function codeChiffres(n = 6) {
  // rejection sampling: no digit more likely than another
  let out = '';
  while (out.length < n) {
    const b = crypto.getRandomValues(new Uint8Array(n));
    for (const x of b) if (x < 250 && out.length < n) out += String(x % 10);
  }
  return out;
}
// two strings compared in a time that does not depend on where they differ
export function egal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// an address as the limits count it: IPv4 whole, IPv6 by its /64 (what one subscriber holds, whatever the last bits say)
export function cleIp(ip) {
  const s = String(ip || '').trim().toLowerCase();
  if (!s.includes(':')) return s;
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) return v4[1];
  const [a, b = ''] = s.split('::');
  const l = a ? a.split(':') : [];
  const r = b ? b.split(':') : [];
  const tout = [...l, ...Array(Math.max(0, 8 - l.length - r.length)).fill('0'), ...r];
  return `${tout.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

// a phone number in E.164 (+33612345678): written with its prefix, or national with the default country's
const PREFIXES = { FR: '33', BE: '32', CH: '41', LU: '352', DE: '49', ES: '34', IT: '39', GB: '44', US: '1', CA: '1' };
export function numero(brut, pays = 'FR') {
  if (typeof brut !== 'string') return null;
  let s = brut.trim().replace(/[\s.\-()]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (!s.startsWith('+')) {
    const p = PREFIXES[pays] || PREFIXES.FR;
    s = '+' + p + s.replace(/^0/, '');
  }
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
}
// the numbers a text message may go to (env.INDICATIFS_SMS, calling codes separated by commas): the shop's countries only,
// so that nobody can make the server text premium-rate numbers abroad (SMS pumping). In the +1 zone, only the United States
// and Canada: the Caribbean area codes share it and are the pumpers' favourite targets.
export const INDICATIFS_SMS = '33,32,41,352,49,34,39,44,1';
const CARAIBES = new Set('242 246 264 268 284 345 441 473 649 658 664 721 758 767 784 809 829 849 868 869 876'.split(' '));
export function joignable(n, liste = INDICATIFS_SMS) {
  if (typeof n !== 'string') return false;
  const ok = String(liste)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d{1,3}$/.test(s))
    .some((p) => n.startsWith('+' + p));
  return ok && !(n.startsWith('+1') && CARAIBES.has(n.slice(2, 5)));
}

// a request made to the server on the developer's own machine (wrangler dev, the tests): the simulated text messages and
// payment work there only, never online, whatever the configuration says
export function local(req) {
  const h = new URL(req.url).hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost') || h.endsWith('.test');
}

// a number shown on an invoice: its prefix and its last two digits only (+33 •• •• •• •• 22)
export function masque(n) {
  if (typeof n !== 'string' || !/^\+\d{8,15}$/.test(n)) return null;
  const p = Object.values(PREFIXES).filter((x) => n.startsWith('+' + x)).sort((x, y) => y.length - x.length)[0] || n.slice(1, 3);
  const reste = n.slice(1 + p.length);
  const c = [...('•'.repeat(reste.length - 2) + reste.slice(-2))];
  const paires = [];
  while (c.length) paires.unshift(c.splice(-2).join('')); // in pairs from the right, as numbers are read
  return `+${p} ${paires.join(' ')}`;
}
// an e-mail address as people write it, at most 254 characters, in lower case; null otherwise
const MAIL = /^[^\s@<>()",;:]{1,64}@[^\s@<>()",;:]+\.[^\s@<>()",;:.]{2,}$/;
export function adresse(brut) {
  if (typeof brut !== 'string') return null;
  const s = brut.trim().toLowerCase();
  return s.length <= 254 && MAIL.test(s) ? s : null;
}
// a first name as people write it: 1 to 40 letters, spaces, apostrophes and hyphens
export function prenom(brut) {
  if (typeof brut !== 'string') return null;
  const s = brut.normalize('NFC').trim().replace(/\s+/g, ' ');
  return /^[\p{L}][\p{L}\p{M} '’-]{0,39}$/u.test(s) ? s : null;
}

// answers
export function json(corps, statut = 200, entetes = {}) {
  return new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...entetes } });
}
export const erreur = (code, statut = 400, plus = {}) => json({ erreur: code, ...plus }, statut);

export function cookies(req) {
  const out = {};
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
