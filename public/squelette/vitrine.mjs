// vitrine.mjs: the showcase (reglages.mjs). Loaded by every page: a banner says the shop opens soon and its prices are
// indicative; what buys, signs in, gives or installs stays in sight, marked « bientôt », and does nothing; the forms that would take
// something from the visitor are closed. The modules that could reach a server refuse on their own too (noyau.mjs, connexion.mjs,
// ecrire.mjs, abeille.mjs): nothing here is asked of the network.
import { VITRINE } from './reglages.mjs';

// what waits, in the pages as they are and as the modules write them
const ACTIONS = '[data-bouchon="achat"], [data-bouchon="launcher"], [data-bouchon="deconnexion"], [data-bouchon="garder"], [data-bouchon="communaute"], [data-bouchon="film"], .ajout-prix, #v-panier, #f-panier, #c-acheter, #merci-envoyer, #vocal-rec, #groupe [type="submit"], #demande [type="submit"], #rappel-ok, #retrouver [type="submit"], #recu-form [type="submit"], [data-bientot]';
// the forms and the gift's settings: every field of theirs is closed (the search of the flowers, the bee's talk and the try-on stay)
const CHAMPS = '#groupe, #carte, #demande, #rappel, #recu-form, #retrouver, .ecrire-form, .pro, #cadeau, #plusieurs, .merci, #code-form label';
const MESSAGE = 'Bientôt : rien ne se vend et rien ne s’envoie encore depuis ce site.';

const pastille = (mot = 'bientôt') => Object.assign(document.createElement('span'), { className: 'bientot-mot', textContent: mot });

function ferme() {
  for (const el of document.querySelectorAll(ACTIONS)) {
    if (el.getAttribute('aria-disabled') !== 'true') el.setAttribute('aria-disabled', 'true');
    const tuile = el.classList.contains('ajout-prix');
    if (!el.querySelector('.bientot-mot')) (tuile ? el : el.querySelector('span:not(.btn-prix)')?.parentElement || el).append(pastille(tuile ? 'indicatif' : undefined));
  }
  for (const el of document.querySelectorAll(CHAMPS)) {
    for (const x of el.querySelectorAll('input, textarea, select, button')) {
      if (x.closest('form[method="dialog"]') || x.matches('#ouvrir')) continue;
      if (!x.disabled) x.disabled = true;
    }
    if (el.matches('form, #cadeau, #plusieurs') && !el.querySelector('.vitrine-note')) {
      const p = Object.assign(document.createElement('p'), { className: 'cadeau-note vitrine-note', textContent: 'Bientôt : ce formulaire n’envoie rien encore.' });
      el.prepend(p);
    }
  }
  // the price one reads, where one would buy
  for (const el of document.querySelectorAll('.actions')) {
    if (!el.querySelector('.btn-prix') || el.querySelector('.prix-indicatif')) continue;
    el.append(Object.assign(document.createElement('p'), { className: 'cadeau-note prix-indicatif', textContent: 'Prix indicatif, à venir.' }));
  }
  const vente = document.querySelector('.faits > li [data-fin]');
  if (vente) vente.closest('li').replaceChildren('Ouverture des ventes : bientôt.');
}

function dit() {
  const d = document.getElementById('bouchon');
  const t = document.getElementById('bouchon-texte');
  if (!d || !t || d.open) return;
  t.textContent = MESSAGE;
  d.showModal();
}

if (VITRINE) {
  document.documentElement.classList.add('est-vitrine');
  // before any listener of the pages
  addEventListener(
    'click',
    (ev) => {
      const el = ev.target.closest?.(ACTIONS);
      if (!el) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      dit();
    },
    true,
  );
  addEventListener(
    'submit',
    (ev) => {
      const f = ev.target;
      if (f.method === 'dialog' || f.matches('.abeille-form, #code-form')) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      dit();
    },
    true,
  );
  const pose = () => {
    const recu = document.body.classList.contains('page-recu');
    const compte = !!document.getElementById('rappel');
    const b = document.createElement('p');
    b.className = 'vitrine-bandeau';
    b.setAttribute('role', 'note');
    b.textContent = recu ? 'Démonstration : les cadeaux ouvrent bientôt.' : compte ? 'Compte de démonstration : « Mes fleurs » ouvre bientôt.' : 'Ouverture bientôt : le site se visite, rien ne s’y vend encore. Les prix sont indicatifs.';
    document.body.prepend(b);
    ferme();
    // what the modules write later
    let prevu = false;
    new MutationObserver(() => {
      if (prevu) return;
      prevu = true;
      requestAnimationFrame(() => ((prevu = false), ferme()));
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pose, { once: true });
  else pose();
}
