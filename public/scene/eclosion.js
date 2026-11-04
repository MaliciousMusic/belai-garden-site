// eclosion.js: grows a pre-drawn bouquet (decor/scene/bouquets/<id>/, written by predessin.mjs) without the flower engine.
//
// The bouquet comes as files: the vessel (vase-dos.svg behind the stems, vase.svg in front of them) and every other piece
// of the engine's cut (p001.svg...), each an <img> the browser draws once and then only moves on the graphics card.
// manifeste.json gives each piece its box, the origin of its growth and its timings, exactly those of growBq / growIn
// and of the breeze of aliveBq (z5.js). The rules of the growth hold: the vessel is whole from the first frame; the stems
// seen inside it grow from the mouth down; every stem grows out of the mouth from its foot; heads, leaves and sprigs open
// at the tip of their stem, one by one; only transforms move (never an opacity, a mask or a gradient); then the breeze.
//
// Three differences with the engine. Two are in how it runs, not in what is seen:
// - a moving piece is an <img> (its growth) inside a box (its breeze): the browser can then run both on the graphics card
//   (two transform animations on one element are run by the main thread, every frame);
// - the pieces load in the order they grow: the growth starts once the vessel and the first pieces are in, the others
//   come during it; a piece that would come after its own start begins as soon as it is in (its breeze shifted alike),
//   never half-grown.
// The third is seen: a moving line or drape grows out of the mouth from its foot, as growIn means it and the grower asks
// (every stem leaves the vessel); in the engine the breeze's origin, set after, made it grow from its joint.
//
//   const b = await Eclosion.ouvre(parent, 'bouquets/<id>/manifeste.json', { monde: [2400, 1350] });
//   await b.vase;         // the vessel is in
//   await b.pret;         // the vessel and the first pieces are in: the growth can start
//   b.depart();           // the growth starts (auto: false); b.parti resolves with the time of its first frame
//   await b.tout;         // every piece is in
//   await b.grandi;       // every piece has grown (the breeze goes on)
//   await b.repli();      // the bouquet folds back (flowers close, stems go back into the mouth), then is removed
//
// Options: monde (the parent's frame in world units: the box comes from manifest.boite; without it, the bouquet fills the
// parent), final (everything at rest, as drawn: no growth, no breeze), immobile (it grows, no breeze), auto (start as soon
// as ready, true by default), avance (ms of growth that must be loaded before the start, 450 by default), parallele
// (files loading at once, 6 by default), plans (the pieces cut, in their stacking order, into that many boxes of equal
// count laid over one another, so the insects' canvases can sit between them: b.plans, b.plan[k] the box of piece k).
// The parent gets the event "eclosion:ouvert" (detail: the bouquet) once its boxes are in, "eclosion:repli" when it starts
// folding back.
// prefers-reduced-motion: the bouquet is shown open and still.
//
// The shop page no longer grows its bouquets (owner, 2026-10-24): it shows them open and swaying with Eclosion.pose, from
// the one file paquet.mjs writes (see pose below). ouvre stays for the growth.
(() => {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hash = (k) => Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1;
  const loaded = (img) =>
    img.complete && img.naturalWidth
      ? Promise.resolve(true)
      : new Promise((r) => {
          img.addEventListener('load', () => r(true), { once: true });
          img.addEventListener('error', () => r(false), { once: true });
        });

  async function ouvre(parent, url, opt = {}) {
    const base = new URL('.', new URL(url, document.baseURI)).href;
    const m = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`manifeste ${r.status}`);
      return r.json();
    });
    const still = RM || !!opt.final;
    const sway = !still && !opt.immobile;
    const lead = opt.avance ?? 450;
    const [vx, vy, vw, vh] = m.vb;

    // the bouquet's box: the drawing's frame in whole units (pieces are cut on whole units, so none sits on a fraction of a
    // pixel: the browser would round each image's place on its own, and neighbours would part by up to half a pixel), one
    // CSS pixel per unit, brought to its place and size in the world by a single transform; clipped like the engine's
    const X0 = Math.floor(vx);
    const Y0 = Math.floor(vy);
    const nPlans = Math.max(1, Math.min(m.pieces.length, opt.plans | 0 || 1));
    const per = Math.ceil(m.pieces.length / nPlans);
    const boxes = [];
    for (let g = 0; g < nPlans; g++) {
      const bx = document.createElement('div');
      bx.className = 'bq-pose';
      bx.style.cssText = `position:absolute;left:0;top:0;width:${Math.ceil(vx + vw) - X0}px;height:${Math.ceil(vy + vh) - Y0}px;overflow:hidden;pointer-events:none;transform-origin:0 0`;
      boxes.push(bx);
    }
    const box = boxes[0];
    box.dataset.etat = 'charge';
    const fit = () => {
      const pw = parent.clientWidth;
      if (!pw) return;
      let e = pw / vw;
      let ox = 0;
      let oy = 0;
      if (opt.monde && m.boite) {
        const k = pw / opt.monde[0];
        e = (k * m.boite[2]) / vw;
        ox = k * m.boite[0];
        oy = k * m.boite[1];
      }
      const tf = `translate(${(ox - (vx - X0) * e).toFixed(3)}px,${(oy - (vy - Y0) * e).toFixed(3)}px) scale(${e.toFixed(6)})`;
      for (const bx of boxes) bx.style.transform = tf;
    };
    const ro = window.ResizeObserver ? new ResizeObserver(fit) : null;

    // every piece in stacking order: an <img> (its growth), inside a box for a moving piece (its breeze)
    const items = m.pieces.map((p, k) => {
      const [bx, by, bw, bh] = p.b;
      const place = `position:absolute;left:${bx - X0}px;top:${by - Y0}px;width:${bw}px;height:${bh}px`;
      const at = (o) => (o ? `transform-origin:${+(o[0] - bx).toFixed(2)}px ${+(o[1] - by).toFixed(2)}px` : '');
      // the breeze turns round the joint (o); the growth starts at the foot of a moving line or drape (p, out of the mouth,
      // as growIn means it: the engine let the breeze's origin override it), else at o
      const origin = at(p.o);
      const growFrom = at(p.p || p.o);
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      img.className = 'bq-piece';
      let outer = img;
      if (p.z && sway) {
        outer = document.createElement('div');
        outer.className = 'bq-brise';
        outer.style.cssText = `${place};${origin};will-change:transform`;
        img.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;max-width:none;${growFrom}${p.g && !still ? ';will-change:transform' : ''}`;
        outer.append(img);
      } else img.style.cssText = `${place};max-width:none;${growFrom}${p.g && !still ? ';will-change:transform' : ''}`;
      // when it is needed: the vessel first, then each piece by the start of its growth
      const need = p.t === 'vase' ? -1 : p.g ? p.g[0] : 0;
      // nothing shows before it is set going: a growing piece is scaled down to nothing, a still one hidden until the start
      if (!still && p.t !== 'vase') img.style.visibility = 'hidden';
      return { p, img, outer, k, need, ok: null, anims: [] };
    });
    for (const it of items) boxes[Math.floor(it.k / per)].append(it.outer);
    parent.append(...boxes);
    fit();
    if (ro) ro.observe(parent);

    // started: depart() was called; startedAt: the time (document timeline) of the first frame of the growth, once known
    let started = false;
    let startedAt = null;
    let startRes;
    const late = [];
    // every growth animation's end: the bouquet is grown once all its pieces are in and have grown
    const growths = [];
    const parti = new Promise((r) => (startRes = r));
    // the lateness (ms) given to each element of the engine: its head never opens before its stem has started to grow
    const shift = new Map();
    // a piece is set going: its growth from scale(.001), its breeze after it. Before the start, both wait, paused at their
    // first frame; at the start, they all begin with the first frame drawn; a piece that comes after its own start begins
    // at once, the whole of it (growth and breeze) shifted by its lateness, and so do the later pieces of its element
    const setGoing = (it) => {
      const { p, img, outer } = it;
      it.set = true;
      if (still || p.t === 'vase') {
        img.style.visibility = '';
        return;
      }
      let at = null;
      if (startedAt != null) {
        const own = it.need > 0 ? performance.now() - startedAt - it.need : 0;
        const by = Math.max(0, own, p.e != null ? shift.get(p.e) || 0 : 0);
        if (p.e != null) shift.set(p.e, by);
        if (by > 0) late.push(Math.round(by));
        at = startedAt + by;
      }
      const go = (a) => {
        if (!started) a.pause();
        else if (at != null) a.startTime = at;
        it.anims.push(a);
      };
      if (p.g) {
        const [delay, duration, ease] = p.g;
        const a = img.animate([{ transform: 'scale(.001)' }, { transform: 'scale(1)' }], { duration, delay, easing: m.courbes[ease], fill: 'both' });
        go(a);
        growths.push(a.finished.catch(() => {}));
        // grown: its last frame is the piece as drawn (scale 1), so the animation goes and the browser has one less to follow
        a.finished.then(
          () => {
            if (a.playState === 'finished' && box.isConnected) {
              a.cancel();
              it.anims.splice(it.anims.indexOf(a), 1);
            }
          },
          () => {},
        );
      }
      if (p.g || started) img.style.visibility = '';
      if (p.z && sway && outer !== img) {
        const [amp, duration, delay] = p.z;
        go(
          outer.animate(
            [
              { transform: 'rotate(0deg)', easing: 'ease-out' },
              { transform: `rotate(${amp}deg)`, easing: 'ease-in' },
              { transform: 'rotate(0deg)', easing: 'ease-out' },
              { transform: `rotate(${-amp}deg)`, easing: 'ease-in' },
              { transform: 'rotate(0deg)' },
            ],
            { duration, delay, iterations: Infinity },
          ),
        );
      }
    };

    // load in growing order (the vessel first), a few at a time so each one is set going as soon as it is in (all at
    // once, the browser would read every file before telling of the first)
    const order = items.slice().sort((a, b) => a.need - b.need || a.k - b.k);
    for (const it of order) it.done = new Promise((r) => (it.res = r));
    // the pieces of one element, in growing order: a piece is set going only once those before it are
    const byEl = new Map();
    for (const it of order) if (it.p.e != null) (byEl.get(it.p.e) || byEl.set(it.p.e, []).get(it.p.e)).push(it);
    const canGo = (it) => started || it.p.t === 'vase' || it.p.g;
    const release = (it) => {
      if (!box.isConnected) return;
      const list = it.p.e != null ? byEl.get(it.p.e) : [it];
      for (const x of list) {
        if (x.set) continue;
        if (x.ok == null) break;
        if (x.ok && canGo(x)) setGoing(x);
      }
    };
    const queue = order.slice();
    let inflight = 0;
    const pump = () => {
      while (inflight < (opt.parallele || 6) && queue.length) {
        const it = queue.shift();
        inflight++;
        it.img.src = base + it.p.f;
        loaded(it.img).then((ok) => {
          inflight--;
          it.ok = ok;
          if (!ok) {
            it.outer.remove();
            it.set = true;
          }
          release(it);
          it.res();
          pump();
        });
      }
    };
    pump();
    const vReady = Promise.all(order.filter((it) => it.p.t === 'vase').map((it) => it.done));
    const ready = Promise.all(order.filter((it) => it.need <= lead).map((it) => it.done));
    const all = Promise.all(order.map((it) => it.done));

    const b = {
      manifeste: m,
      el: box,
      plans: boxes,
      plan: items.map((x) => Math.floor(x.k / per)),
      // the lateness (ms) of every piece that came after its own start
      retards: late,
      pieces: items.map((x) => x.img),
      vase: vReady.then(() => box),
      pret: ready.then(() => b),
      tout: all.then(() => b),
      // every piece in and grown (late ones included); the breeze goes on
      grandi: all.then(() => Promise.all(growths)).then(() => b),
      parti,
      // the growth starts: every piece in so far from the same instant, the others as they come
      depart() {
        if (started) return parti;
        started = true;
        const going = [];
        for (const it of items) {
          if (!it.ok || it.p.t === 'vase') continue;
          if (it.set) for (const a of it.anims) a.play();
          else release(it);
          going.push(...it.anims);
        }
        box.dataset.etat = 'eclot';
        // the growth's own time: that of its first frame, shared by every piece set going so far
        (going.length ? going[0].ready.then((a) => a.startTime) : Promise.resolve(null)).then((t) => {
          startedAt = t ?? performance.now();
          startRes(startedAt);
        });
        return parti;
      },
      // the end of the growth (ms, document time) if every piece came in time; the breeze then goes on alone
      fin() {
        return startedAt == null ? null : startedAt + m.finCroissanceMs;
      },
      // the bouquet folds back: each flower closes on the tip of its stem, then each stem goes back into the mouth, then the
      // vessel goes at once (a scale on the piece itself: its growth is over, its breeze, on its box, goes on meanwhile)
      repli() {
        parent.dispatchEvent(new CustomEvent('eclosion:repli', { detail: b }));
        const end = () => {
          if (ro) ro.disconnect();
          for (const bx of boxes) bx.remove();
        };
        if (RM || !started) return Promise.resolve(end());
        const out = [];
        let k = 0;
        for (const it of items) {
          if (it.p.t === 'vase' || !it.ok) continue;
          const grow = it.anims.find((a) => a.effect && a.effect.target === it.img);
          const running = grow && grow.playState !== 'finished';
          if (grow && !running) grow.cancel();
          const h = hash(++k);
          const moving = !!it.p.z;
          const a = it.img.animate([{ transform: 'scale(1)' }, { transform: 'scale(.001)' }], {
            duration: moving ? 420 : 380,
            delay: moving ? h * 260 : 300 + h * 240,
            easing: 'cubic-bezier(.55,0,.8,.3)',
            fill: 'forwards',
            // a piece still growing folds from where it is
            composite: running ? 'add' : 'replace',
          });
          out.push(a.finished);
        }
        return Promise.race([Promise.all(out), new Promise((r) => setTimeout(r, 1400))]).then(end, end);
      },
      arret() {
        for (const it of items) for (const a of it.anims) a.cancel();
        if (ro) ro.disconnect();
        for (const bx of boxes) bx.remove();
      },
    };
    vReady.then(() => {
      if (box.dataset.etat === 'charge') box.dataset.etat = 'vase';
    });
    if (still) {
      // reduced motion or the final state: each piece shown as it comes, open and still
      started = true;
      startedAt = performance.now();
      startRes(startedAt);
      box.dataset.etat = 'fini';
    } else if (opt.auto !== false) b.pret.then(() => b.depart());
    parent.dispatchEvent(new CustomEvent('eclosion:ouvert', { detail: b }));
    return b;
  }

  // ---------- pose: the bouquet open, already swaying, from its one file bouquets/<id>/ouvert.json (paquet.mjs)
  // Every image is made and drawn hidden; the bouquet shows whole, at once, when montre() is called (never piece by piece).
  // Each swaying image turns round its joint as in the breeze of aliveBq, all of them shifted by one common time so the
  // breeze is already under way at the first frame, its phases between pieces unchanged.
  //
  //   const b = await Eclosion.pose(parent, 'bouquets/<id>/ouvert.json', { monde: [2400, 1350], plans: 4 });
  //   await b.pret;    // every image drawn, hidden
  //   b.montre();      // shown, swaying; the parent gets "eclosion:ouvert"
  //   b.repli();       // gone at once; the parent gets "eclosion:repli"
  //
  // Options: monde, plans (as ouvre), final (still, no breeze), donnees (the file's JSON already read: no request).
  // The object answers like ouvre's for the shop and the insects: manifeste (vb, boite, echelle, pieces: every piece of the
  // growth's cut with its kind and box), plan[k] (the box of that piece), plans, el, vase/tout/grandi (= pret).
  const AHEAD = 60000; // the breeze's common head start (ms)
  // the kind of each image of a bouquet (orig: every element of the growth's cut, k its image): « tete » for an image that
  // draws a flower head and no vase, the places the shop's bee may land on (vie.mjs)
  const kindsOf = (orig) => {
    const by = new Map();
    for (const o of orig || []) (by.get(o.k) || by.set(o.k, new Set()).get(o.k)).add(o.t);
    return (k) => (by.get(k)?.has('tete') && !by.get(k).has('vase') ? 'tete' : '');
  };
  async function pose(parent, url, opt = {}) {
    const m =
      opt.donnees ||
      (await fetch(url).then((r) => {
        if (!r.ok) throw new Error(`bouquet ${r.status}`);
        return r.json();
      }));
    const sway = !RM && !opt.final;
    const [vx, vy, vw, vh] = m.vb;
    const X0 = Math.floor(vx);
    const Y0 = Math.floor(vy);
    const nPlans = Math.max(1, Math.min(m.pieces.length, opt.plans | 0 || 1));
    const per = Math.ceil(m.pieces.length / nPlans);
    const boxes = [];
    for (let g = 0; g < nPlans; g++) {
      const bx = document.createElement('div');
      bx.className = 'bq-pose';
      bx.style.cssText = `position:absolute;left:0;top:0;width:${Math.ceil(vx + vw) - X0}px;height:${Math.ceil(vy + vh) - Y0}px;overflow:hidden;pointer-events:none;transform-origin:0 0;visibility:hidden`;
      boxes.push(bx);
    }
    const fit = () => {
      const pw = parent.clientWidth;
      if (!pw) return;
      let e = pw / vw;
      let ox = 0;
      let oy = 0;
      if (opt.monde && m.boite) {
        const k = pw / opt.monde[0];
        e = (k * m.boite[2]) / vw;
        ox = k * m.boite[0];
        oy = k * m.boite[1];
      }
      const tf = `translate(${(ox - (vx - X0) * e).toFixed(3)}px,${(oy - (vy - Y0) * e).toFixed(3)}px) scale(${e.toFixed(6)})`;
      for (const bx of boxes) bx.style.transform = tf;
    };
    const ro = window.ResizeObserver ? new ResizeObserver(fit) : null;
    const urls = [];
    const kind = kindsOf(m.orig);
    const imgs = m.pieces.map((p, k) => {
      const [bx, by, bw, bh] = p.b;
      const place = `position:absolute;left:${bx - X0}px;top:${by - Y0}px;width:${bw}px;height:${bh}px`;
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      img.className = 'bq-piece';
      if (kind(k)) img.dataset.t = kind(k);
      const u = URL.createObjectURL(new Blob([p.s], { type: 'image/svg+xml' }));
      urls.push(u);
      img.src = u;
      let outer = img;
      if (p.z && sway) {
        outer = document.createElement('div');
        outer.className = 'bq-brise';
        outer.style.cssText = `${place};transform-origin:${+(p.o[0] - bx).toFixed(2)}px ${+(p.o[1] - by).toFixed(2)}px;will-change:transform`;
        img.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;max-width:none';
        outer.append(img);
      } else img.style.cssText = `${place};max-width:none`;
      boxes[Math.floor(k / per)].append(outer);
      return { p, img, outer };
    });
    parent.append(...boxes);
    fit();
    if (ro) ro.observe(parent);
    // drawn once, hidden: decode() resolves once the browser can paint the image without waiting
    const ready = Promise.all(imgs.map(({ img }) => img.decode().catch(() => {})));
    const anims = [];
    let shownAt = null;
    let shownRes;
    const parti = new Promise((r) => (shownRes = r));
    const end = () => {
      if (ro) ro.disconnect();
      for (const a of anims) a.cancel();
      for (const bx of boxes) bx.remove();
      for (const u of urls) URL.revokeObjectURL(u);
    };
    const b = {
      manifeste: { vb: m.vb, boite: m.boite, pied: m.pied, echelle: m.echelle, pieces: m.orig, finCroissanceMs: 0 },
      el: boxes[0],
      plans: boxes,
      plan: m.orig.map((o) => Math.floor(o.k / per)),
      retards: [],
      pieces: imgs.map((x) => x.img),
      pret: ready.then(() => b),
      parti,
      montre() {
        if (shownAt != null) return parti;
        if (sway)
          for (const { p, outer } of imgs) {
            if (!p.z || outer === p.img) continue;
            const [amp, duration, delay] = p.z;
            anims.push(
              outer.animate(
                [
                  { transform: 'rotate(0deg)', easing: 'ease-out' },
                  { transform: `rotate(${amp}deg)`, easing: 'ease-in' },
                  { transform: 'rotate(0deg)', easing: 'ease-out' },
                  { transform: `rotate(${-amp}deg)`, easing: 'ease-in' },
                  { transform: 'rotate(0deg)' },
                ],
                { duration, delay: delay - AHEAD, iterations: Infinity },
              ),
            );
          }
        // in phase with the bouquet it follows (sprites, below)
        if (opt.debut != null) for (const a of anims) a.startTime = opt.debut;
        for (const bx of boxes) bx.style.visibility = '';
        boxes[0].dataset.etat = 'fini';
        shownAt = performance.now();
        shownRes(shownAt);
        parent.dispatchEvent(new CustomEvent('eclosion:ouvert', { detail: b }));
        return parti;
      },
      depart() {
        return b.montre();
      },
      fin() {
        return shownAt;
      },
      debut: () => anims.find((a) => a.startTime != null)?.startTime ?? null,
      repli() {
        parent.dispatchEvent(new CustomEvent('eclosion:repli', { detail: b }));
        end();
        return Promise.resolve();
      },
      arret: end,
    };
    b.vase = b.tout = b.grandi = b.pret;
    return b;
  }

  // ---------- sprites: the same open bouquet from its baked sprites (bouquets/<id>/sprites/, sprites.mjs), about 35 times
  // lighter than ouvert.json (owner, 2026-11-02: the collection's cards, and the product's bouquet until its SVG is in).
  // Each image of the close-up's sheets is a box showing its part of the sheet, in the drawing's units like pose's, and a
  // swaying one turns round its joint with the very breeze of pose. Same calls and same object as pose (no growth cut).
  //
  //   const b = await Eclosion.sprites(parent, 'bouquets/<id>/sprites/sprites.json', { donnees: index });
  //   await b.pret; b.montre(); b.debut()  // the breeze's start time (document timeline), for a pose to follow in phase
  //
  // pose takes { debut } to start its breeze at that time: a sprite bouquet can give way to its SVG without a jump.
  async function sprites(parent, url, opt = {}) {
    const base = new URL('.', new URL(url, document.baseURI)).href;
    const m =
      opt.donnees ||
      (await fetch(url).then((r) => {
        if (!r.ok) throw new Error(`sprites ${r.status}`);
        return r.json();
      }));
    const sway = !RM && !opt.final;
    const [vx, vy, vw, vh] = m.vb;
    const X0 = Math.floor(vx);
    const Y0 = Math.floor(vy);
    const e = m.boite[2] / vw; // world units per drawing unit
    const dx = (x) => vx + (x - m.boite[0]) / e;
    const dy = (y) => vy + (y - m.boite[1]) / e;
    const P = m.proche;
    // the sheets, decoded before anything shows
    const sheets = P.sheets.map((s) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = base + s;
      return img;
    });
    const box = document.createElement('div');
    box.className = 'bq-pose';
    box.style.cssText = `position:absolute;left:0;top:0;width:${Math.ceil(vx + vw) - X0}px;height:${Math.ceil(vy + vh) - Y0}px;overflow:hidden;pointer-events:none;transform-origin:0 0;visibility:hidden`;
    const fit = () => {
      const pw = parent.clientWidth;
      if (!pw) return;
      let k = pw / vw;
      let ox = 0;
      let oy = 0;
      if (opt.monde && m.boite) {
        const s = pw / opt.monde[0];
        k = (s * m.boite[2]) / vw;
        ox = s * m.boite[0];
        oy = s * m.boite[1];
      }
      box.style.transform = `translate(${(ox - (vx - X0) * k).toFixed(3)}px,${(oy - (vy - Y0) * k).toFixed(3)}px) scale(${k.toFixed(6)})`;
    };
    const ro = window.ResizeObserver ? new ResizeObserver(fit) : null;
    const kind = kindsOf(m.orig);
    const ready = Promise.all(sheets.map((img) => img.decode().catch(() => {}))).then(() => {
      for (const f of P.frames) {
        const sh = sheets[f.sheet];
        const [x, y, w, h] = [dx(f.x), dy(f.y), f.w / e, f.h / e];
        const kx = w / f.sw;
        const ky = h / f.sh;
        const el = document.createElement('div');
        el.className = f.z && sway ? 'bq-piece bq-brise' : 'bq-piece';
        if (kind(f.k)) el.dataset.t = kind(f.k);
        el.style.cssText =
          `position:absolute;left:${(x - X0).toFixed(3)}px;top:${(y - Y0).toFixed(3)}px;width:${w.toFixed(3)}px;height:${h.toFixed(3)}px;` +
          `background:url("${sh.src}") ${(-f.sx * kx).toFixed(3)}px ${(-f.sy * ky).toFixed(3)}px / ${(sh.naturalWidth * kx).toFixed(3)}px ${(sh.naturalHeight * ky).toFixed(3)}px no-repeat` +
          // no will-change: a running breeze is put on the graphics card by itself, and the eleven cards of the collection,
          // held at rest, would keep some two hundred layers in memory for nothing (a phone's)
          (f.z && sway ? `;transform-origin:${(dx(f.o[0]) - x).toFixed(2)}px ${(dy(f.o[1]) - y).toFixed(2)}px` : '');
        el._f = f;
        box.append(el);
      }
    });
    parent.append(box);
    fit();
    if (ro) ro.observe(parent);
    const anims = [];
    let shownAt = null;
    let shownRes;
    const parti = new Promise((r) => (shownRes = r));
    const end = () => {
      if (ro) ro.disconnect();
      for (const a of anims) a.cancel();
      box.remove();
    };
    const b = {
      manifeste: { vb: m.vb, boite: m.boite, pied: m.pied, echelle: m.echelle, pieces: m.orig, finCroissanceMs: 0 },
      sprites: true,
      el: box,
      plans: [box],
      plan: m.orig.map(() => 0),
      retards: [],
      pieces: [],
      pret: ready.then(() => ((b.pieces = [...box.children]), b)),
      parti,
      montre() {
        if (shownAt != null) return parti;
        if (sway)
          for (const el of box.children) {
            if (!el._f.z) continue;
            const [amp, duration, delay] = el._f.z;
            anims.push(
              el.animate(
                [
                  { transform: 'rotate(0deg)', easing: 'ease-out' },
                  { transform: `rotate(${amp}deg)`, easing: 'ease-in' },
                  { transform: 'rotate(0deg)', easing: 'ease-out' },
                  { transform: `rotate(${-amp}deg)`, easing: 'ease-in' },
                  { transform: 'rotate(0deg)' },
                ],
                { duration, delay: delay - AHEAD, iterations: Infinity },
              ),
            );
          }
        if (opt.debut != null) for (const a of anims) a.startTime = opt.debut;
        box.style.visibility = '';
        box.dataset.etat = 'fini';
        shownAt = performance.now();
        shownRes(shownAt);
        parent.dispatchEvent(new CustomEvent('eclosion:ouvert', { detail: b }));
        return parti;
      },
      debut: () => anims.find((a) => a.startTime != null)?.startTime ?? null,
      depart() {
        return b.montre();
      },
      fin() {
        return shownAt;
      },
      repli() {
        parent.dispatchEvent(new CustomEvent('eclosion:repli', { detail: b }));
        end();
        return Promise.resolve();
      },
      arret: end,
    };
    b.vase = b.tout = b.grandi = b.pret;
    return b;
  }

  window.Eclosion = { ouvre, pose, sprites };
})();
