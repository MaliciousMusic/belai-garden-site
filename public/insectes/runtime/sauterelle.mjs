// Behaviour of the great green bush-cricket of the bouquet: it comes in flying, lands on a flower and sits there a long while,
// sweeping its antennae; now and then it walks a few steps over the flower; then it crouches and jumps, opens its wings at the
// take-off and flies a short way to another flower, or out of the view. It is never steered; a click makes it jump and flee.
// Its four wings (tegmina and hind wings) are runtime quads (essaim.placeWings) shown only in the air (b.wingsShown); at rest the
// folded tegmina are part of the body's atlas cells.
//
// Numbers (insectes/sauterelle/COMPORTEMENT.md):
//  - jump (Burrows & Morris 2003, J Exp Biol 206:1035, the bush-cricket Pholidoptera griseoaptera): take-off at 2.1 m/s and 34 deg,
//    the hind tibiae extended in 30 ms, 300 mm jumped; T. viridissima spreads its wings before the hind tarsi leave the ground
//    (Brackenbury 1990, J Zool 220:593) and flies on;
//  - walk (katydids, bioRxiv 2025.04.04.647231): stance 0.48 s at a duty factor of 0.67, a stride cycle of 0.72 s (1.4 Hz);
//  - wingbeat: 20 to 29 Hz in free flight for a bush-cricket (Springer, Insect Bioacoustics and Biotremology, 2025), drawn as three
//    positions in turn (DECISIONS: fast beats as a cycle of a few drawings).
import { PERSPECTIVE } from './essaim.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const lerp = (a, b, t) => a + (b - a) * t;

export const SAUTERELLE = {
  kind: 'sauterelle', bodyMm: 32.4,
  // jump: crouch, push (30 ms), take-off speed (mm/s) and angle; gravity 9.81 m/s2
  crouch: 0.28, push: 0.03, jumpV: 2100, jumpDeg: 34, g: 9810,
  // walk: cycle 0.72 s, stride 10 mm (the reach of the fore legs in the model)
  walkHz: 1.39, strideMm: 10,
  // flight: three wing drawings in turn at about 20 Hz; speed (mm/s, an order of magnitude, to be measured on video); short flights
  beatHz: 20, flightV: 900, flight: [0.8, 2.2],
  // wing angles (flap 0 spread flat, 90 closed above the back; sweep: drawn back) for the up, middle and down drawings
  wings: [
    { fore: { flap: 62, sweep: -6 }, hind: { flap: 70, sweep: -4 } },
    { fore: { flap: 25, sweep: 4 }, hind: { flap: 20, sweep: 6 } },
    { fore: { flap: 4, sweep: 2 }, hind: { flap: -12, sweep: 6 } },
  ],
  visit: [10, 28],
};

export class Sauterelle {
  constructor(essaim, flowers, rnd, opts = {}) {
    this.S = opts.species ?? SAUTERELLE;
    this.e = essaim; this.flowers = flowers; this.rnd = rnd;
    this.kind = this.S.kind;
    this.lengthPx = opts.lengthPx ?? 30;
    this.P = [0, 0, 0]; this.V = [0, 0, 0]; this.fwd = [1, 0, 0]; this.bank = 0;
    this.pose = 'vol'; this.frame = 0; this.visible = false;
    this.state = 'away'; this.t = 1 + rnd() * 4;
    this.beat = 0; this.walkPh = 0; this.wingsShown = false;
    this.wingPose = { fore: { flap: 25, sweep: 0 }, hind: { flap: 20, sweep: 0 } };
  }

  get pxmm() { return this.lengthPx / this.S.bodyMm; }

  pickFlower() {
    const free = this.flowers.filter((f) => f !== this.flower && !f.busy);
    if (!free.length) return null;
    // a short hop is likelier than a long flight
    const w = free.map((f) => 1 / (len(sub(f.P, this.P)) + 120));
    let s = w.reduce((a, b) => a + b, 0) * this.rnd();
    for (let i = 0; i < free.length; i++) { s -= w[i]; if (s <= 0) return free[i]; }
    return free[free.length - 1];
  }

  spawn() {
    const { w, h } = this.e, side = this.rnd() < 0.5 ? -1 : 1;
    this.P = [side < 0 ? -120 : w + 120, h * (0.1 + this.rnd() * 0.4), (this.rnd() - 0.5) * 300];
    this.visible = true;
    const f = this.pickFlower();
    if (!f) { this.state = 'away'; this.visible = false; this.t = 6; return; }
    this.claim(f);
    this.fly(this.target(f));
  }

  claim(f) { if (this.flower && this.flower.busy === this) this.flower.busy = null; this.flower = f; if (f) f.busy = this; }
  target(f) { return add(f.P, [(this.rnd() - 0.5) * f.r * 0.5, -f.r * 0.15, 4]); }

  // ---- flight ---------------------------------------------------------------------------------------------------
  fly(goal, out = false) {
    this.state = 'vol'; this.pose = 'vol'; this.wingsShown = true; this.goal = goal; this.out = out;
    this.t = lerp(this.S.flight[0], this.S.flight[1], this.rnd());
  }

