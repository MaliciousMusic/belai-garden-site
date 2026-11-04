// Behaviour of a butterfly of the bouquet (the swallowtail first): it comes in from the edges or the far meadow in a floppy
// flight, bouts of wingbeats and short glides, visits a few flowers, and on each one feeds with its proboscis uncoiled while its
// wings keep fluttering, now and then opens them flat in the sun or closes them over its back, then flies on; sooner or later it
// leaves the view. It is never steered; a click makes it take off and flee. Its four wings are runtime quads (essaim.placeWings):
// this module only sets their flap and sweep (b.wingPose) and the body pose of the atlas (vol, butine, pose).
//
// Orders of magnitude (Papilio machaon, ETAT.md and COMPORTEMENT.md): wingbeat about 5 to 6 per second in flight, glides of a
// few tenths of a second; on a flower it feeds 5 to 20 s, its wings fluttering at 2 to 4 per second in a narrow arc; it basks
// with its wings spread flat, and rests with them closed, the forewings drawn back between the hindwings.
import { PERSPECTIVE } from './essaim.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const lerp = (a, b, t) => a + (b - a) * t;

// The species' numbers (the swallowtail): body length, wingbeat, the wing angles of each attitude (degrees), the visit times.
export const MACHAON = {
  kind: 'machaon', bodyMm: 24.2,
  beatHz: 5.5, glide: [0.25, 0.7], bout: [0.5, 1.4],
  flapUp: 72, flapDown: -32, glideFlap: 12,
  // on the flower: fluttering while feeding, spread to bask, closed at rest (sweep: the forewing drawn back over the hindwing)
  feed: { hz: 2.6, lo: 18, hi: 62, sweepFore: 18, sweepHind: 2 },
  bask: { flap: 3, sweepFore: 14, sweepHind: 0 },
  rest: { flap: 88, sweepFore: 62, sweepHind: 4 },
  visit: [6, 16], speed: 230,
};

// The peacock (Aglais io, paon-du-jour/COMPORTEMENT.md): smaller wings beating faster, a dark leaf when closed, and its
// startle display: touched or nearly so while settled, it snaps its wings open in 0.2 s, showing the four eyespots, then flicks
// them shut and open again about once every 2.7 s (11 flicks in 30 s), the wings held open between flicks with a slight pulsing
// (Olofsson et al. 2013, Behav. Ecol. 24: 305; Vallin et al. 2005, Proc. R. Soc. B 272: 1203). On fruit or flowers it keeps
// its wings mostly closed (Wiklund 2005, Entomol. Fenn. 16: 17); in the sun it spreads them flat.
export const PAON = {
  kind: 'paon-du-jour', bodyMm: 17,
  beatHz: 8, glide: [0.2, 0.5], bout: [0.6, 1.6],
  flapUp: 70, flapDown: -30, glideFlap: 10,
  feed: { hz: 0.45, lo: 40, hi: 94, sweepFore: 16, sweepHind: 2 },
  bask: { flap: 2, sweepFore: 6, sweepHind: 0 },
  // closed past 90 deg: the hinges sit 2.3 mm either side of the axis, so at 90 the wings are two parallel planes and the far
  // one's coloured upper side shows above and behind the near one; at 94 they converge and meet near the tips (2.3 / cos 86 = 33 mm)
  rest: { flap: 94, sweepFore: 40, sweepHind: 4 },
  visit: [5, 20], speed: 220,
  hideFarClosed: true, // closed past 90 deg only the undersides show (essaim.mjs)
  // the startle display: open in 0.2 s, flicks every 2.7 s for 2 to 4 flicks, then a third fly off, the rest settle again
  startle: { open: 0.2, flap: 4, every: 2.7, flicks: [2, 4], shut: 0.12, flickFlap: 72, pulse: { hz: 1.6, sweep: 5 }, flee: 0.35 },
};

export class Papillon {
  constructor(essaim, flowers, rnd, opts = {}) {
    this.S = opts.species ?? MACHAON;
    this.e = essaim; this.flowers = flowers; this.rnd = rnd;
    this.kind = this.S.kind;
    this.lengthPx = opts.lengthPx ?? 40;
    this.speed = (opts.speed ?? 1) * (0.85 + 0.3 * rnd());
    this.P = [0, 0, 0]; this.V = [0, 0, 0]; this.fwd = [1, 0, 0]; this.bank = 0;
    this.pose = 'vol'; this.frame = 0; this.visible = false;
    this.state = 'away'; this.t = 0.5 + rnd() * 2;
    this.wob = rnd() * 100; this.visits = 0;
    this.beat = rnd(); this.gliding = 0; this.boutLeft = 1;
    this.wingPose = { fore: { flap: 20, sweep: 0 }, hind: { flap: 17, sweep: 0 } };
    this.att = { flap: 20, sweepFore: 0, sweepHind: 0 };   // the wings' attitude, eased toward the wanted one
  }

