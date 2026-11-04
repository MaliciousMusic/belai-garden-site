// Behaviour of the ants of the bouquet (the black garden ant first: LASIUS): workers that walk on the ground at the foot of the
// vase in a correlated random walk, stop now and then to palpate with their antennae, meet each other head on (a short
// antennation, then both go on), and leave the view or come back from its edges. A click on an ant sets them all to work: each
// goes to the nearest faded petal on the ground, palpates it, tears off a fragment, and carries it off toward the nest, then
// comes back for another while fragments remain (DECISIONS: "un clic sur les fourmis les fait ramasser les pétales fanés").
//
// Numbers (fourmi-noire/COMPORTEMENT.md, with their sources): walking speed 24 mm/s on a trail (23.5 to 26 mm/s), a stride of
// about 2.5 mm (0.62 body length) at about 9.6 cycles per second, duty factor 0.6 (the alternating tripod); a head-on meeting costs
// about 0.45 s; a load lowers the cadence, not the stride. On screen the speeds are scaled to the body length (true size).
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export const LASIUS = {
  kind: 'fourmi-noire', bodyMm: 4.0,
  speedMm: 24, strideMm: 2.5, loadSpeed: 0.7,       // mm/s, mm per cycle; carrying: the cadence times 0.7, the stride kept
  turn: 1.6,                                         // rad/s of the heading's random drift (a correlated random walk)
  stop: { every: [2.5, 7], dur: [0.4, 1.6] },        // a pause to palpate, every few seconds
  meet: { reach: 1.4, dur: 0.45 },                   // a meeting within 1.4 body lengths, 0.45 s of antennation
  take: 0.9,                                         // s spent palpating and cutting at the petal
  frames: { marche: 8, porte: 8, palpe: 4 },
};

export class Fourmi {
  // ground: { y, z0, z1, x0, x1 } the band of the scene where ants walk (scene px, y the ground's height on screen at z = 0 is not
  // used: the ground is the plane y = ground.y); petals: [{ P, tint, left }] shared by all the ants; nest: [P...] exits
  constructor(essaim, ground, petals, nest, rnd, opts = {}) {
    this.S = opts.species ?? LASIUS;
    this.e = essaim; this.g = ground; this.petals = petals; this.nest = nest; this.rnd = rnd;
    this.kind = this.S.kind; this.carry = true;
    this.lengthPx = opts.lengthPx ?? 8;
    this.speed = 0.85 + 0.3 * rnd();
    this.P = [0, ground.y, 0]; this.fwd = [1, 0, 0]; this.head = rnd() * 2 * Math.PI;
    this.pose = 'marche'; this.frame = 0; this.phase = rnd(); this.visible = false;
    this.state = 'away'; this.t = rnd() * 3; this.nextStop = this.span(this.S.stop.every);
    this.carrying = false; this.carryTint = 0xffffff; this.work = false;
  }

  get pxmm() { return this.lengthPx / this.S.bodyMm; }
  span(a) { return a[0] + (a[1] - a[0]) * this.rnd(); }

  spawn() {
    const g = this.g, side = this.rnd() < 0.5 ? -1 : 1;
    this.P = [side < 0 ? g.x0 - 10 : g.x1 + 10, g.y, g.z0 + (g.z1 - g.z0) * this.rnd()];
    this.head = side < 0 ? (this.rnd() - 0.5) * 0.8 : Math.PI + (this.rnd() - 0.5) * 0.8;
    this.visible = true; this.state = this.work ? 'go' : 'walk'; this.pose = 'marche';
    if (this.work) this.pickPetal();
  }

  // the work set off by a click: every ant of the bouquet goes for the petals
  poke() { for (const b of this.e.insects) if (b.kind === this.kind && b.startWork) b.startWork(); }
  startWork() {
    this.work = true;
    if (this.state === 'walk' || this.state === 'stop' || this.state === 'meet') { this.state = 'go'; this.pickPetal(); }
  }

  pickPetal() {
    const left = this.petals.filter((p) => p.left > 0);
    if (!left.length) { this.work = false; this.target = null; this.state = 'walk'; return; }
    left.sort((a, b) => len(sub(a.P, this.P)) - len(sub(b.P, this.P)));
    this.target = left[Math.floor(this.rnd() * Math.min(2, left.length))];
  }

