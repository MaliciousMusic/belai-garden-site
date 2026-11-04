// achat.js: buying a bouquet (lots C3, C9, decor/COMPTE.md): an order holds one copy of the month's series while its payment
// page is open (30 minutes), Stripe confirms the payment by a signed event, the bouquet is then added to the account with
// its copy number in the series, and its invoice issued. The account's credit (cagnotte, left by an exchange) is taken off
// the price when the order is made, and given back if the order is not paid; an order the credit covers whole is delivered
// at once, with no payment page. A card dispute lost takes the bouquet back (owner, 2026-10-27).
//
//   POST /api/achat              { produit, renonce, texte, langue, retour } -> { commande, url }   (signed in)
//   GET  /api/commande/<id>                                                 -> the order, its bouquet once paid
//   POST /api/stripe/webhook     Stripe's events (checkout.session.completed / expired, charge.dispute.created / closed)
//   GET  /api/faux-stripe/<id>   the simulated payment page (env.PAIEMENT = "faux"); POST: pay or cancel
import { identifiant, local, json, erreur } from './outils.js';
import { session as stripeSession, evenement } from './stripe.js';
import { session as connecte } from './compte.js';
import { produit as produitDe } from './catalogue.js';
import { total } from './collection.js';
import { emettre, libelle } from './factures.js';

const MIN = 60 * 1000;
// Stripe keeps a Checkout session 30 minutes at least; a little more so it is always accepted
const TENUE = 31 * MIN;

const lireJson = async (req) => {
  try {
    return await req.json();
  } catch (_) {
    return {};
  }
};
const origines = (env) => (env.ORIGINES || '').split(',').map((s) => s.trim()).filter(Boolean);
const avec = (u, commande, etat) => {
  const x = new URL(u);
  x.searchParams.set('commande', commande);
  x.searchParams.set('paiement', etat);
  return x.href;
};

// the copies of a series taken: the bouquets held (not given back in an exchange) and the orders whose page is open
export const PRIS = `(SELECT COUNT(*) FROM bouquets WHERE produit = ?1 AND mois = ?2 AND etat <> 'rendu')
                   + (SELECT COUNT(*) FROM commandes WHERE produit = ?1 AND mois = ?2 AND etat = 'en_attente' AND expire > ?3)`;

// how this server takes payments: "stripe", or "faux" (the simulated page) on the developer's machine only. Anything else,
// a missing setting included, refuses to sell: a forgotten line in wrangler.toml must never give bouquets away
function modePaiement(req, env) {
  if (env.PAIEMENT === 'stripe') return 'stripe';
  if (env.PAIEMENT === 'faux' && local(req)) return 'faux';
  throw Object.assign(new Error(`PAIEMENT « ${env.PAIEMENT} » refusé ici`), { config: true });
}