  flyStep(dt) {
    const S = this.S, d = sub(this.goal, this.P), dist = len(d), v = S.flightV * this.pxmm;
    const want = mul(norm(d), Math.min(v, dist * 3 + 20));
    this.V = mix(this.V, want, clamp(dt * 3, 0, 1));
    this.P = add(this.P, mul(this.V, dt));
    // three drawings in turn, one per frame at most (about 20 beats a second)
    this.beat = (this.beat + dt * S.beatHz * 3) % 3;
    this.wingPose = S.wings[Math.floor(this.beat)];
    // the body follows its course, head up about 20 deg (c250)
    const sp = len(this.V);
    if (sp > 10) this.fwd = norm(mix(this.fwd, norm([this.V[0], -0.35 * Math.abs(this.V[0]) / (sp || 1) - 0.25, this.V[2]]), clamp(dt * 5, 0, 1)));
    if (dist < 10 && !this.out) this.land();
    const s = PERSPECTIVE / (PERSPECTIVE - this.P[2]);
    if (this.out && (this.P[0] < -150 || this.P[0] > this.e.w + 150 || this.P[1] < -150 || s < 0.15)) {
      this.state = 'away'; this.visible = false; this.wingsShown = false; this.t = 8 + this.rnd() * 14; this.claim(null);
    }
  }

  land() {
    this.state = 'pose'; this.pose = 'pose'; this.frame = 0; this.wingsShown = false; this.V = [0, 0, 0];
    this.layerHint = this.flower?.layer ?? null;
    const sx = this.rnd() < 0.5 ? -1 : 1;
    this.fwd = norm([sx, -0.12, (this.rnd() - 0.5) * 0.9]);
    this.t = lerp(this.S.visit[0], this.S.visit[1], this.rnd());
    this.mood = 2 + this.rnd() * 5;
  }

  // ---- jump -------------------------------------------------------------------------------------------------------
  jump(away) {
    this.state = 'crouch'; this.pose = 'saut'; this.frame = 0; this.jt = 0; this.away = away;
  }

  jumpStep(dt) {
    const S = this.S;
    this.jt += dt;
    if (this.state === 'crouch') {
      if (this.jt >= S.crouch) { this.state = 'push'; this.frame = 1; this.jt = 0; }
      return;
    }
    if (this.state === 'push') {
      if (this.jt < S.push + 1 / 60) return;
      // take-off: the wings open before the hind tarsi leave the ground (Brackenbury 1990)
      this.state = 'leap'; this.frame = 2; this.wingsShown = true; this.wingPose = S.wings[0]; this.layerHint = null;
      const a = (S.jumpDeg * Math.PI) / 180, side = Math.sign(this.fwd[0]) || 1, v = S.jumpV * this.pxmm;
      this.V = [side * v * Math.cos(a), -v * Math.sin(a), (this.rnd() - 0.5) * v * 0.3];
      this.jt = 0;
      return;
    }
    // airborne: ballistic for a moment, then the wings take over
    this.V[1] += S.g * this.pxmm * dt;
    this.P = add(this.P, mul(this.V, dt));
    this.beat = (this.beat + dt * S.beatHz * 3) % 3;
    this.wingPose = S.wings[Math.floor(this.beat)];
    if (this.jt > 0.12) {
      if (this.away) this.fly(this.exitPoint(), true);
      else { const f = this.pickFlower(); this.claim(f); if (f) this.fly(this.target(f)); else this.fly(this.exitPoint(), true); }
    }
  }

  exitPoint() {
    const { w, h } = this.e, side = this.rnd() < 0.5 ? -1 : 1;
    return this.rnd() < 0.3 ? [this.rnd() * w, h * 0.2, -1600] : [side < 0 ? -200 : w + 200, h * (0.1 + this.rnd() * 0.5), (this.rnd() - 0.5) * 300];
  }

  // ---- on the flower --------------------------------------------------------------------------------------------
  restStep(dt) {
    const S = this.S;
    this.t -= dt; this.mood -= dt;
    if (this.state === 'marche') {
      // a few steps over the flower: the walk cycle at its measured cadence, the body moving one stride per cycle
      this.walkPh = (this.walkPh + dt * S.walkHz) % 1;
      this.frame = Math.floor(this.walkPh * 6) % 6;
      const step = S.strideMm * S.walkHz * this.pxmm;
      this.P = add(this.P, mul(norm([this.fwd[0], 0, this.fwd[2]]), step * dt));
      if (this.flower && len(sub(this.P, this.flower.P)) > this.flower.r * 0.6) this.fwd = norm([-this.fwd[0], this.fwd[1], -this.fwd[2]]);
    }
    if (this.mood <= 0) {
      const walk = this.state !== 'marche' && this.rnd() < 0.45;
      this.state = walk ? 'marche' : 'pose'; this.pose = this.state; this.frame = 0;
      this.mood = walk ? 1.5 + this.rnd() * 2.5 : 3 + this.rnd() * 6;
    }
    if (this.t <= 0) this.jump(this.rnd() < 0.25);
  }

  poke() {
    if (this.state === 'pose' || this.state === 'marche') this.jump(true);
    else if (this.state === 'vol') { this.goal = this.exitPoint(); this.out = true; }
  }

  update(dt) {
    if (this.state === 'away') {
      this.visible = false; this.t -= dt;
      if (this.t <= 0) this.spawn();
      return;
    }
    if (this.state === 'vol') this.flyStep(dt);
    else if (this.state === 'crouch' || this.state === 'push' || this.state === 'leap') this.jumpStep(dt);
    else this.restStep(dt);
  }
}
