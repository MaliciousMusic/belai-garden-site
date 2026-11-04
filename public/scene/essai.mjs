// essai.mjs: "Try on your desktop" (owner, 2026-10-28, in place of the device demo): the page seems to vanish and show the
// visitor's own desktop, the bouquet framed on it, a honeybee giving each step in a bubble as soon as the last is done.
// A page cannot see through itself, so the desktop is a picture of it, taken once:
//   - a computer: the visitor shares their entire screen (getDisplayMedia), minimises the browser for a moment, and the
//     screen is grabbed while the page is hidden: their bare desktop, taskbar and icons as they are. The sharing stops at
//     once; the picture never leaves the page (no upload). Back on the page, one click brings it full screen (the
//     Fullscreen API): the picture fills the screen pixel for pixel, the page is gone, the bouquet stands on the desktop;
//   - a phone (no screen sharing there): the visitor takes a screenshot of their home screen and picks it;
//   - a Windows computer (owner, 2026-10-29: no detour by the screen any more): Belai Bureau sets the bouquet on the real
//     desktop itself, opened by a belai://essai link on the very click (essai.rs, in bureau/); the bee says what happens,
//     and gives the installer when nothing opened.
// Then, in its frame (as Belai Bureau places it): drag it, pull a corner, ✓. It sways in the breeze (its close-up sprites,
// sprites.mjs, each piece turning about its joint as on the frieze). Escape, the ✕ or leaving full screen close it.
//
//   import('./essai.mjs').then((m) => m.ouvrir(api))
//     api: { T, I18N, index: () => Promise<sprites index>, base, ouvert, nom, evite: () => DOMRect | null, focusBack }
//     optional (the shop skeleton, owner 2026-10-31: no raster bouquet anywhere):
//       svg: { vb: () => Promise<[x, y, w, h]>, poser: (el) => Promise<pose> } puts the live SVG bouquet (Eclosion.pose) in the
//       frame instead of the close-up sprites; racine: the path to the site's root for telechargements/
//     optional (the skeleton's « Essayer » in its header, owner 2026-10-31): partage: true goes straight to the screen's
//       sharing and the minimise and reopen (no Belai Bureau); bouquets: [{ nom, svg }] (svg as above) and indice: the
//       one shown first: two small arrows on the frame's sides go through them, the frame keeping its height and centre
//   m.fermer()

const BASE = new URL('../insectes/', import.meta.url).href;
const V = new URL(import.meta.url).search;
const AHEAD = 60000; // the breeze's common head start (frise.js)
const BEE_PXMM = 3; // the guide's scale: a honeybee 37 px long
const $ = (s, el = document) => el.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));

let run = null; // the open try: { root, stop() }

export function fermer() {
  if (run) run.stop();
}

