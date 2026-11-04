// Behaviour of the hummingbird hawk-moth (moro-sphinx) over the bouquet: it darts in fast from an edge or the far meadow, stops
// dead in front of a flower and hovers there, body pitched up, its proboscis unrolled into the corolla, holding its place with
// small corrections; then it side-steps to the next flower, and after a run of flowers it leaves as fast as it came. Now and
// then it settles on a flower, wings folded in a low roof. It is never steered; a click makes it dart away.
// In flight its wings are baked in the atlas cells (the fake beat of DECISIONS: three drawings looping 0 1 2 1); at rest they
// are the runtime quads of essaim.placeWings (b.wingsOff tells which). Numbers and sources: moro-sphinx/COMPORTEMENT.md.
import { bodyFrame } from './vue.mjs';
import { PERSPECTIVE } from './essaim.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const lerp = (a, b, t) => a + (b - a) * t;

export const SPHINX = {
  kind: 'moro-sphinx', bodyMm: 21.9,
  // body pitched head up while hovering (c153: 32°); the proboscis tip in the body frame (mm, moro-sphinx.mjs proboscisPath)
  pitch: 32, tip: [24.12, 0, -16.55],
  // drawings of the fake beat (the real one runs at 77 to 86 Hz, Kihlström et al. 2020: no display can show it)
  seq: [0, 1, 2, 1],
  // at a flower 3 to 10 s (Doremi, after Herrera 1992), probing it a few times; 3 to 9 flowers, then it leaves
  visit: [3, 10], run: [3, 9], probe: [0.8, 2.2],
  // fast darting transit, quick side-steps between flowers (orders of magnitude, to be measured on video: COMPORTEMENT.md)
  speed: 620, hop: 420,
  // at rest: wings in a low roof, the forewings drawn back over the hindwings (moro-sphinx.mjs REST)
  rest: { fore: { flap: -10, sweep: 81 }, hind: { flap: -16, sweep: 66 } }, restChance: 0.08, restTime: [4, 10],
};

export class Sphinx {
  constructor(essaim, flowers, rnd, opts = {}) {
    this.S = opts.species ?? SPHINX;
    this.e = essaim; this.flowers = flowers; this.rnd = rnd;
    this.kind = this.S.kind;
    this.lengthPx = opts.lengthPx ?? 24;
    this.speed = (opts.speed ?? 1) * (0.9 + 0.2 * rnd());
    this.P = [0, 0, 0]; this.V = [0, 0, 0]; this.fwd = [1, 0, 0]; this.bank = 0;
    this.pose = 'vol'; this.frame = 0; this.tick = 0; this.visible = false; this.wingsOff = true;
    this.wingPose = { fore: { ...this.S.rest.fore }, hind: { ...this.S.rest.hind } };
    this.state = 'away'; this.t = 1 + rnd() * 3;
    this.wob = rnd() * 100; this.visits = 0;
  }

  get pxmm() { return this.lengthPx / this.S.bodyMm; }

  pickFlower() {
    const free = this.flowers.filter((f) => f !== this.flower && !f.busy);
    if (!free.length) return null;
    // it works through a patch: the near flowers first
    const w = free.map((f) => 1 / (len(sub(f.P, this.P)) + 60) ** 1.5);
    let s = w.reduce((a, b) => a + b, 0) * this.rnd();
    for (let i = 0; i < free.length; i++) { s -= w[i]; if (s <= 0) return free[i]; }
    return free[free.length - 1];
  }

  spawn() {
    const { w, h } = this.e, r = this.rnd();
    if (r < 0.3) this.P = [this.rnd() * w, h * (0.1 + this.rnd() * 0.3), -1300];
    else { const side = this.rnd() < 0.5 ? -1 : 1; this.P = [side < 0 ? -160 : w + 160, h * (0.1 + this.rnd() * 0.5), (this.rnd() - 0.5) * 300]; }
    this.V = [0, 0, 0]; this.visible = true; this.pose = 'vol'; this.wingsOff = true;
    this.run = Math.round(lerp(this.S.run[0], this.S.run[1], this.rnd()));
    this.visits = 0;
    this.goFlower();
  }

