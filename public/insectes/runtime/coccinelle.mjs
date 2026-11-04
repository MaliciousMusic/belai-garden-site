// Behaviour of a seven-spot ladybird on the bouquet: it flies in, heavy and straight, body steeply tilted, the elytra held up and
// open, the hind wings beating too fast to see; it lands on a flower, folds its wings under the elytra and walks over the petals,
// stopping, turning, walking on; after a while it climbs to an edge, opens its elytra, unfolds its wings and takes off, for
// another flower or out of the view. It is never steered; a click on it makes it take off and flee (in flight: a swerve).
// Its elytra (open) and hind wings are runtime quads (essaim.placeWings, textures of coccinelle/outils/plans.mjs); the body is
// in the atlas: pose (elytra closed), marche (8 frames of the tripod gait), vol (elytra open, dorsal abdomen).
//
// Numbers (coccinelle/COMPORTEMENT.md): wingbeat 72.5 Hz, stroke 190 degrees in a plane 61 degrees from the body axis (the
// climbing-flight study of C. septempunctata, PMC11117773); the hind wings unfold in about a tenth of a second and fold in about
// two (Saito et al. 2017, PNAS); walking about 8 mm/s; the elytra held up about 45 degrees in flight (c365, c372, c495).
import { PERSPECTIVE } from './essaim.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };

export const COCCINELLE = {
  kind: 'coccinelle', bodyMm: 7.2,
  beatHz: 72.5, stroke: 190, strokePlane: 61,
  // the elytra's planes: closed (the lid that the atlas's dome becomes at take-off) and open in flight (flapAxes angles)
  elyClosed: { flap: 0, sweep: 90 }, elyOpen: { flap: 42, sweep: 14 },
  // the spread wings' beat, as a faux of the stroke (owner, 2026-10-25: sampling the 72.5 Hz stroke at 60 images a second made
  // it turn like a propeller): three drawings, the top of the stroke, the downstroke swept forward, the bottom, played back and
  // forth (top, middle, bottom, middle) at 60 a second, so that the wing only goes up and down
  faux: [{ flap: 46, sweep: 4 }, { flap: 12, sweep: -18 }, { flap: -22, sweep: -6 }],
  fauxOrder: [0, 1, 2, 1], fauxHz: 60,
  openS: 0.12, unfoldS: 0.1, foldS: 0.22,
  walkMmS: 8, strideMm: 1.6, flightMmS: 1000, speed: 210,
  visit: [6, 18], walkBout: [0.6, 2.2], pause: [0.4, 2.5],
  max: 4,
};

export class Coccinelle {
  constructor(essaim, flowers, rnd, opts = {}) {
    this.S = COCCINELLE;
    this.e = essaim; this.flowers = flowers; this.rnd = rnd;
    this.kind = this.S.kind;
    this.lengthPx = opts.lengthPx ?? 20;
    this.speed = (opts.speed ?? 1) * (0.85 + 0.3 * rnd());
    this.P = [0, 0, 0]; this.V = [0, 0, 0]; this.fwd = [1, 0, 0]; this.bank = 0;
    this.pose = 'vol'; this.frame = 0; this.visible = false;
    this.state = 'away'; this.t = 0.5 + rnd() * 3;
    this.wob = rnd() * 100; this.visits = 0; this.beat = rnd(); this.phase = 0;
    this.open = 1; this.unfold = 1;
    this.wingPose = { fore: { ...this.S.elyOpen }, hind: { flap: 10, sweep: 0 } };
    this.wingsHidden = true;
  }

  get pxmm() { return this.lengthPx / this.S.bodyMm; }

  // ---- choices ------------------------------------------------------------------------------------------------
  pickFlower() {
    const free = this.flowers.filter((f) => f !== this.flower && !f.busy);
    if (!free.length) return null;
    const w = free.map((f) => 1 / (len(sub(f.P, this.P)) + 120));
    let s = w.reduce((a, b) => a + b, 0) * this.rnd();
    for (let i = 0; i < free.length; i++) { s -= w[i]; if (s <= 0) return free[i]; }
    return free[free.length - 1];
  }

  spawn() {
    const { w, h } = this.e, r = this.rnd();
    if (r < 0.3) this.P = [this.rnd() * w, h * (0.1 + this.rnd() * 0.4), -1300];
    else if (r < 0.45) this.P = [this.rnd() * w, -120, (this.rnd() - 0.5) * 300];
    else { const side = this.rnd() < 0.5 ? -1 : 1; this.P = [side < 0 ? -120 : w + 120, h * (0.1 + this.rnd() * 0.5), (this.rnd() - 0.5) * 300]; }
    this.V = [0, 0, 0]; this.visible = true; this.setFlight(1, 1);
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
    const { w, h } = this.e, r = this.rnd();
    if (r < 0.35) this.exit = { P: [this.rnd() * w, h * (0.05 + this.rnd() * 0.3), -1600], kind: 'far' };
    else { const side = this.rnd() < 0.5 ? -1 : 1; this.exit = { P: [side < 0 ? -160 : w + 160, h * (0.05 + this.rnd() * 0.5), (this.rnd() - 0.5) * 300], kind: 'side' }; }
    this.state = 'leave'; this.boost = fast ? 1.6 : 1;
  }

