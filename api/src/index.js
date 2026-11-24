// index.js: the shop's account and gift server (decor/COMPTE.md), a Cloudflare Worker. It answers the site's pages,
// which are served elsewhere (GitHub Pages today), with their cookie when they come from env.ORIGINES; and Belai Bureau,
// with a bearer token. Lot C2: the account (by text message or by e-mail); lot C3: the purchase and the copies; lot C9: the invoices, the exchange within
// 24 hours and the account's credit; « Nous écrire », the site's messages; the bee's counter (a person of the atelier on
// the line). Lots C4, C5 add the gifts.
import { demande, verifie, demandeCourriel, verifieCourriel, moi, exporte, deconnexion, menage } from './compte.js';
import { collection } from './collection.js';
import { achat, commande, webhook, fauxStripe, menageCommandes } from './achat.js';
import { echange } from './echange.js';
import { factures, facture } from './factures.js';
import { retractation, retractations } from './retractation.js';
import { message } from './message.js';
import { ouvre, lit, message as messageGuichet, liste, tout, reponse, clos } from './guichet.js';
import { problemes } from './reglages.js';
import { cleIp, local, erreur } from './outils.js';

const ROUTES = {
  'POST /api/sms/demande': demande,
  'POST /api/sms/verifie': verifie,
  'POST /api/mail/demande': demandeCourriel,
  'POST /api/mail/verifie': verifieCourriel,
  'GET /api/moi': moi,
  'POST /api/moi': moi,
  'DELETE /api/moi': moi,
  'GET /api/moi/export': exporte,
  'POST /api/deconnexion': deconnexion,
  'GET /api/collection': collection,
  'POST /api/achat': achat,
  'POST /api/stripe/webhook': webhook,
  'POST /api/echange': echange,
  'GET /api/factures': factures,
  'POST /api/retractation': retractation,
  'GET /api/retractations': retractations,
  'POST /api/message': message,
  'POST /api/guichet': ouvre,
  'GET /api/guichet': liste,
};
// routes with an identifier in their path
const AVEC_ID = [
  [/^GET \/api\/commande\/([\w-]{8,40})$/, commande],
  [/^(?:GET|POST) \/api\/faux-stripe\/([\w-]{8,40})$/, fauxStripe],
  [/^GET \/api\/facture\/(\d{1,9})$/, facture],
  // the bee's counter (guichet.js): the visitor's talk, and the atelier's panel
  [/^GET \/api\/guichet\/([\w-]{8,40})$/, lit],
  [/^POST \/api\/guichet\/([\w-]{8,40})\/message$/, messageGuichet],
  [/^GET \/api\/guichet\/([\w-]{8,40})\/tout$/, tout],
  [/^POST \/api\/guichet\/([\w-]{8,40})\/reponse$/, reponse],
  [/^POST \/api\/guichet\/([\w-]{8,40})\/clos$/, clos],
];
function route(cle) {
  if (ROUTES[cle]) return ROUTES[cle];
  for (const [re, fn] of AVEC_ID) {
    const m = re.exec(cle);
    if (m) return (req, env) => fn(req, env, m[1]);
  }
  return null;
}

// the site's origins may call with their cookie; anyone else gets no CORS headers (Belai Bureau is not a browser page)
function cors(req, env) {
  const o = req.headers.get('origin');
  const ok = o && (env.ORIGINES || '').split(',').map((s) => s.trim()).includes(o);
  return ok
    ? {
        'access-control-allow-origin': o,
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type, authorization, x-guichet-jeton',
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        'access-control-max-age': '600',
        vary: 'origin',
      }
    : { vary: 'origin' };
}

// Belai Bureau and the counter's panel sign with a bearer token; Stripe signs its events; the simulated payment page is a form
function horsSite(req, url, env) {
  if (['GET', 'HEAD'].includes(req.method) || req.headers.get('authorization')) return null;
  if (url.pathname === '/api/stripe/webhook' || url.pathname.startsWith('/api/faux-stripe/')) return null;
  const o = req.headers.get('origin');
  if (o && !(env.ORIGINES || '').split(',').map((s) => s.trim()).includes(o)) return erreur('origine', 403);
  if (!/^application\/json\b/i.test(req.headers.get('content-type') || '')) return erreur('type', 415);
  return null;
}

// on every answer (Cloudflare Pages' _headers covers the pages only). A route that sends a page sets its own policy
const ENTETES = {
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'cross-origin-resource-policy': 'same-site',
  'x-robots-tag': 'noindex',
};

// a visitor's pace, counted by Cloudflare near the visitor (wrangler.toml, ratelimits): a first dam that spares the base. The strict
// counts, for money and codes, are the base's own (compte1). Stripe's events are signed, and come in bursts
const STRICTES = new Set(['/api/sms/demande', '/api/sms/verifie', '/api/mail/demande', '/api/mail/verifie', '/api/achat', '/api/echange', '/api/retractation', '/api/message', '/api/guichet']);
async function debit(req, url, env) {
  const ip = cleIp(req.headers.get('cf-connecting-ip'));
  if (!ip || url.pathname === '/api/stripe/webhook') return null;
  const compteur = req.method === 'POST' && STRICTES.has(url.pathname) ? env.DEBIT_STRICT : env.DEBIT;
  if (!compteur) return null;
  const { success } = await compteur.limit({ key: ip });
  return success ? null : erreur('trop', 429, { attendre: 60 }, { 'retry-after': '60' });
}

// online, incomplete or simulated settings close every route (reglages.js): the names go to the logs, never to the visitor
function pret(req, env) {
  if (local(req)) return;
  const p = problemes(env);
  if (p.length) throw Object.assign(new Error(`réglages : ${p.join(' ; ')}`), { config: true });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const h = cors(req, env);
    let res;
    try {
      if (req.method === 'OPTIONS') res = new Response(null, { status: 204 });
      else {
        pret(req, env);
        const fn = route(`${req.method} ${url.pathname}`);
        res = (await debit(req, url, env)) || (fn ? horsSite(req, url, env) || (await fn(req, env)) : erreur('introuvable', 404));
      }
    } catch (err) {
      if (!err.statut) console.error('[api]', err);
      res = err.statut ? erreur(err.code, err.statut) : erreur(err.config ? 'configuration' : 'serveur', 500);
    }
    // (a redirection's headers are locked: a copy)
    res = new Response(res.body, res);
    for (const [k, v] of Object.entries({ ...ENTETES, ...(local(req) ? {} : { 'strict-transport-security': 'max-age=31536000' }), ...h })) if (!res.headers.has(k) || k in h) res.headers.set(k, v);
    return res;
  },
  // each task on its own: one that fails neither stops the other nor goes unseen
  async scheduled(_ev, env) {
    const ratees = [];
    for (const f of [menage, menageCommandes]) await f(env).catch((err) => ratees.push(err));
    if (ratees.length) throw ratees.length > 1 ? new AggregateError(ratees) : ratees[0];
  },
};
