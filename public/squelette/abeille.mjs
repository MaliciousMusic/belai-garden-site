// abeille.mjs: the shop's bee, its guide and its counter (owner, 2026-11-02: « un humble clippy », no language model). It
// welcomes the visitor in the middle of the screen at each visit, says what the shop is in a few words, and that a touch
// on it answers any question; then it roams over the page (vie.mjs). Touched, it opens its talk: the visitor types, the
// bee's small network (abeille-modele.json, trained offline by outils/abeille/entraine.py) picks one of the shop's answers
// (abeille-savoir.mjs) and the bee gives it, word for word, in the page's language. Short words that name a subject
// beyond doubt (outils/abeille/lexique.json, « paypal », « nft », « enterrement ») weigh in too. Below its confidence it
// offers its best guesses as buttons (« Vous parlez de… ? ») with a person as the last one (owner, 2026-11-02: « ça
// renvoie direct vers quelqu'un »); with no guess at all, or asked for a person, it puts someone of the atelier on the line: the talk goes to the server (api/src/guichet.js), the community
// manager answers from the atelier's panel (guichet.html), and the answers come into the same talk.
// The talk follows the visitor from page to page (sessionStorage). With reduced motion the bee does not fly: a still bee
// in the corner opens the talk.
import { API, ouvreEcrire } from './ecrire.mjs';
import { SAVOIR } from './abeille-savoir.mjs';
import { conseille } from './abeille-conseil.mjs';
import { choixLangue, langue, tapeDedans } from './traduction.mjs';
import { $, chargeSoli, plain, products, SOLI } from './noyau.mjs';

const VOLE = !!window.VIE;
const MEMOIRE = 'abeille-fil';
const GUICHET = 'abeille-guichet';
const VUE = 'abeille-accueil';
const lire = (k, sinon) => {
  try {
    return JSON.parse(sessionStorage.getItem(k)) ?? sinon;
  } catch (_) {
    return sinon;
  }
};
const garde = (k, v) => {
  try {
    sessionStorage.setItem(k, JSON.stringify(v));
  } catch (_) {}
};

// ---------- the small network: the text folded and hashed as in training (outils/abeille/entraine.py), one hidden layer
let modele = null;
const charge = () =>
  (modele ||= fetch(new URL('abeille-modele.json', import.meta.url))
    .then((r) => r.json())
    .then((m) => {
      const octets = (b64) => Int8Array.from(atob(b64), (c) => (c.charCodeAt(0) << 24) >> 24);
      return { ...m, W1: octets(m.W1), W2: octets(m.W2) };
    }));
const plie = (t) => t.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const enc = new TextEncoder();
function fnv(s) {
  let h = 0x811c9dc5;
  for (const b of enc.encode(s)) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h >>> 0;
}
function traits(t, D) {
  const v = new Map();
  const mot = plie(t);
  const p = [...` ${mot} `];
  for (const n of [1, 2, 3, 4])
    for (let i = 0; i + n <= p.length; i++) {
      const g = p.slice(i, i + n).join('');
      if (g === ' ') continue;
      const k = fnv(g) % D;
      v.set(k, (v.get(k) || 0) + 1);
    }
  for (const w of mot.split(' ').filter(Boolean)) {
    const k = fnv(`#${w}`) % D;
    v.set(k, (v.get(k) || 0) + 1);
  }
  let n2 = 0;
  for (const [k, c] of v) {
    const x = Math.log1p(c);
    v.set(k, x);
    n2 += x * x;
  }
  const n = Math.sqrt(n2) || 1;
  for (const [k, x] of v) v.set(k, x / n);
  return v;
}
async function devine(texte) {
  const m = await charge();
  const { D, H, ids } = m;
  const K = ids.length;
  const h = Float32Array.from(m.b1);
  for (const [k, x] of traits(texte, D)) for (let j = 0, o = k * H; j < H; j++) h[j] += x * m.W1[o + j] * m.s1;
  const z = Float32Array.from(m.b2);
  for (let j = 0; j < H; j++) {
    const a = h[j] > 0 ? h[j] : 0;
    if (a) for (let c = 0, o = j * K; c < K; c++) z[c] += a * m.W2[o + c] * m.s2;
  }
  const max = Math.max(...z);
  let s = 0;
  const e = z.map((x) => ((x = Math.exp(x - max)), (s += x), x));
  const p = e.map((x) => x / s);
  // a short word that names one subject beyond doubt: half of the weight goes to it
  const mots = ` ${plie(texte)} `;
  const vus = ids.filter((id) => (m.lex?.[id] || []).some((t) => (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(t) ? mots.includes(t) : mots.includes(` ${t} `))));
  if (vus.length) for (let c = 0; c < K; c++) p[c] = p[c] * 0.5 + (vus.includes(ids[c]) ? 0.5 / vus.length : 0);
  const connus = new Set(['hors_sujet', 'humain', 'prix', ...SAVOIR.filter((x) => x.a).map((x) => x.id)]);
  const top = ids.map((id, c) => ({ id, p: p[c] })).filter((c) => connus.has(c.id)).sort((a, b) => b.p - a.p);
  return { ...top[0], seuil: m.seuil, top };
}