export async function achat(req, env, now = Date.now()) {
  const mode = modePaiement(req, env);
  const s = await connecte(req, env, now);
  if (!s) return erreur('non_connecte', 401);
  const corps = await lireJson(req);
  const p = await produitDe(env, String(corps.produit || ''), now);
  if (!p) return erreur('produit_inconnu', 404);
  // the express request for immediate delivery and waiver of withdrawal (Code de la consommation L221-28, 13°)
  if (corps.renonce !== true || typeof corps.texte !== 'string' || corps.texte.length < 20) return erreur('renonciation_requise');
  // the page to come back to: one of the site's own
  let retour;
  try {
    retour = new URL(String(corps.retour || ''));
  } catch (_) {
    return erreur('retour_invalide');
  }
  if (!origines(env).includes(retour.origin)) return erreur('retour_invalide');
  retour.searchParams.delete('commande');
  retour.searchParams.delete('paiement');

  // the copy is held in one statement: two buyers of the last copy cannot both have it (a bouquet with no cap: always)
  const id = identifiant();
  const expire = now + TENUE;
  const tot = await total(env, p.id, p.mois, p.exemplaires);
  const cg = Math.min(s.compte.cagnotte || 0, p.centimes);
  const consent = JSON.stringify({ texte: corps.texte.slice(0, 600), le: new Date(now).toISOString() });
  const r = await env.DB.prepare(
    `INSERT INTO commandes (id, compte, produit, mois, centimes, etat, cree, expire, consentement, retour, langue, cagnotte)
     SELECT ?4, ?5, ?1, ?2, ?6, 'en_attente', ?3, ?7, ?8, ?9, ?10, ?12
     WHERE ?11 IS NULL OR ${PRIS} < ?11`,
  )
    .bind(p.id, p.mois, now, id, s.compte.id, p.centimes, expire, consent, retour.href, String(corps.langue || 'fr').slice(0, 5), tot, cg)
    .run();
  if (!r.meta || r.meta.changes !== 1) return erreur('epuise', 409);
  // the credit taken now (given back by abandon if the order is not paid)
  if (cg) {
    const t = await env.DB.prepare('UPDATE comptes SET cagnotte = cagnotte - ?1 WHERE id = ?2 AND cagnotte >= ?1').bind(cg, s.compte.id).run();
    if (!t.meta || t.meta.changes !== 1) {
      await env.DB.prepare("UPDATE commandes SET etat = 'echec' WHERE id = ?").bind(id).run();
      return erreur('cagnotte_changee', 409);
    }
  }
  // paid whole by the credit: delivered now, straight back to the page
  if (cg === p.centimes) {
    await livre(env, id, 'cagnotte', now);
    return json({ commande: id, url: avec(retour.href, id, 'ok') });
  }

  if (mode === 'faux') {
    const base = new URL(req.url).origin;
    return json({ commande: id, url: `${base}/api/faux-stripe/${id}` });
  }
  try {
    const st = await stripeSession(env, { commande: id, nom: p.nom, centimes: p.centimes - cg, expire, retour: retour.href, langue: corps.langue });
    await env.DB.prepare('UPDATE commandes SET session_stripe = ? WHERE id = ?').bind(st.id, id).run();
    return json({ commande: id, url: st.url });
  } catch (err) {
    // the copy and the credit go back at once
    await abandon(env, id, 'echec');
    throw err;
  }
}

// an order not paid (its page expired, cancelled, failed): its copy is free again, its credit back on the account (once)
export async function abandon(env, id, etat) {
  const c = await env.DB.prepare('SELECT compte, cagnotte FROM commandes WHERE id = ?').bind(id).first();
  const r = await env.DB.prepare("UPDATE commandes SET etat = ? WHERE id = ? AND etat = 'en_attente'").bind(etat, id).run();
  if (r.meta && r.meta.changes === 1 && c && c.cagnotte) await env.DB.prepare('UPDATE comptes SET cagnotte = cagnotte + ? WHERE id = ?').bind(c.cagnotte, c.compte).run();
}

// once a day (index.js): the orders whose page expired an hour ago and of which Stripe said nothing (or the simulated page)
// give their credit back
export async function menageCommandes(env, now = Date.now()) {
  const { results } = await env.DB.prepare("SELECT id FROM commandes WHERE etat = 'en_attente' AND expire < ?").bind(now - 60 * MIN).all();
  for (const c of results || []) await abandon(env, c.id, 'expiree');
}

// A bouquet put on an account with the smallest copy number free in its series (a copy given back in an exchange frees its
// number). With plafond, only while the series has a copy left (an exchange; a purchase's order already holds its copy).
// Returns { id, numero }, or null when the series is full.
export async function ajouteBouquet(env, b, now = Date.now()) {
  for (let essai = 0; essai < 6; essai++) {
    const { results } = await env.DB.prepare("SELECT numero FROM bouquets WHERE produit = ? AND mois = ? AND etat <> 'rendu' ORDER BY numero").bind(b.produit, b.mois).all();
    let n = 1;
    for (const r of results || []) if (r.numero === n) n++;
    const id = identifiant();
    try {
      const r = await env.DB.prepare(
        `INSERT INTO bouquets (id, compte, produit, mois, numero, achat, origine, echange_de, commande)
         SELECT ?4, ?5, ?1, ?2, ?6, ?3, ?7, ?8, ?9
         WHERE ?10 IS NULL OR ${PRIS} < ?10`,
      )
        .bind(b.produit, b.mois, now, id, b.compte, n, b.origine, b.echange_de || null, b.commande || null, b.plafond ?? null)
        .run();
      return r.meta && r.meta.changes === 1 ? { id, numero: n } : null;
    } catch (err) {
      // the number was taken meanwhile: the next free one
      if (!/UNIQUE/i.test(String(err && err.message))) throw err;
    }
  }
  throw new Error('numero introuvable');
}

