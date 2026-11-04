// Behaviour of the red ant worker (Myrmica rubra) on the ground at the foot of the bouquet: it walks in an alternating tripod along
// a sinuous path, stops now and then to tap the ground with its antennae, meets the other ants (of either kind) head to head and
// antennates, then goes on; it is never steered; a click alarms it: it runs, straighter, then calms down (COMPORTEMENT.md).
//
// Sourced numbers (fourmi-rouge/COMPORTEMENT.md):
//   linear speed 8.5 to 9.6 mm/s exploring, 18 to 25 mm/s alarmed; sinuosity 154 to 162 deg/cm exploring, 77 to 115 alarmed
//   (Cammaerts et al. 2012, Belg. J. Zool. 142: 147-153, M. rubra workers, tables 1 and 4);
//   stride 0.67 body length, speed set by the cadence more than the stride (Clifton et al. 2020, R. Soc. Open Sci. 7: 192068).
// Working numbers (to refine on video, as the swallowtail's): stops of 0.4 to 2.5 s every 3 to 9 s, meetings of 0.8 to 2 s.
export const MYRMICA = {
  bodyMm: 4.9, strideMm: 3.3,
  speed: [8.5, 9.6], alarmSpeed: [18, 25],
  sinuosity: [154, 162], alarmSinuosity: [77, 115],
  stopEvery: [3, 9], stop: [0.4, 2.5], meet: [0.8, 2.0], alarm: [3, 5], tap: 2.2,
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const WALK = 8, TAP = 4;
const TH = 4, SK = 1.22;

export class FourmiRouge {
  // ground: { y (scene px of the ground line), x0, x1, z0, z1 (the strip it walks on) }; colony: every ant on the ground (shared)
  constructor(essaim, ground, colony, rnd, opts = {}) {
    this.e = essaim; this.g = ground; this.colony = colony; this.rnd = rnd;
    this.kind = opts.kind ?? 'fourmi-rouge';
    this.S = opts.species ?? MYRMICA;
    this.bodyMm = this.S.bodyMm;
    this.lengthPx = opts.lengthPx ?? 6;
    this.heading = rnd() * 2 * Math.PI; this.turn = 0;
    this.P = [lerp(ground.x0, ground.x1, rnd()), ground.y, lerp(ground.z0, ground.z1, rnd())];
    this.fwd = [Math.cos(this.heading), 0, Math.sin(this.heading)]; this.bank = 0;
    this.pose = 'marche'; this.frame = 0; this.phase = rnd(); this.visible = true;
    this.v = lerp(...this.S.speed, rnd());
    this.state = 'marche'; this.t = lerp(...this.S.stopEvery, rnd());
    this.cool = 0;
    colony.push(this);
  }

  get pxmm() { return this.lengthPx / this.bodyMm; }
  range(a) { return lerp(a[0], a[1], this.rnd()); }

  poke() {
    this.state = 'alarme'; this.t = this.range(this.S.alarm);
    this.v = this.range(this.S.alarmSpeed); this.heading += Math.PI * (0.6 + 0.8 * this.rnd()); this.partner = null;
  }

  // the nearest other ant ahead within 1.4 body lengths, not already meeting
  meeting() {
    let best = null, bd = 1.4 * this.bodyMm * this.pxmm;
    for (const o of this.colony) {
      if (o === this || !o.visible || o.state === 'rencontre' || o.state === 'alarme') continue;
      const dx = o.P[0] - this.P[0], dz = o.P[2] - this.P[2], d = Math.hypot(dx, dz);
      if (d < bd && (dx * this.fwd[0] + dz * this.fwd[2]) > 0) { best = o; bd = d; }
    }
    return best;
  }

  face(o) { this.heading = Math.atan2(o.P[2] - this.P[2], o.P[0] - this.P[0]); }

  update(dt) {
    const S = this.S, px = this.pxmm;
    this.t -= dt; this.cool -= dt;
    if (this.state === 'marche' || this.state === 'alarme') {
      // sinuosity: the heading wanders so that the turning summed over a centimetre is the measured one (deg/cm): the turn rate is an
      // Ornstein-Uhlenbeck process (correlation time 1 / TH s) whose mean size is S * v / 10 deg/s, times SK: the factor that brings the
      // angle summed on a trajectory sampled every 2 mm, as Cammaerts et al. traced it, to the measured value (outils/simule.mjs)
      const sin = this.state === 'alarme' ? S.alarmSinuosity : S.sinuosity;
      const rate = (lerp(sin[0], sin[1], 0.5) * this.v / 10) * Math.PI / 180 * SK;
      const sigma = (rate / Math.sqrt(2 / Math.PI)) * Math.sqrt(2 * TH);
      this.turn += -TH * this.turn * dt + sigma * Math.sqrt(dt) * (this.rnd() - 0.5) * Math.sqrt(12);
      this.heading += this.turn * dt;
      // the strip's edges turn it back in
      // (the strip is shallow in depth: its margin there a quarter of it at most, or both edges would turn it at once)
      const { x0, x1, z0, z1 } = this.g, m = 6 * px, mz = Math.min(m, (z1 - z0) / 4);
      const tx = this.P[0] < x0 + m ? 1 : this.P[0] > x1 - m ? -1 : 0, tz = this.P[2] < z0 + mz ? 1 : this.P[2] > z1 - mz ? -1 : 0;
      if (tx || tz) {
        const want = Math.atan2(tz || Math.sin(this.heading), tx || Math.cos(this.heading));
        let d = want - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
        this.heading += clamp(d, -3 * dt, 3 * dt);
      }
      const step = this.v * px * dt;
      this.P = [this.P[0] + Math.cos(this.heading) * step, this.g.y, this.P[2] + Math.sin(this.heading) * step];
      // the cadence follows the speed (one stride of 0.67 body length per cycle)
      this.phase = (this.phase + (this.v / S.strideMm) * dt) % 1;
      this.pose = 'marche'; this.frame = Math.floor(this.phase * WALK) % WALK;
      if (this.state === 'alarme' && this.t <= 0) { this.state = 'marche'; this.v = this.range(S.speed); this.t = this.range(S.stopEvery); }
      if (this.state === 'marche') {
        const o = this.cool <= 0 && this.meeting();
        if (o) {
          // head to head: both stop, turn to each other and antennate
          this.state = o.state = 'rencontre'; this.partner = o; o.partner = this;
          this.t = o.t = this.range(S.meet); this.face(o); o.face(this);
        } else if (this.t <= 0) { this.state = 'arret'; this.t = this.range(S.stop); }
      }
    } else if (this.state === 'arret' || this.state === 'rencontre') {
      this.pose = 'palpe'; this.phase = (this.phase + S.tap * dt) % 1; this.frame = Math.floor(this.phase * TAP) % TAP;
      if (this.state === 'rencontre' && this.partner) this.face(this.partner);
      if (this.t <= 0) {
        // after a meeting each goes its way, turned aside
        if (this.state === 'rencontre') { this.heading += (this.rnd() < 0.5 ? -1 : 1) * (1.2 + this.rnd()); this.cool = 2.5; this.partner = null; }
        this.state = 'marche'; this.v = this.range(S.speed); this.t = this.range(S.stopEvery);
      }
    }
    this.fwd = [Math.cos(this.heading), 0, Math.sin(this.heading)];
  }
}
