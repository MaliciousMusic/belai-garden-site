// d1.mjs: a D1 database for the tests, on Node's own SQLite (no wrangler): the same prepare / bind / first / all / run
// as a Worker's env.DB, the schema from migrations/.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIG = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of readdirSync(MIG).sort()) db.exec(readFileSync(join(MIG, f), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => {
      const r = db.prepare(sql).run(...args);
      return { meta: { changes: r.changes } };
    },
  });
  return { prepare: (sql) => stmt(sql), raw: db };
}
