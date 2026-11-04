// Behaviour of the buff-tailed bumblebee (worker): a heavy forager that comes in from the edges or the far meadow in a humming,
// bobbing flight, flies from flower to flower of the bouquet with almost no hover, lands heavily, works the flower on foot with its
// tongue out, takes off with a drop before it climbs, now and then leaves toward the meadow or past the viewer, and comes back later.
// It is never steered; a click makes it take off and flee, a flying one swerves. Three at most on screen (DECISIONS).
//
// Numbers (COMPORTEMENT.md, with their sources): flight between nearby flowers about 0.5 m/s (0.47 to 0.55 m/s, Bombus terrestris
// in a foraging arena at 24 and 32 °C, PMC11521611), 9 to 13 flowers a minute, 4.4 to 7 s on a flower (same study, medians far
// below the means: most visits are short, a few long); wingbeat 155 Hz (Dudley & Ellington 1990): far above the frame rate, so the
// three drawings of the false wingbeat (bourdon.mjs FLIGHT) follow one another every frame.
import { PERSPECTIVE } from './essaim.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export const BOURDON = {
  kind: 'bourdon', bodyMm: 15, strideMm: 2.8,
  speed: 500,              // mm/s between flowers (0.47 to 0.55 m/s)
  leaveSpeed: 1400,        // mm/s when it leaves the bouquet (open-field flight is faster)
  visit: [2.5, 9],         // s on a flower (4.4 to 7 s: the spread of the arena study, short visits more frequent)
  hover: [0.08, 0.35],     // s: a bumblebee barely hovers before it lands
  walk: 12,                // mm/s on the flower
  bob: { hz: 3.2, mm: 1.2 }, // the slow heave of a heavy flier, under the wingbeat
  max: 3,
};
const FLIGHT = [0, 1, 2];

export class Bourdon {
  constructor(essaim, flowers, rnd, opts = {}) {
    this.S = opts.species ?? BOURDON;
    this.e = essaim; this.flowers = flowers; this.rnd = rnd;
    this.kind = this.S.kind;
    this.lengthPx = opts.lengthPx ?? 14;
    this.speed = (opts.speed ?? 1) * (0.85 + 0.3 * rnd());
    this.P = [0, 0, 0]; this.V = [0, 0, 0]; this.fwd = [1, 0, 0]; this.bank = 0;
    this.pose = 'vol'; this.frame = 0; this.visible = false;
    this.state = 'away'; this.t = 0.5 + rnd() * 4;
    this.tick = Math.floor(rnd() * 3); this.phase = 0; this.visits = 0;
    this.wob = rnd() * 100;
  }

  get pxmm() { return this.lengthPx / this.S.bodyMm; }

  pickFlower() {
    const free = this.flowers.filter((f) => f !== this.flower && !f.busy);
    if (!free.length) return null;
    // flower constancy and short hops, like the honeybee, a little less fussy about distance
    const w = free.map((f) => 1 / (len(sub(f.P, this.P)) + 90) ** 1.2);
    let s = w.reduce((a, b) => a + b, 0) * this.rnd();
    for (let i = 0; i < free.length; i++) { s -= w[i]; if (s <= 0) return free[i]; }
    return free[free.length - 1];
  }

  exitPoint() {
    const { w, h } = this.e, r = this.rnd();
    if (r < 0.2) return { P: [w / 2 + (this.rnd() - 0.5) * w * 0.6, h * (0.25 + this.rnd() * 0.4), PERSPECTIVE * 0.72], kind: 'past' };
    if (r < 0.5) return { P: [this.rnd() * w, h * (0.15 + this.rnd() * 0.4), -1600], kind: 'far' };
    const side = this.rnd() < 0.5 ? -1 : 1;
    return { P: [side < 0 ? -160 : w + 160, h * (0.1 + this.rnd() * 0.6), (this.rnd() - 0.5) * 300], kind: 'side' };
  }

  spawn() {
    const { w, h } = this.e, r = this.rnd();
    if (r < 0.35) this.P = [this.rnd() * w, h * (0.15 + this.rnd() * 0.3), -1500];
    else { const side = this.rnd() < 0.5 ? -1 : 1; this.P = [side < 0 ? -140 : w + 140, h * (0.2 + this.rnd() * 0.55), (this.rnd() - 0.5) * 400]; }
    this.V = [0, 0, 0]; this.visible = true; this.pose = 'vol';
    this.goFlower();
  }