// a payment confirmed: the order paid (once, whatever the number of events), the bouquet on the account with its number,
// its invoice issued
export async function livre(env, id, reference, now = Date.now()) {
  const c = await env.DB.prepare('SELECT * FROM commandes WHERE id = ?').bind(id).first();
  if (!c || !['en_attente', 'expiree'].includes(c.etat)) return false;
  const r = await env.DB.prepare("UPDATE commandes SET etat = 'payee', paye = ?, paiement = ? WHERE id = ? AND etat = ?").bind(now, reference, id, c.etat).run();
  if (!r.meta || r.meta.changes !== 1) return false;
  // paid after its page expired: its credit had gone back, it is taken again
  if (c.etat === 'expiree' && c.cagnotte) await env.DB.prepare('UPDATE comptes SET cagnotte = cagnotte - ? WHERE id = ?').bind(c.cagnotte, c.compte).run();
  const b = await ajouteBouquet(env, { compte: c.compte, produit: c.produit, mois: c.mois, origine: 'achat', commande: id }, now);
  await env.DB.prepare('UPDATE commandes SET bouquet = ? WHERE id = ?').bind(b.id, id).run();
  let nom = c.produit;
  let tot = null;
  try {
    const p = await produitDe(env, c.produit, now);
    if (p) {
      nom = p.nom;
      tot = await total(env, c.produit, c.mois, p.exemplaires);
    }
  } catch (_) {}
  await emettre(
    env,
    { type: 'facture', compte: c.compte, bouquet: b.id, commande: id, libelle: libelle(nom, b.numero, tot, c.mois), total: c.centimes, carte: c.centimes - c.cagnotte, cagnotte: c.cagnotte, paiement: reference === 'cagnotte' ? null : reference },
    now,
  );
  return true;
}

// A card dispute lost: the order's bouquet is taken back, and the one it was exchanged for (wherever it is now, on the account
// of the person it was offered to too). The credit the exchange left goes too, as far as the account still has it.
async function retire(env, commande) {
  const c = await env.DB.prepare('SELECT compte, centimes, bouquet FROM commandes WHERE id = ?').bind(commande).first();
  if (!c || !c.bouquet) return;
  let id = c.bouquet;
  let dernier = id;
  for (let i = 0; id && i < 10; i++) {
    await env.DB.prepare("UPDATE bouquets SET etat = 'retire' WHERE id = ? AND etat = 'actif'").bind(id).run();
    dernier = id;
    const n = await env.DB.prepare('SELECT id FROM bouquets WHERE echange_de = ?').bind(id).first();
    id = n ? n.id : null;
  }
  if (dernier !== c.bouquet) {
    const f = await env.DB.prepare("SELECT total FROM factures WHERE bouquet = ? AND type = 'facture'").bind(dernier).first();
    const credit = c.centimes - (f ? f.total : c.centimes);
    if (credit > 0) await env.DB.prepare('UPDATE comptes SET cagnotte = MAX(0, cagnotte - ?) WHERE id = ?').bind(credit, c.compte).run();
  }
}

