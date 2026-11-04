// echange.js: the exchange within 24 hours (lot C9, decor/COMPTE.md, owner 2026-10-27), a commercial gesture beside the
// waived right of withdrawal: once, within 24 hours of the purchase, for a bouquet never offered, against a bouquet of the
// day with a copy left and a price no higher. The difference goes into the account's credit (cagnotte), taken off the next
// purchases; no money is given back. The new bouquet lives 30 days from the exchange; the copy given back is on sale again.
// A credit note cancels the first invoice, an invoice paid by the exchange names the new bouquet.
//
//   POST /api/echange   { bouquet, produit }   -> { bouquet: { id, produit, numero, achat, fin }, cagnotte }   (signed in)
import { json, erreur } from './outils.js';
import { session as connecte } from './compte.js';
import { produit as produitDe } from './catalogue.js';
import { total } from './collection.js';
import { ajouteBouquet } from './achat.js';
import { emettre, libelle } from './factures.js';

const DELAI = 24 * 60 * 60 * 1000;
const J30 = 30 * 24 * 60 * 60 * 1000;

const lireJson = async (req) => {
  try {
    return await req.json();
  } catch (_) {
    return {};
  }
};

export async function echange(req, env, now = Date.now()) {
  const s = await connecte(req, env, now);
  if (!s) return erreur('non_connecte', 401);
  const corps = await lireJson(req);
  const b = await env.DB.prepare("SELECT * FROM bouquets WHERE id = ? AND compte = ? AND etat = 'actif'").bind(String(corps.bouquet || ''), s.compte.id).first();
  if (!b) return erreur('introuvable', 404);
  // the conditions: bought (not itself an exchange's), within 24 hours, never offered
  if (b.origine !== 'achat' || b.echange_de) return erreur('echange_impossible', 409, { raison: 'deja_echange' });
  if (now - b.achat >= DELAI) return erreur('echange_impossible', 409, { raison: 'delai' });
  const k = await env.DB.prepare('SELECT COUNT(*) AS n FROM cadeaux WHERE bouquet = ?').bind(b.id).first();
  if (k && k.n) return erreur('echange_impossible', 409, { raison: 'offert' });
  const f0 = await env.DB.prepare("SELECT numero, total FROM factures WHERE bouquet = ? AND type = 'facture'").bind(b.id).first();
  if (!f0) return erreur('echange_impossible', 409, { raison: 'sans_facture' });

  const p = await produitDe(env, String(corps.produit || ''), now);
  if (!p) return erreur('produit_inconnu', 404);
  if (p.id === b.produit && p.mois === b.mois) return erreur('meme_bouquet');
  if (p.centimes > f0.total) return erreur('trop_cher', 409);

  // the bouquet given back first (once), then the new one while its series has a copy; if it has none, nothing changed
  const r = await env.DB.prepare("UPDATE bouquets SET etat = 'rendu' WHERE id = ? AND etat = 'actif'").bind(b.id).run();
  if (!r.meta || r.meta.changes !== 1) return erreur('introuvable', 404);
  const tot = await total(env, p.id, p.mois, p.exemplaires);
  const nb = await ajouteBouquet(env, { compte: s.compte.id, produit: p.id, mois: p.mois, origine: 'echange', echange_de: b.id, plafond: tot }, now);
  if (!nb) {
    await env.DB.prepare("UPDATE bouquets SET etat = 'actif' WHERE id = ?").bind(b.id).run();
    return erreur('epuise', 409);
  }
  const credit = f0.total - p.centimes;
  if (credit > 0) await env.DB.prepare('UPDATE comptes SET cagnotte = cagnotte + ? WHERE id = ?').bind(credit, s.compte.id).run();

  // the papers: a credit note for the first invoice (what it went to: the new bouquet, the credit), an invoice for the new one
  const f1 = await env.DB.prepare('SELECT libelle FROM factures WHERE numero = ?').bind(f0.numero).first();
  await emettre(env, { type: 'avoir', compte: s.compte.id, bouquet: b.id, annule: f0.numero, libelle: f1.libelle, total: -f0.total, echange: p.centimes, cagnotte: credit }, now);
  await emettre(env, { type: 'facture', compte: s.compte.id, bouquet: nb.id, libelle: libelle(p.nom, nb.numero, tot, p.mois), total: p.centimes, echange: p.centimes }, now);

  const c = await env.DB.prepare('SELECT cagnotte FROM comptes WHERE id = ?').bind(s.compte.id).first();
  return json({ bouquet: { id: nb.id, produit: p.id, mois: p.mois, numero: nb.numero, achat: now, fin: now + J30 }, cagnotte: c ? c.cagnotte : 0 });
}