window.__abeille = { devine }; // for checks

// ---------- the answers: word for word, « prix » with the month's prices
async function reponse(id) {
  if (id === 'prix') {
    await chargeSoli().catch(() => {});
    const bouquet = Math.min(...products.map((p) => p.prix.centimes));
    return `Les soliflores commencent à ${plain(SOLI?.des_centimes ?? 80)}, les bouquets de la collection à ${plain(bouquet)}. Chaque prix est la somme de ses tiges chez un fleuriste, et le vase est offert.`;
  }
  return SAVOIR.find((s) => s.id === id)?.a || '';
}

// ---------- the talk's window
const fil = lire(MEMOIRE, []); // [{ de: 'visiteur' | 'abeille' | 'atelier', texte }]
let guichet = lire(GUICHET, null); // { id, jeton, n }
const chat = document.createElement('section');
chat.className = 'abeille-chat';
chat.setAttribute('role', 'dialog');
chat.setAttribute('aria-label', 'L’abeille de l’atelier');
chat.hidden = true;
chat.innerHTML = `<header class="abeille-tete"><span class="abeille-nom">L’abeille de l’atelier</span><button type="button" class="abeille-fermer" aria-label="Fermer"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg></button></header>
  <ol class="abeille-fil" aria-live="polite"></ol>
  <p class="abeille-mention">Bzzou est une IA. Une personne de l’atelier peut prendre le relais.</p>
  <form class="abeille-form"><label class="visuellement-cache" for="abeille-q">Votre question</label><input id="abeille-q" autocomplete="off" maxlength="500" placeholder="Posez votre question…"><button type="submit" aria-label="Envoyer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg></button></form>`;
document.body.append(chat);
const liste = chat.querySelector('.abeille-fil');
const champ = chat.querySelector('#abeille-q');
// the welcome's bubble, beside the bee
const bulle = document.createElement('div');
bulle.className = 'abeille-bulle';
bulle.setAttribute('role', 'status');
bulle.hidden = true;
document.body.append(bulle);
// a bee to touch where it does not fly (reduced motion), and for the keyboard everywhere
const bouton = document.createElement('button');
bouton.type = 'button';
bouton.className = `abeille-bouton${VOLE ? ' abeille-bouton-cache' : ''}`;
bouton.setAttribute('aria-label', 'Poser une question à l’abeille');
bouton.innerHTML =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="18" rx="7" ry="9"/><path d="M9.5 15h13M9.2 19h13.6M10 23h12"/><ellipse class="aile" cx="10" cy="9" rx="5" ry="3.4" transform="rotate(-25 10 9)"/><ellipse class="aile" cx="22" cy="9" rx="5" ry="3.4" transform="rotate(25 22 9)"/><circle cx="16" cy="8" r="3"/></svg>';
document.body.append(bouton);

