// vie.mjs: the shop's bee (owner, 2026-11-02: « l'abeille roam around et se pose ici et là »; the swallowtail is gone). One
// honeybee of insectes/runtime, drawn by the swarm on a fixed canvas over the page (and one under the product's bouquet for
// a while it is behind it: zCuts, depth 0 is the page's plane). It never leaves by itself: it goes from one word of the
// page to another (the cards' names, the titles, the buttons), stays a few seconds on each, and goes where the page asks:
//   - the middle of the screen, to welcome the visitor (abeille.mjs speaks beside it);
//   - beside the talk's window while the visitor talks with it;
//   - the try-on's words, as its guide (window.VIE.guide, essai.mjs).
// A touch on it is not a poke any more: it tells the page (« abeille:clic »), which opens the talk.
// Never with reduced motion or ?insectes=0 (the page then shows a still bee to touch instead); the loop holds while the tab
// is hidden.
// Where it lands (owner, 2026-11-02: « jamais de dos », « à des endroits cohérents »; 2026-11-03: « se pose dans le
// header »): on the header's things (the shop's name, its links and buttons); a page without a header, on the flower heads
// (Eclosion marks them data-t="tete"), else the titles. Never in the air, and always seen from the front, three quarters or
// the side, never from behind. Always in front of everything (one canvas, the highest layer).

const OFF = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('insectes') === '0';
// switched off by the visitor (the header's bee button, abeille.mjs): nothing of the swarm is fetched until it is switched on
const ETEINTE = 'bzzou-eteinte';
const eteinte = () => {
  try {
    return localStorage.getItem(ETEINTE) === '1';
  } catch (_) {
    return false;
  }
};
const BASE = new URL('../insectes/', import.meta.url).href;
const narrow = () => matchMedia('(max-width: 900px)').matches;

// where the bee lands while it roams (owner, 2026-11-03: « se pose dans le header »): the header's own things, the shop's
// name, its links and buttons, always in view; the flowers' heads and the titles only when the page has no header
const TETES = '.bq-piece[data-t="tete"]';
const MOTS = '.tuile-nom, .titre, .nom, .soli b, .fiche .nom';
const ENTETE = '.tete .marque, .tete .nav a, .tete-droite > a, .tete-droite > button, .tete-droite > details > summary';
const REPLI = '.marque';
// its size: as on the page while it roams, in the foreground while it welcomes (owner, 2026-11-03: « en assez gros, genre
// premier plan »)
const TAILLE = () => (narrow() ? 40 : 54);
const TAILLE_ACCUEIL = () => (narrow() ? 80 : 108);
// sitting, its feet are this many body lengths under its middle (the welcome sets it on its card's rim)
const PIEDS = 0.28;
// how much of its heading must turn toward the viewer (z, toward the screen's front): never seen from behind
const FACE_VOL = 0.2;
const FACE_POSE = 0.5;
const LANDED = new Set(['land', 'forage', 'hover']);

let seed = (Date.now() % 100000) + 20261102;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

