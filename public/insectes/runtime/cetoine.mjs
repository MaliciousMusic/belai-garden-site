// Behaviour of the rose chafer (Cetonia aurata) over the bouquet (cetoine/COMPORTEMENT.md): one at most on screen. It comes in
// with a straight, buzzing flight, its elytra closed and its hind wings out through the side notches, body pitched up and legs
// hanging; lands heavily on a flower, walks a little over it, then digs in, head down in the flower's heart, and feeds there a long
// while, now and then shifting; it may walk to the flower's edge before it takes off: the wings unfold first (half a second), then
// it lifts off. A click makes it drop its hold and fly off. It is never steered.
// Its hind wings are runtime quads (essaim.placeWings): this module sets b.wingPose. The wingbeat (about 85 Hz, COMPORTEMENT.md) is
// far over the frame rate, so it is drawn as a faux of animation (DECISIONS: two or three drawings that loop, each holding two sets
// of wings in arc): the 'hind' quads carry the wing at one point of the stroke, the 'fore' quads a fainter ghost at another.
import { PERSPECTIVE } from './essaim.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const lerp = (a, b, t) => a + (b - a) * t;

// The species' numbers (COMPORTEMENT.md, sources there): body 18 mm, flight speed in mm/s, the walk, the visit, the faux of the stroke.
export const CETOINE = {
  kind: 'cetoine', bodyMm: 18,
  flySpeed: 2200,            // mm/s: a straight flight of 2 to 3 m/s
  walk: 5,                   // mm/s on the flower (video v2: about a third of a body length per second)
  stepHz: 2.2,               // tripod cycles per second at that pace
  visit: [25, 70],           // s buried in a flower
  surface: [2, 6],           // s walking on it before digging in or before leaving
  unfold: 0.55,              // s to unfold the wings before lift-off (c061 to c064)
  pitchFly: 0.45,            // the body pitched up in flight (c071: 25 to 35 degrees)
  // the faux of the stroke: three drawings looped at 30 per second, each the wing at one angle of the stroke (flap, sweep, degrees)
  // and a ghost at another (alpha): the top of the stroke, the downstroke swept forward, the bottom
  faux: [
    { main: { flap: 62, sweep: 12 }, ghost: { flap: 30, sweep: 4, alpha: 0.45 } },
    { main: { flap: 20, sweep: -24 }, ghost: { flap: 44, sweep: -6, alpha: 0.4 } },
    { main: { flap: -38, sweep: -8 }, ghost: { flap: -12, sweep: -18, alpha: 0.45 } },
  ],
  fauxHz: 30,
  // on screen the flight is slowed three times: at true size a chafer crossing at 2 m/s spans the page in under a second
  slow: 1 / 3,
};

export class Cetoine {
  constructor(essaim, flowers, rnd, opts = {}) {
    this.S = opts.species ?? CETOINE;
    this.e = essaim; this.flowers = flowers; this.rnd = rnd;
    this.kind = this.S.kind;
    this.lengthPx = opts.lengthPx ?? 16;
    this.P = [0, 0, 0]; this.V = [0, 0, 0]; this.fwd = [1, 0, 0]; this.bank = 0;
    this.pose = 'vol'; this.frame = 0; this.visible = false;
    this.state = 'away'; this.t = 1 + rnd() * 3;
    this.wob = rnd() * 100; this.phase = 0; this.fx = 0;
    this.wingPose = { fore: { flap: 0, sweep: 0, alpha: 0 }, hind: { flap: 0, sweep: 0, alpha: 0 } };
  }

  get mmPx() { return this.lengthPx / this.S.bodyMm; }

  pickFlower() {
    const free = this.flowers.filter((f) => f !== this.flower && !f.busy);
    if (!free.length) return null;
    // chafers go for the big open flowers: the larger the head, the likelier
    const w = free.map((f) => f.r * f.r / (len(sub(f.P, this.P)) + 300));
    let s = w.reduce((a, b) => a + b, 0) * this.rnd();
    for (let i = 0; i < free.length; i++) { s -= w[i]; if (s <= 0) return free[i]; }
    return free[free.length - 1];
  }

  spawn() {
    const { w, h } = this.e, r = this.rnd();
    if (r < 0.4) this.P = [this.rnd() * w, h * (0.05 + this.rnd() * 0.3), -1500];
    else { const side = this.rnd() < 0.5 ? -1 : 1; this.P = [side < 0 ? -150 : w + 150, h * (0.05 + this.rnd() * 0.45), (this.rnd() - 0.5) * 300]; }
    this.V = [0, 0, 0]; this.visible = true; this.pose = 'vol';
    this.goFlower();
  }

  goFlower() {
    const f = this.pickFlower();
    if (!f) { this.leave(); return; }
    if (this.flower && this.flower.busy === this) this.flower.busy = null;
    this.flower = f; f.busy = this; this.state = 'transit';
  }

