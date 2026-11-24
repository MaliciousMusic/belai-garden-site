// reglages.js: online, the server starts only if its settings are whole. Anything missing, simulated, of a test or of the
// developer's machine closes every route (index.js) and the publication (npm run deploie). Each door is open or closed on purpose:
//   SMS             "ovh" or "ferme"
//   COURRIEL_CODES  "cloudflare" or "ferme"
//   PAIEMENT        "stripe" or "ferme"
//   ENVIRONNEMENT   "production" (live keys only) or "preproduction" (test keys only)
// Names only here, never a value: this list is written to the logs.

const VARIABLES = {
  SMS: ['ovh', 'ferme'],
  COURRIEL_CODES: ['cloudflare', 'ferme'],
  PAIEMENT: ['stripe', 'ferme'],
  ENVIRONNEMENT: ['production', 'preproduction'],
};
const enLigne = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && x.hostname.includes('.') && !/(^|\.)(localhost|test|local|example|invalid)$/.test(x.hostname) && !/^[\d.]+$/.test(x.hostname);
  } catch (_) {
    return false;
  }
};

// what wrangler.toml says
export function problemesVariables(env) {
  const p = [];
  for (const [k, ok] of Object.entries(VARIABLES)) if (!ok.includes(env[k])) p.push(`${k} : ${ok.join(' ou ')} attendu`);
  const origines = (env.ORIGINES || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origines.length || !origines.every((o) => enLigne(o) && new URL(o).origin === o)) p.push('ORIGINES : des adresses https, sans chemin');
  if (!enLigne(env.CATALOGUE) || !origines.includes(new URL(env.CATALOGUE).origin)) p.push('CATALOGUE : une adresse https du site');
  for (const k of ['SMS_JOUR', 'COURRIEL_JOUR', 'MESSAGES_JOUR', 'GUICHET_JOUR']) if (!/^\d{1,5}$/.test(String(env[k] ?? ''))) p.push(`${k} : un nombre attendu`);
  if (env.COURRIEL_CODES === 'cloudflare' && !env.EXPEDITEUR_CODES) p.push('EXPEDITEUR_CODES manquant');
  try {
    if (!JSON.parse(env.VENDEUR).siren) throw 0;
  } catch (_) {
    p.push('VENDEUR : les mentions du vendeur');
  }
  return p;
}
// the secrets (wrangler secret put)
export function problemesSecrets(env) {
  const p = [];
  const long = (k, n) => (String(env[k] || '').length < n ? p.push(`${k} : ${n} caractères au moins`) : 0);
  long('POIVRE', 32);
  long('GUICHET_JETON', 32);
  if (!/^[\w-]{43}$/.test(env.CLE_NUMEROS || '')) p.push('CLE_NUMEROS : 32 octets en base64url');
  if (env.POIVRE && env.POIVRE === env.CLE_NUMEROS) p.push('POIVRE et CLE_NUMEROS : deux valeurs différentes');
  // (Cloudflare's own test keys pass or fail every robot)
  if (!env.TURNSTILE_SECRET || /^[123]x0{10,}/.test(env.TURNSTILE_SECRET)) p.push('TURNSTILE_SECRET : celui du site, pas une clé d’essai');
  if (env.SMS === 'ovh') for (const k of ['OVH_APP_KEY', 'OVH_APP_SECRET', 'OVH_CONSUMER_KEY', 'OVH_SERVICE']) if (!env[k]) p.push(`${k} manquant`);
  if (env.PAIEMENT === 'stripe') {
    const mode = env.ENVIRONNEMENT === 'production' ? 'live' : 'test';
    if (!new RegExp(`^[sr]k_${mode}_`).test(env.STRIPE_SECRET || '')) p.push(`STRIPE_SECRET : une clé « ${mode} » attendue`);
    if (!/^whsec_/.test(env.STRIPE_WEBHOOK_SECRET || '')) p.push('STRIPE_WEBHOOK_SECRET manquant');
  }
  return p;
}
// what is bound to the server: its base, its counters, the code's mail
export function problemesLiaisons(env) {
  const p = [];
  if (!env.DB) p.push('DB : la base manque');
  for (const k of ['DEBIT', 'DEBIT_STRICT']) if (!env[k]) p.push(`${k} : le compteur de débit manque`);
  if (env.COURRIEL_CODES === 'cloudflare' && !env.CODES) p.push('CODES : la liaison d’envoi manque');
  return p;
}
export const problemes = (env) => [...problemesVariables(env), ...problemesSecrets(env), ...problemesLiaisons(env)];
