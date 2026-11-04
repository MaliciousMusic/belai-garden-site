// From an insect's orientation in the scene to the cell of its atlas: which baked view, mirrored or not, turned by how
// much in the screen plane. No dependency: shared by the runtime and the node tests.
//
// Scene frame: X to the right, Y up, Z toward the viewer. The insect's body frame is given by three unit vectors in the
// scene: f (toward the head), l (its left), u (its back). The atlas views follow the engine's camera (geo.mjs camera):
// az = 0 looks at the head, az = 90 at the left side, el = 90 from above.

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const DEG = 180 / Math.PI;

// Body frame from a heading (forward, any length), a bank angle around it and a world up.
export function bodyFrame(fwd, bank = 0, up = [0, 1, 0]) {
  const f = norm(fwd);
  let l = cross(up, f);
  if (Math.hypot(l[0], l[1], l[2]) < 1e-4) l = cross([0, 0, 1], f);
  l = norm(l);
  let u = cross(f, l);
  if (bank) {
    const c = Math.cos(bank), s = Math.sin(bank);
    const l2 = [l[0] * c + u[0] * s, l[1] * c + u[1] * s, l[2] * c + u[2] * s];
    u = cross(f, l2); l = l2;
  }
  return { f, l, u: norm(u) };
}

// toEye: unit vector from the insect to the viewer, in the scene frame.
export function viewOf(frame, toEye = [0, 0, 1]) {
  const { f, l, u } = frame;
  const cb = [dot(toEye, f), dot(toEye, l), dot(toEye, u)];
  const el = Math.asin(Math.max(-1, Math.min(1, cb[2]))) * DEG;
  let az = Math.atan2(cb[1], cb[0]) * DEG;
  if (az < 0) az += 360;
  // Up of the baked sprite (the engine camera's u = r x (-c)), carried into the scene, then seen on screen.
  const a = az / DEG;
  const rb = [-Math.sin(a), Math.cos(a), 0];
  const ub = cross(rb, [-cb[0], -cb[1], -cb[2]]);
  const uw = [ub[0] * f[0] + ub[1] * l[0] + ub[2] * u[0], ub[0] * f[1] + ub[1] * l[1] + ub[2] * u[1], ub[0] * f[2] + ub[1] * l[2] + ub[2] * u[2]];
  // Screen: x right, y down. The sprite's up must point along (uw.X, -uw.Y) on screen.
  const rotation = Math.atan2(uw[0], uw[1]);
  return { az, el, rotation };
}

// Nearest baked cell of one level of detail. Views past 180 degrees are the mirror of 360 - az.
// Mirroring a walk swaps the tripods, which is half a cycle later.
export function pickCell(lod, elList, pose, frame, frames, view) {
  let az = view.az, flip = false;
  if (az > 180) { az = 360 - az; flip = true; }
  const azs = lod.az;
  let ba = azs[0];
  for (const a of azs) if (Math.abs(a - az) < Math.abs(ba - az)) ba = a;
  let be = elList[0];
  for (const e of elList) if (Math.abs(e - view.el) < Math.abs(be - view.el)) be = e;
  let f = frame;
  if (flip && pose === 'marche') f = (frame + frames / 2) % frames;
  const i = lod.keys[`${pose}/${f}/${ba}/${be}`];
  return { i, flip, az: ba, el: be };
}

// Wing axes of a butterfly wing (moteur/papillon.mjs flapAxes, kept identical): the sweep turns the flat wing in its plane
// (positive: drawn back), then the flap raises it about the body's axis (0 spread flat, +90 closed above the back); side +1 for
// the left wings. Body frame: x forward, y left, z up.
export function flapAxes(side, flapDeg, sweepDeg) {
  const fl = flapDeg / DEG, sw = sweepDeg / DEG;
  const e1 = [-Math.sin(sw), side * Math.cos(sw) * Math.cos(fl), Math.cos(sw) * Math.sin(fl)];
  const e2 = [Math.cos(sw), side * Math.sin(sw) * Math.cos(fl), Math.sin(sw) * Math.sin(fl)];
  return { e1, e2 };
}