  leave(fast = false) {
    if (this.flower && this.flower.busy === this) this.flower.busy = null;
    this.flower = null;
    const { w, h } = this.e;
    const side = this.rnd() < 0.5 ? -1 : 1;
    this.exit = this.rnd() < 0.4 ? { P: [this.rnd() * w, h * 0.1, -1800], far: true } : { P: [side < 0 ? -200 : w + 200, h * (0.05 + this.rnd() * 0.3), (this.rnd() - 0.5) * 300] };
    this.state = 'leave'; this.boost = fast ? 1.4 : 1;
  }

  poke() {
    if (['feed', 'walk', 'land', 'unfold'].includes(this.state)) {
      // it lets go: a short drop, the wings out, then away
      this.layerHint = null; this.state = 'unfold'; this.t = this.S.unfold * 0.5; this.fleeing = true;
    } else if (this.visible) {
      this.V = add(this.V, mul(norm([-this.V[1] || 1, this.V[0], 0]), 400 * this.mmPx * (this.rnd() < 0.5 ? -1 : 1) * this.S.slow));
    }
  }

  // the faux of the stroke: one of the drawings, chosen by time, the wings fully out
  strokeWings(dt, open = 1) {
    // (a chafer that never flew before has no phase yet: the HUD's carrier, porteuses.mjs, starts it in flight)
    this.phase = ((this.phase || 0) + (dt || 0) * this.S.fauxHz) % this.S.faux.length;
    const d = this.S.faux[Math.floor(this.phase)];
    // unfolding: the wing comes out flat under the elytral margin, swept back along the body (flap -8, sweep 110), opening sideways
    // (sweep to 0) before it starts to beat (c061 to c064)
    const u = clamp(open, 0, 1), f1 = clamp(u * 1.6, 0, 1), f2 = clamp((u - 0.55) / 0.45, 0, 1);
    const pose = (w) => ({ flap: lerp(-8, w.flap, f2), sweep: lerp(110, lerp(0, w.sweep, f2), f1) });
    this.wingPose.hind = { ...pose(d.main), alpha: lerp(0.9, 1, u) };
    this.wingPose.fore = { ...pose(d.ghost), alpha: f2 * d.ghost.alpha };
  }

  foldWings() {
    // folded under the elytra: not shown
    this.wingPose.hind = { flap: 80, sweep: 110, alpha: 0 };
    this.wingPose.fore = { flap: 80, sweep: 110, alpha: 0 };
  }

  steer(dt, goal, vmax, arrive) {
    const d = sub(goal, this.P), dist = len(d);
    const sp = vmax * clamp(dist / arrive, 0.15, 1);
    this.wob += dt;
    // a fairly straight flight with a slow sway (a heavy beetle, not a butterfly)
    const wa = clamp(dist / 300, 0.1, 1) * 25;
    const want = add(mul(norm(d), sp), [Math.sin(this.wob * 1.7) * wa, Math.sin(this.wob * 2.3 + 1) * wa * 0.6, Math.sin(this.wob * 1.1 + 2) * wa]);
    this.V = mix(this.V, want, clamp(dt * 2.5, 0, 1));
    this.P = add(this.P, mul(this.V, dt));
    return dist;
  }

  faceFlight(dt) {
    const v = this.V, sp = len(v);
    if (sp > 10) {
      const h = Math.hypot(v[0], v[2]) || 1;
      // body pitched head up in flight (its legs hanging below)
      const dir = norm([v[0] / h, -this.S.pitchFly + 0.3 * clamp(v[1] / sp, -1, 1), v[2] / h]);
      const before = this.fwd;
      this.fwd = norm(mix(this.fwd, dir, clamp(dt * 3, 0, 1)));
      const turn = (before[0] * this.fwd[2] - before[2] * this.fwd[0]) / Math.max(dt, 1e-3);
      this.bank = lerp(this.bank, clamp(turn * 0.25, -0.4, 0.4), clamp(dt * 3, 0, 1));
    }
  }

  // on the flower: a walking step along fwd, the frame of the tripod cycle from the distance walked
  walkStep(dt, dir) {
    const v = this.S.walk * this.mmPx;
    this.P = add(this.P, mul(dir, v * dt));
    this.fx = (this.fx + dt * this.S.stepHz) % 1;
    this.frame = Math.floor(this.fx * 8) % 8;
  }

  update(dt) {
    this.step(dt);
    // only the walk has frames in the atlas
    if (this.pose !== 'marche') this.frame = 0;
  }

