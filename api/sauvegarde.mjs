// sauvegarde.mjs: a copy of the base outside Cloudflare, proved by restoring it. It exports the base with wrangler, restores the
// file into an empty SQLite base, checks it (integrity, references, the invoices' unbroken numbers, the guards still in place)
// and says how long it took. The file holds personal data: the folder must be outside the repository, and the file encrypted.
//
//   npm run sauvegarde -- <folder>               the base in Cloudflare ([env.production])
//   npm run sauvegarde -- <folder> --local       the developer's base, to try it
//   npm run sauvegarde -- --verifie <file.sql>   a file already there
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const DEPOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

// a file restored into an empty base: what it holds, or an error that says what is wrong with it
export function verifie(sql) {
  const debut = Date.now();
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec(sql);
  const un = (q) => db.prepare(q).get();
  const integre = un('PRAGMA integrity_check').integrity_check;
  if (integre !== 'ok') throw new Error(`base abîmée : ${integre}`);
  const orphelins = db.prepare('PRAGMA foreign_key_check').all();
  if (orphelins.length) throw new Error(`${orphelins.length} ligne(s) sans leur parent`);
  const f = un('SELECT COUNT(*) AS n, COALESCE(MAX(numero), 0) AS max FROM factures');
  if (f.n !== f.max) throw new Error(`factures : ${f.n} pièces pour le numéro ${f.max}`);
  const suite = un("SELECT seq FROM sqlite_sequence WHERE name = 'factures'");
  if (f.n && (!suite || suite.seq !== f.max)) throw new Error('factures : la numérotation reprendrait au mauvais numéro');
  const gardes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all().map((x) => x.name);
  for (const g of ['comptes_cagnotte', 'factures_fixes', 'factures_gardees']) if (!gardes.includes(g)) throw new Error(`garde ${g} absente`);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all();
  const lignes = Object.fromEntries(tables.map(({ name }) => [name, un(`SELECT COUNT(*) AS n FROM "${name}"`).n]));
  return { lignes, duree: Date.now() - debut };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  let fichier = args[args.indexOf('--verifie') + 1];
  if (!args.includes('--verifie')) {
    const dossier = args.find((a) => !a.startsWith('--'));
    if (!dossier || `${resolve(dossier)}${sep}`.startsWith(DEPOT + sep)) {
      console.error('Donnez un dossier hors du dépôt (il est public) : npm run sauvegarde -- <dossier>');
      process.exit(1);
    }
    mkdirSync(dossier, { recursive: true, mode: 0o700 });
    fichier = join(resolve(dossier), `belai-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.sql`);
    const ou = args.includes('--local') ? ['--local'] : ['--remote', '--env', 'production'];
    execFileSync('npx', ['--no-install', 'wrangler', 'd1', 'export', 'belai', ...ou, '--output', fichier], { cwd: fileURLToPath(new URL('.', import.meta.url)), stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' });
    chmodSync(fichier, 0o600);
  }
  const { lignes, duree } = verifie(readFileSync(fichier, 'utf8'));
  console.log(`${fichier} : ${statSync(fichier).size} octets, restaurée et vérifiée en ${duree} ms`);
  console.table(lignes);
}