  get pxmm() { return this.lengthPx / this.S.bodyMm; }

  // ---- choices ------------------------------------------------------------------------------------------------
  pickFlower() {
    const free = this.flowers.filter((f) => f !== this.flower && !f.busy);
    if (!free.length) return null;
    // butterflies wander farther between flowers than bees: distance weighs less
    const w = free.map((f) => 1 / (len(sub(f.P, this.P)) + 200));
    let s = w.reduce((a, b) => a + b, 0) * this.rnd();
    for (let i = 0; i < free.length; i++) { s -= w[i]; if (s <= 0) return free[i]; }
    return free[free.length - 1];
  }

  spawn() {
    const { w, h } = this.e, r = this.rnd();
    if (r < 0.35) this.P = [this.rnd() * w, h * (0.05 + this.rnd() * 0.3), -1400];
    else if (r < 0.5) this.P = [this.rnd() * w, -160, (this.rnd() - 0.5) * 300];
    else { const side = this.rnd() < 0.5 ? -1 : 1; this.P = [side < 0 ? -180 : w + 180, h * (0.05 + this.rnd() * 0.5), (this.rnd() - 0.5) * 400]; }
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
    const { w, h } = this.e, r = this.rnd();
    if (r < 0.35) this.exit = { P: [this.rnd() * w, h * (0.05 + this.rnd() * 0.3), -1700], kind: 'far' };
    else { const side = this.rnd() < 0.5 ? -1 : 1; this.exit = { P: [side < 0 ? -220 : w + 220, h * (0.02 + this.rnd() * 0.4), (this.rnd() - 0.5) * 400], kind: 'side' }; }
    this.state = 'leave'; this.boost = fast ? 1.7 : 1;
  }

  poke(x) {
    // a species with a startle display (S.startle) answers a touch while settled by showing its eyespots, not by fleeing
    if (this.S.startle && ['feed', 'bask', 'rest'].includes(this.state)) {
      const St = this.S.startle;
      this.state = 'startle'; this.pose = 'pose'; this.st = 0;
      this.flicks = St.flicks[0] + Math.floor(this.rnd() * (St.flicks[1] - St.flicks[0] + 1));
      this.t = (this.flicks + 0.5) * St.every;
      return;
    }
    if (['feed', 'bask', 'rest', 'land', 'startle'].includes(this.state)) {
      this.layerHint = null; this.pose = 'vol';
      this.V = mul(norm([this.P[0] - x, -80, 30 * (this.rnd() - 0.5)]), 380 * this.speed);
      this.leave(true);
    } else if (this.visible) {
      this.V = add(this.V, mul(norm([-this.V[1] || 1, this.V[0], this.rnd() - 0.5]), 300 * (this.rnd() < 0.5 ? -1 : 1)));
      this.swerve = 0.4;
    }
  }

  // ---- wings --------------------------------------------------------------------------------------------------
  // Flight: bouts of wingbeats (the forewing a little ahead of the hindwing, swept forward on the downstroke) and glides with
  // the wings held in a shallow V. The body pitches up with each downstroke: the bobbing flight of a large butterfly.
  flyWings(dt) {
    const S = this.S;
    if (this.gliding > 0) {
      this.gliding -= dt;
      if (this.gliding <= 0) { this.boutLeft = lerp(S.bout[0], S.bout[1], this.rnd()); }
      this.ease({ flap: S.glideFlap, sweepFore: -6, sweepHind: 0 }, dt, 6);
      this.setWings(this.att.flap, this.att.flap - 2);
      this.lift = -0.25;
      return;
    }
    this.beat = (this.beat + dt * S.beatHz * (this.boost || 1)) % 1;
    this.boutLeft -= dt;
    if (this.boutLeft <= 0 && this.beat < 0.08) { this.gliding = lerp(S.glide[0], S.glide[1], this.rnd()); return; }
    // the stroke: a fast downstroke (45 % of the cycle), a slower upstroke
    const ph = this.beat, d = ph < 0.45 ? ph / 0.45 : 1 - (ph - 0.45) / 0.55;
    const e = 0.5 - 0.5 * Math.cos(Math.PI * d);                     // 0 at the top, 1 at the bottom
    const fore = lerp(S.flapUp, S.flapDown, e);
    const phh = (ph + 0.94) % 1, dh = phh < 0.45 ? phh / 0.45 : 1 - (phh - 0.45) / 0.55, eh = 0.5 - 0.5 * Math.cos(Math.PI * dh);
    this.att.flap = fore;
    this.wingPose.fore = { flap: fore, sweep: -10 * (ph < 0.45 ? Math.sin(Math.PI * d) : 0) };
    this.wingPose.hind = { flap: lerp(S.flapUp - 6, S.flapDown + 4, eh), sweep: 0 };
    this.lift = ph < 0.45 ? 1 : -0.6;
  }