  // walking: the heading eased toward a goal (or drifting at random), the body moved along it, the stride's phase advanced so that
  // the feet do not slip (the distance per cycle is the stride)
  walk(dt, goal, slow = 1) {
    if (goal) {
      const want = Math.atan2(goal[2] - this.P[2], goal[0] - this.P[0]);
      let d = want - this.head; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.head += clamp(d, -4 * dt, 4 * dt) + (this.rnd() - 0.5) * 0.6 * dt;
    } else this.head += (this.rnd() - 0.5) * 2 * this.S.turn * Math.sqrt(dt) * 2;
    const v = this.S.speedMm * this.pxmm * this.speed * slow;
    this.P = [this.P[0] + Math.cos(this.head) * v * dt, this.g.y, this.P[2] + Math.sin(this.head) * v * dt];
    // the ground's band holds the ants (they turn back from its far and near edges)
    if (this.P[2] < this.g.z0 || this.P[2] > this.g.z1) { this.head = -this.head; this.P[2] = clamp(this.P[2], this.g.z0, this.g.z1); }
    this.fwd = [Math.cos(this.head), 0, Math.sin(this.head)];
    this.phase = (this.phase + (v * dt) / (this.S.strideMm * this.pxmm)) % 1;
    this.frame = Math.floor(this.phase * 8) % 8;
  }

  palpe(dt) {
    this.pose = 'palpe'; this.phase = (this.phase + dt * 1.6) % 1; this.frame = Math.floor(this.phase * 4) % 4;
  }

  out() { const g = this.g; return this.P[0] < g.x0 - 20 || this.P[0] > g.x1 + 20; }

  update(dt) {
    if (this.state === 'away') {
      this.visible = false; this.t -= dt;
      if (this.t <= 0) this.spawn();
      return;
    }
    const S = this.S;
    if (this.state === 'walk') {
      this.pose = 'marche'; this.walk(dt, null);
      this.nextStop -= dt;
      if (this.nextStop <= 0) { this.state = 'stop'; this.t = this.span(S.stop.dur); this.nextStop = this.span(S.stop.every); }
      this.meetCheck();
      if (this.out()) { this.state = 'away'; this.t = 1 + this.rnd() * 4; }
    } else if (this.state === 'stop' || this.state === 'meet') {
      this.palpe(dt); this.t -= dt;
      if (this.state === 'meet' && this.other) this.head = Math.atan2(this.other.P[2] - this.P[2], this.other.P[0] - this.P[0]);
      this.fwd = [Math.cos(this.head), 0, Math.sin(this.head)];
      if (this.t <= 0) {
        if (this.state === 'meet') this.head += (this.rnd() < 0.5 ? 1 : -1) * (0.6 + this.rnd());
        this.cool = 1.5; this.state = this.work ? 'go' : 'walk';
        if (this.work) this.pickPetal();
      }
    } else if (this.state === 'go') {
      if (!this.target || this.target.left <= 0) { this.pickPetal(); if (!this.target) return; }
      this.pose = 'marche'; this.walk(dt, this.target.P);
      if (len(sub(this.target.P, this.P)) < this.lengthPx * 0.9) { this.state = 'take'; this.t = S.take; }
    } else if (this.state === 'take') {
      this.palpe(dt); this.t -= dt;
      if (this.t <= 0) {
        if (this.target.left > 0) {
          this.target.left--; this.carrying = true; this.carryTint = this.target.tint;
          const n = this.nest[Math.floor(this.rnd() * this.nest.length)];
          this.home = n; this.state = 'carry';
        } else this.state = 'go';
      }
    } else if (this.state === 'carry') {
      this.pose = 'porte'; this.walk(dt, this.home, S.loadSpeed);
      if (this.out() || len(sub(this.home, this.P)) < this.lengthPx) {
        this.carrying = false; this.state = 'away'; this.t = 1.5 + this.rnd() * 2.5;
      }
    }
    if (this.cool > 0) this.cool -= dt;
  }

  // two ants meeting head on: both stop and palpate each other
  meetCheck() {
    if (this.cool > 0) return;
    for (const b of this.e.insects) {
      if (b === this || b.kind !== this.kind || b.state !== 'walk' || !b.visible || b.cool > 0) continue;
      if (len(sub(b.P, this.P)) < this.S.meet.reach * this.lengthPx) {
        for (const [x, y] of [[this, b], [b, this]]) { x.state = 'meet'; x.t = this.S.meet.dur * (0.8 + 0.4 * this.rnd()); x.other = y; }
        return;
      }
    }
  }
}
