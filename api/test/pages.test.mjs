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

test('ce qu’un message dit de sa page : le bouquet ou la fleur, jamais le mot d’un cadeau ni une commande', () => {
  const src = lit('squelette/ecrire.mjs').match(/export const ici = (\(\) => \{[\s\S]*?\n\});/)[1];
  const ici = (search) => new Function('location', `return (${src})()`)({ pathname: '/squelette/recu', search });
  assert.equal(ici('?b=citrine&de=Léa&mot=secret&commande=abc&g=1'), '/squelette/recu?b=citrine');
  assert.equal(ici(''), '/squelette/recu');
  for (const f of ['ecrire', 'abeille']) assert.ok(!/page: location/.test(lit(`squelette/${f}.mjs`)));
});

test('vitrine : chaque page qui a un formulaire ou un bouton d’achat la charge, et chaque module qui pourrait envoyer refuse', async () => {
  const { readdirSync } = await import('node:fs');
  const dossier = new URL('../../public/squelette/', import.meta.url);
  for (const f of readdirSync(dossier).filter((x) => x.endsWith('.html') && !['guichet.html', 'obs.html', 'catalogue.html'].includes(x))) assert.match(lit(`squelette/${f}`), /src="vitrine\.mjs"/, f);
  assert.match(lit('squelette/connexion.mjs'), /exigeCompte\(\) \{\s+if \(VITRINE\) return false;/);
  assert.match(lit('squelette/ecrire.mjs'), /ouvreEcrire\(texte = ''\) \{[^\n]*\n[^\n]*\n?\s*(\/\/[^\n]*\n\s*)?if \(VITRINE\)|if \(VITRINE\) return void \(location\.href = `mailto:/);
  assert.match(lit('squelette/abeille.mjs'), /async function passe\(question\) \{\s+if \(VITRINE\)/);
  assert.match(lit('squelette/abeille.mjs'), /if \(VITRINE \|\| llmAbsent\) return null;/);
  // every module that calls a server knows of the showcase (the atelier's panel is not published with it)
  for (const f of readdirSync(dossier).filter((x) => /\.m?js$/.test(x) && x !== 'guichet.mjs')) if (/\$\{API\}|fetch\(LLM/.test(lit(`squelette/${f}`))) assert.match(lit(`squelette/${f}`), /VITRINE/, f);
});

test('vitrine : ses phrases sont dans les dix langues, avec leurs repères', () => {
  const src = JSON.parse(lit('squelette/langues/source.json'));
  const phrases = Object.keys(src).filter((k) => src[k] === 'vitrine.mjs');
  assert.ok(phrases.length >= 14);
  for (const c of ['en', 'es', 'it', 'de', 'ja', 'zh', 'fil', 'pt', 'ko']) {
    const livre = JSON.parse(lit(`squelette/langues/${c}.json`));
    for (const k of [...phrases, 'bientôt']) assert.ok(livre[k], `${c} : ${k}`);
  }
  // and what vitrine.mjs writes is among them
  const ecrit = [...lit('squelette/vitrine.mjs').matchAll(/textContent[:=] ?'([^']+)'|MESSAGE = '([^']+)'|replaceChildren\('([^']+)'\)|\? '([^']{12,})'|: '([^']{12,})'/g)].map((m) => m.slice(1).find(Boolean)).filter((x) => /[a-zé] /.test(x) && !/^\.|^cadeau-note/.test(x));
  for (const t of ecrit) assert.ok(phrases.includes(t), t);
});

test('vitrine : construite, elle n’a ni installateur, ni panneau, ni secret, ni envoi', { skip: process.platform === 'win32' }, async () => {
  const { mkdtempSync, rmSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const d = join(mkdtempSync(join(tmpdir(), 'vitrine-')), 'dist');
  try {
    execFileSync(process.execPath, [new URL('../../outils/vitrine.mjs', import.meta.url).pathname, '--sortie', d]);
    for (const x of ['scene/telechargements', 'squelette/guichet.html', 'squelette/guichet.mjs']) assert.ok(!existsSync(join(d, x)), x);
    for (const x of ['index.html', '404.html', '_headers', 'robots.txt', 'sitemap.xml', '.well-known/security.txt', 'squelette/index.html', 'scene/boutique.json']) assert.ok(existsSync(join(d, x)), x);
    const csp = readFileSync(join(d, '_headers'), 'utf8').match(/Content-Security-Policy: (.*)/)[1];
    assert.match(csp, /form-action 'none'/);
    assert.ok(!/challenges|127\.0\.0\.1/.test(csp));
    // a folder it did not make is never replaced
    assert.throws(() => execFileSync(process.execPath, [new URL('../../outils/vitrine.mjs', import.meta.url).pathname, '--sortie', new URL('../src', import.meta.url).pathname], { stdio: 'pipe' }));
  } finally {
    rmSync(join(d, '..'), { recursive: true, force: true });
  }
});

test('mentions : l’identité validée, aucune ancienne coordonnée', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const racine = new URL('../../public/', import.meta.url);
  const voir = (d) => readdirSync(new URL(d, racine), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (['bouquets', 'soliflores', 'telechargements', 'vendor', 'atlas'].includes(e.name) ? [] : voir(`${d}${e.name}/`)) : [`${d}${e.name}`]));
  for (const f of voir('').filter((x) => /\.(html|m?js|json|txt)$/.test(x) && statSync(new URL(x, racine)).size < 5e6)) assert.ok(!/proton\.me|18 55 81 22|618558122|FR69853801488/.test(lit(f)), f);
  const legal = lit('squelette/legal.html');
  for (const x of ['Hadrien Lonjaret, entrepreneur individuel (EI)', 'Directeur de la publication : Hadrien Lonjaret', 'SIRET 853 801 488 00026', '35 cours Sablon, 63000 Clermont-Ferrand, France', '+33 7 43 77 48 97', 'belaisgarden@gmail.com']) assert.ok(legal.includes(x), x);
});
