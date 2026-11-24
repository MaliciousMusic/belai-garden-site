// collection.js: the copies left of each bouquet in a month's collection. Since 2026-10-28 (owner: « il n'y a plus de
// rareté sur aucun bouquet ») a bouquet has no cap unless one is set for it (the database's tables, or "exemplaires" in
// boutique.json): its total and copies left are then null. Public. A copy is taken once paid (bouquets, except one given back in an exchange), or held
// while its payment page is open (commandes "en_attente" not yet expired, achat.js).
//
//   GET /api/collection?mois=2026-10&produits=a,b,c   -> { mois, restants: { a: { total, restants }, ... } }
import { json, erreur } from './outils.js';
import { catalogue } from './catalogue.js';

// the copies of a bouquet in a month: set for it in the database, else for the month, else the catalogue's (boutique.json),
// else none (null: no cap)
export async function total(env, produit, mois, defaut = null) {
  const propre = await env.DB.prepare('SELECT nombre FROM exemplaires WHERE produit = ? AND mois = ?').bind(produit, mois).first();
  if (propre) return propre.nombre;
  const col = await env.DB.prepare('SELECT exemplaires FROM collections WHERE mois = ?').bind(mois).first();
  return col ? col.exemplaires : defaut;
}

export async function collection(req, env, now = Date.now()) {
  const url = new URL(req.url);
  const mois = url.searchParams.get('mois') || '';
  if (!/^\d{4}-\d{2}$/.test(mois)) return erreur('mois_invalide');
  const produits = (url.searchParams.get('produits') || '').split(',').filter((p) => /^[a-z0-9-]{1,60}$/.test(p)).slice(0, 60);
  let C = null;
  try {
    C = await catalogue(env, now);
  } catch (_) {}
  // four questions whatever the number of bouquets asked for
  const parProduit = async (sql, ...args) => new Map(((await env.DB.prepare(sql).bind(...args).all()).results || []).map((x) => [x.produit, x.n]));
  const propres = await parProduit('SELECT produit, nombre AS n FROM exemplaires WHERE mois = ?', mois);
  const col = await env.DB.prepare('SELECT exemplaires FROM collections WHERE mois = ?').bind(mois).first();
  const vendus = await parProduit("SELECT produit, COUNT(*) AS n FROM bouquets WHERE mois = ? AND etat <> 'rendu' GROUP BY produit", mois);
  const tenus = await parProduit("SELECT produit, COUNT(*) AS n FROM commandes WHERE mois = ? AND etat = 'en_attente' AND expire > ? GROUP BY produit", mois, now);
  const restants = {};
  for (const p of produits) {
    const fiche = C && (C.produits || []).find((x) => x.id === p);
    if (C && !fiche) continue; // only what the shop sells
    const tot = propres.get(p) ?? (col ? col.exemplaires : (fiche && fiche.exemplaires) || (C && C.collection && C.collection.exemplaires) || null);
    restants[p] = tot == null ? { total: null, restants: null } : { total: tot, restants: Math.max(0, tot - (vendus.get(p) || 0) - (tenus.get(p) || 0)) };
  }
  return json({ mois, restants }, 200, { 'cache-control': 'public, max-age=30' });
}
