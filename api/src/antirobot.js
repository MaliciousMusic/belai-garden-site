// antirobot.js: Cloudflare Turnstile, checked here and never on the page's word: before a code is sent (it costs money, and
// fills somebody's phone), a message kept, a talk opened. The token is the visitor's for this action on this site, once (Cloudflare refuses
// it twice). If Cloudflare does not answer, nothing is sent.
import { local } from './outils.js';

const VERIFIE = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function humain(env, req, jeton, action) {
  // (the developer's machine has no key; online the server does not start without one: reglages.js)
  if (!env.TURNSTILE_SECRET && local(req)) return true;
  if (!env.TURNSTILE_SECRET) throw Object.assign(new Error('TURNSTILE_SECRET manquant'), { config: true });
  if (typeof jeton !== 'string' || !jeton || jeton.length > 2048) return false;
  let j;
  try {
    const r = await fetch(VERIFIE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: jeton, remoteip: req.headers.get('cf-connecting-ip') || undefined }),
      signal: AbortSignal.timeout(8000),
    });
    j = await r.json();
  } catch (err) {
    console.error('[antirobot]', err);
    throw Object.assign(new Error('antirobot'), { statut: 503, code: 'antirobot_indisponible' });
  }
  const hotes = (env.ORIGINES || '').split(',').map((s) => s.trim()).filter(Boolean).map((o) => new URL(o).hostname);
  return j.success === true && j.action === action && hotes.includes(j.hostname);
}
