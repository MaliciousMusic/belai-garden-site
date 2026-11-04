// catalogue.js: what the shop sells, read from the site's own boutique.json (env.CATALOGUE, its address): the products,
// their price in cents (the sum of their stems, never taken from the buyer's page), the month's collection and its copies.
// Read again at most once a minute.

let cache = null;
let lu = 0;

export async function catalogue(env, now = Date.now()) {
  if (env.__catalogue) return env.__catalogue;
  if (cache && now - lu < 60_000) return cache;
  if (!env.CATALOGUE) throw Object.assign(new Error('CATALOGUE manquant'), { config: true });
  const r = await fetch(env.CATALOGUE, { cf: { cacheTtl: 60 } });
  if (!r.ok) throw new Error(`catalogue ${r.status}`);
  cache = await r.json();
  lu = now;
  return cache;
}

// a product of the month's collection: { id, nom, centimes, mois, exemplaires (null: no cap) } or null
export async function produit(env, id, now = Date.now()) {
  const C = await catalogue(env, now);
  const p = (C.produits || []).find((x) => x.id === id);
  if (!p || !p.prix || !(p.prix.centimes > 0) || !C.collection) return null;
  return { id: p.id, nom: p.nom, centimes: p.prix.centimes, mois: C.collection.mois, exemplaires: p.exemplaires || C.collection.exemplaires || null, vie: (C.vie && C.vie.jours) || 30 };
}