export async function webhook(req, env, now = Date.now()) {
  const ev = await evenement(env, req, now);
  if (!ev) return erreur('signature', 400);
  const o = (ev.data && ev.data.object) || {};
  const id = (o.metadata && o.metadata.commande) || o.client_reference_id;
  if ((ev.type === 'checkout.session.completed' && o.payment_status === 'paid') || ev.type === 'checkout.session.async_payment_succeeded') {
    if (id) await livre(env, id, String(o.payment_intent || o.id), now);
  } else if (ev.type === 'checkout.session.expired' && id) {
    await abandon(env, id, 'expiree');
  } else if (ev.type.startsWith('charge.dispute.') && o.payment_intent) {
    // a dispute: contested from Stripe's dashboard with the order's proofs (GET /api/commande: the dated waiver, the delivery)
    const c = await env.DB.prepare('SELECT id FROM commandes WHERE paiement = ?').bind(String(o.payment_intent)).first();
    if (c) {
      const etat = ev.type === 'charge.dispute.closed' ? (o.status === 'lost' ? 'perdu' : o.status === 'won' ? 'gagne' : String(o.status || 'clos')) : 'ouvert';
      await env.DB.prepare('UPDATE commandes SET litige = ? WHERE id = ?').bind(etat, c.id).run();
      if (etat === 'perdu') await retire(env, c.id);
    }
  }
  return json({ recu: true });
}

export async function commande(req, env, id, now = Date.now()) {
  const s = await connecte(req, env, now);
  if (!s) return erreur('non_connecte', 401);
  const c = await env.DB.prepare('SELECT * FROM commandes WHERE id = ? AND compte = ?').bind(id, s.compte.id).first();
  if (!c) return erreur('introuvable', 404);
  const b = c.bouquet ? await env.DB.prepare('SELECT id, numero, achat FROM bouquets WHERE id = ?').bind(c.bouquet).first() : null;
  const f = await env.DB.prepare('SELECT numero FROM factures WHERE commande = ?').bind(id).first();
  const etat = c.etat === 'en_attente' && c.expire <= now ? 'expiree' : c.etat;
  return json({
    id: c.id,
    etat,
    produit: c.produit,
    mois: c.mois,
    centimes: c.centimes,
    cagnotte: c.cagnotte,
    cree: c.cree,
    paye: c.paye,
    paiement: c.paiement,
    consentement: c.consentement ? JSON.parse(c.consentement) : null,
    bouquet: b,
    facture: f ? f.numero : null,
  });
}

// ---------- the simulated payment page (local work and tests, never online: env.PAIEMENT = "faux")
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export async function fauxStripe(req, env, id, now = Date.now()) {
  if (env.PAIEMENT !== 'faux' || !local(req)) return erreur('introuvable', 404);
  const c = await env.DB.prepare('SELECT * FROM commandes WHERE id = ?').bind(id).first();
  if (!c) return erreur('introuvable', 404);
  if (req.method === 'POST') {
    const f = await req.formData();
    if (f.get('action') === 'payer' && c.etat === 'en_attente' && c.expire > now) {
      await livre(env, id, `faux_${id}`, now);
      return Response.redirect(avec(c.retour, id, 'ok'), 303);
    }
    await abandon(env, id, 'annulee');
    return Response.redirect(avec(c.retour, id, 'annule'), 303);
  }
  const fmt = (x) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(x / 100);
  const prix = fmt(c.centimes - c.cagnotte);
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Paiement simulé</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:420px;margin:48px auto;padding:0 16px;color:#1d2420}
.n{background:#fff6dc;border:1px solid #e8cf7a;padding:10px 12px;border-radius:8px;font-size:14px}button{font:inherit;padding:10px 18px;border-radius:999px;border:1px solid #2f6b4f;margin:6px 6px 0 0}
.p{background:#2f6b4f;color:#fff}</style>
<p class="n">Paiement simulé : en ligne, cette page sera celle de Stripe. Aucune carte n'est demandée ici.</p>
<h1>${esc(c.produit)}</h1><p>${prix}${c.cagnotte ? ` (${fmt(c.centimes)} moins ${fmt(c.cagnotte)} de cagnotte)` : ''} · commande ${esc(id)}</p>
<form method="post"><button class="p" name="action" value="payer">Payer ${prix}</button><button name="action" value="annuler">Annuler</button></form></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