  poke(x) {
    if (['walk', 'land', 'fold'].includes(this.state)) {
      this.layerHint = null; this.flee = true;
      this.startTakeoff();
    } else if (this.visible && this.state !== 'away') {
      this.V = add(this.V, mul(norm([-this.V[1] || 1, this.V[0], this.rnd() - 0.5]), 220 * (this.rnd() < 0.5 ? -1 : 1)));
      this.swerve = 0.35;
    }
  }

  // ---- the planes -----------------------------------------------------------------------------------------------
  // flight attitude: open (0 closed lid .. 1 held up), unfold (0 folded under .. 1 spread); spread, the wing beats as the faux
  // of the stroke (S.faux); while it unfolds, a small stroke sampled at a phase that jumps each frame, drawn faint
  setFlight(open, unfold) { this.open = open; this.unfold = unfold; }

  planes(dt) {
    const S = this.S, A = S.elyClosed, B = S.elyOpen, o = ease(this.open);
    this.wingPose.fore = { flap: lerp(A.flap, B.flap, o), sweep: lerp(A.sweep, B.sweep, o) };
    if (this.unfold <= 0.02) { this.wingPose.hind = { flap: 0, sweep: 90, hidden: true }; return; }
    if (this.unfold >= 1 && S.faux) {
      this.fx = ((this.fx || 0) + dt * S.fauxHz) % S.fauxOrder.length;
      this.wingPose.hind = { ...S.faux[S.fauxOrder[Math.floor(this.fx)]], unfold: 1, alpha: 0.55 };
      return;
    }
    this.beat = (this.beat + dt * S.beatHz) % 1;
    // the stroke: a wide arc in a plane tilted from the body axis, forward on the downstroke, back on the upstroke
    const a = Math.PI * 2 * this.beat;
    const amp = this.unfold < 1 ? 0.25 : 1;
    const sweep = lerp(90, 0, ease(this.unfold)) + amp * 72 * Math.cos(a);
    const flap = 12 + amp * 34 * Math.sin(a);
    this.wingPose.hind = { flap, sweep, unfold: 0.25 + 0.75 * ease(this.unfold), alpha: this.unfold < 1 ? 0.9 : 0.55 };
  }

  // ---- motion ---------------------------------------------------------------------------------------------------
  steer(dt, goal, vmax, arrive) {
    const d = sub(goal, this.P), dist = len(d);
    const sp = vmax * clamp(dist / arrive, 0.12, 1);
    this.wob += dt;
    // a ladybird flies fairly straight: a small slow sway
    const wa = clamp(dist / 300, 0.15, 1) * 25 * this.speed;
    const wander = [Math.sin(this.wob * 1.1) * wa, Math.sin(this.wob * 1.7 + 1) * wa * 0.6, Math.sin(this.wob * 0.8 + 2) * wa];
    this.V = mix(this.V, add(mul(norm(d), sp), wander), clamp(dt * (this.swerve > 0 ? 1.5 : 3.5), 0, 1));
    this.P = add(this.P, mul(this.V, dt));
    return dist;
  }

  // in flight the body is tilted head up (about 40 degrees, c495, c369), banked into turns
  faceFlight(dt) {
    const v = this.V, sp = len(v);
    if (sp > 10) {
      const h = Math.hypot(v[0], v[2]) || 1;
      const dir = norm([v[0] / h, -0.85, v[2] / h]);
      const before = this.fwd;
      this.fwd = norm(mix(this.fwd, dir, clamp(dt * 5, 0, 1)));
      const turn = (before[0] * this.fwd[2] - before[2] * this.fwd[0]) / Math.max(dt, 1e-3);
      this.bank = lerp(this.bank, clamp(turn * 0.3, -0.5, 0.5), clamp(dt * 4, 0, 1));
    }
  }

  startTakeoff() {
    this.state = 'open'; this.t = 0; this.pose = 'vol'; this.wingsHidden = false;
    this.setFlight(0, 0);
  }

