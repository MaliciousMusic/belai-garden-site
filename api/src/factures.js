// factures.js: invoices and credit notes (lot C9, decor/COMPTE.md, owner 2026-10-27). Every purchase gets an invoice, numbered
// in one unbroken sequence with the credit notes; an exchange gives a credit note for the bouquet given back and an invoice
// for the new one, paid by the exchange. What an invoice says is copied when it is issued (the buyer's first name and
// masked number, the bouquet, the amounts): it never changes afterwards. The seller is env.VENDEUR (wrangler.toml).
//
//   GET /api/factures            -> { factures: [{ numero, ref, type, emise, libelle, total }] }   (signed in)
//   GET /api/facture/<numero>    -> the invoice as a page to print or save (signed in, the account's own)
import { json, erreur, dechiffre, masque } from './outils.js';
import { session as connecte } from './compte.js';

export const ref = (f) => `${f.type === 'avoir' ? 'A' : 'F'}-${String(f.numero).padStart(6, '0')}`;

// the bouquet's line: « Bouquet « Neige de mars », exemplaire n° 3 sur 100, collection d'octobre 2026 »
export function libelle(nom, numero, total, mois) {
  const [y, m] = mois.split('-').map(Number);
  let month = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, 1));
  month = (/^[aeiouyàâéèêîôû]/i.test(month) ? 'd’' : 'de ') + month;
  // (no total for a bouquet with no cap)
  return `Bouquet « ${nom} », exemplaire n° ${numero}${total ? ` sur ${total}` : ''}, collection ${month}`;
}

// issued: f = { type, compte, bouquet?, commande?, annule?, libelle, total, carte?, cagnotte?, echange?, paiement? }, at now;
// returns its number. The buyer's first name and number are read from the account now (the number decrypted, then masked)
export async function emettre(env, f, now = Date.now()) {
  const c = await env.DB.prepare('SELECT prenom, numero_chiffre FROM comptes WHERE id = ?').bind(f.compte).first();
  let tel = null;
  try {
    if (c && c.numero_chiffre && env.CLE_NUMEROS) tel = masque(await dechiffre(env.CLE_NUMEROS, c.numero_chiffre));
  } catch (_) {}
  const r = await env.DB.prepare(
    `INSERT INTO factures (type, compte, emise, bouquet, commande, annule, prenom, numero_masque, libelle, total, carte, cagnotte, echange, paiement)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING numero`,
  )
    .bind(f.type, f.compte, now, f.bouquet || null, f.commande || null, f.annule || null, (c && c.prenom) || null, tel, f.libelle, f.total, f.carte || 0, f.cagnotte || 0, f.echange || 0, f.paiement || null)
    .first();
  return r.numero;
}

export async function factures(req, env, now = Date.now()) {
  const s = await connecte(req, env, now);
  if (!s) return erreur('non_connecte', 401);
  const { results } = await env.DB.prepare('SELECT numero, type, emise, libelle, total FROM factures WHERE compte = ? ORDER BY numero DESC').bind(s.compte.id).all();
  return json({ factures: (results || []).map((f) => ({ ...f, ref: ref(f) })) });
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const eur = (c) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100);
const jour = (t) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(t);

function vendeur(env) {
  try {
    return JSON.parse(env.VENDEUR || '{}');
  } catch (_) {
    return {};
  }
}

export async function facture(req, env, numero, now = Date.now()) {
  const s = await connecte(req, env, now);
  if (!s) return erreur('non_connecte', 401);
  const f = await env.DB.prepare('SELECT * FROM factures WHERE numero = ? AND compte = ?').bind(Number(numero), s.compte.id).first();
  if (!f) return erreur('introuvable', 404);
  const V = vendeur(env);
  const avoir = f.type === 'avoir';
  const titre = `${avoir ? 'Avoir' : 'Facture'} ${ref(f)}`;
  // how it was paid (an invoice) or what the credit went to (a credit note)
  const reglement = avoir
    ? [
        f.echange ? ['Affecté au bouquet reçu en échange', f.echange] : null,
        f.cagnotte ? ['Crédité sur votre cagnotte', f.cagnotte] : null,
      ]
    : [
        f.carte ? [`Carte bancaire (Stripe${f.paiement ? `, réf. ${f.paiement}` : ''})`, f.carte] : null,
        f.cagnotte ? ['Cagnotte du compte', f.cagnotte] : null,
        f.echange ? ['Échange d’un bouquet (voir l’avoir correspondant)', f.echange] : null,
      ];
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titre)}</title>
<style>
html{background:#eef2ef}body{font:14.5px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1d2420;margin:0;padding:24px 16px 32px}
.f{box-sizing:border-box;max-width:680px;margin:0 auto;padding:34px 38px 30px;background:#fff;border:1px solid #dfe5e1;border-radius:14px;box-shadow:0 6px 24px rgb(20 40 30 / .08)}
@media (max-width:560px){.f{padding:22px 18px}}.cadre button{display:none}
h1{font-size:24px;margin:0 0 4px}.m{color:#5b665f;margin:0 0 28px}
.p{display:flex;gap:32px;flex-wrap:wrap;margin-bottom:28px}.p div{flex:1 1 240px}.p h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#5b665f;margin:0 0 6px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #dfe5e1;vertical-align:top}
th{font-size:13px;color:#5b665f;font-weight:600}td.n,th.n{text-align:right;white-space:nowrap}
.t td{font-weight:700;border-bottom:0}.r{margin:0 0 24px}.r td{border:0;padding:3px 6px}.x{font-size:13px;color:#5b665f}
button{font:inherit;padding:8px 16px;border-radius:999px;border:1px solid #2f6b4f;background:#2f6b4f;color:#fff;cursor:pointer}
@media print{button{display:none}html{background:none}body{padding:0}.f{max-width:none;border:0;box-shadow:none;padding:0}}
</style>
<div class="f">
<h1>${esc(titre)}</h1>
<p class="m">Émis le ${esc(jour(f.emise))}${avoir && f.annule ? ` · annule la facture ${esc(ref({ type: 'facture', numero: f.annule }))}` : ''}</p>
<div class="p">
<div><h2>Vendeur</h2>${esc(V.nom || '')}<br>${esc(V.adresse || '')}<br>${V.siren ? `SIREN ${esc(V.siren)}<br>` : ''}${esc(V.courriel || '')}</div>
<div><h2>Client</h2>${esc(f.prenom || '')}<br>${esc(f.numero_masque || '')}</div>
</div>
<table>
<tr><th>Désignation</th><th class="n">Qté</th><th class="n">Prix unitaire</th><th class="n">Total</th></tr>
<tr><td>${esc(f.libelle)}${avoir ? '' : `<br><span class="x">Contenu numérique livré le ${esc(jour(f.emise))}</span>`}</td><td class="n">1</td><td class="n">${eur(f.total)}</td><td class="n">${eur(f.total)}</td></tr>
<tr class="t"><td colspan="3">Total${avoir ? ' de l’avoir' : ''}</td><td class="n">${eur(f.total)}</td></tr>
</table>
<p class="x">TVA non applicable, art. 293 B du CGI.</p>
<table class="r">${reglement
    .filter(Boolean)
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${eur(v)}</td></tr>`)
    .join('')}</table>
<button onclick="print()">Imprimer ou enregistrer en PDF</button>
</div>
<script>if (window.top !== window) document.documentElement.classList.add('cadre')</script>
</html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