  goFlower() {
    const f = this.pickFlower();
    if (!f) { this.leave(); return; }
    if (this.flower && this.flower.busy === this) this.flower.busy = null;
    this.flower = f; f.busy = this;
    // it hovers beside the flower, seen side on, a little in front of it
    this.side = this.P[0] < f.P[0] ? -1 : 1;
    this.hf = this.hoverFwd(this.side);
    this.state = this.visits ? 'hop' : 'transit';
  }

  leave(fast = false) {
    if (this.flower && this.flower.busy === this) this.flower.busy = null;
    this.flower = null;
    const { w, h } = this.e, r = this.rnd();
    if (r < 0.3) this.exit = { P: [this.rnd() * w, h * (0.05 + this.rnd() * 0.3), -1600], kind: 'far' };
    else { const side = this.rnd() < 0.5 ? -1 : 1; this.exit = { P: [side < 0 ? -200 : w + 200, h * (0.05 + this.rnd() * 0.5), (this.rnd() - 0.5) * 300], kind: 'side' }; }
    this.state = 'leave'; this.boost = fast ? 1.8 : 1; this.pose = 'vol'; this.wingsOff = true; this.layerHint = null;
  }

  poke(x) {
    // the most skittish of the bouquet's visitors: it darts off at once
    if (!this.visible) return;
    this.V = mul(norm([this.P[0] - x || 1, -0.6, 0.3 * (this.rnd() - 0.5)]), 700 * this.speed);
    this.leave(true);
  }

  // The body's heading for a hover: facing the flower across, head pitched up (runtime y points down).
  hoverFwd(side) {
    const a = (this.S.pitch * Math.PI) / 180, d = norm([-side, 0, 0.25 * (this.rnd() - 0.5)]);
    return norm([d[0] * Math.cos(a), -Math.sin(a), d[2] * Math.cos(a)]);
  }

  // Where the body must be for its proboscis tip to reach the flower's heart.
  hoverAt(f, fwd, reach = 1) {
    const fr = bodyFrame([fwd[0], -fwd[1], fwd[2]], 0, [0, 1, 0]);
    const T = this.S.tip, o = [0, 1, 2].map((i) => T[0] * fr.f[i] + T[1] * fr.l[i] + T[2] * fr.u[i]);
    return sub(f.P, mul([o[0], -o[1], o[2]], this.pxmm * reach));
  }

  steer(dt, goal, vmax, arrive, k = 4) {
    const d = sub(goal, this.P), dist = len(d);
    const sp = vmax * clamp(dist / arrive, 0.05, 1);
    this.V = mix(this.V, mul(norm(d), sp), clamp(dt * k, 0, 1));
    this.P = add(this.P, mul(this.V, dt));
    return dist;
  }

  // In fast flight the body points along its course, a little head up, banking into turns.
  faceFlight(dt) {
    const v = this.V, sp = len(v);
    if (sp > 20) {
      const h = Math.hypot(v[0], v[2]) || 1;
      const dir = norm([v[0] / h, -0.3 + 0.3 * clamp(v[1] / sp, -1, 1), v[2] / h]);
      const before = this.fwd;
      this.fwd = norm(mix(this.fwd, dir, clamp(dt * 7, 0, 1)));
      const turn = (before[0] * this.fwd[2] - before[2] * this.fwd[0]) / Math.max(dt, 1e-3);
      this.bank = lerp(this.bank, clamp(turn * 0.25, -0.5, 0.5), clamp(dt * 6, 0, 1));
    }
  }

