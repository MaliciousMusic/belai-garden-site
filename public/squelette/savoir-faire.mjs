// savoir-faire.mjs: the atelier's page (savoir-faire.html): the film of how a bouquet is made, three facts, the signature.
// The film's poster is the month's bouquet itself, posed still (a poster does not sway: no animation, no work once drawn).
// Its drawing (nuit-d-ambre, 10 MB before compression) is fetched only as the poster nears the view: on a phone it stands
// below the first screen.
import { near } from './cache.mjs';
import { $, flagship, meta, poseIn, products, stems, surLargeur } from './noyau.mjs';

// the largest bouquet of the month, counted from the shop's data
$('n-tiges').textContent = Math.max(...products.map(stems));

const box = $('film-bq');
const id = products.some((p) => p.id === 'nuit-d-ambre') ? 'nuit-d-ambre' : flagship.id;
// as tall as most of the picture, never wider than most of it
const width = (vb) => {
  const img = box.parentElement;
  return Math.min(img.clientWidth * 0.62, (img.clientHeight * 0.92 * vb[2]) / vb[3]);
};
near(box.parentElement, () =>
  meta(id)
    .then((m) => poseIn(box, id, width(m.vb), { still: true }))
    .catch((err) => console.error('[savoir-faire] poster', err)),
);
// a new width only resizes the box: the posed drawing follows its box by itself
surLargeur(async () => {
  const m = await meta(id);
  const w = width(m.vb);
  box.style.width = `${w}px`;
  box.style.height = `${(w * m.vb[3]) / m.vb[2]}px`;
});
