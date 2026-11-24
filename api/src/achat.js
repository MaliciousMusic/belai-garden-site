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
import { identifiant, lireJson, local, json, erreur } from './outils.js';
import { session as stripeSession, lireSession, expireSession, evenement } from './stripe.js';
import { compte1, session as connecte } from './compte.js';
import { moisCourant, produit as produitDe } from './catalogue.js';
import { total } from './collection.js';
import { emettre, libelle } from './factures.js';
import { trace } from './journal.js';

const MIN = 60 * 1000;
// Stripe keeps a Checkout session 30 minutes at least; a little more so it is always accepted. The copy is held a few minutes
// longer than the page stays open: a payment made at the last second still finds it
const PAGE = 31 * MIN;
const TENUE = PAGE + 5 * MIN;

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

// the waiver kept as the proof of the buyer's request: the server's own words, never the client's
export const RENONCIATION = {
  version: '2026-11-04b',
  texte: 'Je demande que mon bouquet me soit livré tout de suite, dès la confirmation du paiement, et je reconnais que je perds ainsi mon droit de rétractation de 14 jours.',
};
const ACHATS_HEURE = 10;

export async function achat(req, env, now = Date.now()) {
  if (env.PAIEMENT === 'ferme') return erreur('vente_fermee', 503);
  const mode = modePaiement(req, env);
  const s = await connecte(req, env, now);
  if (!s) return erreur('non_connecte', 401);
  const corps = await lireJson(req);
  const p = await produitDe(env, String(corps.produit || ''), now);
  if (!p) return erreur('produit_inconnu', 404);
  if (p.mois !== moisCourant(now)) return erreur('collection_close', 409, { mois: p.mois });
  // the express request for immediate delivery and waiver of withdrawal (Code de la consommation L221-28, 13°)
  if (corps.renonce !== true) return erreur('renonciation_requise');
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

  // one open order per bouquet and per account: asking again frees the copy the last one held (still delivered if it gets paid)
  const trop = await compte1(env.DB, `achat:${s.compte.id}`, 60 * MIN, ACHATS_HEURE, now);
  if (!trop.ok) return erreur('trop', 429, { attendre: trop.attendre });
  const { results: ouvertes } = await env.DB.prepare("SELECT * FROM commandes WHERE compte = ? AND produit = ? AND etat = 'en_attente'").bind(s.compte.id, p.id).all();
  for (const o of ouvertes || []) {
    const etat = await solde(env, o, now);
    if (etat === 'payee') return erreur('deja_payee', 409, { commande: o.id });
    if (etat === 'en_cours') return erreur('commande_en_cours', 409, { commande: o.id });
  }

  // the copy is held in one statement: two buyers of the last copy cannot both have it (a bouquet with no cap: always); the
  // credit is taken with it, or neither is done
  const id = identifiant();
  const expire = now + TENUE;
  const tot = await total(env, p.id, p.mois, p.exemplaires);
  // (read now: an order closed above has just given its credit back)
  const solvable = await env.DB.prepare('SELECT cagnotte FROM comptes WHERE id = ?').bind(s.compte.id).first();
  const cg = Math.max(0, Math.min((solvable && solvable.cagnotte) || 0, p.centimes));
  const consent = JSON.stringify({ ...RENONCIATION, langue: String(corps.langue || 'fr').slice(0, 5), le: new Date(now).toISOString() });
  let r;
  try {
    [r] = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO commandes (id, compte, produit, mois, centimes, etat, cree, expire, consentement, retour, langue, cagnotte)
         SELECT ?4, ?5, ?1, ?2, ?6, 'en_attente', ?3, ?7, ?8, ?9, ?10, ?12
         WHERE ?11 IS NULL OR ${PRIS} < ?11`,
      ).bind(p.id, p.mois, now, id, s.compte.id, p.centimes, expire, consent, retour.href, String(corps.langue || 'fr').slice(0, 5), tot, cg),
      env.DB.prepare('UPDATE comptes SET cagnotte = cagnotte - ?1 WHERE id = ?2 AND EXISTS (SELECT 1 FROM commandes WHERE id = ?3)').bind(cg, s.compte.id, id),
    ]);
  } catch (err) {
    // another tab, or a second press, at the very same moment; the credit spent meanwhile
    if (/UNIQUE/i.test(String(err && err.message))) return erreur('commande_en_cours', 409);
    if (/cagnotte negative/.test(String(err && err.message))) return erreur('cagnotte_changee', 409);
    throw err;
  }
  if (!r.meta || r.meta.changes !== 1) return erreur('epuise', 409);
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
    const st = await stripeSession(env, { commande: id, nom: p.nom, centimes: p.centimes - cg, expire: now + PAGE, retour: retour.href, langue: corps.langue });
    await env.DB.prepare('UPDATE commandes SET session_stripe = ? WHERE id = ?').bind(st.id, id).run();
    return json({ commande: id, url: st.url });
  } catch (err) {
    // the copy and the credit go back at once
    await abandon(env, id, 'echec');
    throw err;
  }
}

// an order still open, before another is made for the same bouquet: its page is closed at Stripe first, so that it can no
// longer be paid. 'libre' (abandoned), 'payee' (it had just been), or 'en_cours' (being made, or a payment under way)
async function solde(env, o, now) {
  if (env.PAIEMENT === 'stripe') {
    if (o.session_stripe) return rapproche(env, o, now, true);
    if (now - o.cree < MIN) return 'en_cours';
  }
  await abandon(env, o.id, 'expiree');
  return 'libre';
}
// an account's open orders, and one of them closed without fuss (compte.js, an account deleted)
export const ouvertes = async (env, compte) => (await env.DB.prepare("SELECT * FROM commandes WHERE compte = ? AND etat = 'en_attente'").bind(compte).all()).results || [];
export const ferme = (env, o, now) => solde(env, o, now).catch((err) => console.error(`[achat] fermeture de ${o.id}`, err));
// an order held against what Stripe says of its page (closed on the way when fermer): delivered if it is paid, whatever
// became of its event; abandoned if the page is expired
async function rapproche(env, o, now, fermer = false) {
  const st = (fermer && (await expireSession(env, o.session_stripe))) || (await lireSession(env, o.session_stripe));
  if (st.payment_status === 'paid') {
    await confirme(env, st, now);
    return 'payee';
  }
  if (st.status !== 'expired') return 'en_cours';
  await abandon(env, o.id, 'expiree');
  return 'libre';
}
// a page paid, as Stripe gives it: delivered if its amount, its currency and its page are the order's
async function confirme(env, st, now) {
  const id = (st.metadata && st.metadata.commande) || st.client_reference_id;
  const c = id ? await env.DB.prepare('SELECT * FROM commandes WHERE id = ?').bind(String(id)).first() : null;
  // (the Stripe account may sell elsewhere too)
  if (!c) return false;
  const reference = String(st.payment_intent || st.id);
  if (st.currency !== 'eur' || st.amount_total !== c.centimes - c.cagnotte || (c.session_stripe && c.session_stripe !== st.id)) {
    await aVerifier(env, c.id, reference, 'montant, devise ou page', now);
    return false;
  }
  return livre(env, c.id, reference, now);
}
// paid, but not as ordered: nothing is delivered, a person looks (README, Commandes à vérifier)
async function aVerifier(env, id, reference, pourquoi, now) {
  console.error(`[achat] commande ${id} à vérifier : ${pourquoi}`);
  await trace(env, 'serveur', 'commande_a_verifier', id, now);
  await env.DB.prepare("UPDATE commandes SET etat = 'a_verifier', paye = ?, paiement = ? WHERE id = ? AND etat <> 'payee'").bind(now, reference, id).run();
}

// an order not paid (its page expired, cancelled, failed): its copy is free again, its credit back on the account (once)
export async function abandon(env, id, etat) {
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE comptes SET cagnotte = cagnotte + (SELECT cagnotte FROM commandes WHERE id = ?1)
       WHERE id = (SELECT compte FROM commandes WHERE id = ?1 AND etat = 'en_attente' AND cagnotte > 0)`,
    ).bind(id),
    env.DB.prepare("UPDATE commandes SET etat = ?2 WHERE id = ?1 AND etat = 'en_attente'").bind(id, etat),
  ]);
}