// ---------- the header's switch (owner, 2026-11-02: « une icône noire en contour dans l'en-tête, qui active ou désactive
// Bzzou »): off, Bzzou does not fly, does not welcome, and its talk closes; kept in this browser
const ETEINTE = 'bzzou-eteinte';
const estEteinte = () => {
  try {
    return localStorage.getItem(ETEINTE) === '1';
  } catch (_) {
    return false;
  }
};
const bascule = document.createElement('button');
bascule.type = 'button';
bascule.className = 'bzzou-bascule';
bascule.innerHTML =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="14" rx="4.2" ry="5.6"/><path d="M8 12.6h8M7.9 15.6h8.2"/><circle cx="12" cy="6.6" r="1.9"/><path d="M10.4 9.2C8 7 5 7.2 4.6 9.2s2.3 3 4.2 2.4M13.6 9.2C16 7 19 7.2 19.4 9.2s-2.3 3-4.2 2.4"/><path class="bzzou-barre" d="M4 20L20 4"/></svg>';
const montreBascule = () => {
  const off = estEteinte();
  bascule.classList.toggle('eteinte', off);
  bascule.setAttribute('aria-pressed', String(!off));
  bascule.setAttribute('aria-label', off ? 'Réveiller Bzzou' : 'Endormir Bzzou');
  bascule.title = off ? 'Réveiller Bzzou' : 'Endormir Bzzou';
  bouton.hidden = off;
};
montreBascule();
document.querySelector('.tete-droite')?.insertBefore(bascule, document.querySelector('.tete-droite .compte-lien'));
bascule.addEventListener('click', async () => {
  const off = !estEteinte();
  try {
    off ? localStorage.setItem(ETEINTE, '1') : localStorage.removeItem(ETEINTE);
  } catch (_) {}
  montreBascule();
  if (off) {
    chat.hidden = true;
    bulle.hidden = true;
  }
  await window.VIE?.allume(!off);
});

function montre(m) {
  const li = document.createElement('li');
  li.className = `abeille-msg de-${m.de}`;
  if (m.de === 'atelier') {
    const qui = document.createElement('b');
    qui.textContent = 'L’atelier';
    li.append(qui, document.createElement('br'));
  }
  // what the visitor and the atelier write stays as written; only the bee's own words go through the phrase books
  const t = document.createElement('span');
  t.textContent = m.texte;
  // the model's words come already in the page's language: like the visitor's and the atelier's, never re-translated
  if (m.de !== 'abeille' || m.libre) t.setAttribute('translate', 'no');
  li.append(t);
  // the bee's advice: the soliflores and bouquets it proposes, each a link to its page
  if (m.liens?.length) {
    const ul = document.createElement('ul');
    ul.className = 'abeille-liens';
    for (const l of m.liens) {
      const li = document.createElement('li');
      const lien = document.createElement('a');
      lien.href = l.href;
      // the name and the colourway each in their own words (the phrase books know them), the price as it is
      const [nom, coloris, prix] = Array.isArray(l.t) ? l.t : [l.t, '', ''];
      for (const [morceau, avant, garde] of [[nom, '', false], [coloris, ', ', false], [prix, ' · ', true]]) {
        if (!morceau) continue;
        if (avant) lien.append(avant);
        const sp = document.createElement('span');
        sp.textContent = morceau;
        if (garde) sp.setAttribute('translate', 'no');
        lien.append(sp);
      }
      li.append(lien);
      ul.append(li);
    }
    li.append(ul);
  }
  // its guesses, and a person last; once one is chosen the buttons go
  if (m.choix && !m.fait) {
    const ul = document.createElement('div');
    ul.className = 'abeille-choix';
    for (const c of [...m.choix, { id: 'humain', q: m.choix.length ? 'Non, parler à quelqu’un' : 'Oui, parler à quelqu’un' }]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.q;
      if (c.id === 'humain') b.className = 'abeille-choix-humain';
      b.addEventListener('click', () => {
        m.fait = true;
        garde(MEMOIRE, fil.slice(-40));
        ul.remove();
        choisi(c, m.question);
      });
      ul.append(b);
    }
    li.append(ul);
  }
  if (m.ecrire) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'abeille-ecrire';
    b.textContent = 'Nous écrire';
    b.addEventListener('click', () => ouvreEcrire(m.ecrire));
    li.append(document.createElement('br'), b);
  }
  liste.append(li);
  liste.scrollTop = liste.scrollHeight;
}
function dit(m) {
  fil.push(m);
  garde(MEMOIRE, fil.slice(-40));
  montre(m);
}
for (const m of fil) montre(m);

