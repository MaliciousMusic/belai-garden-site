// sw.js: the shop's service worker (registered by cache.mjs, scope: the skeleton's pages; it sees every file they ask for,
// ../scene/ and /insectes/ included). Three ways of keeping a file, by what it is:
// - fixed files, kept first (cache, then the network only if missing): the fonts, the vendored libraries (their version
//   is in their name), the insects' atlases, and the bouquets' drawings (bouquets/<id>/: ouvert.json, atelier.json,
//   coloris/, manifeste.json, p*.svg, sprites/), which are fixed for a collection. The bouquets have their own cache,
//   trimmed to the last BOUQUETS files kept (a bouquet weighs 1 to 10 MB);
// - the data (boutique.json, sens.json, soli.json, the small images): shown from the cache at once, and fetched again
//   behind (stale-while-revalidate), so the next visit has the new one;
// - the pages, modules and styles: the network first, the cache when offline. They are small, and they must come from the
//   same publication: kept stale, an old noyau.mjs met a new produit.mjs on the bench (2026-11-01) and the page stayed
//   empty. The network answers them with a 304 most of the time.
// A new VERSION (at every publication of the shop, and whenever a bouquet is drawn again) empties every older cache.
// Never kept: what is not a GET of this origin, a range (the cycle's video streams by ranges), an answer other than 200.
'use strict';
const VERSION = 'squelette-2026-11-01';
const FIXED = `${VERSION}:fixe`;
const BQ = `${VERSION}:bouquets`;
const FRESH = `${VERSION}:frais`;
const CODE = `${VERSION}:code`;
const BOUQUETS = 48;

const isBouquet = (p) => /\/bouquets\/[^/]+\//.test(p);
const isFixed = (p) => /\.woff2$/.test(p) || /\/vendor\//.test(p) || /\/insectes\/[^/]+\/atlas\//.test(p);
const isCode = (req, p) => req.mode === 'navigate' || /^(document|script|style|worker)$/.test(req.destination) || /\.(html|m?js|css)$/.test(p) || p.endsWith('/');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (ev) =>
  ev.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(`${VERSION}:`)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

const keep = (name, req, res) => {
  if (!res || res.status !== 200 || res.type === 'opaque') return;
  const copy = res.clone();
  caches.open(name).then((c) => c.put(req, copy).then(() => (name === BQ ? trim(c) : null))).catch(() => {});
};
// the oldest bouquet files go first (keys come in the order they were put)
let trimming = null;
const trim = (c) =>
  (trimming ||= c
    .keys()
    .then((keys) => Promise.all(keys.slice(0, Math.max(0, keys.length - BOUQUETS)).map((k) => c.delete(k))))
    .finally(() => (trimming = null)));

async function cacheFirst(name, req) {
  const hit = await caches.match(req, { cacheName: name });
  if (hit) return hit;
  const res = await fetch(req);
  keep(name, req, res);
  return res;
}
async function staleWhileRevalidate(ev, req) {
  const hit = await caches.match(req, { cacheName: FRESH });
  const net = fetch(req).then((res) => (keep(FRESH, req, res), res));
  if (hit) {
    ev.waitUntil(net.catch(() => {}));
    return hit;
  }
  return net;
}
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    keep(CODE, req, res);
    return res;
  } catch (err) {
    const hit = (await caches.match(req, { cacheName: CODE })) || (await caches.match(req, { cacheName: CODE, ignoreSearch: true }));
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || /\.(mp4|webm)$/.test(url.pathname)) return;
  if (isBouquet(url.pathname)) return ev.respondWith(cacheFirst(BQ, req));
  if (isFixed(url.pathname)) return ev.respondWith(cacheFirst(FIXED, req));
  if (isCode(req, url.pathname)) return ev.respondWith(networkFirst(req));
  ev.respondWith(staleWhileRevalidate(ev, req));
});