  goFlower() {
    const f = this.pickFlower();
    if (!f) { this.leave(); return; }
    if (this.flower && this.flower.busy === this) this.flower.busy = null;
    this.flower = f; f.busy = this;
    this.state = 'transit';
  }

  leave(fast = false) {
    if (this.flower && this.flower.busy === this) this.flower.busy = null;
    this.flower = null;
    this.exit = this.exitPoint();
    this.state = 'leave'; this.boost = fast ? 1.6 : 1;
  }

  poke(x) {
    if (this.state === 'forage' || this.state === 'land' || this.state === 'hover') {
      this.layerHint = null; this.pose = 'vol';
      this.V = mul(norm([this.P[0] - x, -40, 30 * (this.rnd() - 0.5)]), 0.9 * this.S.speed * this.pxmm);
      this.leave(true);
    } else if (this.visible) {
      const side = norm([-this.V[1] || 1, this.V[0], this.rnd() - 0.5]);
      this.V = add(this.V, mul(side, 0.7 * this.S.speed * this.pxmm * (this.rnd() < 0.5 ? -1 : 1)));
      this.swerve = 0.4;
    }
  }

  steer(dt, goal, vmax, arrive) {
    const d = sub(goal, this.P), dist = len(d);
    const sp = vmax * clamp(dist / arrive, 0.15, 1);
    this.wob += dt;
    // a wide, slow meander, and the heave of a heavy body (BOURDON.bob) more than the bee's zig-zag
    const wa = clamp(dist / 300, 0.15, 1) * 0.35 * vmax;
    const B = this.S.bob, heave = Math.sin(this.wob * 2 * Math.PI * B.hz) * B.mm * this.pxmm * 2 * Math.PI * B.hz;
    const wander = [Math.sin(this.wob * 1.3) * wa, Math.sin(this.wob * 1.9 + 1) * wa * 0.5 + heave, Math.sin(this.wob * 1.1 + 2) * wa];
    const want = add(mul(norm(d), sp), wander);
    this.V = mix(this.V, want, clamp(dt * (this.swerve > 0 ? 1.2 : 3.2), 0, 1));
    this.P = add(this.P, mul(this.V, dt));
    return dist;
  }

  faceFlight(dt) {
    const v = this.V, sp = len(v);
    if (sp > 15) {
      const dir = norm([v[0], v[1] * 0.25, v[2]]);
      const before = this.fwd;
      this.fwd = norm(mix(this.fwd, dir, clamp(dt * 4.5, 0, 1)));
      const turn = (before[0] * this.fwd[2] - before[2] * this.fwd[0]) / Math.max(dt, 1e-3);
      this.bank = mix([this.bank, 0, 0], [clamp(turn * 0.3, -0.5, 0.5), 0, 0], clamp(dt * 4, 0, 1))[0];
    }
  }

  faceTo(P, dt, pitch = 0) {
    const d = sub(P, this.P), h = Math.hypot(d[0], d[2]);
    const want = h < 6 ? norm([this.fwd[0], pitch, this.fwd[2] + 0.001]) : norm([d[0] / h, pitch, d[2] / h]);
    this.fwd = norm(mix(this.fwd, want, clamp(dt * 4, 0, 1)));
  }