  setWings(fore, hind) {
    this.wingPose.fore = { flap: fore, sweep: this.att.sweepFore };
    this.wingPose.hind = { flap: hind, sweep: this.att.sweepHind };
  }

  ease(want, dt, k) {
    const a = clamp(dt * k, 0, 1);
    this.att.flap = lerp(this.att.flap, want.flap, a);
    this.att.sweepFore = lerp(this.att.sweepFore, want.sweepFore, a);
    this.att.sweepHind = lerp(this.att.sweepHind, want.sweepHind, a);
  }

  // ---- motion -------------------------------------------------------------------------------------------------
  steer(dt, goal, vmax, arrive) {
    const d = sub(goal, this.P), dist = len(d);
    const sp = vmax * clamp(dist / arrive, 0.1, 1);
    this.wob += dt;
    // the erratic track of a butterfly: a slow wide meander and the bobbing of each wingbeat
    const wa = clamp(dist / 260, 0.2, 1) * 90 * this.speed;
    const wander = [Math.sin(this.wob * 0.9) * wa, Math.sin(this.wob * 1.3 + 1) * wa * 0.5, Math.sin(this.wob * 0.7 + 2) * wa];
    const bob = [0, -(this.lift || 0) * 60, 0];
    const want = add(add(mul(norm(d), sp), wander), bob);
    this.V = mix(this.V, want, clamp(dt * (this.swerve > 0 ? 1.4 : 3), 0, 1));
    this.P = add(this.P, mul(this.V, dt));
    return dist;
  }

  // In flight the body follows its course, pitched head up (about 25°), banked into turns.
  faceFlight(dt) {
    const v = this.V, sp = len(v);
    if (sp > 15) {
      const h = Math.hypot(v[0], v[2]) || 1;
      const dir = norm([v[0] / h, -0.45 + 0.25 * clamp(v[1] / sp, -1, 1), v[2] / h]);
      const before = this.fwd;
      this.fwd = norm(mix(this.fwd, dir, clamp(dt * 4, 0, 1)));
      const turn = (before[0] * this.fwd[2] - before[2] * this.fwd[0]) / Math.max(dt, 1e-3);
      this.bank = lerp(this.bank, clamp(turn * 0.3, -0.5, 0.5), clamp(dt * 4, 0, 1));
    }
  }

