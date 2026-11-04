// stripe.js: the card payment (decor/COMPTE.md, Stripe on the owner's account). Two modes (env.PAIEMENT):
//   "faux"   a payment page of this server's own (/api/faux-stripe/<order>) with Pay and Cancel, for local work and the
//            tests, until the owner's test keys exist;
//   "stripe" Stripe Checkout: a session made with STRIPE_SECRET (sk_test_... first), its events signed with
//            STRIPE_WEBHOOK_SECRET (whsec_...) and checked here.

const API = 'https://api.stripe.com/v1';

// form encoding of nested values, as Stripe's API takes them: a[b][c]=v
function form(obj, pre = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = pre ? `${pre}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

// a Checkout session for one bouquet: { id, url }
export async function session(env, { commande, nom, centimes, expire, retour, langue }) {
  if (!env.STRIPE_SECRET) throw Object.assign(new Error('STRIPE_SECRET manquant'), { config: true });
  const body = form({
    mode: 'payment',
    client_reference_id: commande,
    metadata: { commande },
    payment_intent_data: { metadata: { commande } },
    line_items: { 0: { quantity: 1, price_data: { currency: 'eur', unit_amount: centimes, product_data: { name: nom } } } },
    success_url: `${retour}${retour.includes('?') ? '&' : '?'}commande=${commande}&paiement=ok`,
    cancel_url: `${retour}${retour.includes('?') ? '&' : '?'}commande=${commande}&paiement=annule`,
    // Stripe holds a session 30 minutes at least: the copy is held as long (achat.js)
    expires_at: Math.ceil(expire / 1000),
    locale: ['fr', 'en', 'es', 'de', 'zh'].includes(langue) ? langue : 'auto',
  });
  const r = await fetch(`${API}/checkout/sessions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET}`, 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': `commande-${commande}` },
    body,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Stripe ${r.status} : ${j.error && j.error.message}`);
  return { id: j.id, url: j.url };
}

// a webhook event, its signature checked (Stripe-Signature: t=<time>,v1=<HMAC-SHA256 of "<t>.<body>">), at most 5 minutes
// old; null when it does not hold
export async function evenement(env, req, now = Date.now()) {
  if (!env.STRIPE_WEBHOOK_SECRET) throw Object.assign(new Error('STRIPE_WEBHOOK_SECRET manquant'), { config: true });
  const brut = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  const parts = Object.fromEntries(sig.split(',').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k, v]));
  const t = Number(parts.t);
  const v1s = sig
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3));
  if (!t || !v1s.length || Math.abs(now / 1000 - t) > 300) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${brut}`)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const { egal } = await import('./outils.js');
  if (!v1s.some((v) => egal(v, mac))) return null;
  try {
    return JSON.parse(brut);
  } catch (_) {
    return null;
  }
}
