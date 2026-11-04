// ecrire.mjs: « Nous écrire » (owner, 2026-11-01): every link to the shop's address opens a window of the site's own
// instead of the visitor's mail application; the message goes to the server (api/src/message.js) with an e-mail address
// or a phone number to be answered at. Without JavaScript the link stays a plain mailto. If the server cannot be reached,
// the window says so and gives the address.
import { langue } from './traduction.mjs';

// the server: the same domain once online (belai.garden/api), wrangler dev on the developer's machine
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
export const API = LOCAL ? 'http://127.0.0.1:8790/api' : '/api';
const ADRESSE = 'lonjaret.hadrien@proton.me';

let boite = null;
function construit() {
  boite = document.createElement('dialog');
  boite.className = 'ecrire';
  boite.setAttribute('aria-labelledby', 'ecrire-titre');
  boite.innerHTML = `<form class="ecrire-form" novalidate>
      <h2 id="ecrire-titre">Nous écrire</h2>
      <p class="ecrire-delai">Réponse en 30 minutes environ, de 10 h à 23 h (heure de Paris), 7 jours sur 7.</p>
      <label class="ecrire-champ">Votre message<textarea id="ecrire-texte" rows="5" maxlength="2000" required></textarea></label>
      <fieldset class="ecrire-par">
        <legend>Pour vous répondre</legend>
        <div class="ecrire-choix" role="radiogroup" aria-label="Pour vous répondre">
          <button type="button" role="radio" aria-checked="true" data-par="mail">Par e-mail</button><button type="button" role="radio" aria-checked="false" data-par="tel">Par téléphone</button>
        </div>
        <label class="ecrire-champ"><span id="ecrire-contact-mot">Votre e-mail</span><input id="ecrire-contact" type="email" autocomplete="email" inputmode="email" maxlength="254" required></label>
      </fieldset>
      <label class="ecrire-pot" aria-hidden="true">Site<input name="site" tabindex="-1" autocomplete="off"></label>
      <button type="submit" class="btn btn-achat ecrire-envoyer">Envoyer</button>
      <p class="ecrire-etat" role="status" aria-live="polite"></p>
      <p class="ecrire-note">Votre adresse ou votre numéro sert seulement à vous répondre. <a href="legal.html#privacy">Confidentialité</a></p>
    </form>
    <form method="dialog"><button class="ecrire-fermer" aria-label="Fermer">×</button></form>`;
  document.body.append(boite);
  const form = boite.querySelector('.ecrire-form');
  const champ = boite.querySelector('#ecrire-contact');
  const etat = boite.querySelector('.ecrire-etat');
  const envoyer = boite.querySelector('.ecrire-envoyer');
  let par = 'mail';
  // by e-mail or by phone: the field becomes the one its way asks for (the keyboard on a phone too)
  for (const b of boite.querySelectorAll('[data-par]'))
    b.addEventListener('click', () => {
      par = b.dataset.par;
      for (const x of boite.querySelectorAll('[data-par]')) x.setAttribute('aria-checked', String(x === b));
      Object.assign(champ, par === 'mail' ? { type: 'email', autocomplete: 'email', inputMode: 'email' } : { type: 'tel', autocomplete: 'tel', inputMode: 'tel' });
      boite.querySelector('#ecrire-contact-mot').textContent = par === 'mail' ? 'Votre e-mail' : 'Votre téléphone';
      champ.focus();
    });
  const dit = (texte, lien = false) => {
    etat.textContent = texte;
    if (lien) etat.insertAdjacentHTML('beforeend', ` <a href="mailto:${ADRESSE}">${ADRESSE}</a>`);
  };
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const texte = boite.querySelector('#ecrire-texte').value.trim();
    const contact = champ.value.trim();
    if (texte.length < 2) return void (dit('Écrivez votre message.'), boite.querySelector('#ecrire-texte').focus());
    if (par === 'mail' ? !/^\S+@\S+\.\S{2,}$/.test(contact) : contact.replace(/\D/g, '').length < 8)
      return void (dit(par === 'mail' ? 'Cette adresse e-mail ne semble pas complète.' : 'Ce numéro ne semble pas complet.'), champ.focus());
    envoyer.disabled = true;
    dit('Envoi…');
    try {
      const r = await fetch(`${API}/message`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texte, contact, page: location.pathname + location.search, langue, site: form.elements.site.value }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        form.reset();
        dit(par === 'mail' ? 'Merci, c’est envoyé. Nous vous répondons par e-mail.' : 'Merci, c’est envoyé. Nous vous rappelons ou vous écrivons à ce numéro.');
      } else if (j.erreur === 'contact') dit(par === 'mail' ? 'Cette adresse e-mail ne semble pas valide.' : 'Ce numéro ne semble pas valide.');
      else if (j.erreur === 'trop') dit('Beaucoup de messages d’un coup : réessayez dans un moment.');
      else dit('Le message n’est pas parti. Réessayez, ou écrivez-nous à', true);
    } catch (_) {
      dit('Le message n’est pas parti. Réessayez, ou écrivez-nous à', true);
    }
    envoyer.disabled = false;
  });
}

// (texte: a message already written, the bee's question it could not answer)
export function ouvreEcrire(texte = '') {
  if (!boite) construit();
  boite.querySelector('.ecrire-etat').textContent = '';
  if (texte) boite.querySelector('#ecrire-texte').value = texte;
  boite.showModal();
  boite.querySelector('#ecrire-texte').focus();
}
// the shop's address links, wherever they are (footers, the seller's line); the window's own fallback link stays a mailto
document.addEventListener('click', (e) => {
  const a = e.target.closest?.(`a[href^="mailto:${ADRESSE}"]`);
  if (!a || a.closest('.ecrire') || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  ouvreEcrire();
});