  update(dt) {
    if (this.state === 'away') {
      this.visible = false; this.t -= dt;
      if (this.t <= 0) this.spawn();
      return;
    }
    this.tick++;
    if (this.pose !== 'pose') this.frame = this.S.seq[this.tick % this.S.seq.length];
    const S = this.S, f = this.flower;
    if (this.state === 'transit' || this.state === 'hop') {
      // a fast dart, then a hard stop a little short of the hover point
      this.pose = len(sub(f.P, this.P)) < 6 * this.lengthPx ? 'butine' : 'vol';
      const want = this.hoverAt(f, this.hf);
      const dist = this.steer(dt, want, (this.state === 'hop' ? S.hop : S.speed) * this.speed * (this.boost || 1), 90, 5);
      this.faceFlight(dt);
      if (dist < 3) {
        this.state = 'hover'; this.pose = 'butine'; this.wob = 0;
        this.t = lerp(S.visit[0], S.visit[1], this.rnd());
        this.probeT = lerp(S.probe[0], S.probe[1], this.rnd()); this.reach = 1;
        this.layerHint = f.layer;
      }
    } else if (this.state === 'hover') {
      this.t -= dt; this.probeT -= dt; this.wob += dt;
      // probing: the proboscis pulled out and pushed back in (the body backs off a little), and the small corrections of a
      // hovering moth tracking its flower (a few tenths of a millimetre, 1 to 2 Hz)
      if (this.probeT <= 0) { this.reach = this.reach === 1 ? 1.12 : 1; this.probeT = this.reach > 1 ? 0.25 : lerp(S.probe[0], S.probe[1], this.rnd()); }
      const at = this.hoverAt(f, this.hf, this.reach);
      const jig = [Math.sin(this.wob * 9.4) * 0.35, Math.sin(this.wob * 7.1 + 1) * 0.5, Math.sin(this.wob * 5.3 + 2) * 0.3];
      const goal = add(at, mul(jig, this.pxmm));
      this.P = mix(this.P, goal, clamp(dt * 10, 0, 1));
      this.fwd = norm(mix(this.fwd, this.hf, clamp(dt * 8, 0, 1)));
      this.bank *= 0.9;
      if (this.t <= 0) {
        this.visits++;
        if (this.visits >= this.run) this.leave();
        else if (this.rnd() < S.restChance) this.land();
        else { this.V = [0, -40, 0]; this.layerHint = null; this.goFlower(); }
      }
    } else if (this.state === 'land') {
      this.t += dt / 0.4;
      const e = this.t * this.t * (3 - 2 * this.t);
      this.P = mix(this.from, this.landAt, clamp(e, 0, 1));
      this.fwd = norm(mix(this.fwd, this.restFwd, clamp(dt * 6, 0, 1)));
      this.bank *= 0.85;
      if (this.t >= 1) {
        // the wings fold at once into their roof: from here they are the quads
        this.state = 'rest'; this.pose = 'pose'; this.frame = 0; this.wingsOff = false;
        this.wingPose = { fore: { ...S.rest.fore }, hind: { ...S.rest.hind } };
        this.t = lerp(S.restTime[0], S.restTime[1], this.rnd());
      }
    } else if (this.state === 'rest') {
      this.t -= dt;
      if (this.t <= 0) { this.pose = 'vol'; this.wingsOff = true; this.layerHint = null; this.V = [(this.rnd() - 0.5) * 200, -260, 0]; this.goFlower(); }
    } else if (this.state === 'leave') {
      const x = this.exit;
      const dist = this.steer(dt, x.P, S.speed * 1.2 * this.speed * (this.boost || 1), 60, 3);
      this.faceFlight(dt);
      const s = PERSPECTIVE / (PERSPECTIVE - this.P[2]);
      const out = this.P[0] < -200 || this.P[0] > this.e.w + 200 || this.P[1] < -200 || this.P[2] > PERSPECTIVE * 0.68 || (x.kind === 'far' && s < 0.12) || dist < 24;
      if (out) { this.state = 'away'; this.visible = false; this.t = 5 + this.rnd() * 12; this.boost = 1; }
    }
  }

  // It settles on the flower it fed from, facing across it, head a little up.
  land() {
    const f = this.flower;
    this.state = 'land'; this.t = 0; this.from = this.P;
    this.landAt = add(f.P, [0, -f.r * 0.25 - this.lengthPx * 0.15, 4]);
    this.restFwd = norm([-this.side, -0.25, (this.rnd() - 0.5) * 0.8]);
    this.layerHint = f.layer;
  }
}
