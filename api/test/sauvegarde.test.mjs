// A backup is proved by restoring it, and the publication's settings are read as they are in wrangler.toml.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { d1 } from './d1.mjs';
import { verifie } from '../sauvegarde.mjs';

function remplie() {
  const { raw } = d1();
  raw.exec("INSERT INTO comptes (id, empreinte, numero_chiffre, prenom, cree) VALUES ('c', 'e', 'x', 'O''Brien', 0)");
  raw.exec("INSERT INTO factures (type, compte, emise, libelle, total) VALUES ('facture', 'c', 0, 'a', 1), ('avoir', 'c', 0, 'b', -1)");
  return raw;
}
// the tables, the rows, then the indexes and the triggers, as wrangler d1 export writes them
function copie(db) {
  const objets = db.prepare("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all();
  const q = (v) => (v === null ? 'NULL' : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v);
  const out = [];
  for (const o of objets.filter((x) => x.type === 'table')) {
    out.push(`${o.sql};`);
    for (const r of db.prepare(`SELECT * FROM ${o.name}`).all()) out.push(`INSERT INTO ${o.name} VALUES (${Object.values(r).map(q).join(',')});`);
  }
  for (const o of objets.filter((x) => x.type !== 'table')) out.push(`${o.sql};`);
  return out.join('\n');
}

test('une sauvegarde se restaure entière', () => {
  const r = verifie(copie(remplie()));
  assert.equal(r.lignes.comptes, 1);
  assert.equal(r.lignes.factures, 2);
});

test('une sauvegarde abîmée se voit : facture manquante, garde absente, parent absent, fichier coupé', () => {
  const bonne = copie(remplie());
  assert.throws(() => verifie(bonne.replace(/INSERT INTO factures VALUES \(1,.*\n/, '')), /factures/);
  assert.throws(() => verifie(bonne.replace(/CREATE TRIGGER factures_gardees[\s\S]*?END;/, '')), /factures_gardees/);
  assert.throws(() => verifie(bonne.replace(/INSERT INTO comptes VALUES.*\n/, '')), /parent/);
  assert.throws(() => verifie(bonne.slice(0, bonne.length / 2)));
});

test('la production : rien de simulé, aucune adresse locale, aucun secret', () => {
  const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const prod = toml.slice(toml.indexOf('[env.production]')).replace(/^\s*#.*$/gm, '');
  assert.ok(!/"faux"|localhost|127\.0\.0\.1/.test(prod));
  assert.match(prod, /workers_dev = false/);
  assert.match(prod, /preview_urls = false/);
  for (const k of ['POIVRE', 'CLE_NUMEROS', 'GUICHET_JETON', 'STRIPE_SECRET', 'STRIPE_WEBHOOK_SECRET', 'TURNSTILE_SECRET', 'OVH_APP_SECRET']) assert.ok(!new RegExp(`^\\s*${k}\\s*=`, 'm').test(toml), k);
});