async function start() {
  // the runtime and its atlas come only now, after the page has settled (nothing of them before the first paint)
  const [{ Essaim }, { Abeille }] = await Promise.all([import('../insectes/runtime/essaim.mjs'), import('../insectes/runtime/abeille.mjs')]);
  // one canvas, in front of everything on the page (owner, 2026-11-03: « devant TOUT le reste »); no layer behind the
  // product's bouquet any more
  const front = document.createElement('canvas');
  front.className = 'vie vie-devant';
  front.setAttribute('aria-hidden', 'true');
  document.body.append(front);
  const essaim = await Essaim.create({ layers: [front], zCuts: [] });
  // only its large level (152 px cells): the bee is always shown larger than the small one's 64 px, which made it blurry
  await essaim.kind('abeille', `${BASE}abeille/atlas/abeille`, 12.5, ['L']);

  // its flowers: the page's words while it roams, or the one place the page asks for
  const fleurs = [];
  // large enough to be seen at once and touched (owner: a guide, « humble clippy »)
  const abeille = new Abeille(essaim, fleurs, rnd, { lengthPx: TAILLE(), maxVisible: 1 });
  let taille = TAILLE(); // the size it grows or shrinks to, smoothly
  // it never leaves by itself: where it would leave, it hops to another word (unless the page sends it away)
  const partir = abeille.leave.bind(abeille);
  abeille.leave = (fast) => {
    if (abeille.envol || !fleurs.length) return partir(fast);
    if (abeille.pickFlower()) return abeille.goFlower();
    // no other place free (only the shop's name in view, say): back to the one it is on, or away if it has none
    const ici = abeille.flower;
    if (!ici || ici.busy !== abeille) return partir(fast);
    ici.busy = null;
    abeille.flower = null;
    abeille.goFlower();
  };
  abeille.t = Infinity;
  essaim.add(abeille);

  // ---------- the places in view, as flowers: a point on a flower head's face, or on the top of a title's first line, kept
  // while the bee sits there
  const spots = new Map();
  const surMots = [];
  let scrolled = 0;
  let placedAt = -Infinity;
  let moved = true;
  let entete = [];
  let tetes = [];
  let mots = [];
  let repli = null;
  addEventListener('scroll', () => ((scrolled = performance.now()), (moved = true)), { passive: true });
  addEventListener('resize', () => (moved = true));
  // on a header's thing: its upper right corner, as a bee on the rim of a button (the word stays readable)
  const coin = (r) => [r.right - Math.min(10, r.width * 0.2), r.top + 3];
  // where on the element it lands (page px), or null when it cannot be seen or touched
  const pointDe = (el, tete) => {
    if (el.closest('dialog, [hidden], .abeille-chat')) return null;
    if (tete) {
      const box = el.closest('.bq-pose');
      if (!box || box.style.visibility === 'hidden') return null;
      const r = el.getBoundingClientRect();
      if (r.width < 14 || r.height < 14) return null;
      return [r.left + r.width * 0.5, r.top + r.height * 0.32];
    }
    const rg = document.createRange();
    rg.selectNodeContents(el);
    // the first line whole (a range gives it in pieces: a calligraphic title comes in fragments of 17 px)
    const rs = [...rg.getClientRects()].filter((q) => q.width > 0);
    const un = rs.filter((q) => Math.abs(q.top - rs[0]?.top) < 3);
    const line = un.length && { left: Math.min(...un.map((q) => q.left)), top: un[0].top, height: un[0].height, width: Math.max(...un.map((q) => q.right)) - Math.min(...un.map((q) => q.left)) };
    if (line && line.width >= 24) return [line.left + Math.min(line.width * 0.5, 40), line.top - line.height * 0.1];
    // a word drawn rather than written (the shop's name in the header): on its upper part
    const r = el.getBoundingClientRect();
    if (r.width < 24) return null;
    return [r.left + Math.min(r.width * 0.5, 40), r.top + r.height * 0.35];
  };
  const spotDe = (el, x, y) => {
    let f = spots.get(el);
    if (!f) {
      f = { P: [0, 0, 6], r: 8, layer: 0, busy: null, el };
      spots.set(el, f);
    }
    const P = essaim.unproject(x, y, 6);
    const d = [P[0] - f.P[0], P[1] - f.P[1]];
    f.P = P;
    // a bee sitting there goes with it when the page scrolls or the flower sways
    const b = f.busy;
    if (b && LANDED.has(b.state)) for (const k of ['P', 'landAt', 'walkTo', 'hoverAt', 'from']) if (b[k]) b[k] = [b[k][0] + d[0], b[k][1] + d[1], b[k][2]];
    return f;
  };
  const placeMots = (now) => {
    if (!moved && now - placedAt < 300) return;
    if (now - placedAt >= 500) {
      entete = [...document.querySelectorAll(ENTETE)];
      tetes = entete.length ? [] : [...document.querySelectorAll(TETES)];
      mots = entete.length ? [] : [...document.querySelectorAll(MOTS)];
      repli = document.querySelector(REPLI);
    }
    moved = false;
    placedAt = now;
    const calme = performance.now() - scrolled > 600 && !document.querySelector('dialog[open]');
    const dedans = (x, y) => y > 90 && y < innerHeight - 90 && x > 20 && x < innerWidth - 20;
    const vus = (els, tete) => {
      const seen = [];
      for (const el of els) {
        const at = pointDe(el, tete);
        if (!at) continue;
        const f = spotDe(el, at[0], at[1]);
        if (f.busy || (calme && dedans(at[0], at[1]))) seen.push(f);
      }
      return seen;
    };
    // the header's things: on their upper part, whatever the scroll (the header stays)
    let seen = [];
    for (const el of entete) {
      const r = el.getBoundingClientRect();
      if (r.width < 16 || r.bottom < 8 || r.right < 0 || r.left > innerWidth) continue;
      seen.push(spotDe(el, ...coin(r)));
    }
    if (!seen.length) seen = vus(tetes, true);
    if (!seen.length) seen = vus(mots, false);
    // none in view: the shop's name, in the header that never leaves the screen
    if (!seen.length && repli) {
      const at = pointDe(repli, false);
      if (at) seen = [spotDe(repli, at[0], at[1])];
    }
    surMots.splice(0, surMots.length, ...seen);
  };

  // ---------- what the page asks: roam (the words), or one place (the middle, beside the talk, the try-on's words)
  let mode = 'promene';
  let arrive = null; // resolves when the bee sits on the place asked for
  const ici = (x, y) => ({ P: essaim.unproject(x, y, 6), r: 8, layer: 0, busy: null });
  let suivi = null; // the welcome's card, whose rim the bee sits on, followed at every frame
  const rebord = (el) => {
    const r = el.getBoundingClientRect();
    return spotDe(el, r.left + r.width * 0.5, r.top - TAILLE_ACCUEIL() * PIEDS);
  };
  const vers = (f) => {
    suivi = null;
    mode = 'ici';
    fleurs.splice(0, fleurs.length, f);
    abeille.envol = false;
    if (!abeille.visible) abeille.spawn();
    else if (abeille.flower !== f) {
      // off its word at once, to the place
      if (abeille.state === 'forage' || abeille.state === 'hover' || abeille.state === 'land') abeille.t = 0;
      else abeille.goFlower();
    }
    return new Promise((res) => (arrive = res));
  };
  const promene = () => {
    taille = TAILLE();
    suivi = null;
    mode = 'promene';
    arrive = null;
    moved = true;
    if (abeille.state === 'forage') abeille.t = 1 + rnd() * 2;
  };

  let etat = abeille.state;
  let last = performance.now();
  let asleep = false;
  let stopped = false;
  let endormie = false; // switched off by the visitor: no frame, no canvas, no touch
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  calm.addEventListener?.('change', () => {
    if (!calm.matches) return;
    stopped = true;
    front.remove();
    document.dispatchEvent(new CustomEvent('abeille:calme'));
  });
  const wake = () => {
    if (!asleep || stopped || document.hidden) return;
    asleep = false;
    last = performance.now();
    requestAnimationFrame(frame);
  };
  document.addEventListener('visibilitychange', () => !document.hidden && wake());
  // one step: where the bee may land, its flight, its landings, the drawing
  const frameUnique = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (mode === 'promene') {
      placeMots(now);
      // the places in view are its flowers (while the page scrolls it keeps the one it sits on)
      if (surMots.length) fleurs.splice(0, fleurs.length, ...surMots);
      // the flower it sits on, followed at every frame (it sways)
      const f = abeille.flower;
      if (f?.el && LANDED.has(abeille.state)) {
        if (f.el.matches(ENTETE)) {
          const r = f.el.getBoundingClientRect();
          spotDe(f.el, ...coin(r));
        } else {
          const at = pointDe(f.el, f.el.matches(TETES));
          if (at) spotDe(f.el, at[0], at[1]);
        }
      }
    }
    if (mode === 'ici' && suivi) rebord(suivi);
    // its size, eased toward the one asked for
    if (Math.abs(abeille.lengthPx - taille) > 0.3) abeille.lengthPx += (taille - abeille.lengthPx) * Math.min(1, dt * 2.5);
    abeille.update(dt);
    // landed, it sits still in its resting pose: the large level has no foraging or walking cells
    if (abeille.state === 'forage') {
      abeille.pose = 'pose';
      abeille.frame = 0;
    }
    // never seen from behind: its heading keeps a part toward the viewer, more when it sits
    {
      const fw = abeille.fwd;
      const z = LANDED.has(abeille.state) ? FACE_POSE : FACE_VOL;
      if (fw && fw[2] < z) {
        const h = Math.hypot(fw[0], fw[1]);
        const k = Math.sqrt(1 - z * z) / (h || 1);
        abeille.fwd = h > 1e-3 ? [fw[0] * k, fw[1] * k, z] : [Math.sqrt(1 - z * z), 0, z];
      }
    }
    // a new landing: a few seconds on a word while it roams; on the place asked for, it stays
    if (abeille.state === 'forage' && etat !== 'forage') {
      if (mode === 'ici') {
        abeille.t = Infinity;
        arrive?.();
        arrive = null;
      } else abeille.t = 5 + rnd() * 8;
    }
    etat = abeille.state;
    // away (at first, or after the page sent it off): it comes back, at once to a place asked for, soon to roam
    if (abeille.state === 'away' && !abeille.envol && !Number.isFinite(abeille.t)) abeille.t = mode === 'ici' ? 0 : 1.5;
    essaim.render();
  };
  const frame = (now) => {
    if (document.hidden || stopped || endormie) return void (asleep = true);
    frameUnique(now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // for checks: one step of the loop by hand (a hidden pane gets no animation frames)
  window.__vie = { essaim, abeille, fleurs, pas: (ms = 1000 / 60) => frameUnique(last + ms) };
  addEventListener('resize', () => essaim.resize());
  // A round zone around the bee, wings included: a touch in it is the bee's, never the card or the link under its body
  // (owner, 2026-11-02: « une hit box ronde qui empêche les missclick à travers son corps »).
  const surAbeille = (x, y) => {
    const s = !endormie && abeille.visible && abeille.screen;
    return !!s && Math.hypot(s.x - x, s.y - y) < Math.max(26, abeille.lengthPx * 0.8);
  };
  // a touch on the bee: the page opens the talk (it does not flee any more); the press, its release and its click stop here
  let pris = 0;
  const garde = (ev) => {
    if (now() - pris > 800) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.type === 'click') pris = 0;
  };
  document.addEventListener(
    'pointerdown',
    (ev) => {
      if (!surAbeille(ev.clientX, ev.clientY)) return;
      pris = now();
      ev.preventDefault();
      ev.stopPropagation();
      document.dispatchEvent(new CustomEvent('abeille:clic'));
    },
    { capture: true },
  );
  for (const t of ['mousedown', 'pointerup', 'mouseup', 'click']) document.addEventListener(t, garde, { capture: true });
  // the hand shows the bee can be touched
  let survol = 0;
  addEventListener(
    'pointermove',
    (ev) => {
      if (now() - survol < 80) return;
      survol = now();
      document.documentElement.classList.toggle('sur-abeille', surAbeille(ev.clientX, ev.clientY));
    },
    { passive: true },
  );

  return {
    // switched off and on by the visitor
    dort() {
      endormie = true;
      front.style.display = 'none';
      document.documentElement.classList.remove('sur-abeille');
    },
    reveille() {
      if (!endormie) return;
      endormie = false;
      front.style.display = '';
      wake();
    },
    // where the bee is on the screen (its body's middle), or null while it is away
    ecran() {
      if (endormie || !abeille.visible) return null;
      const p = essaim.project(abeille.P);
      return [p.x, p.y];
    },
    taille: () => abeille.lengthPx,
    // the welcome: in the foreground, sitting in the middle of its card's upper rim; resolves when it sits there
    tailleAccueil: TAILLE_ACCUEIL,
    accueil(carte) {
      taille = TAILLE_ACCUEIL();
      const arrivee = vers(rebord(carte));
      suivi = carte;
      return arrivee;
    },
    // to a page point (beside the talk's window); resolves when it sits there
    perche: (x, y) => vers(ici(x, y)),
    promene,
    // The guide: from behind the bouquet (from) to the try-on's words (to); while a modal dialog holds them, the front
    // canvas goes into it (the top layer) and comes back when it closes, and the bee roams again
    async guide(to, from, dialog) {
      const t = to.getBoundingClientRect();
      if (dialog) {
        dialog.append(front);
        dialog.addEventListener(
          'close',
          () => {
            document.body.append(front);
            promene();
          },
          { once: true },
        );
      }
      const r = (from || to).getBoundingClientRect();
      if (!abeille.visible) {
        abeille.P = essaim.unproject(r.left + r.width * 0.5, r.top + r.height * 0.42, -320);
        abeille.V = [0, -30, 80];
      }
      vers(ici(t.left + 24, t.top + 4));
    },
  };
}
const now = () => performance.now();

if (!OFF) {
  let swarm = null;
  const go = () => (swarm ||= start().catch((err) => (console.error('[vie]', err), null)));
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 800));
  const loaded = new Promise((res) => (document.readyState === 'complete' ? res() : addEventListener('load', res, { once: true })));
  // the bee comes once the page has settled, unless the visitor switched it off
  if (!eteinte()) loaded.then(() => idle(go));
  window.VIE = {
    // the swarm, fetched now if it is not there yet
    get ready() {
      return go();
    },
    // the header's button: off (kept in this browser), or on again (fetched then if it never came)
    async allume(on) {
      try {
        on ? localStorage.removeItem(ETEINTE) : localStorage.setItem(ETEINTE, '1');
      } catch (_) {}
      if (on) (await go())?.reveille();
      else if (swarm) (await swarm)?.dort();
    },
    get eteinte() {
      return eteinte();
    },
    async guide(...a) {
      (await this.ready)?.guide(...a);
    },
  };
}