  update(dt) {
    if (this.swerve > 0) this.swerve -= dt;
    if (this.state === 'away') {
      this.visible = false; this.t -= dt;
      if (this.t <= 0) this.spawn();
      return;
    }
    const S = this.S, f = this.flower;
    if (this.state === 'transit') {
      const over = add(f.P, [0, -f.r * 0.6 - this.lengthPx * 0.9, 6]);
      const dist = this.steer(dt, over, S.speed * this.speed * (this.boost || 1), 220);
      this.flyWings(dt); this.faceFlight(dt);
      if (dist < 16) {
        this.state = 'land'; this.t = 0; this.from = this.P;
        const a = this.rnd() * Math.PI * 2, rr = f.r * 0.2 * this.rnd();
        this.landAt = add(f.P, [Math.cos(a) * rr, -f.r * 0.2 - this.lengthPx * 0.12, 5]);
        // it settles facing left or right on the flower, head a little up
        const sx = this.rnd() < 0.5 ? -1 : 1;
        this.restFwd = norm([sx, -0.2, (this.rnd() - 0.5) * 1.2]);
      }
    } else if (this.state === 'land') {
      // the last flaps of the landing, slowing, then the wings held up
      this.t += dt / 0.6;
      const e = this.t * this.t * (3 - 2 * this.t);
      this.P = mix(this.from, this.landAt, clamp(e, 0, 1));
      this.fwd = norm(mix(this.fwd, this.restFwd, clamp(dt * 4, 0, 1)));
      this.bank *= 0.85;
      this.beat = (this.beat + dt * S.beatHz * 0.8) % 1;
      const amp = 1 - clamp(this.t, 0, 1);
      this.att.flap = lerp(S.feed.hi, lerp(S.flapUp, S.flapDown, 0.5 - 0.5 * Math.cos(2 * Math.PI * this.beat)), amp);
      this.setWings(this.att.flap, this.att.flap - 3);
      this.layerHint = f.layer;
      if (this.t >= 1) this.startFeed();
    } else if (this.state === 'feed' || this.state === 'bask' || this.state === 'rest') {
      this.t -= dt; this.mood -= dt;
      this.fwd = norm(mix(this.fwd, this.restFwd, clamp(dt * 2, 0, 1)));
      this.bank = 0;
      if (this.state === 'feed') {
        // the proboscis in the flower; the wings flutter in a narrow arc, held half open
        this.beat = (this.beat + dt * S.feed.hz) % 1;
        const e = 0.5 - 0.5 * Math.cos(2 * Math.PI * this.beat);
        this.ease({ flap: lerp(S.feed.lo, S.feed.hi, e), sweepFore: S.feed.sweepFore, sweepHind: S.feed.sweepHind }, dt, 14);
      } else if (this.state === 'bask') this.ease({ flap: S.bask.flap, sweepFore: S.bask.sweepFore, sweepHind: S.bask.sweepHind }, dt, 2.2);
      else this.ease({ flap: S.rest.flap, sweepFore: S.rest.sweepFore, sweepHind: S.rest.sweepHind }, dt, 2.6);
      this.setWings(this.att.flap, this.att.flap - 2);
      // now and then it changes attitude: feeding, spread in the sun, closed
      if (this.mood <= 0) {
        const r = this.rnd();
        this.state = r < 0.6 ? 'feed' : r < 0.82 ? 'bask' : 'rest';
        this.pose = this.state === 'feed' ? 'butine' : 'pose';
        this.mood = this.state === 'feed' ? 2.5 + this.rnd() * 4 : 1.8 + this.rnd() * 3;
      }
      if (this.t <= 0) {
        this.state = 'takeoff'; this.t = 0.45; this.pose = 'vol'; this.layerHint = null; this.visits++;
        this.V = [(this.rnd() - 0.5) * 120, -170, (this.rnd() - 0.5) * 120];
        this.gliding = 0; this.boutLeft = 1.2;
      }
    } else if (this.state === 'startle') {
      // the eyespots shown: the wings snap open, then at each flick shut a little and open again, pulsing in between
      const St = S.startle;
      this.st += dt; this.t -= dt;
      this.fwd = norm(mix(this.fwd, this.restFwd, clamp(dt * 2, 0, 1)));
      const ph = this.st % St.every, inFlick = this.st > St.every * 0.5 && ph < St.shut + St.open;
      const want = inFlick && ph < St.shut ? St.flickFlap : St.flap;
      // a 0.2 s opening: an easing rate that covers 95 % of the way in that time
      this.ease({ flap: want, sweepFore: St.pulse.sweep * Math.sin(2 * Math.PI * St.pulse.hz * this.st), sweepHind: 0 }, dt, 3 / St.open);
      this.setWings(this.att.flap, this.att.flap - 2);
      if (this.t <= 0) {
        if (this.rnd() < St.flee) { this.pose = 'vol'; this.V = [(this.rnd() - 0.5) * 200, -260, (this.rnd() - 0.5) * 120]; this.leave(true); }
        else { this.state = 'rest'; this.pose = 'pose'; this.t = 2 + this.rnd() * 6; this.mood = 1.5 + this.rnd() * 2; }
      }
    } else if (this.state === 'takeoff') {
      this.P = add(this.P, mul(this.V, dt));
      this.flyWings(dt); this.faceFlight(dt);
      this.t -= dt;
      if (this.t <= 0) {
        if (this.rnd() < 0.18 + Math.min(0.3, this.visits * 0.08)) { this.visits = 0; this.leave(); } else this.goFlower();
      }
    } else if (this.state === 'leave') {
      const x = this.exit;
      const dist = this.steer(dt, x.P, S.speed * 1.3 * this.speed * (this.boost || 1), 60);
      this.flyWings(dt); this.faceFlight(dt);
      const s = PERSPECTIVE / (PERSPECTIVE - this.P[2]);
      const out = this.P[0] < -220 || this.P[0] > this.e.w + 220 || this.P[1] < -220 || this.P[2] > PERSPECTIVE * 0.68 || (x.kind === 'far' && s < 0.12) || dist < 24;
      if (out) { this.state = 'away'; this.visible = false; this.t = 4 + this.rnd() * 10; this.boost = 1; }
    }
  }

  startFeed() {
    const S = this.S;
    this.state = 'feed'; this.pose = 'butine'; this.frame = 0;
    this.t = lerp(S.visit[0], S.visit[1], this.rnd());
    this.mood = 2 + this.rnd() * 3;
  }
}
