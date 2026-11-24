// journal.js: what was done, by whom and when (an account's identifier, « atelier », « stripe », « menage »; an object's identifier).
// Never a name, a number, an address, a code or a card. A line that cannot be written never stops what it tells.
export async function trace(env, acteur, action, objet = null, now = Date.now()) {
  try {
    await env.DB.prepare('INSERT INTO journal (cree, acteur, action, objet) VALUES (?, ?, ?, ?)').bind(now, acteur, action, objet).run();
  } catch (err) {
    console.error('[journal]', err);
  }
}
