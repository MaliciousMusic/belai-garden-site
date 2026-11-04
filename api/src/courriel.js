// courriel.js: sends an account's code by e-mail (owner, 2026-11-02: the account is validated « par mail ou numéro de
// téléphone »). Two senders (env.COURRIEL_CODES): "faux" writes it to the console (local work, tests: the code is read
// there), "cloudflare" sends it through Cloudflare itself (owner, 2026-11-01: no other mail service), with the send_email
// binding env.CODES and the sender env.EXPEDITEUR_CODES, an address of the shop's domain.
// Email Routing's own binding only reaches the addresses verified in it: to write to any visitor the domain needs
// Cloudflare's Email Sending, a question for the owner (README, Le compte par e-mail).

const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const enTete = (s) => `=?UTF-8?B?${b64(s)}?=`;
const lignes76 = (s) => s.replace(/.{76}/g, '$&\r\n');

// the mail itself: plain text, UTF-8, the code in the subject too (read on a phone's lock screen)
export function courrierCode({ de, a, sujet, texte, now, id }) {
  return [
    `From: ${enTete('Belai’s Garden')} <${de}>`,
    `To: <${a}>`,
    `Subject: ${enTete(sujet)}`,
    `Date: ${new Date(now).toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${id}@${de.split('@')[1]}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    lignes76(b64(texte)),
  ].join('\r\n');
}

export async function envoieCourriel(env, a, { sujet, texte }, now = Date.now()) {
  // (no sender set is an error, never the simulated one: compte.js lets "faux" work on the developer's machine only)
  if (env.COURRIEL_CODES === 'faux') {
    console.log(`[courriel faux] à ${a} : ${sujet}`);
    // the tests read the last mail here
    if (env.__mails) env.__mails.push({ a, sujet, texte });
    return { ok: true, faux: true };
  }
  if (env.COURRIEL_CODES === 'cloudflare') {
    if (!env.CODES || !env.EXPEDITEUR_CODES) throw new Error('Courriel : CODES ou EXPEDITEUR_CODES manquant');
    // (the tests give their own EmailMessage: cloudflare:email exists only in a Worker)
    const EmailMessage = env.__EmailMessage || (await import('cloudflare:email')).EmailMessage;
    const de = env.EXPEDITEUR_CODES;
    const id = [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x.toString(16).padStart(2, '0')).join('');
    await env.CODES.send(new EmailMessage(de, a, courrierCode({ de, a, sujet, texte, now, id })));
    return { ok: true };
  }
  throw new Error(`Courriel : expéditeur inconnu « ${env.COURRIEL_CODES} »`);
}