// ---------- a person of the atelier on the line
let relance = 0;
let attente = 0;
async function passe(question) {
  dit({ de: 'abeille', texte: 'Un instant, je vous passe quelqu’un de l’atelier…' });
  try {
    const r = await fetch(`${API}/guichet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texte: question, langue, page: location.pathname + location.search, avant: fil.slice(-11, -2) }),
    });
    const j = await r.json();
    if (!r.ok || !j.id) throw new Error(j.erreur || r.status);
    guichet = { id: j.id, jeton: j.jeton, n: 0 };
    garde(GUICHET, guichet);
    attente = Date.now();
    ecoute();
  } catch (_) {
    dit({ de: 'abeille', texte: 'Personne n’est joignable pour l’instant. Laissez-nous un mot, l’atelier vous répond vite.', ecrire: question });
  }
}
// what the atelier wrote since the last look: every 4 s while the talk is open, every 20 s while it is closed
async function ecoute() {
  clearTimeout(relance);
  if (!guichet) return;
  try {
    const r = await fetch(`${API}/guichet/${guichet.id}?depuis=${guichet.n}`, { headers: { 'x-guichet-jeton': guichet.jeton } });
    if (r.status === 404) {
      guichet = null;
      garde(GUICHET, null);
      return;
    }
    const j = await r.json();
    for (const m of j.messages || []) {
      guichet.n = Math.max(guichet.n, m.n);
      if (m.de !== 'atelier') continue;
      attente = 0;
      dit({ de: 'atelier', texte: m.texte });
      if (chat.hidden) parle('L’atelier vous a répondu : touchez-moi pour lire.');
    }
    garde(GUICHET, guichet);
    // nobody yet after two minutes: the hours, and a way to be answered later
    if (attente && Date.now() - attente > 120000) {
      attente = 0;
      dit({ de: 'abeille', texte: 'L’atelier répond de 10 h à 23 h (heure de Paris). Laissez ici votre e-mail ou votre téléphone : on vous répondra.' });
    }
  } catch (_) {}
  relance = setTimeout(ecoute, chat.hidden ? 20000 : 4000);
}
if (guichet) ecoute();

async function demande(texte) {
  dit({ de: 'visiteur', texte });
  // a person is on the line: what the visitor writes goes to them
  if (guichet) {
    try {
      await fetch(`${API}/guichet/${guichet.id}/message`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jeton: guichet.jeton, texte }) });
      ecoute();
      return;
    } catch (_) {}
  }
  // the obvious first, without the network: a buzz, a laugh, a bee joke, a joke asked for
  const evident = evidence(texte);
  if (evident) return dit({ de: 'abeille', texte: evident });
  let g;
  try {
    g = await devine(texte);
  } catch (_) {
    g = { id: 'hors_sujet', p: 0, seuil: 1 };
  }
  // advice: a colour, a season, a flower, a budget or an occasion named, and a request for something to choose
  const conseil = await conseille(texte).catch(() => null);
  if (conseil && !SERVICE.has(g.id) && (conseil.fort || DEMANDE.test(` ${plie(texte)} `) || CONSEIL.has(g.id) || g.p < g.seuil)) return dit({ de: 'abeille', texte: conseil.texte, liens: conseil.liens });
  if (g.id === 'humain') return passe(texte);
  // a word of conversation (a joke, a greeting, a compliment) is never offered as a guess: it is answered from half the
  // confidence, a slightly wrong one costs nothing
  const seuil = SAVOIR.find((x) => x.id === g.id)?.choix === false ? Math.min(g.seuil, 0.5) : g.seuil;
  if (g.id !== 'hors_sujet' && g.p >= seuil) return repond(g.id, texte);
  // not sure: the conversation model (bzzou/serveur.mjs), when it runs; never for an order, a payment or a loss
  if (!SERVICE.has(g.id)) {
    const libre = await converse(texte, g);
    if (libre) return dit({ de: 'abeille', texte: libre, libre: true });
  }
  // its best guesses among the shop's subjects (never the greetings), a person as the last button
  const choix = (g.top || [])
    .filter((c) => c.p >= 0.08 && SAVOIR.find((s) => s.id === c.id)?.choix !== false)
    .slice(0, 3)
    .map((c) => ({ id: c.id, q: SAVOIR.find((s) => s.id === c.id)?.q }))
    .filter((c) => c.q);
  if (choix.length) return dit({ de: 'abeille', texte: 'Je ne suis pas sûre d’avoir compris. Vous parlez de… ?', choix, question: texte });
  // nothing of the shop in it: a person only if the visitor wants one (an off-topic question would cost the atelier for
  // nothing); a question of the shop it cannot place: the atelier, as the owner decided
  if (g.id === 'hors_sujet') return dit({ de: 'abeille', texte: 'Je ne connais que la boutique : les bouquets, les soliflores, les cadeaux. Voulez-vous que je vous passe quelqu’un ?', choix: [], question: texte });
  return passe(texte);
}
// an answer; for what only a person can do (a payment, a lost link, a loss), the bee's sentence, then the atelier; never
// an empty bubble (an answer missing: the atelier)
async function repond(id, question) {
  const s = SAVOIR.find((x) => x.id === id);
  if (s?.humain) {
    if (s.a) dit({ de: 'abeille', texte: s.a });
    return passe(question);
  }
  const a = await reponse(id);
  if (!a) return passe(question);
  dit({ de: 'abeille', texte: a });
}
// ---------- the conversation model, run by the owner (bzzou/serveur.mjs: on this machine while the shop is built, then on
// its server behind /bzzou): asked only when the bee cannot answer on its own; a « … » while it thinks; absent or silent,
// the bee does as before (its guesses, then a person)
const LLM = ['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://127.0.0.1:8792/bzzou' : '/bzzou';
let llmAbsent = false;
async function converse(texte, g) {
  if (llmAbsent) return null;
  const pense = document.createElement('li');
  pense.className = 'abeille-msg de-abeille abeille-pense';
  pense.setAttribute('aria-label', 'Bzzou réfléchit');
  pense.innerHTML = '<span></span><span></span><span></span>';
  liste.append(pense);
  liste.scrollTop = liste.scrollHeight;
  try {
    const r = await fetch(LLM, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texte, langue, pistes: (g.top || []).slice(0, 5).map((c) => c.id), fil: fil.slice(-7, -1) }),
      signal: AbortSignal.timeout(40000),
    });
    if (r.status === 204 || r.status === 429) return null;
    if (!r.ok) throw new Error(r.status);
    return (await r.json()).texte || null;
  } catch (_) {
    // not running (or too slow): not asked again on this page
    llmAbsent = true;
    return null;
  } finally {
    pense.remove();
  }
}
// what is about an order or a person, never answered with flowers to buy
const SERVICE = new Set(['humain', 'code', 'code_ne_marche_pas', 'lien_pas_recu', 'probleme_paiement', 'retractation', 'panne', 'deuil_personnel', 'solitude_reconfort', 'changer_destinataire', 'ouvert_par_erreur', 'modifier_mot', 'retrouver_bouquet']);
// the intentions that ask the bee to choose (its advice comes before their answer when the question names what it wants)
const CONSEIL = new Set(['conseil_choix', 'fleurs', 'saison', 'soliflore', 'signification', 'prix', 'retouche', 'composer_soi_meme', 'collection_mois', 'exactitude_botanique', 'vraies_fleurs']);
const DEMANDE = / (donne|donnez|donner|conseil\w*|propos\w*|cherche\w*|veux|voudrais|aimerais|souhaite|quel|quelle|quels|quelles|recommand\w*|idee|idees|trouve\w*|montre\w*|suggest\w*|want|wanna|looking|recommend\w*|need|show|give|which|what|busco|quiero|quisiera|recomienda\w*|cerco|vorrei|consigli\w*|suche|empfehl\w*|mochte|quero|procuro|recomenda\w*|gusto|kailangan|おすすめ|推荐|推薦|추천|想要|欲しい) /;
// the obvious, read before the network (owner, 2026-11-02: « répondre aux blagues évidentes »)
function evidence(texte) {
  const t = ` ${plie(texte)} `;
  const court = t.trim().split(' ').length <= 8;
  if (/ b*z{2,}\w* | bz+ /.test(t) && court) return 'Bzzz bzz ! Ça veut dire : posez-moi une question sur les bouquets, je butine les réponses.';
  if (/ (ha){2,}h? | (he|hi|ho){2,} | lol | mdr | ptdr | xd | (ja){2,} | (je){2,} | k{3,} | rs{2,} |ㅋ{2,}|ㅎ{2,}|哈{2,}|笑|w{3,}/.test(t) || /[\u{1F602}\u{1F923}\u{1F604}\u{1F606}\u{1F601}\u{1F60A}\u{1F642}\u{1F339}\u{1F41D}]/u.test(texte)) {
    if (court) return 'Bzz ! Ravie de vous faire sourire. Une question sur les bouquets ?';
  }
  if (court && / (piques?|piquer|dard|miel|ruche|reine|sting|stings|stinger|honey|hive|queen|aguijon|pica|picas|pungi|pungiglione|miele|alveare|stachel|stichst|honig|ferrao|ferroa|mel|colmeia) |蜂蜜|針|刺|꿀|침/.test(t)) return SAVOIR.find((x) => x.id === 'blague_abeille')?.a || null;
  if (/ (blague|blagues|joke|jokes|chiste|chistes|barzelletta|witz|witze|piada|piadas|biro) |笑话|冗談|ジョーク|농담/.test(t)) return SAVOIR.find((x) => x.id === 'blague')?.a || null;
  // asked whether Bzzou itself is an AI, a robot, a person (owner, 2026-11-02): its own answer; the bouquets made by an AI
  // go to « ia » (the atelier's film)
  if (/ (tu|t|toi|vous|bzzou|abeille|you|u|eres|sei|bist|voce|ka|ikaw) /.test(t) && / (ia|ai|ki|robot|bot|chatbot|chatgpt|gpt|llm|intelligence artificielle|artificial intelligence|machine|programme|program|humain|humaine|human|personne|person|vraie|real|reelle) |人工智能|ロボット|機械|인공지능|로봇/.test(t)) return SAVOIR.find((x) => x.id === 'abeille_robot')?.a || null;
  return null;
}
// a guess chosen: its answer; the person: the atelier, with the visitor's question
async function choisi(c, question) {
  dit({ de: 'visiteur', texte: c.q });
  if (c.id === 'humain') return passe(question);
  repond(c.id, question);
}
chat.querySelector('.abeille-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = champ.value.trim();
  if (!t) return;
  champ.value = '';
  demande(t);
});

// ---------- opening and closing the talk; the bee sits beside it
async function ouvre() {
  bulle.hidden = true;
  chat.hidden = false;
  if (!fil.length) dit({ de: 'abeille', texte: 'Bonjour ! Je suis Bzzou, l’abeille de l’atelier, une IA. Posez-moi votre question sur les bouquets, les soliflores ou un cadeau. Une personne de l’atelier peut prendre le relais.' });
  liste.scrollTop = liste.scrollHeight;
  champ.focus({ preventScroll: true });
  charge().catch(() => {});
  if (guichet) ecoute();
  const v = VOLE && (await window.VIE.ready);
  if (v && !chat.hidden) {
    const r = chat.getBoundingClientRect();
    v.perche(r.left + 30, r.top - 6);
  }
}
async function ferme() {
  chat.hidden = true;
  bouton.focus?.({ preventScroll: true });
  const v = VOLE && (await window.VIE.ready);
  v?.promene();
}
chat.querySelector('.abeille-fermer').addEventListener('click', ferme);
chat.addEventListener('keydown', (e) => e.key === 'Escape' && ferme());
bouton.addEventListener('click', () => (chat.hidden ? ouvre() : ferme()));
document.addEventListener('abeille:clic', () => (chat.hidden ? ouvre() : ferme()));
// reduced motion asked for while the page is open: the bee stops flying, the still one takes its place
document.addEventListener('abeille:calme', () => bouton.classList.remove('abeille-bouton-cache'));

// ---------- the bubble: words beside the bee, following it while they are shown
let suit = 0;
// a sentence, or a little text ({ titre, corps: [paragraphs], fin }); sous: under the bee (the welcome), else above it
function parle(texte, ms = 9000, { sous = false, haut = 0 } = {}) {
  if (typeof texte === 'string') bulle.textContent = texte;
  else {
    bulle.replaceChildren();
    const h = document.createElement('p');
    h.className = 'abeille-bulle-titre';
    h.textContent = texte.titre;
    bulle.append(h);
    for (const c of texte.corps) {
      const q = document.createElement('p');
      q.textContent = c;
      bulle.append(q);
    }
    const f = document.createElement('p');
    f.className = 'abeille-bulle-fin';
    f.textContent = texte.fin;
    bulle.append(f);
  }
  bulle.classList.toggle('accueil', sous);
  bulle.hidden = false;
  cancelAnimationFrame(suit);
  const fin = performance.now() + ms;
  const place = async () => {
    const v = VOLE && window.__vie ? await window.VIE.ready : null;
    const p = v?.ecran();
    const r = bulle.getBoundingClientRect();
    let x;
    let y;
    if (sous) {
      // the welcome: still, in the middle, its top at haut (room for the bee sitting on its rim), kept within the screen
      x = (innerWidth - r.width) / 2;
      y = Math.max(12, Math.min(innerHeight - r.height - 12, haut));
    } else if (p) {
      // above the bee, kept within the screen
      x = Math.min(innerWidth - r.width - 12, Math.max(12, p[0] - r.width / 2));
      y = Math.max(70, p[1] - r.height - v.taille() * 0.9);
    } else {
      const b = bouton.getBoundingClientRect();
      x = Math.max(12, b.right - r.width);
      y = b.top - r.height - 12;
    }
    bulle.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    if (performance.now() < fin && !bulle.hidden) suit = requestAnimationFrame(place);
    else bulle.hidden = true;
  };
  place();
}
bulle.addEventListener('click', ouvre);

// ---------- the welcome, at each visit (owner, 2026-11-02, then 2026-11-03: « l'abeille bien au-dessus de sa bulle, en
// assez gros, genre premier plan », a text that tells the whole idea with perfect clarity and places the brand): Bzzou in
// the foreground sitting on the upper rim of its words, never closing by itself (owner, 2026-11-03): only a touch elsewhere
// or a scroll ends it
const ACCUEIL = {
  titre: 'Bienvenue chez Belai’s Garden',
  corps: [
    'Un atelier de fleurs numériques. Chaque bouquet est dessiné tige à tige d’après de vraies fleurs : sur votre écran, il éclôt, respire dans la brise, puis fane doucement en trente jours, comme un vrai.',
    'Offrez-le d’un simple lien, où que soit la personne, ou gardez-le sur votre bureau. Son prix est celui de ses tiges chez un fleuriste, vase offert, et la collection change chaque mois.',
  ],
  fin: 'Une question ? Touchez-moi : je suis Bzzou.',
};
// the welcome's words typed in, the card at its final size from the start. The phrase books write first, so the words typed
// are the reader's; screen readers get the words whole, not letter by letter
async function tapeAccueil() {
  bulle.style.visibility = 'hidden';
  bulle.setAttribute('aria-live', 'off');
  await new Promise((res) => setTimeout(res));
  const lignes = [...bulle.querySelectorAll(':scope > p')];
  bulle.style.width = `${bulle.getBoundingClientRect().width}px`;
  for (const p of lignes) p.style.minHeight = `${p.getBoundingClientRect().height}px`;
  bulle.style.visibility = '';
  tapeDedans(
    lignes.map((p) => p.firstChild),
    () => {
      bulle.style.width = '';
      for (const p of lignes) p.style.minHeight = '';
      bulle.removeAttribute('aria-live');
    },
  );
}
async function accueil() {
  let vu = false;
  try {
    vu = sessionStorage.getItem(VUE) === '1';
  } catch (_) {}
  if (vu || estEteinte()) return;
  const v = VOLE ? await window.VIE.ready : null;
  // the cookies first, in the same card in the middle (owner, 2026-11-04): Bzzou sits on its rim, then the welcome takes its place
  const question = document.querySelector('.consentement:not([hidden])');
  if (question) {
    v?.accueil(question);
    await new Promise((res) => document.addEventListener('belai:consentement', res, { once: true }));
  }
  try {
    sessionStorage.setItem(VUE, '1');
  } catch (_) {}
  // the words first, then Bzzou comes and sits on their upper rim (owner, 2026-11-03: « posée sur le rebord de la bulle »)
  parle(ACCUEIL, Infinity, { sous: true, haut: v ? v.tailleAccueil() * 0.75 + 76 : 96 });
  // the language, in the card's upper right corner (owner, 2026-11-03); a choice rewrites the words in place
  const globe = choixLangue();
  globe.classList.add('abeille-langues');
  globe.addEventListener('click', (e) => e.stopPropagation());
  bulle.prepend(globe);
  tapeAccueil();
  if (!v) return;
  v.accueil(bulle);
  let fini = false;
  const fin = () => {
    if (fini) return;
    fini = true;
    removeEventListener('scroll', parDefil);
    document.removeEventListener('pointerdown', parTouche, true);
    bulle.hidden = true;
    if (chat.hidden) v.promene();
  };
  const y0 = scrollY;
  const parDefil = () => Math.abs(scrollY - y0) > 160 && fin();
  const parTouche = (e) => !bulle.contains(e.target) && fin();
  addEventListener('scroll', parDefil, { passive: true });
  document.addEventListener('pointerdown', parTouche, true);
}
const posee = new Promise((res) => (document.readyState === 'complete' ? res() : addEventListener('load', res, { once: true })));
posee.then(() => (window.requestIdleCallback ? requestIdleCallback(accueil, { timeout: 2000 }) : setTimeout(accueil, 800)));
