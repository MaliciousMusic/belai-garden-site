// vitrine.mjs: builds the showcase, the folder to publish: static files only, no server, no base, no secret. Then checks it, and
// fails if anything in it could send, sell or install.
//
//   node outils/vitrine.mjs                                        dist/, for https://belaisgarden.com
//   node outils/vitrine.mjs --site <address> --sortie <folder>     another address (ends with /), another folder
//
// Left out, and kept in the repository: the desktop application's installer (not signed yet) and the atelier's panel (it needs the
// server). Changed: the canonical addresses, and the policy (no form is sent, no local server, no Turnstile).
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEPOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC = join(DEPOT, 'public');
const option = (nom, defaut) => (process.argv.includes(nom) ? process.argv[process.argv.indexOf(nom) + 1] : defaut);
const SITE = option('--site', 'https://belaisgarden.com/');
const DIST = resolve(option('--sortie', join(DEPOT, 'dist')));
const ANCIEN = 'https://maliciousmusic.github.io/belai-garden-site/';
const ABSENTS = ['scene/telechargements', 'squelette/guichet.html', 'squelette/guichet.mjs'];

if (!/^https:\/\/[^\s"<>]+\/$/.test(SITE)) throw new Error('--site : une adresse https qui finit par /');
// only a folder this script made is replaced
const MARQUE = join(DIST, '.vitrine');
if (existsSync(DIST) && !existsSync(MARQUE)) throw new Error(`${DIST} existe et ne vient pas d’ici : à retirer à la main`);
if (PUBLIC.startsWith(DIST + sep) || DIST.startsWith(PUBLIC + sep) || DIST === PUBLIC) throw new Error('--sortie : ailleurs que public/');
rmSync(DIST, { recursive: true, force: true });
const voulu = (src) => !ABSENTS.includes(relative(PUBLIC, src).split(sep).join('/'));
cpSync(PUBLIC, DIST, { recursive: true, filter: voulu });
writeFileSync(MARQUE, '');

const fichiers = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? fichiers(join(d, e.name)) : [join(d, e.name)]));
const tous = fichiers(DIST);
const nom = (f) => relative(DIST, f).split(sep).join('/');

// ---------- the pages and the headers
const politique = (csp) =>
  csp
    .replace(/ https:\/\/challenges\.cloudflare\.com/g, '')
    .replace(/ http:\/\/127\.0\.0\.1:\d+/g, '')
    .replace("form-action 'self'", "form-action 'none'");
for (const f of tous.filter((x) => x.endsWith('.html'))) {
  const t = readFileSync(f, 'utf8');
  writeFileSync(f, t.replaceAll(ANCIEN, SITE).replace(/(Content-Security-Policy" content=")([^"]*)/, (s, a, c) => a + politique(c)));
}
const entetes = join(DIST, '_headers');
writeFileSync(entetes, readFileSync(entetes, 'utf8').replace(/^( {2}Content-Security-Policy: )(.*)$/m, (s, a, c) => a + politique(c)).replace('microphone=(self)', 'microphone=()'));
const secu = join(DIST, '.well-known', 'security.txt');
writeFileSync(secu, readFileSync(secu, 'utf8').replace('https://belaisgarden.com/', SITE));
const pages = tous.filter((f) => /squelette\/[\w-]+\.html$/.test(nom(f)) && !/name="robots" content="noindex/.test(readFileSync(f, 'utf8')));
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((f) => `  <url><loc>${SITE}${nom(f).replace(/index\.html$/, '')}</loc></url>`).join('\n')}\n</urlset>\n`,
);

// ---------- the checks
const erreurs = [];
const faux = (cond, quoi) => cond && erreurs.push(quoi);
const finaux = fichiers(DIST);
faux(!/export const VITRINE = true;/.test(readFileSync(join(DIST, 'squelette/reglages.mjs'), 'utf8')), 'reglages.mjs : VITRINE doit être à true');
for (const f of finaux) {
  const n = nom(f);
  faux(/\.(exe|msi|dmg|pkg|apk|deb|zip|map|env|toml|sql|py)$/i.test(n) || /(^|\/)\.(dev\.vars|git)/.test(n), `${n} ne se publie pas`);
  faux(statSync(f).size > 25 * 2 ** 20, `${n} dépasse 25 Mio`);
  if (!/\.(html|m?js|json|txt|xml)$/.test(n) || /bouquets\/|soliflores\/|vendor\//.test(n)) continue;
  const t = readFileSync(f, 'utf8');
  faux(/(sk|rk)_(live|test)_\w{8}|whsec_\w{8}|-----BEGIN/.test(t), `${n} : un secret`);
  if (!n.endsWith('.html')) continue;
  faux(t.includes('maliciousmusic.github.io') && !SITE.includes('maliciousmusic.github.io'), `${n} : l’ancienne adresse`);
  const csp = t.match(/Content-Security-Policy" content="([^"]*)/)?.[1];
  if (csp) faux(/127\.0\.0\.1|localhost|challenges|script-src[^;]*'unsafe-inline'/.test(csp) || !csp.includes("form-action 'none'"), `${n} : politique`);
  if (/<form/.test(t)) faux(!t.includes('src="vitrine.mjs"'), `${n} : un formulaire sans vitrine.mjs`);
  faux(/<form[^>]*\saction=/.test(t), `${n} : un formulaire qui part`);
}
faux(finaux.length > 20000, `${finaux.length} fichiers, 20 000 au plus`);
faux(!/frame-ancestors 'none'/.test(readFileSync(entetes, 'utf8')), '_headers : politique');
if (erreurs.length) {
  console.error(`Vitrine refusée :\n${erreurs.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`Vitrine prête : ${DIST} (${finaux.length} fichiers, ${Math.round(finaux.reduce((a, f) => a + statSync(f).size, 0) / 1e6)} Mo), pour ${SITE}`);
