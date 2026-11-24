// retractation.js: the withdrawal on line (« Renoncer au contrat ici », then « Confirmer la rétractation »): a declaration received,
// dated, and acknowledged on a durable medium: the answer, and an e-mail when the account has an address. It is received whatever the order
// (the law, not this code, says what it gives right to: waiver, gift not opened...): a person looks, nothing moves by itself.
//
//   POST /api/retractation        { commande, confirme: true }  -> { id, commande, recue, le, accuse }   (signed in; the same one if asked again)
//   GET  /api/retractations                                     -> { retractations }
import { identifiant, lireJson, json, erreur, dechiffre } from './outils.js';
import { session as connecte } from './compte.js';
import { envoieCourriel } from './courriel.js';
import { ref } from './factures.js';
import { trace } from './journal.js';

// at the second, in the shop's own time, so that it reads the same on the answer and on the e-mail
const moment = (t) => `${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'medium', timeZone: 'Europe/Paris' }).format(t)} (heure de Paris)`;

export async function retractation(req, env, now = Date.now()) {
  const s = await connecte(req, env, now);
  if (!s) return erreur('non_connecte', 401);
  const corps = await lireJson(req);
  const c = await env.DB.prepare("SELECT c.id, c.produit, f.type, f.numero, f.libelle FROM commandes c LEFT JOIN factures f ON f.commande = c.id WHERE c.id = ? AND c.compte = ? AND c.etat IN ('payee', 'a_verifier')")
    .bind(String(corps.commande || ''), s.compte.id)
    .first();
  if (!c) return erreur('introuvable', 404);
  if (corps.confirme !== true) return erreur('confirmation_requise');
  const r = await env.DB.prepare('INSERT INTO retractations (id, commande, compte, cree) VALUES (?, ?, ?, ?) ON CONFLICT(commande) DO NOTHING').bind(identifiant(), c.id, s.compte.id, now).run();
  const x = await env.DB.prepare('SELECT id, cree, etat FROM retractations WHERE commande = ?').bind(c.id).first();
  const accuse = `Votre déclaration de rétractation a été reçue le ${moment(x.cree)}. Contrat : ${c.libelle || c.produit}${c.numero ? `, facture ${ref(c)}` : ''}, commande ${c.id}. Référence : ${x.id}. L’atelier vous répond au sujet de ses suites.`;
  if (r.meta && r.meta.changes === 1) {
    await trace(env, s.compte.id, 'retractation', c.id, now);
    console.error(`[retractation] reçue pour la commande ${c.id}`);
    // the acknowledgement never depends on the mail: it is in the answer, and in the base
    try {
      if (s.compte.canal === 'mail' && env.COURRIEL_CODES !== 'ferme') await envoieCourriel(env, await dechiffre(env.CLE_NUMEROS, s.compte.numero_chiffre), { sujet: 'Belai’s Garden : votre rétractation est reçue', texte: `Bonjour,\r\n\r\n${accuse}\r\n\r\nBelai’s Garden` }, now);
    } catch (err) {
      console.error('[retractation] courriel', err);
    }
  }
  return json({ id: x.id, commande: c.id, recue: true, le: x.cree, etat: x.etat, accuse });
}

export async function retractations(req, env, now = Date.now()) {
  const s = await connecte(req, env, now);
  if (!s) return erreur('non_connecte', 401);
  const { results } = await env.DB.prepare('SELECT id, commande, cree, etat FROM retractations WHERE compte = ? ORDER BY cree DESC').bind(s.compte.id).all();
  return json({ retractations: results || [] });
}