// once a day (index.js): the orders whose page expired an hour ago and of which Stripe said nothing (or the simulated page):
// Stripe is asked, the paid ones are delivered, the others give their credit back. One that fails waits for tomorrow
export async function menageCommandes(env, now = Date.now()) {
  const { results } = await env.DB.prepare("SELECT * FROM commandes WHERE etat = 'en_attente' AND expire < ? ORDER BY expire LIMIT 200").bind(now - 60 * MIN).all();
  for (const c of results || []) {
    try {
      await solde(env, c, now);
    } catch (err) {
      console.error(`[achat] rapprochement de ${c.id}`, err);
    }
  }
  // what is paid must have its bouquet and its invoice: a delivery stopped half-way goes on, and what stays out of step is said
  const ecart = "SELECT id, paiement FROM commandes c WHERE etat = 'payee' AND paye < ?1 AND (bouquet IS NULL OR NOT EXISTS (SELECT 1 FROM factures f WHERE f.commande = c.id)) LIMIT 50";
  for (const c of (await env.DB.prepare(ecart).bind(now - 10 * MIN).all()).results || []) await livre(env, c.id, c.paiement, now).catch((err) => console.error(`[achat] livraison de ${c.id}`, err));
  const restes = (await env.DB.prepare(ecart).bind(now - 10 * MIN).all()).results || [];
  const verif = await env.DB.prepare("SELECT COUNT(*) AS n FROM commandes WHERE etat = 'a_verifier'").first();
  if (restes.length || verif.n) console.error(`[achat] rapprochement : ${restes.length} commande(s) payée(s) sans bouquet ou facture, ${verif.n} à vérifier`);
}