  update(dt) {
    if (this.swerve > 0) this.swerve -= dt;
    if (this.state === 'away') { this.visible = false; this.t -= dt; if (this.t <= 0) this.spawn(); return; }
    const S = this.S, f = this.flower;
    if (this.state === 'transit') {
      this.wingsHidden = false; this.pose = 'vol';
      const over = add(f.P, [0, -f.r * 0.3 - this.lengthPx * 0.6, 4]);
      const dist = this.steer(dt, over, S.speed * this.speed * (this.boost || 1), 160);
      this.planes(dt); this.faceFlight(dt);
      if (dist < 10) {
        this.state = 'land'; this.t = 0; this.from = this.P;
        const a = this.rnd() * Math.PI * 2, rr = f.r * 0.3 * this.rnd();
        this.landAt = add(f.P, [Math.cos(a) * rr, -f.r * 0.15 + Math.sin(a) * rr * 0.4, 4]);
        this.restFwd = norm([(this.rnd() - 0.5) * 2, -0.3, (this.rnd() - 0.5)]);
      }
    } else if (this.state === 'land') {
      // the last beats, slowing onto the petal
      this.t += dt / 0.35;
      this.P = mix(this.from, this.landAt, ease(this.t));
      this.fwd = norm(mix(this.fwd, this.restFwd, clamp(dt * 5, 0, 1)));
      this.bank *= 0.85; this.planes(dt);
      this.layerHint = f.layer;
      if (this.t >= 1) { this.state = 'fold'; this.t = 0; }
    } else if (this.state === 'fold') {
      // the wings fold back under the elytra, then the elytra close (Saito et al. 2017: folding takes about twice the unfolding)
      this.t += dt;
      this.setFlight(1 - clamp((this.t - S.foldS) / S.openS, 0, 1), 1 - clamp(this.t / S.foldS, 0, 1));
      this.planes(dt);
      if (this.t >= S.foldS + S.openS) {
        this.state = 'walk'; this.pose = 'pose'; this.frame = 0; this.wingsHidden = true;
        this.t = lerp(S.visit[0], S.visit[1], this.rnd()); this.step = lerp(S.pause[0], S.pause[1], this.rnd()); this.walking = false;
        this.visits++;
      }
    } else if (this.state === 'walk') {
      this.t -= dt; this.step -= dt;
      if (!this.walking && this.step <= 0) {
        // a bout of walking over the flower, toward a point of its rim or across its heart
        this.walking = true; this.step = lerp(S.walkBout[0], S.walkBout[1], this.rnd());
        const a = this.rnd() * Math.PI * 2, rr = f.r * (0.15 + 0.4 * this.rnd());
        this.walkTo = add(f.P, [Math.cos(a) * rr, -f.r * 0.15 + Math.sin(a) * rr * 0.35, 4]);
      } else if (this.walking) {
        const d = sub(this.walkTo, this.P), dist = len(d);
        const v = Math.min(dist, S.walkMmS * this.pxmm * dt);
        if (dist > 0.5) {
          this.pose = 'marche';
          this.P = add(this.P, mul(norm(d), v));
          this.fwd = norm(mix(this.fwd, norm([d[0], 0.3 * Math.abs(d[1]) - 0.15, d[2]]), clamp(dt * 4, 0, 1)));
          this.phase = (this.phase + v / (S.strideMm * this.pxmm)) % 1;
          this.frame = Math.floor(this.phase * 8) % 8;
        }
        if (this.step <= 0 || dist < 0.5) { this.walking = false; this.pose = 'pose'; this.frame = 0; this.step = lerp(S.pause[0], S.pause[1], this.rnd()); }
      }
      this.bank = 0;
      if (this.t <= 0 && !this.walking) this.startTakeoff();
    } else if (this.state === 'open') {
      // the elytra open, then the wings unfold (about a tenth of a second each), then it lifts off
      this.t += dt;
      this.setFlight(clamp(this.t / S.openS, 0, 1), clamp((this.t - S.openS * 0.6) / S.unfoldS, 0, 1));
      this.planes(dt);
      if (this.t >= S.openS * 0.6 + S.unfoldS) {
        this.state = 'takeoff'; this.t = 0.4; this.layerHint = null;
        this.V = [(this.rnd() - 0.5) * 80, -150 * (this.flee ? 1.6 : 1), (this.rnd() - 0.5) * 80];
      }
    } else if (this.state === 'takeoff') {
      this.P = add(this.P, mul(this.V, dt));
      this.planes(dt); this.faceFlight(dt);
      this.t -= dt;
      if (this.t <= 0) {
        if (this.flee) { this.flee = false; this.leave(true); }
        else if (this.rnd() < 0.2 + Math.min(0.3, this.visits * 0.08)) { this.visits = 0; this.leave(); } else this.goFlower();
      }
    } else if (this.state === 'leave') {
      const x = this.exit;
      const dist = this.steer(dt, x.P, S.speed * 1.3 * this.speed * (this.boost || 1), 60);
      this.planes(dt); this.faceFlight(dt);
      const s = PERSPECTIVE / (PERSPECTIVE - this.P[2]);
      const out = this.P[0] < -180 || this.P[0] > this.e.w + 180 || this.P[1] < -180 || this.P[2] > PERSPECTIVE * 0.68 || (x.kind === 'far' && s < 0.12) || dist < 20;
      if (out) { this.state = 'away'; this.visible = false; this.t = 4 + this.rnd() * 10; this.boost = 1; }
    }
  }
}
