// mise-en-scene.js: the order in which the eye meets each screen (REGLES.md §1). An abrupt onset captures attention
// whatever else is on screen, so showing the parts of a screen one after the other makes the reading order the showing
// order: each part rises into place (12 px, expo-out; no blur, read as loading by the n2 army), parts of the same rank together, ranks
// RANK_MS apart; children of a list cascade STEP_MS apart; the one underlined word (.surligne) is traced after its line.
// A section plays when it enters the screen, once. Bouquets are never faded in (they are whole from the first frame).
//
// html.scene (set in the head before the first paint) holds every part in its waiting state; without JS, or with reduced
// motion, the class is never set and everything is simply there. Parts without data-tour get one from their place:
// the section's label and title first, then its lead, then each following block in document order.
//
//   window.SCENE.jouer(section)    plays a section (again)
//   window.SCENE.rejouer(element)  plays one block's parts again, e.g. the product card when the bouquet changes
(() => {
  'use strict';
  const RANK_MS = 220;
  const STEP_MS = 70;
  const LEAD_MS = 100;
  // the blocks that follow a section's head, each its own rank, in document order
  const BLOCKS = '.grille, .sens, .soli-grille, .bientot, .etapes, .trente, .essai-encart, .cycle-etats, .recevez, .film, .chiffres, .signature, .faq, .jardin-texte > .btn';
  const root = document.documentElement;
  const on = root.classList.contains('scene');

  // the parts of a section, with a rank each
  function parts(section) {
    if (!section.querySelector('[data-tour]')) {
      let r = 1;
      for (const el of section.querySelectorAll('.sur-titre, .titre')) el.dataset.tour = 1;
      for (const el of section.querySelectorAll('.chapo, .jardin-texte > p')) el.dataset.tour = r = 2;
      for (const el of section.querySelectorAll(BLOCKS)) if (!el.closest('[data-tour]')) el.dataset.tour = ++r;
    }
    return [...section.querySelectorAll('[data-tour]')];
  }

  function play(scope, delay = LEAD_MS) {
    const list = parts(scope);
    for (const el of list) {
      const rank = +el.dataset.tour || 1;
      const t = delay + (rank - 1) * RANK_MS;
      el.style.setProperty('--d', `${t}ms`);
      // lists cascade: each item a little after the one before
      const items = el.matches('ul, ol, dl') ? [...el.children] : el.matches('.grille, .portes') ? [...el.children] : [];
      items.forEach((it, i) => it.style.setProperty('--d', `${t + i * STEP_MS}ms`));
      el.classList.remove('vu');
      void el.offsetWidth; // restart the transition when played again
      el.classList.add('vu');
      for (const w of el.querySelectorAll('.surligne')) {
        w.style.setProperty('--d', `${t + 500}ms`);
        w.classList.add('trace');
      }
    }
    const last = list.reduce((m, el) => Math.max(m, +el.dataset.tour || 1), 1);
    return delay + (last - 1) * RANK_MS + 550;
  }

  const SCENE = {
    jouer: (section) => play(section),
    rejouer(el) {
      if (!on) return;
      for (const x of el.querySelectorAll('[data-tour]')) x.classList.remove('vu');
      requestAnimationFrame(() => play(el, 60));
    },
  };
  window.SCENE = SCENE;
  if (!on) return;

  const sections = [...document.querySelectorAll('main > section')];
  // the first screen plays at once; the others when their top passes the lower quarter of the screen (a threshold on the
  // section's own height would never be reached by a section taller than the screen)
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const ms = play(e.target);
        setTimeout(() => (e.target.dataset.joue = '1'), ms);
      }
    },
    { rootMargin: '0px 0px -25% 0px', threshold: 0 },
  );
  for (const s of sections) io.observe(s);
})();
