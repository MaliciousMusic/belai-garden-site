// cache.mjs: how the shop keeps and fetches its files, and when its bouquets breathe (perf pass, 2026-11-01). Every page
// imports it first (noyau.mjs or the page's own module), and it holds no state a page must wait for.
// - The service worker (sw.js) is registered once the page is idle: fonts, modules, styles and the bouquets' files are
//   then kept on the device (sw.js says how). Never on a local host unless asked (?sw=1): a dev server's files change under
//   it, and a kept module would hide the change; ?sw=0 removes it again.
// - The breeze holds when nobody sees it: every live bouquet (Eclosion's "eclosion:ouvert", caught on its way down to its
//   box) has its sway paused while its box is out of view or the tab is hidden, and resumed as it was (all the pieces of a
//   box together, so their phases are kept). Only the breeze is held (the boxes .bq-brise): a growth runs to its end.
// - idle(fn), near(el, fn, margin), prefetch(urls): the lazy helpers of the pages.

// ---------- the service worker
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(location.hostname);
const ask = new URLSearchParams(location.search).get('sw');
if (ask === '1') {
  try {
    sessionStorage.setItem('sw', '1');
  } catch (_) {}
}
let wanted = !LOCAL || ask === '1';
try {
  wanted ||= ask !== '0' && sessionStorage.getItem('sw') === '1';
} catch (_) {}

// fn when the page has nothing better to do (at the latest after timeout ms)
export const idle = (fn, timeout = 2000) =>
  window.requestIdleCallback ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, Math.min(timeout, 300));

if ('serviceWorker' in navigator) {
  if (wanted) {
    const go = () => idle(() => navigator.serviceWorker.register(new URL('sw.js', import.meta.url), { scope: './' }).catch((err) => console.warn('[cache] sw', err)));
    document.readyState === 'complete' ? go() : addEventListener('load', go, { once: true });
  } else if (LOCAL)
    navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => r.unregister()), () => {});
}

// ---------- lazy loading
// fn(el) once, when el comes within margin of the view (a quarter screen by default)
export function near(el, fn, margin = '25% 0px') {
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      fn(el);
    },
    { rootMargin: margin },
  );
  io.observe(el);
  return () => io.disconnect();
}
// files fetched ahead, quietly, so the drawing that needs them finds them kept (by the service worker or the browser)
const fetched = new Set();
export function prefetch(urls) {
  return Promise.all(
    urls.map((u) => {
      const href = new URL(u, document.baseURI).href;
      if (fetched.has(href)) return null;
      fetched.add(href);
      return fetch(href, { priority: 'low' }).then((r) => r.arrayBuffer(), () => fetched.delete(href)).catch(() => {});
    }),
  );
}
export const reduced = matchMedia('(prefers-reduced-motion: reduce)');

// ---------- the breeze holds when nobody sees it
const boxes = new Set();
const shown = new WeakMap(); // box -> in view (unknown until its first sighting: counted as in view)
const held = new WeakSet(); // the animations this module paused (never resume one paused by the page itself)
function apply(box) {
  if (!box.isConnected) {
    boxes.delete(box);
    sight.unobserve(box);
    return;
  }
  const run = !document.hidden && shown.get(box) !== false;
  for (const a of box.getAnimations({ subtree: true })) {
    if (!a.effect?.target?.classList?.contains('bq-brise')) continue;
    if (!run && a.playState === 'running') {
      a.pause();
      held.add(a);
    } else if (run && held.has(a)) {
      held.delete(a);
      if (a.playState === 'paused') a.play();
    }
  }
}
const sight = new IntersectionObserver((entries) => {
  for (const e of entries) {
    shown.set(e.target, e.isIntersecting);
    apply(e.target);
  }
});
document.addEventListener(
  'eclosion:ouvert',
  (e) => {
    const box = e.target;
    if (!(box instanceof Element)) return;
    if (!boxes.has(box)) {
      boxes.add(box);
      sight.observe(box);
    }
    // the breeze starts in montre(), just after this event: looked at once it has
    queueMicrotask(() => apply(box));
  },
  true,
);
document.addEventListener('visibilitychange', () => {
  for (const box of boxes) apply(box);
});