export async function ouvrir(api) {
  if (run) return;
  const T = api.T.essai;
  const PHONE = !(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) || matchMedia('(pointer: coarse) and (max-width: 899px)').matches;
  // Windows: Belai Bureau, opened on the very click (an app is launched only from a click), the bouquet's file named in
  // the link (only the shop's addresses are read by the app)
  const B = api.I18N.bureau || {};
  const BUREAU = !api.partage && !PHONE && /Windows/.test(navigator.userAgent) && !!B.installer && !!api.ouvert;
  const lien = () => `belai://essai?u=${encodeURIComponent(api.ouvert)}&n=${encodeURIComponent(api.nom || '')}`;
  if (BUREAU) location.href = lien();
  // another computer: the browser's sharing picker opens on the very click of "Try on your desktop" (owner, 2026-10-28: one
  // button rather than steps before it; the picker itself no page can skip), its "Entire screen" chosen beforehand
  let firstAsk = PHONE || BUREAU ? null : askScreen();
  if (firstAsk) firstAsk.catch(() => {}); // (declined before it is awaited: no unhandled rejection)
  // the system's "show the desktop" shortcut, pressed twice: every window out of the way (not only the browser: owner's try,
  // a window under it was taken for the desktop), then back as they were. No page can minimise or restore its window.
  const OS = /Win/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '') ? 'win' : /Mac/i.test(navigator.platform || '') ? 'mac' : '';

  // ---------- the layer over the page: the bee and its bubble first; later the desktop's picture and the framed bouquet
  const root = document.createElement('div');
  root.className = 'essai';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', T.titre);
  root.innerHTML = `
    <img class="essai-bureau" alt="" hidden>
    <div class="essai-pose" hidden>
      <canvas class="essai-bouquet"></canvas>
      <div class="essai-cadre">
        <span class="essai-coin" data-coin="nw"></span><span class="essai-coin" data-coin="ne"></span>
        <span class="essai-coin" data-coin="sw"></span><span class="essai-coin" data-coin="se"></span>
        <button class="essai-ok" type="button" aria-label="${T.valider}">✓</button>
        ${api.bouquets && api.bouquets.length > 1 ? `<button class="essai-fleche essai-prec" type="button" aria-label="Bouquet précédent"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6l-6 6 6 6"/></svg></button><button class="essai-fleche essai-suiv" type="button" aria-label="Bouquet suivant"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 6l6 6-6 6"/></svg></button>` : ''}
      </div>
    </div>
    <div class="essai-invite" aria-hidden="true" hidden></div>
    <div class="essai-anneau" aria-hidden="true" hidden><svg viewBox="0 0 40 40"><circle class="fond" cx="20" cy="20" r="16"/><circle class="plein" cx="20" cy="20" r="16" pathLength="100"/></svg></div>
    <div class="essai-bulle" role="status" aria-live="polite"><p class="essai-texte"></p><div class="essai-actions"></div></div>
    <button class="essai-fermer" type="button" aria-label="${T.fermer}">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17"/></svg>
    </button>`;
  document.body.append(root);
  const img = $('.essai-bureau', root);
  const pose = $('.essai-pose', root);
  const canvas = $('.essai-bouquet', root);
  const cadre = $('.essai-cadre', root);
  const bulle = $('.essai-bulle', root);
  const texte = $('.essai-texte', root);
  const actions = $('.essai-actions', root);
  const invite = $('.essai-invite', root);
  const anneau = $('.essai-anneau', root);
  // the long press (as Belai Bureau's, maintien.rs: 6 s, the ring from 0.5 s, 12 px of drift at most): set before the loop reads it
  const HOLD = { duree: 6000, retard: 500, derive: 12 };
  let hold = null; // { id, x, y, t0 }
  const plein = anneau.querySelector('.plein');

  let stream = null;
  let shotUrl = null;
  let closed = false;
  let raf = 0;
  const offs = [];
  const on = (el, ev, fn, o) => {
    el.addEventListener(ev, fn, o);
    offs.push(() => el.removeEventListener(ev, fn, o));
  };
  const stopStream = () => {
    if (stream) for (const t of stream.getTracks()) t.stop();
    stream = null;
  };
  run = {
    root,
    stop() {
      if (closed) return;
      closed = true;
      cancelAnimationFrame(raf);
      stopStream();
      for (const off of offs) off();
      if (document.fullscreenElement === root) document.exitFullscreen().catch(() => {});
      if (shotUrl) URL.revokeObjectURL(shotUrl);
      if (bee) bee.e.canvas.remove();
      root.remove();
      document.documentElement.classList.remove('essai-ouvert');
      run = null;
      api.focusBack && api.focusBack();
    },
  };
  document.documentElement.classList.add('essai-ouvert');
  on($('.essai-fermer', root), 'click', fermer);
  on(document, 'keydown', (e) => e.key === 'Escape' && (e.preventDefault(), fermer()), true);
  on(document, 'fullscreenchange', () => {
    if (state.full && document.fullscreenElement !== root) fermer();
  });

  const state = { full: false, moved: 0, sized: false, done: false, freed: false };
  let bq = null; // the framed bouquet, once the desktop is shown

  // ---------- the guide: one honeybee (insects' runtime, as the HUD's carriers fly theirs), hovering by its bubble
  let bee = null;
  const W = () => root.clientWidth, H = () => root.clientHeight;
  try {
    const { Essaim } = await import(BASE + 'runtime/essaim.mjs');
    const { Abeille } = await import(BASE + 'runtime/abeille.mjs');
    const e = await Essaim.create({ layers: [], zCuts: [], size: () => [W(), H()], direct: true });
    e.canvas.className = 'essai-abeille';
    e.canvas.setAttribute('aria-hidden', 'true');
    root.append(e.canvas);
    const fit = () => {
      e.resize();
      e.canvas.style.width = W() + 'px';
      e.canvas.style.height = H() + 'px';
    };
    fit();
    on(window, 'resize', fit);
    await e.kind('abeille', `${BASE}abeille/atlas/abeille`, 12.5);
    let seed = 11;
    const b = new Abeille(e, [], () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296), { species: { kind: 'abeille', bodyMm: 12.5 }, lengthPx: 12.5 * BEE_PXMM });
    b.visible = true;
    b.pose = 'vol';
    b.lod = 'L';
    b.P = [W() + 60, H() * 0.3, 0];
    e.add(b);
    bee = { e, b, fit, to: [W() * 0.5, H() * 0.4] };
  } catch (err) {
    console.error('[essai] abeille', err);
  }

  // ---------- one loop (owner, 2026-10-29: the bubble stays put, the bee comes close to what it asks to touch, small white
  // rings inviting the click there, as on the shop's bouquet): the bee flies by the step's target and hovers, the bouquet
  // sways, the long press's ring fills
  let cible = null; // the step's target: () => { x, y, d } (px, the rings' size) or null (the bee by the bubble)
  let last = performance.now();
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    placeBubble();
    const c = cible ? cible() : null;
    invite.hidden = !c;
    if (c) Object.assign(invite.style, { left: c.x + 'px', top: c.y + 'px', width: c.d + 'px', height: c.d + 'px' });
    if (bee) bee.to = c ? beside(c) : byBubble();
    if (hold) holdStep(now);
    if (bee) {
      const { b, to } = bee;
      // a hover: a slow figure of eight round its spot
      const t = now / 1000;
      const gx = to[0] + 7 * Math.sin(t * 1.3), gy = to[1] + 5 * Math.sin(t * 2.6);
      const k = 1 - Math.exp(-dt * 3.2);
      const nx = b.P[0] + (gx - b.P[0]) * k, ny = b.P[1] + (gy - b.P[1]) * k;
      b.V = [(nx - b.P[0]) / Math.max(dt, 1e-3), (ny - b.P[1]) / Math.max(dt, 1e-3), 0];
      b.P = [nx, ny, 0];
      b.frame = [0, 1, 2, 1][++b.tick % 4];
      b.faceFlight(dt);
      bee.e.render();
    }
    if (bq) bq.draw(now);
  };
  raf = requestAnimationFrame(frame);

  // the bee: up and to the left of the target, just off its rings (to its right near the screen's left edge, under it near
  // the top); with no target, by the bubble's right end (under it on a narrow screen)
  function beside(c) {
    const r = c.d / 2 + 26;
    const x = c.x - r < 30 ? c.x + r : c.x - r;
    const y = c.y - r * 0.7 < 30 ? c.y + r * 0.7 : c.y - r * 0.7;
    return [x, y];
  }
  function byBubble() {
    const r = bulle.getBoundingClientRect();
    if (W() >= 600 && r.right + 70 < W()) return [r.right + 40, r.top + r.height / 2];
    return [r.left + r.width / 2, r.bottom + 70 < H() ? r.bottom + 34 : r.top - 30];
  }
  // the bubble while the page is still seen (owner, 2026-10-29: never over the bouquet): in the room on the bouquet's right,
  // else on its left, under it, over it; when none has room, the place hiding the least of it. Full screen, the stylesheet's
  // place (the top's middle)
  let placed = '';
  function placeBubble() {
    const a = !root.classList.contains('essai-plein') && api.evite ? api.evite() : null;
    if (!a || !a.width) {
      if (placed) Object.assign(bulle.style, { left: '', top: '', translate: '' });
      placed = '';
      return;
    }
    const w = bulle.offsetWidth, h = bulle.offsetHeight, m = 16, gap = 24;
    // (under the top band and the ✕)
    const top = 64, x = (v) => Math.max(m, Math.min(W() - m - w, v)), y = (v) => Math.max(top, Math.min(H() - m - h, v));
    const mid = y(H() * 0.45 - h / 2);
    const spots = [
      [Math.max(a.right + gap, (a.right + W() - w) / 2), mid],
      [Math.min(a.left - gap - w, (a.left - w) / 2), mid],
      [W() / 2 - w / 2, a.bottom + gap],
      [W() / 2 - w / 2, a.top - gap - h],
    ];
    let best = null, least = Infinity;
    for (const [sx, sy] of spots) {
      const bx = x(sx), by = y(sy);
      const over = Math.max(0, Math.min(bx + w, a.right) - Math.max(bx, a.left)) * Math.max(0, Math.min(by + h, a.bottom) - Math.max(by, a.top));
      if (over < least) (least = over), (best = [bx, by]);
      if (!over) break;
    }
    const at = `${Math.round(best[0])},${Math.round(best[1])}`;
    if (at === placed) return;
    placed = at;
    Object.assign(bulle.style, { left: Math.round(best[0]) + 'px', top: Math.round(best[1]) + 'px', translate: 'none' });
  }
  // an element's middle, as a target of d px
  const middle = (el, d) => () => {
    const r = el && el.getBoundingClientRect();
    return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, d } : null;
  };

  // a step: its words, its buttons ([label, fn, primary, href]), what it asks to touch (cible above, or null)
  function etape(words, buttons = [], target = null) {
    texte.innerHTML = words;
    actions.replaceChildren(
      ...buttons.map(([label, fn, primary, href]) => {
        const el = document.createElement(href ? 'a' : 'button');
        if (href) {
          // (the installer, as the dock's Belai Bureau stack gives it: entete.js)
          el.href = href;
          el.setAttribute('download', '');
        }
        else el.type = 'button';
        el.className = 'essai-bouton' + (primary ? ' essai-bouton-1' : '');
        el.textContent = label;
        if (fn) el.addEventListener('click', fn);
        return el;
      }),
    );
    bulle.classList.remove('essai-bulle-neuve');
    void bulle.offsetWidth;
    bulle.classList.add('essai-bulle-neuve');
    cible = target;
    const first = actions.querySelector('button, a');
    if (first) first.focus({ preventScroll: true });
  }

  if (BUREAU) return void bureau();

  // ---------- the desktop's picture
  const shot = PHONE ? await phoneShot() : await desktopShot();
  if (!shot || closed) return;
  shotUrl = shot;
  img.src = shot;
  await img.decode().catch(() => {});

  // one click, anywhere (a click or a key is needed for full screen): the page gone, the desktop and the bouquet
  await new Promise((go) => {
    let gone = false;
    const full = async (e) => {
      if (gone || (e && e.target && e.target.closest && e.target.closest('.essai-fermer'))) return;
      if (e && e.type === 'keydown' && e.key === 'Escape') return;
      gone = true;
      root.classList.remove('essai-attente');
      root.removeEventListener('pointerdown', full);
      document.removeEventListener('keydown', full);
      try {
        await root.requestFullscreen({ navigationUI: 'hide' });
        state.full = true;
      } catch (_) {}
      go();
    };
    etape(PHONE ? T.pretTel : T.pret, [[T.montrer, full, true]], () => ({ x: W() / 2, y: H() * 0.56, d: 64 }));
    root.classList.add('essai-attente');
    root.addEventListener('pointerdown', full);
    document.addEventListener('keydown', full);
    offs.push(() => (root.removeEventListener('pointerdown', full), document.removeEventListener('keydown', full)));
  });
  if (closed) return;
  root.classList.add('essai-plein');
  img.hidden = false;
  bq = await bouquet();
  if (closed) return;
  pose.hidden = false;

  // ---------- its frame: drag it, pull a corner, ✓, then the long press that frees it again (Belai Bureau's: 6 s), ✓ once more;
  // each step said once the last is done, the bee by what it asks to touch
  const okBtn = $('.essai-ok', root);
  // a corner of the frame inside the screen, the lower right first
  const corner = () => {
    for (const k of ['se', 'sw', 'ne', 'nw']) {
      const r = $(`.essai-coin[data-coin=${k}]`, root).getBoundingClientRect();
      if (r.left > 8 && r.right < W() - 8 && r.top > 8 && r.bottom < H() - 8) return { x: r.left + r.width / 2, y: r.top + r.height / 2, d: 40 };
    }
    return null;
  };
  // the bouquet's flowers: a little over its middle
  const flowers = (d) => () => {
    const r = pose.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.4, d };
  };
  await new Promise((done) => {
    let step = 'glisser';
    const next = () => {
      if (step === 'glisser' && state.moved > 24) step = 'taille';
      if (step === 'taille' && state.sized) step = 'valider';
      if (step === 'valider' && state.done) step = 'appui';
      if (step === 'appui' && state.freed) step = 'revalider';
      if (step === 'revalider' && state.done) return done();
      show();
    };
    let shown = '';
    const show = () => {
      if (shown === step) return;
      shown = step;
      // (the ✓ only once it is asked for: a bouquet set before it was moved would end the try)
      okBtn.hidden = !['valider', 'revalider'].includes(step);
      if (step === 'glisser') etape(PHONE ? T.glisserTel : T.glisser, [], flowers(60));
      else if (step === 'taille') etape(T.taille, [], corner);
      else if (step === 'valider') etape(T.ok, [], middle(okBtn, 46));
      else if (step === 'appui') etape(T.appui, [], flowers(70));
      else etape(T.revalider, [], middle(okBtn, 46));
    };
    show();
    bq.onChange = next;
  });
  if (closed) return;

  // ---------- the end: the bouquet set, the way to keep it
  const win = /Windows/.test(navigator.userAgent);
  const fin = PHONE ? [T.finTel, [[T.retour, fermer, true]]] : win && B.installer
      ? [fill(T.fin, { jours: api.jours || 30 }), [[T.telecharger, null, true, `${api.racine || ''}telechargements/${B.installer}`], [T.retour, fermer]]]
      : [fill(T.finAutre, { jours: api.jours || 30 }), [[T.retour, fermer, true]]];
  etape(fin[0], fin[1]);
  // (its first button, made by etape)
  cible = middle(actions.querySelector('.essai-bouton-1'), 40);

  // ---------- Windows: Belai Bureau sets the bouquet; the app taking the focus says it opened. Nothing after a few seconds:
  // not installed yet (or the browser's own question still open), the installer offered and the link once more
  function bureau() {
    // (only while a launch is awaited: later, the installer or any other window taking the focus says nothing of the app;
    // owner, 2026-10-29: Windows' SmartScreen over the installer was taken for Belai Bureau)
    let awaiting = false;
    let wait = 0;
    const essayer = (launch) => {
      awaiting = true;
      if (launch) location.href = lien();
      etape(T.bureau);
      clearTimeout(wait);
      wait = setTimeout(() => {
        if (closed || !awaiting) return;
        awaiting = false;
        etape(T.bureauAbsent, [[T.telecharger, null, true, `${api.racine || ''}telechargements/${B.installer}`], [T.reessayer, () => essayer(true)], [T.annuler, fermer]]);
      }, 4500);
    };
    on(window, 'blur', () => {
      if (!awaiting || closed) return;
      awaiting = false;
      clearTimeout(wait);
      etape(T.bureauPose, [[T.retour, fermer, true]]);
    });
    offs.push(() => clearTimeout(wait));
    essayer(false);
  }

  // ---------- another computer: the screen shared, the desktop shown (the shortcut), grabbed
  function askScreen() {
    return navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'monitor', frameRate: 5 },
      audio: false,
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'exclude',
      monitorTypeSurfaces: 'include',
    });
  }
  async function desktopShot() {
    for (;;) {
      if (firstAsk) {
        // the picker already open: the bee says what to choose in it
        etape(T.partager);
        const ask = firstAsk;
        firstAsk = null;
        stream = await ask.catch(() => null);
        // (closed while the picker was open: a screen shared since is let go at once)
        if (closed) return stopStream(), null;
      } else {
        const go = await new Promise((r) => etape(T.partagerEncore, [[T.partagerBouton, () => r(true), true], [T.annuler, () => r(false)]]));
        if (!go || closed) return fermer(), null;
        stream = await askScreen().catch(() => null);
        if (closed) return stopStream(), null;
      }
      // declined: asked again, with a button
      if (!stream) continue;
      const track = stream.getVideoTracks()[0];
      const surface = track.getSettings().displaySurface;
      if (surface && surface !== 'monitor') {
        stopStream();
        etape(T.pasEcran);
        await sleep(2600);
        continue;
      }
      // what the screen shows now (this page): the desktop's picture must differ from it
      const before = await grab(track).catch(() => null);
      for (;;) {
        etape(OS === 'win' ? T.reduireWin : OS === 'mac' ? T.reduireMac : T.reduire);
        const ended = new Promise((r) => track.addEventListener('ended', () => r('ended'), { once: true }));
        const hidden = new Promise((r) => {
          if (document.hidden) return r('hidden');
          const f = () => document.hidden && (document.removeEventListener('visibilitychange', f), r('hidden'));
          document.addEventListener('visibilitychange', f);
        });
        if ((await Promise.race([hidden, ended])) === 'ended' || closed) break;
        // the window's minimising animation, then the desktop as it is
        await sleep(650);
        const pic = await grab(track).catch(() => null);
        if (pic && (!before || differs(before, pic))) {
          stopStream();
          const url = await toUrl(pic);
          if (document.hidden) await new Promise((r) => document.addEventListener('visibilitychange', () => r(), { once: true }));
          return url;
        }
        // still this page (another tab, a window over it): asked again once the visitor is back
        if (document.hidden) await new Promise((r) => document.addEventListener('visibilitychange', () => r(), { once: true }));
        etape(T.encore);
        await sleep(2200);
      }
      stopStream();
      if (closed) return null;
    }
  }

  // one frame of the shared screen: ImageCapture where there is one (Chromium), else a video element's frame
  async function grab(track) {
    if ('ImageCapture' in window) {
      try {
        return await new window.ImageCapture(track).grabFrame();
      } catch (_) {}
    }
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.srcObject = new MediaStream([track]);
    await v.play();
    await sleep(120);
    const bmp = await createImageBitmap(v);
    v.pause();
    v.srcObject = null;
    return bmp;
  }
  // two pictures of the screen, compared on a 32 x 18 thumbnail: the desktop differs from the page
  function differs(a, b) {
    const px = (bmp) => {
      const c = document.createElement('canvas');
      c.width = 32;
      c.height = 18;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(bmp, 0, 0, 32, 18);
      return g.getImageData(0, 0, 32, 18).data;
    };
    const p = px(a), q = px(b);
    let d = 0;
    for (let i = 0; i < p.length; i += 4) d += Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]);
    return d / (32 * 18 * 3) > 10;
  }
  async function toUrl(bmp) {
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
    return URL.createObjectURL(blob);
  }

  // ---------- a phone: a screenshot of the home screen, picked
  async function phoneShot() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.hidden = true;
    root.append(input);
    for (;;) {
      const go = await new Promise((r) => etape(T.capture, [[T.choisir, () => (input.click(), r(true)), true], [T.annuler, () => r(false)]]));
      if (!go || closed) return fermer(), null;
      const file = await new Promise((r) => {
        input.value = '';
        input.onchange = () => r(input.files && input.files[0]);
        // (a picker closed with no file sends no event on some phones: the page coming back says so)
        const back = () => setTimeout(() => r(input.files && input.files[0]), 600);
        window.addEventListener('focus', back, { once: true });
      });
      if (closed) return null;
      if (file && /^image\//.test(file.type)) return URL.createObjectURL(file);
    }
  }

  // ---------- the long press that frees a set bouquet, as Belai Bureau's (maintien.rs): held 6 s without drifting more than
  // 12 px, the ring under the pointer from 0.5 s (a plain click never flashes it)
  function startHold(e) {
    hold = { id: e.pointerId, x: e.clientX, y: e.clientY, t0: performance.now() };
    try {
      pose.setPointerCapture(e.pointerId);
    } catch (_) {}
  }
  function stopHold() {
    hold = null;
    anneau.hidden = true;
  }
  function holdStep(now) {
    const t = now - hold.t0;
    anneau.hidden = t < HOLD.retard;
    Object.assign(anneau.style, { left: hold.x + 'px', top: hold.y + 'px' });
    plein.style.strokeDashoffset = String(100 - 100 * Math.min(1, t / HOLD.duree));
    if (t >= HOLD.duree) {
      stopHold();
      if (bq && bq.free) bq.free();
    }
  }

  // ---------- the bouquet: its close-up sprites (sprites.mjs) drawn on a canvas, swaying; placed, moved, sized
  async function bouquet() {
    if (api.svg) return bouquetSvg();
    const idx = await api.index();
    const P = idx.proche;
    const sheets = await Promise.all(
      P.sheets.map(
        (s) =>
          new Promise((ok, ko) => {
            const im = new Image();
            im.onload = () => ok(im);
            im.onerror = ko;
            im.src = api.base + s;
          }),
      ),
    );
    // its box in the world (its pieces' union, with room for the sway), the pieces in their depth groups' order
    const per = Math.ceil(idx.images / 4);
    const frames = P.frames.map((f, i) => ({ ...f, g: Math.min(3, Math.floor(f.k / per)), i })).sort((a, b) => a.g - b.g || a.i - b.i);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const f of frames) {
      x0 = Math.min(x0, f.x);
      y0 = Math.min(y0, f.y);
      x1 = Math.max(x1, f.x + f.w);
      y1 = Math.max(y1, f.y + f.h);
    }
    const pad = 0.04 * (x1 - x0);
    x0 -= pad;
    x1 += pad;
    y0 -= pad;
    const bw = x1 - x0, bh = y1 - y0;
    const g = canvas.getContext('2d');
    return cadrer(bw, bh, (B) => {
      B.draw = (now) => {
        const s = canvas.width / bw;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, canvas.width, canvas.height);
        for (const f of frames) {
          g.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
          if (f.o && f.z) {
            const [amp, duration, delay] = f.z;
            const a = ((amp * Math.PI) / 180) * Math.sin((2 * Math.PI * (now - delay + AHEAD)) / duration);
            g.translate(f.o[0], f.o[1]);
            g.rotate(a);
            g.translate(-f.o[0], -f.o[1]);
          }
          g.drawImage(sheets[f.sheet], f.sx, f.sy, f.sw, f.sh, f.x, f.y, f.w, f.h);
        }
      };
    });
  }

  // the live SVG bouquet in the frame: it sways by itself (Eclosion), the frame only moves and sizes it; with a list of
  // bouquets, the arrows on the frame's sides put the previous or next one in its place
  async function bouquetSvg() {
    const list = api.bouquets && api.bouquets.length ? api.bouquets : [{ nom: api.nom, svg: api.svg }];
    let at = Math.max(0, Math.min(list.length - 1, api.indice | 0));
    const vb = await list[at].svg.vb();
    canvas.hidden = true;
    const holder = document.createElement('div');
    holder.className = 'essai-svg';
    holder.style.cssText = 'position:absolute;inset:0';
    pose.prepend(holder);
    const B = await cadrer(vb[2], vb[3], () => {});
    let live = null;
    let token = 0;
    const put = async (i) => {
      const my = ++token;
      const q = list[i];
      const v = await q.svg.vb();
      if (my !== token || closed) return;
      B.ratio(v[2], v[3]);
      const b = await q.svg.poser(holder);
      await b.pret;
      if (my !== token || closed) return b.arret();
      if (live) live.arret();
      live = b;
      b.montre();
      pose.setAttribute('aria-label', q.nom || '');
    };
    await put(at);
    offs.push(() => live && live.arret());
    for (const [sel, d] of [['.essai-prec', -1], ['.essai-suiv', 1]]) {
      const el = $(sel, root);
      if (el) on(el, 'click', () => put((at = (at + d + list.length) % list.length)));
    }
    return B;
  }

  // the frame shared by both: where it lands, moving, sizing, ✓, press and hold
  async function cadrer(bw, bh, fill) {
    // where it lands: a computer, on the right, a little under half the screen's height, standing over the taskbar; a phone,
    // in the middle, its foot two thirds down
    const H0 = H() * (PHONE ? 0.36 : 0.44);
    const box = { w: (H0 * bw) / bh, h: H0, x: 0, y: 0 };
    box.x = PHONE ? (W() - box.w) / 2 : W() * 0.68 - box.w / 2;
    box.y = (PHONE ? H() * 0.7 : H() * 0.9) - box.h;
    const lay = () => {
      Object.assign(pose.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
      // the ✓ over the frame's top right corner, or its top left when it would leave the screen on the right, under the frame
      // when it would leave it at the top
      pose.classList.toggle('essai-ok-gauche', box.x + box.w + 30 > W());
      pose.classList.toggle('essai-ok-bas', box.y - 60 < 0);
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(box.w * dpr);
      canvas.height = Math.round(box.h * dpr);
    };
    lay();
    const B = { onChange: () => {}, draw() {} };
    // another bouquet in the frame: its proportions, the frame's height and centre kept
    B.ratio = (w, h) => {
      const cx = box.x + box.w / 2;
      box.w = (box.h * w) / h;
      box.x = cx - box.w / 2;
      lay();
    };
    fill(B);

    // moving and sizing: the whole frame drags it, a corner sizes it about the opposite corner (its proportions kept), two
    // fingers pinch it; ✓ sets it (the frame goes)
    const pointers = new Map();
    let grip = null;
    const startGrip = (e, corner) => {
      grip = { corner, x: e.clientX, y: e.clientY, box: { ...box }, pinch: null };
    };
    on(pose, 'pointerdown', (e) => {
      if (e.target.closest('.essai-ok, .essai-fleche')) return;
      if (state.done) return void startHold(e);
      e.preventDefault();
      pose.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      const corner = e.target.closest('.essai-coin')?.dataset.coin || null;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        grip = { corner: null, box: { ...box }, pinch: Math.hypot(a[0] - b[0], a[1] - b[1]) };
      } else startGrip(e, corner);
    });
    on(pose, 'pointermove', (e) => {
      if (!grip || !pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      const o = grip.box;
      if (grip.pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        size(o, Math.hypot(a[0] - b[0], a[1] - b[1]) / grip.pinch, 'c');
      } else if (grip.corner) {
        const dx = e.clientX - grip.x, dy = e.clientY - grip.y;
        const sx = grip.corner.includes('e') ? dx : -dx, sy = grip.corner.includes('s') ? dy : -dy;
        size(o, Math.max((o.w + sx) / o.w, (o.h + sy) / o.h), grip.corner);
      } else {
        box.x = Math.max(-box.w * 0.5, Math.min(W() - box.w * 0.5, o.x + e.clientX - grip.x));
        box.y = Math.max(-box.h * 0.3, Math.min(H() - box.h * 0.5, o.y + e.clientY - grip.y));
        state.moved = Math.max(state.moved, Math.hypot(e.clientX - grip.x, e.clientY - grip.y));
        lay();
      }
    });
    const release = (e) => {
      if (hold && e.pointerId === hold.id) return void stopHold();
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        grip = null;
        B.onChange();
      }
    };
    on(pose, 'pointerup', release);
    on(pose, 'pointercancel', release);
    // sized from the box o by k about its corner opposite `corner` ('c': about its centre); 12 % to 95 % of the screen's height
    function size(o, k, corner) {
      const h = Math.max(H() * 0.12, Math.min(H() * 0.95, o.h * k));
      const w = (h * o.w) / o.h;
      box.x = corner === 'c' ? o.x + (o.w - w) / 2 : corner.includes('w') ? o.x + o.w - w : o.x;
      box.y = corner === 'c' ? o.y + (o.h - h) / 2 : corner.includes('n') ? o.y + o.h - h : o.y;
      box.w = w;
      box.h = h;
      if (Math.abs(h / H0 - 1) > 0.08) state.sized = true;
      lay();
    }
    on($('.essai-ok', root), 'click', () => {
      state.done = true;
      cadre.hidden = true;
      pose.classList.add('essai-posee');
      B.onChange();
    });
    on(pose, 'pointermove', (e) => {
      if (hold && e.pointerId === hold.id && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > HOLD.derive) stopHold();
    });
    B.free = () => {
      state.done = false;
      state.freed = true;
      cadre.hidden = false;
      pose.classList.remove('essai-posee');
      B.onChange();
    };
    return B;
  }
}