// A bouquet put on an account with the smallest copy number free in its series (a copy given back in an exchange frees its
// number). With plafond, only while the series has a copy left (an exchange; a purchase's order already holds its copy).
// suite gives the statements done with it, at once or not at all; an exchange's is done only while the bouquet given back is
// there. Returns { id, numero }, or null when nothing was done.
export async function ajouteBouquet(env, b, now = Date.now(), suite = async () => []) {
  for (let essai = 0; essai < 6; essai++) {
    const { results } = await env.DB.prepare("SELECT numero FROM bouquets WHERE produit = ? AND mois = ? AND etat <> 'rendu' ORDER BY numero").bind(b.produit, b.mois).all();
    let n = 1;
    for (const r of results || []) if (r.numero === n) n++;
    const id = identifiant();
    try {
      const [r] = await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO bouquets (id, compte, produit, mois, numero, achat, origine, echange_de, commande)
           SELECT ?4, ?5, ?1, ?2, ?6, ?3, ?7, ?8, ?9
           WHERE (?10 IS NULL OR ${PRIS} < ?10) AND (?8 IS NULL OR EXISTS (SELECT 1 FROM bouquets WHERE id = ?8 AND compte = ?5 AND etat = 'actif'))`,
        ).bind(b.produit, b.mois, now, id, b.compte, n, b.origine, b.echange_de || null, b.commande || null, b.plafond ?? null),
        ...(await suite(id, n)),
      ]);
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
  if (!c) return false;
  if (['en_attente', 'expiree'].includes(c.etat)) {
    // paid after its page expired: its credit had gone back, it is taken again; if it was spent meanwhile, a person looks
    const reprend = c.etat === 'expiree' ? c.cagnotte : 0;
    try {
      const [, r] = await env.DB.batch([
        env.DB.prepare('UPDATE comptes SET cagnotte = cagnotte - ?1 WHERE id = ?2 AND EXISTS (SELECT 1 FROM commandes WHERE id = ?3 AND etat = ?4)').bind(reprend, c.compte, id, c.etat),
        env.DB.prepare("UPDATE commandes SET etat = 'payee', paye = ?, paiement = ? WHERE id = ? AND etat = ?").bind(now, reference, id, c.etat),
      ]);
      if (!r.meta || r.meta.changes !== 1) return false;
    } catch (err) {
      if (!/cagnotte negative/.test(String(err && err.message))) throw err;
      await aVerifier(env, id, reference, 'cagnotte dépensée entre-temps', now);
      return false;
    }
  } else if (['annulee', 'echec'].includes(c.etat)) {
    await aVerifier(env, id, reference, `payée alors que « ${c.etat} »`, now);
    return false;
  } else {
    // paid, but its delivery stopped half-way last time (Stripe sends the event again, minutes later): it goes on from there.
    // The same event twice at the same moment is not that: the first one is still working
    if (c.etat !== 'payee' || now - c.paye < 60000) return false;
    if (await env.DB.prepare('SELECT 1 FROM factures WHERE commande = ?').bind(id).first()) return false;
  }
  const b =
    (await env.DB.prepare('SELECT id, numero FROM bouquets WHERE commande = ?').bind(id).first()) ||
    (await ajouteBouquet(env, { compte: c.compte, produit: c.produit, mois: c.mois, origine: 'achat', commande: id }, now));
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
  await trace(env, c.compte, 'commande_payee', id, now);
  // a dispute that came before its payment was known here
  await applique(env, reference);
  return true;
}

// A card dispute, as last told: kept by payment, then brought to its order once the order is paid and delivered. A dispute
// settled is not opened again by an event that comes late, and one lost is applied once, however often it is told.
async function litige(env, paiement, etat, now) {
  await env.DB.prepare(
    `INSERT INTO litiges (paiement, etat, maj) VALUES (?1, ?2, ?3)
     ON CONFLICT(paiement) DO UPDATE SET etat = excluded.etat, maj = excluded.maj WHERE litiges.etat = 'ouvert' OR (excluded.etat <> 'ouvert' AND litiges.etat <> 'perdu')`,
  )
    .bind(paiement, etat, now)
    .run();
  await trace(env, 'stripe', `litige_${etat}`, paiement, now);
  await applique(env, paiement);
}
async function applique(env, paiement) {
  const l = await env.DB.prepare('SELECT etat FROM litiges WHERE paiement = ?').bind(paiement).first();
  if (!l) return;
  const c = await env.DB.prepare('SELECT id, compte, centimes, bouquet, litige FROM commandes WHERE paiement = ?').bind(paiement).first();
  if (!c || c.litige === 'perdu') return;
  if (l.etat === 'perdu' && c.bouquet) return retire(env, c);
  await env.DB.prepare('UPDATE commandes SET litige = ? WHERE id = ?').bind(l.etat === 'perdu' ? 'ouvert' : l.etat, c.id).run();
}
// A dispute lost: the order's bouquet is taken back, and the one it was exchanged for (wherever it is now, on the account
// of the person it was offered to too). The credit the exchange left goes too, as far as the account still has it. All of it
// at once, and once.
async function retire(env, c) {
  const pas = [];
  const retrait = (id) => pas.push(env.DB.prepare("UPDATE bouquets SET etat = 'retire' WHERE id = ? AND etat = 'actif'").bind(id));
  let id = c.bouquet;
  let dernier = id;
  for (let i = 0; id && i < 10; i++) {
    retrait(id);
    dernier = id;
    const n = await env.DB.prepare('SELECT id FROM bouquets WHERE echange_de = ?').bind(id).first();
    id = n ? n.id : null;
  }
  if (dernier !== c.bouquet) {
    const f = await env.DB.prepare("SELECT total FROM factures WHERE bouquet = ? AND type = 'facture'").bind(dernier).first();
    const credit = c.centimes - (f ? f.total : c.centimes);
    if (credit > 0) {
      // the credit already spent: what it alone paid for since the exchange goes back too, newest first, as far as it was spent
      const compte = await env.DB.prepare('SELECT cagnotte FROM comptes WHERE id = ?').bind(c.compte).first();
      let manque = credit - (compte ? compte.cagnotte : 0);
      if (manque > 0) {
        const depuis = await env.DB.prepare('SELECT achat FROM bouquets WHERE id = ?').bind(dernier).first();
        const { results } = await env.DB.prepare(
          "SELECT b.id, o.centimes FROM commandes o JOIN bouquets b ON b.commande = o.id WHERE o.compte = ? AND o.cagnotte = o.centimes AND o.centimes > 0 AND o.cree >= ? AND b.etat = 'actif' ORDER BY o.cree DESC",
        )
          .bind(c.compte, depuis ? depuis.achat : 0)
          .all();
        for (const x of results || []) {
          if (manque <= 0) break;
          retrait(x.id);
          manque -= x.centimes;
        }
      }
      pas.push(
        env.DB.prepare("UPDATE comptes SET cagnotte = MAX(0, cagnotte - ?1) WHERE id = ?2 AND EXISTS (SELECT 1 FROM commandes WHERE id = ?3 AND COALESCE(litige, '') <> 'perdu')").bind(credit, c.compte, c.id),
      );
    }
  }
  pas.push(env.DB.prepare("UPDATE commandes SET litige = 'perdu' WHERE id = ?").bind(c.id));
  await env.DB.batch(pas);
}

export async function webhook(req, env, now = Date.now()) {
  const ev = await evenement(env, req, now);
  if (!ev) return erreur('signature', 400);
  const o = (ev.data && ev.data.object) || {};
  const id = (o.metadata && o.metadata.commande) || o.client_reference_id;
  // a test event on the live shop, or the other way round, is not one of its payments
  if (env.PAIEMENT === 'stripe' && typeof ev.livemode === 'boolean' && ev.livemode !== /^[sr]k_live_/.test(env.STRIPE_SECRET || '')) {
    console.error(`[stripe] événement ${ev.id} d’un autre mode, ignoré`);
  } else if ((ev.type === 'checkout.session.completed' && o.payment_status === 'paid') || ev.type === 'checkout.session.async_payment_succeeded') {
    // the page read again at Stripe: the event says which one, Stripe says what was paid
    if (id) await confirme(env, env.PAIEMENT === 'stripe' ? await lireSession(env, String(o.id)) : o, now);
  } else if (['checkout.session.expired', 'checkout.session.async_payment_failed'].includes(ev.type) && id) {
    await abandon(env, String(id), 'expiree');
  } else if (String(ev.type).startsWith('charge.dispute.') && o.payment_intent) {
    // a dispute: contested from Stripe's dashboard with the order's proofs (GET /api/commande: the dated waiver, the delivery)
    const etat = ev.type === 'charge.dispute.closed' ? (o.status === 'lost' ? 'perdu' : o.status === 'won' ? 'gagne' : String(o.status || 'clos')) : 'ouvert';
    await litige(env, String(o.payment_intent), etat, now);
  }
  return json({ recu: true });
}

export async function commande(req, env, id, now = Date.now()) {
  const s = await connecte(req, env, now);
  if (!s) return erreur('non_connecte', 401);
  const lit = () => env.DB.prepare('SELECT * FROM commandes WHERE id = ? AND compte = ?').bind(id, s.compte.id).first();
  let c = await lit();
  if (!c) return erreur('introuvable', 404);
  // back from the payment before its event (or the event lost): Stripe is asked, at most once every fifteen seconds
  if (env.PAIEMENT === 'stripe' && c.etat === 'en_attente' && c.session_stripe && (await compte1(env.DB, `rapproche:${id}`, MIN / 4, 1, now)).ok) {
    try {
      await rapproche(env, c, now);
      c = await lit();
    } catch (err) {
      console.error(`[achat] rapprochement de ${id}`, err);
    }
  }
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
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" } });
}