  step(dt) {
    const S = this.S, f = this.flower;
    if (this.state === 'away') { this.visible = false; this.t -= dt; if (this.t <= 0) this.spawn(); return; }
    if (this.state === 'transit') {
      const over = add(f.P, [0, -f.r * 0.25 - this.lengthPx * 0.6, 4]);
      const dist = this.steer(dt, over, S.flySpeed * this.mmPx * (this.boost || 1) * S.slow, 160);
      this.strokeWings(dt); this.faceFlight(dt); this.pose = 'vol';
      if (dist < 12) { this.state = 'land'; this.t = 0; this.from = this.P; this.landAt = add(f.P, [(this.rnd() - 0.5) * f.r * 0.5, -f.r * 0.15, 5]); }
    } else if (this.state === 'land') {
      // a heavy landing: it drops onto the flower, the wings fold away under the elytra
      this.t += dt / 0.35;
      const e = clamp(this.t, 0, 1);
      this.P = mix(this.from, this.landAt, e * e);
      this.strokeWings(dt, 1 - e);
      this.layerHint = f.layer; this.pose = e < 0.6 ? 'vol' : 'pose';
      const sx = this.rnd() < 0.5 ? -1 : 1;
      if (this.t >= 1) { this.foldWings(); this.state = 'walk'; this.t = lerp(S.surface[0], S.surface[1], this.rnd()); this.walkDir = norm([sx, (this.rnd() - 0.5) * 0.6, (this.rnd() - 0.5) * 0.8]); this.dig = true; }
    } else if (this.state === 'walk') {
      this.t -= dt; this.pose = 'marche';
      this.fwd = norm(mix(this.fwd, [this.walkDir[0], this.walkDir[1] * 0.6 + 0.15, this.walkDir[2]], clamp(dt * 3, 0, 1)));
      this.walkStep(dt, [this.walkDir[0], this.walkDir[1] * 0.4, this.walkDir[2]]);
      // it stays on the flower: turns back toward the heart past 0.4 of its radius
      const off = sub(this.P, f.P);
      if (Math.hypot(off[0], off[1]) > f.r * 0.4) this.walkDir = norm(mix(this.walkDir, norm([-off[0], -off[1] * 0.5, -off[2]]), 0.2));
      if (this.t <= 0) {
        if (this.dig) { this.state = 'feed'; this.t = lerp(S.visit[0], S.visit[1], this.rnd()); this.mood = 3 + this.rnd() * 6; this.dig = false; }
        else { this.state = 'unfold'; this.t = S.unfold; }
      }
    } else if (this.state === 'feed') {
      // buried head down in the flower's heart: the body pitched into it, nearly still, shifting now and then
      this.t -= dt; this.mood -= dt; this.pose = 'pose';
      const into = norm([Math.sign(this.walkDir[0]) * 0.45, 0.8, -0.35]);
      this.fwd = norm(mix(this.fwd, into, clamp(dt * 1.5, 0, 1)));
      this.P = mix(this.P, add(f.P, [0, -f.r * 0.05, 3]), clamp(dt * 0.6, 0, 1));
      if (this.mood <= 0) { this.mood = 3 + this.rnd() * 6; this.walkDir = norm([-this.walkDir[0], (this.rnd() - 0.5) * 0.4, (this.rnd() - 0.5) * 0.6]); }
      if (this.t <= 0) { this.state = 'walk'; this.t = lerp(S.surface[0], S.surface[1], this.rnd()) * 0.6; this.dig = false; }
    } else if (this.state === 'unfold') {
      // the wings unfold through the notches, then it lifts off
      this.t -= dt; this.pose = 'vol';
      this.strokeWings(dt, clamp(1 - this.t / S.unfold, 0, 1));
      if (this.t <= 0) {
        this.layerHint = null; this.state = 'takeoff'; this.t = 0.5;
        this.V = [(this.rnd() - 0.5) * 60, -140, (this.rnd() - 0.5) * 60];
      }
    } else if (this.state === 'takeoff') {
      this.P = add(this.P, mul(this.V, dt)); this.strokeWings(dt); this.faceFlight(dt); this.t -= dt;
      if (this.t <= 0) { if (this.fleeing || this.rnd() < 0.5) { this.fleeing = false; this.leave(true); } else this.goFlower(); }
    } else if (this.state === 'leave') {
      const dist = this.steer(dt, this.exit.P, S.flySpeed * this.mmPx * 1.2 * (this.boost || 1) * S.slow, 60);
      this.strokeWings(dt); this.faceFlight(dt); this.pose = 'vol';
      const s = PERSPECTIVE / (PERSPECTIVE - this.P[2]);
      if (this.P[0] < -200 || this.P[0] > this.e.w + 200 || this.P[1] < -200 || (this.exit.far && s < 0.15) || dist < 20) {
        this.state = 'away'; this.visible = false; this.t = 6 + this.rnd() * 14; this.boost = 1;
      }
    }
  }
}
