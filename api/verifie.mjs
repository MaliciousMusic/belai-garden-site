// verifie.mjs: before a publication (npm run deploie), reads [env.production] of wrangler.toml as wrangler does and stops if anything
// is missing, simulated or of the developer's machine. The secrets are Cloudflare's: the server checks them itself when it
// starts (src/reglages.js).
import { unstable_readConfig as lit } from 'wrangler';
import { problemesVariables } from './src/reglages.js';

const c = lit({ config: new URL('./wrangler.toml', import.meta.url).pathname, env: 'production' }, { hideWarnings: true });
const p = problemesVariables(c.vars);
const base = c.d1_databases.find((d) => d.binding === 'DB');
if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(base?.database_id || '')) p.push('database_id : celui de la base en ligne');
if (c.workers_dev !== false) p.push('workers_dev : false attendu');
if (c.preview_urls !== false) p.push('preview_urls : false attendu');
for (const k of ['DEBIT', 'DEBIT_STRICT']) if (!c.ratelimits.some((r) => r.name === k)) p.push(`${k} : le compteur de débit manque`);
for (const r of c.routes || []) if (!/^belaisgarden\.com\/api\/\*$/.test(r.pattern || r)) p.push(`route inattendue : ${r.pattern || r}`);
if (c.vars.COURRIEL_CODES === 'cloudflare' && !c.send_email.some((s) => s.name === 'CODES')) p.push('CODES : la liaison d’envoi manque');
if (p.length) {
  console.error(`Publication refusée :\n${p.map((x) => `  - ${x}`).join('\n')}`);
  process.exit(1);
}
console.log('Réglages de production : complets.');
