// recu.js: the gift-received journey. The link opens the envelope only (recu.html?g=<gift>&lang=): the giver sends the code
// apart, and a link alone opens nothing (owner, 2026-11-02). The code is typed on the envelope, which also lets the browser
// play sound; then the bouquet grows (Eclosion.ouvre), the message writes itself, and the page offers one main way (keep
// it on a screen) and two quieter ones (thank, come back). Who offers it is said only once the code is right, and only if
// the giver signed: a gift may stay unsigned, and the giver's e-mail never shows (owner, 2026-11-02).
// This preview has no account server: the gift's contents come from the link (?b= the bouquet, ?de= the signature, ?mot=)
// and any code of four signs or more opens it. At integration the code goes to the server with the gift's id (?g=), which
// answers with the gift (signature, word, music, voice message) and ties it to this device: the first one to open it
// receives it, and the link then opens nothing for anyone else. Keeping it, thanking and the music are stubs here.

import { idle, prefetch } from './cache.mjs';
import { T, LOCALES } from './recu-langues.mjs';
import { langue } from './traduction.mjs';

const SCENE = '../scene/';
const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const shop = await fetch(`${SCENE}boutique.json`).then((r) => r.json());
const p = shop.produits.find((x) => x.id === q.get('b')) || shop.produits.find((x) => x.id === 'printemps-a-la-carpe');
// a code an older link still carried is taken out of the address at once: the code never stays in a link
if (q.has('code')) {
  q.delete('code');
  history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`);
}
// the signature, as the giver wrote it, or nothing: an unsigned gift names no one
const de = (q.get('de') || '').trim().slice(0, 30);
const signe = de !== '';
const mot = q.get('mot') || 'Bon anniversaire, petite sœur. Il restera chez toi tout le mois.';
const narrow = () => matchMedia('(max-width: 900px)').matches;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

// the recipient's language, chosen by the giver (?lang=), French by default; every keyed word is set from it
const lang = T[q.get('lang')] ? q.get('lang') : 'fr';
const t = T[lang];
// a language this page has no words of its own for (Italian, Japanese, Filipino, Portuguese, Korean) is set by the phrase
// books (traduction.mjs), which also give the page its lang: it is not taken back to French here
if (lang !== 'fr' || langue === 'fr') document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
for (const el of document.querySelectorAll('[data-t]')) el.innerHTML = t[el.dataset.t];
for (const el of document.querySelectorAll('[data-t-ph]')) el.placeholder = t[el.dataset.tPh];
// unsigned: no « De la part de », and the thanks go to « the person who offers it »
if (!signe) {
  $('part').hidden = true;
  $('m-h3').innerHTML = t.m_h3_anon;
  $('m-p').innerHTML = t.m_p_anon;
}
for (const el of document.querySelectorAll('[data-de]')) el.textContent = de;
document.title = t.titre;
$('son').textContent = t.son_off;
// WeChat's own browser opens the page; placing the bouquet on a screen needs the system browser
if (/MicroMessenger/i.test(navigator.userAgent)) $('wechat').hidden = false;

// the thirty days start today, the day it is opened (owner, 2026-10-31)
const end = new Date(Date.now() + 30 * 864e5).toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'long' });
$('jusqua').textContent = end;
$('r-nom').textContent = p.nom;

// the systems it lives on (same marks as the shop page)
document.querySelector('.os').innerHTML = [
  '<path d="M3 5.5l7.5-1v7H3zM11.5 4.4L21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.4z"/>',
  '<path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9s-2-.9-3.3-.9C6.1 7.1 4.5 8.1 3.6 9.7c-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.3-.9-2.3-3.6zM14 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z"/>',
  '<rect x="6.5" y="2.5" width="11" height="19" rx="2.4"/><path d="M10.5 18.5h3"/>',
  '<path d="M5.5 10.5h13v7a1.5 1.5 0 01-1.5 1.5h-10a1.5 1.5 0 01-1.5-1.5zM5.6 9.5a6.4 5.4 0 0112.8 0z"/><path d="M8 5l1.3 2M16 5l-1.3 2"/>',
].map((d) => `<svg viewBox="0 0 24 24">${d}</svg>`).join('');

// the message writes itself, a letter at a time, as a hand would (instant with reduced motion)
async function write(el, text) {
  if (RM) return void (el.textContent = `« ${text} »`);
  el.textContent = '« ';
  for (const ch of text) {
    el.textContent += ch;
    await new Promise((r) => setTimeout(r, ch === ',' || ch === '.' ? 220 : 38));
  }
  el.textContent += ' »';
}

// the gift's drawing is fetched while the envelope is read, once the page is idle: it grows at the very touch
idle(() =>
  fetch(`${SCENE}bouquets/${p.id}/manifeste.json`, { priority: 'low' })
    .then((r) => r.json())
    .then((m) => prefetch([`${SCENE}bouquets/${p.id}/sprites/sprites.json`, ...new Set(m.pieces.map((x) => `${SCENE}bouquets/${p.id}/${x.f}`))]))
    .catch(() => {}),
);

// the code: in this preview any code of four signs or more is right; at integration, the server's answer (a wrong code
// is counted there, five at most, then an hour's wait)
const ouvre = async (code) => code.length >= 4;
$('code-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const code = $('code').value.replace(/\s+/g, '').toUpperCase();
  if (!code) return void ($('code-etat').textContent = t.code_vide);
  $('ouvrir').disabled = true;
  const ok = await ouvre(code);
  $('ouvrir').disabled = false;
  if (!ok) {
    $('code-etat').textContent = t.code_faux;
    return void $('code').focus();
  }
  $('code-etat').textContent = '';
  revele();
});

// the voice message, when the gift has one (its address comes with the gift from the server; none in this preview)
const voix = q.get('voix-url') || '';
if (voix) {
  $('vocal').hidden = false;
  $('vocal-son').src = voix;
  $('vocal-btn').addEventListener('click', () => ($('vocal-son').paused ? $('vocal-son').play() : $('vocal-son').pause()));
}

// the reveal: the envelope goes, the bouquet grows from its vase, the message follows the first flowers
async function revele() {
  $('enveloppe').hidden = true;
  $('revelation').hidden = false;
  $('mot-lu').textContent = `« ${mot} »`;
  (signe ? $('part') : $('mot-p')).focus({ preventScroll: true });
  const m = await fetch(`${SCENE}bouquets/${p.id}/sprites/sprites.json`).then((r) => r.json());
  const box = $('r-bouquet');
  const maxH = narrow() ? innerHeight * 0.5 : innerHeight - 160;
  const w = Math.min(box.parentElement.clientWidth, (maxH * m.vb[2]) / m.vb[3]);
  box.style.width = `${w}px`;
  box.style.height = `${(w * m.vb[3]) / m.vb[2]}px`;
  box.setAttribute('aria-label', signe ? `${p.nom}, offert par ${de}` : p.nom);
  const grow = Eclosion.ouvre(box, `${SCENE}bouquets/${p.id}/manifeste.json`);
  const written = new Promise((res) => setTimeout(() => write($('mot'), mot).then(res), RM ? 0 : 1600));
  const b = await grow;
  await b.grandi;
  $('apres').hidden = false;
  // no scroll away from the peak: once the message is written, one link leads on, and the bouquet stays in view
  await written;
  setTimeout(() => ($('suite').hidden = false), RM ? 0 : 2500);
  // the cookies' band waits for this moment (consentement.mjs)
  document.dispatchEvent(new Event('cadeau:ouvert'));
}

$('son').addEventListener('click', () => {
  const off = $('son').textContent === t.son_off;
  $('son').textContent = off ? t.son_on : t.son_off;
});

$('merci-envoyer').addEventListener('click', () => {
  const words = $('merci').value.trim();
  $('merci-etat').textContent = words ? (signe ? t.merci_ok.replace('{de}', de) : t.merci_ok_anon) : t.merci_vide;
  // the one offer of the page, right after the thanks: answering with a flower, the giver's name already there. The flower
  // reaches the giver through the gift (?g=), never its code; an unsigned gift is answered on the soliflores' plain page
  // (whether a flower may answer an unsigned gift is a question for the owner: RAPPORT-DECISIONS-2NOV.md)
  if (words && !$('repondre')) {
    const a = document.createElement('p');
    a.className = 'retour-offre';
    a.id = 'repondre';
    a.innerHTML = t.offre;
    if (signe) a.querySelector('a').href = `soliflore.html?${new URLSearchParams({ pour: de, g: q.get('g') || '' })}`;
    $('merci-etat').after(a);
  }
});
$('garder-lien').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $('lien-etat').textContent = t.lien_ok;
  } catch (_) {
    $('lien-etat').textContent = t.lien_non;
  }
});
document.addEventListener('click', (ev) => {
  if (!ev.target.closest('[data-bouchon]')) return;
  ev.preventDefault();
  $('bouchon-texte').textContent = t.garder;
  $('bouchon').showModal();
});

// to find it again: the link by e-mail (one message), and the collections only if the box is ticked (retention ID-06)
$('retrouver').addEventListener('submit', (ev) => {
  ev.preventDefault();
  $('lien-etat').textContent = $('r-mail').value.includes('@') ? t.r_ok : t.r_vide;
});