  update(dt) {
    if (this.swerve > 0) this.swerve -= dt;
    this.tick++;
    const S = this.S, px = this.pxmm;
    if (this.state === 'away') {
      this.visible = false; this.t -= dt;
      if (this.t <= 0) this.spawn();
      return;
    }
    if (this.pose === 'vol') this.frame = FLIGHT[this.tick % FLIGHT.length];
    const f = this.flower;
    if (this.state === 'transit') {
      const hover = add(f.P, [0, -f.r * 0.6 - this.lengthPx * 0.4, 8]);
      const dist = this.steer(dt, hover, S.speed * px * this.speed * (this.boost || 1), 12 * S.bodyMm * px * 0.4);
      this.faceFlight(dt);
      if (dist < 10) { this.state = 'hover'; this.t = S.hover[0] + this.rnd() * (S.hover[1] - S.hover[0]); this.hoverAt = hover; }
    } else if (this.state === 'hover') {
      this.wob += dt;
      const j = [Math.sin(this.wob * 9) * 1.2, Math.sin(this.wob * 6 + 1) * 1.6, Math.sin(this.wob * 5) * 1.5];
      this.P = mix(this.P, add(this.hoverAt, j), clamp(dt * 7, 0, 1));
      this.V = mul(this.V, 0.85);
      this.faceTo(f.P, dt, -0.12);
      this.bank *= 0.9; this.t -= dt;
      if (this.t <= 0) {
        this.state = 'land'; this.t = 0; this.from = this.P;
        const a = this.rnd() * Math.PI * 2, rr = f.r * 0.25 * this.rnd();
        this.landAt = add(f.P, [Math.cos(a) * rr, -f.r * 0.15 + Math.sin(a) * rr * 0.4, 4]);
      }
    } else if (this.state === 'land') {
      // a heavy landing: quick, with a small dip below the spot and back (the flower gives under its weight)
      this.t += dt / 0.22;
      const e = clamp(this.t, 0, 1), dip = Math.sin(Math.PI * clamp((this.t - 0.7) / 0.6, 0, 1)) * 1.2 * px;
      this.P = add(mix(this.from, this.landAt, e * e * (3 - 2 * e)), [0, dip, 0]);
      this.layerHint = f.layer;
      if (this.t >= 1.3) {
        this.state = 'forage'; this.pose = 'butine'; this.frame = 0; this.visits++;
        // most visits short, a few long (the arena study's spread)
        this.t = S.visit[0] + Math.pow(this.rnd(), 2) * (S.visit[1] - S.visit[0]); this.step = 0.6 + this.rnd();
      }
    } else if (this.state === 'forage') {
      this.t -= dt; this.step -= dt;
      if (this.pose !== 'marche' && this.step <= 0) {
        // it walks over the flower from one spot to the next, tongue out between
        this.pose = 'marche'; this.step = 0.5 + this.rnd() * 0.9;
        const a = this.rnd() * Math.PI * 2, rr = f.r * 0.3;
        this.walkTo = add(f.P, [Math.cos(a) * rr, -f.r * 0.15 + Math.sin(a) * rr * 0.35, 4]);
      } else if (this.pose === 'marche') {
        const d = sub(this.walkTo, this.P), dist = len(d), v = Math.min(dist, S.walk * px * dt);
        if (dist > 0.5) {
          this.P = add(this.P, mul(norm(d), v));
          this.fwd = norm(mix(this.fwd, norm([d[0], 0.4 * Math.abs(d[1]) + 0.25, d[2]]), clamp(dt * 5, 0, 1)));
          this.phase = (this.phase + v / (S.strideMm * px)) % 1;
          this.frame = Math.floor(this.phase * 8) % 8;
        }
        if (this.step <= 0 || dist < 0.5) { this.pose = 'butine'; this.frame = 0; this.step = 0.8 + this.rnd() * 1.6; }
      } else {
        this.fwd = norm(mix(this.fwd, [this.fwd[0], 0.4, this.fwd[2]], clamp(dt * 3, 0, 1)));
      }
      this.bank = 0;
      if (this.t <= 0) {
        // the take-off of a loaded bumblebee: it drops a little before it climbs
        this.state = 'takeoff'; this.t = 0.35; this.pose = 'vol'; this.layerHint = null;
        this.V = [(this.rnd() - 0.5) * 60, 40, (this.rnd() - 0.5) * 60];
      }
    } else if (this.state === 'takeoff') {
      this.V = add(this.V, mul([0, -1, 0], 900 * dt * px / 0.9));
      this.P = add(this.P, mul(this.V, dt));
      this.faceFlight(dt); this.t -= dt;
      if (this.t <= 0) {
        const leaveP = 0.1 + Math.min(0.3, this.visits * 0.035);
        if (this.rnd() < leaveP) { this.visits = 0; this.leave(); } else this.goFlower();
      }
    } else if (this.state === 'leave') {
      const x = this.exit;
      const dist = this.steer(dt, x.P, S.leaveSpeed * px * this.speed * (this.boost || 1), 60);
      this.faceFlight(dt);
      const s = PERSPECTIVE / (PERSPECTIVE - this.P[2]);
      const out = this.P[0] < -150 || this.P[0] > this.e.w + 150 || this.P[1] < -150 || this.P[2] > PERSPECTIVE * 0.68 || (x.kind === 'far' && s < 0.09) || dist < 20;
      if (out) { this.state = 'away'; this.visible = false; this.t = 4 + this.rnd() * 10; this.boost = 1; }
    }
  }
}
