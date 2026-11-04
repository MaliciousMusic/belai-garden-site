// Behaviour of the honeybee: a forager that comes in from the edges, visits the flowers of the bouquet one after another
// (approach, short hover, landing, foraging with a few steps, take-off), now and then leaves the view toward the far
// meadow or right past the viewer, and comes back later. It is never steered; a click makes it take off and flee.
//
// Orders of magnitude (worker, FICHE.md): between nearby flowers it flies at about 1 to 2 m/s, hovers a fraction of a
// second before landing, stays 2 to 7 s on a flower. On screen the speeds are scaled to its body length.
import { PERSPECTIVE } from './essaim.mjs';

const BODY_MM = 12.5, STRIDE_MM = 2.2;
const FLIGHT = [0, 1, 2, 1];
// at most four bees on screen at once (DECISIONS); the others wait out of view, so ?n= may ask for more
export const MAX_VISIBLE = 4;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export class Abeille {
  // flowers: [{ P: scene point of the heart, r: radius in scene px, layer }], shared by all the bees of the bouquet.
  constructor(essaim, flowers, rnd, opts = {}) {
    this.e = essaim; this.flowers = flowers; this.rnd = rnd;
    this.kind = 'abeille';
    this.lengthPx = opts.lengthPx ?? 30;
    this.speed = (opts.speed ?? 1) * (0.85 + 0.3 * rnd());
    this.maxVisible = opts.maxVisible ?? MAX_VISIBLE; // (the shop's scene, 2026-10-25: three times as many bees)
    this.P = [0, 0, 0]; this.V = [0, 0, 0]; this.fwd = [1, 0, 0]; this.bank = 0;
    this.pose = 'vol'; this.frame = 0; this.visible = false;
    this.state = 'away'; this.t = 0.3 + rnd() * 3;
    this.tick = Math.floor(rnd() * 4); this.phase = 0; this.visits = 0;
    this.wob = rnd() * 100;
  }

  get pxmm() { return this.lengthPx / BODY_MM; }

  // ---- choices ------------------------------------------------------------------------------------------------
  pickFlower() {
    const free = this.flowers.filter((f) => f !== this.flower && !f.busy);
    if (!free.length) return null;
    // Flower constancy and short hops: nearer flowers are much more likely.
    const w = free.map((f) => 1 / (len(sub(f.P, this.P)) + 60) ** 1.5);
    let s = w.reduce((a, b) => a + b, 0) * this.rnd();
    for (let i = 0; i < free.length; i++) { s -= w[i]; if (s <= 0) return free[i]; }
    return free[free.length - 1];
  }

  exitPoint() {
    const { w, h } = this.e, r = this.rnd();
    if (r < 0.22) return { P: [w / 2 + (this.rnd() - 0.5) * w * 0.6, h * (0.25 + this.rnd() * 0.4), PERSPECTIVE * 0.72], kind: 'past' }; // right past the viewer
    if (r < 0.45) return { P: [this.rnd() * w, h * (0.1 + this.rnd() * 0.4), -1600], kind: 'far' };                                // toward the far meadow
    const side = this.rnd() < 0.5 ? -1 : 1;
    return { P: [side < 0 ? -160 : w + 160, h * (0.05 + this.rnd() * 0.6), (this.rnd() - 0.5) * 300], kind: 'side' };
  }

  spawn() {
    const { w, h } = this.e, r = this.rnd();
    if (r < 0.3) this.P = [this.rnd() * w, h * (0.1 + this.rnd() * 0.3), -1500];            // from the far meadow
    else if (r < 0.45) this.P = [this.rnd() * w, -120, (this.rnd() - 0.5) * 300];           // from above
    else { const side = this.rnd() < 0.5 ? -1 : 1; this.P = [side < 0 ? -140 : w + 140, h * (0.1 + this.rnd() * 0.6), (this.rnd() - 0.5) * 400]; }
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
    this.state = 'leave'; this.boost = fast ? 1.8 : 1;
  }

  // A click: a forager on its flower takes off and flees; a flying one swerves.
  poke(x, y) {
    if (this.state === 'forage' || this.state === 'land' || this.state === 'hover') {
      this.layerHint = null; this.pose = 'vol';
      const away = norm([this.P[0] - x, -60, 30 * (this.rnd() - 0.5)]);
      this.V = mul(away, 420 * this.speed);
      this.leave(true);
    } else if (this.visible) {
      const side = norm([-this.V[1] || 1, this.V[0], (this.rnd() - 0.5)]);
      this.V = add(this.V, mul(side, 380 * (this.rnd() < 0.5 ? -1 : 1)));
      this.swerve = 0.35;
    }
  }

  // ---- motion ---------------------------------------------------------------------------------------------------
  steer(dt, goal, vmax, arrive) {
    const d = sub(goal, this.P), dist = len(d);
    const sp = vmax * clamp(dist / arrive, 0.12, 1);
    // Wander: the zig-zag of a bee looking for flowers, weaker close to the goal.
    this.wob += dt;
    const wa = clamp(dist / 300, 0.15, 1) * 70 * this.speed;
    const wander = [Math.sin(this.wob * 2.3) * wa, Math.sin(this.wob * 3.1 + 1) * wa * 0.6, Math.sin(this.wob * 1.7 + 2) * wa];
    const want = add(mul(norm(d), sp), wander);
    const k = this.swerve > 0 ? 1.5 : 4.5;
    this.V = mix(this.V, want, clamp(dt * k, 0, 1));
    this.P = add(this.P, mul(this.V, dt));
    return dist;
  }

  faceFlight(dt) {
    const v = this.V, sp = len(v);
    if (sp > 20) {
      const dir = norm([v[0], v[1] * 0.3, v[2]]);
      const before = this.fwd;
      this.fwd = norm(mix(this.fwd, dir, clamp(dt * 7, 0, 1)));
      const turn = (before[0] * this.fwd[2] - before[2] * this.fwd[0]) / Math.max(dt, 1e-3);
      this.bank = mix([this.bank, 0, 0], [clamp(turn * 0.35, -0.6, 0.6), 0, 0], clamp(dt * 5, 0, 1))[0];
    }
  }

  update(dt) {
    if (this.swerve > 0) this.swerve -= dt;
    this.tick++;
    if (this.state === 'away') {
      this.visible = false;
      this.t -= dt;
      if (this.t <= 0) {
        const shown = this.e.insects.filter((b) => b.kind === 'abeille' && b.visible).length;
        if (shown < this.maxVisible) this.spawn(); else this.t = 0.5 + this.rnd() * 2;
      }
      return;
    }
    if (this.pose === 'vol') this.frame = FLIGHT[this.tick % 4];

    const f = this.flower;
    if (this.state === 'transit') {
      const hover = add(f.P, [0, -f.r * 0.9 - this.lengthPx * 0.5, 8]);
      const dist = this.steer(dt, hover, 330 * this.speed * (this.boost || 1), 170);
      this.faceFlight(dt);
      if (dist < 12) { this.state = 'hover'; this.t = 0.35 + this.rnd() * 1.1; this.hoverAt = hover; }
    } else if (this.state === 'hover') {
      this.wob += dt;
      const j = [Math.sin(this.wob * 23) * 1.6, Math.sin(this.wob * 17 + 1) * 1.2, Math.sin(this.wob * 11) * 2];
      this.P = mix(this.P, add(this.hoverAt, j), clamp(dt * 8, 0, 1));
      this.V = mul(this.V, 0.85);
      this.faceTo(f.P, dt, -0.08);
      this.bank *= 0.9;
      this.t -= dt;
      if (this.t <= 0) {
        this.state = 'land'; this.t = 0; this.from = this.P;
        const a = this.rnd() * Math.PI * 2, rr = f.r * 0.25 * this.rnd();
        this.landAt = add(f.P, [Math.cos(a) * rr, -f.r * 0.2 + Math.sin(a) * rr * 0.4, 4]);
      }
    } else if (this.state === 'land') {
      this.t += dt / 0.32;
      const e = this.t * this.t * (3 - 2 * this.t);
      this.P = mix(this.from, this.landAt, clamp(e, 0, 1));
      this.layerHint = f.layer;
      if (this.t >= 1) { this.state = 'forage'; this.t = 2 + this.rnd() * 5; this.pose = 'butine'; this.frame = 0; this.step = 0.4 + this.rnd(); this.visits++; }
    } else if (this.state === 'forage') {
      this.t -= dt; this.step -= dt;
      if (this.pose === 'butine' && this.step <= 0) {
        // a few steps on the flower, around its heart
        this.pose = 'marche'; this.step = 0.4 + this.rnd() * 0.8;
        const a = this.rnd() * Math.PI * 2, rr = f.r * 0.3;
        this.walkTo = add(f.P, [Math.cos(a) * rr, -f.r * 0.2 + Math.sin(a) * rr * 0.35, 4]);
      } else if (this.pose === 'marche') {
        const d = sub(this.walkTo, this.P), dist = len(d);
        const v = Math.min(dist, 9 * this.pxmm * dt); // about 9 mm/s
        if (dist > 0.5) {
          this.P = add(this.P, mul(norm(d), v));
          this.fwd = norm(mix(this.fwd, norm([d[0], 0.4 * Math.abs(d[1]) + 0.25, d[2]]), clamp(dt * 6, 0, 1)));
          this.phase = (this.phase + v / (STRIDE_MM * this.pxmm)) % 1;
          this.frame = Math.floor(this.phase * 8) % 8;
        }
        if (this.step <= 0 || dist < 0.5) { this.pose = 'butine'; this.frame = 0; this.step = 0.6 + this.rnd() * 1.4; }
      } else {
        // head down into the flower
        this.fwd = norm(mix(this.fwd, [this.fwd[0], 0.35, this.fwd[2]], clamp(dt * 3, 0, 1)));
      }
      this.bank = 0;
      if (this.t <= 0) {
        this.state = 'takeoff'; this.t = 0.28; this.pose = 'vol'; this.layerHint = null;
        this.V = [(this.rnd() - 0.5) * 120, -190, (this.rnd() - 0.5) * 120];
      }
    } else if (this.state === 'takeoff') {
      this.P = add(this.P, mul(this.V, dt));
      this.faceFlight(dt);
      this.t -= dt;
      if (this.t <= 0) {
        const leaveP = 0.12 + Math.min(0.3, this.visits * 0.04);
        if (this.rnd() < leaveP) { this.visits = 0; this.leave(); } else this.goFlower();
      }
    } else if (this.state === 'leave') {
      const x = this.exit;
      const dist = this.steer(dt, x.P, 420 * this.speed * (this.boost || 1), 60);
      this.faceFlight(dt);
      const s = PERSPECTIVE / (PERSPECTIVE - this.P[2]);
      const out = this.P[0] < -150 || this.P[0] > this.e.w + 150 || this.P[1] < -150 || this.P[2] > PERSPECTIVE * 0.68 || (x.kind === 'far' && s < 0.09) || dist < 20;
      if (out) { this.state = 'away'; this.visible = false; this.t = 3 + this.rnd() * 8; this.boost = 1; }
    }
  }

  faceTo(P, dt, pitch = 0) {
    const d = sub(P, this.P);
    // Right above its flower the direction to the heart is vertical: keep the heading, only set the pitch.
    const h = Math.hypot(d[0], d[2]);
    const want = h < 6 ? norm([this.fwd[0], pitch, this.fwd[2] + 0.001]) : norm([d[0] / h, pitch, d[2] / h]);
    this.fwd = norm(mix(this.fwd, want, clamp(dt * 5, 0, 1)));
  }
}
