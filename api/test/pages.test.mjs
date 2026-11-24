// The pages as Cloudflare Pages serves them: produit.html answers at /produit, every inline script is listed in the policy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const lit = (f) => readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8');

test('un lien de cadeau se colle avec ou sans .html, jamais d’un autre site', () => {
  const src = lit('squelette/noyau.mjs').match(/!u \|\| u\.origin !== location\.origin \|\| (!\/.+?\.test\(u\.pathname\))/);
  const refuse = new Function('u', `return ${src[1]}`);
  for (const p of ['/squelette/recu', '/squelette/recu.html']) assert.equal(refuse({ pathname: p }), false, p);
  for (const p of ['/squelette/recu.html/x', '/squelette/autrerecu', '/squelette/index.html']) assert.equal(refuse({ pathname: p }), true, p);
});

test('la politique de sécurité est à jour, sans script en ligne libre', { skip: process.platform === 'win32' }, () => {
  execFileSync('python3', ['-X', 'utf8', new URL('../../outils/entetes.py', import.meta.url).pathname, '--verifie']);
  const csp = lit('_headers').match(/Content-Security-Policy: (.*)/)[1];
  assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp));
  for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) assert.ok(csp.includes(d), d);
  assert.ok(!/127\.0\.0\.1|localhost/.test(csp));
  assert.ok(!/script-src[^;]*unsafe/.test(lit('squelette/guichet.html').match(/Content-Security-Policy" content="([^"]*)/)[1]));
});

test('security.txt : un contact, une échéance à venir de moins d’un an', () => {
  const t = lit('.well-known/security.txt');
  const fin = new Date(t.match(/^Expires: (.*)$/m)[1]);
  assert.match(t, /^Contact: mailto:/m);
  assert.ok(fin > Date.now(), 'security.txt : échéance passée, à repousser');
  assert.ok(fin - Date.now() < 366 * 86400000);
});
