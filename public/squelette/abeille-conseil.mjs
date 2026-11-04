// abeille-conseil.mjs: Bzzou's advice (owner, 2026-11-02: « il faut que Bzzou puisse aider à conseiller les choix de
// bouquet »). No language model: the question is read for what it names (a colour, a season or a month, a flower, a
// budget, an occasion), in the site's ten languages, and the shop's own soliflores and bouquets are sifted by it. The
// bee answers with up to three of them, each a link to its page.
//   conseille(texte) -> null (nothing to advise on) | { texte, liens: [{ t: [name, colourway, price], href }], fort }
import { chargeSoli, fr, lienFleur, lienProduit, plain, products, SOLI } from './noyau.mjs';

const plie = (t) => ` ${t.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
// a word of the folded text (written with spaces), or anywhere for the scripts written without them
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const a = (t, mots) => mots.some((m) => (CJK.test(m) ? t.includes(m) : t.includes(` ${m} `)));

// ---------- the colours, as the soliflores' page sorts them (soliflore.mjs, teinte)
const COULEURS = {
  jaune: ['jaune', 'jaunes', 'yellow', 'amarillo', 'amarilla', 'giallo', 'gialli', 'gelb', 'gelbe', 'gelben', 'amarelo', 'amarela', 'dilaw', 'golden', 'dore', 'doree', '黄', '黃', '노란', '노랑', 'イエロー'],
  orange: ['orange', 'oranges', 'naranja', 'arancione', 'arancio', 'laranja', 'kahel', 'abricot', 'apricot', 'peche', 'peach', 'corail', 'coral', 'オレンジ', '橙', '주황', '오렌지'],
  rouge: ['rouge', 'rouges', 'red', 'rojo', 'roja', 'rosso', 'rossa', 'rot', 'rote', 'roten', 'vermelho', 'vermelha', 'pula', 'bordeaux', 'burgundy', 'carmin', '赤', '红', '紅', '빨간', '빨강', '레드'],
  rose: ['pink', 'rosado', 'rosada', 'rosa', 'pinke', 'kulay rosas', 'fuchsia', 'fucsia', 'magenta', 'ピンク', '粉', '분홍', '핑크'],
  blanc: ['blanc', 'blanche', 'blancs', 'blanches', 'white', 'blanco', 'blanca', 'bianco', 'bianca', 'weiss', 'weisse', 'weissen', 'branco', 'branca', 'puti', 'creme', 'cream', 'ivoire', 'ivory', '白', '흰', '하얀', '화이트'],
  violet: ['violet', 'violette', 'violets', 'purple', 'morado', 'morada', 'viola', 'lila', 'roxo', 'roxa', 'lilang', 'mauve', 'parme', 'lavande', 'lavender', '紫', '보라', '퍼플'],
  bleu: ['bleu', 'bleue', 'bleus', 'bleues', 'blue', 'azul', 'blu', 'blau', 'blaue', 'blauen', 'asul', '青', '蓝', '藍', '파란', '파랑', '블루'],
  vert: ['vert', 'verte', 'verts', 'green', 'verde', 'grun', 'grune', 'grunen', 'berde', '緑', '绿', '綠', '초록', '녹색'],
  sombre: ['noir', 'noire', 'black', 'negro', 'negra', 'nero', 'nera', 'schwarz', 'preto', 'preta', 'itim', 'sombre', 'dark', 'chocolat', 'brun', '黒', '黑', '검정', '검은'],
};
// « rose » is both a colour and a flower: a colour only beside a word that says so
const ROSE_COULEUR = / (fleurs?|couleur|en|bouquet|teinte|tons?) roses? | roses? (pale|pales|poudre|fuchsia|clair|claire|vif|vive|tendre|bonbon) /;
function teinte(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((x) => x / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (l > 0.84 && (s < 0.55 || (h > 30 && h < 75))) return 'blanc';
  if (s < 0.14) return l > 0.6 ? 'blanc' : 'sombre';
  if (l < 0.2 || (h < 45 && l < 0.36 && s < 0.65)) return 'sombre';
  if (h < 14 || h >= 345) return l > 0.68 ? 'rose' : 'rouge';
  if (h < 22 && l > 0.68) return 'rose';
  if (h < 42) return 'orange';
  if (h < 68) return 'jaune';
  if (h < 165) return 'vert';
  if (h < 255) return 'bleu';
  if (h < 290) return 'violet';
  return l > 0.55 ? 'rose' : 'violet';
}

// ---------- the time: in season now, a month, a season
const MOIS = [
  ['janvier', 'january', 'enero', 'gennaio', 'januar', 'janeiro', 'enero'],
  ['fevrier', 'february', 'febrero', 'febbraio', 'februar', 'fevereiro', 'pebrero'],
  ['mars', 'march', 'marzo', 'marz', 'marco', 'marso'],
  ['avril', 'april', 'abril', 'aprile', 'abril'],
  ['mai', 'may', 'mayo', 'maggio', 'maio', 'mayo'],
  ['juin', 'june', 'junio', 'giugno', 'juni', 'junho', 'hunyo'],
  ['juillet', 'july', 'julio', 'luglio', 'juli', 'julho', 'hulyo'],
  ['aout', 'august', 'agosto', 'agosto'],
  ['septembre', 'september', 'septiembre', 'settembre', 'setembro', 'setyembre'],
  ['octobre', 'october', 'octubre', 'ottobre', 'oktober', 'outubro', 'oktubre'],
  ['novembre', 'november', 'noviembre', 'novembro', 'nobyembre'],
  ['decembre', 'december', 'diciembre', 'dicembre', 'dezember', 'dezembro', 'disyembre'],
];
const SAISONS = [
  [['printemps', 'spring', 'primavera', 'fruhling', 'tagsibol', '春', '봄'], [3, 4, 5]],
  [['ete', 'summer', 'verano', 'estate', 'sommer', 'verao', 'tag init', '夏', '여름'], [6, 7, 8]],
  [['automne', 'autumn', 'fall', 'otono', 'autunno', 'herbst', 'outono', 'taglagas', '秋', '가을'], [9, 10, 11]],
  [['hiver', 'winter', 'invierno', 'inverno', '冬', '겨울'], [12, 1, 2]],
];
const MAINTENANT = ['de saison', 'en saison', 'en ce moment', 'ce mois ci', 'ce mois', 'maintenant', 'actuellement', 'in season', 'this month', 'right now', 'seasonal', 'de temporada', 'en temporada', 'di stagione', 'questo mese', 'saisonal', 'saison', 'da estacao', 'deste mes', 'napapanahon', '旬', '时令', '時令', '应季', '제철', '이번 달'];

// ---------- the occasion: the words of a meaning (the atelier's meanings, in French, in SOLI.fleurs[].sens)
const OCCASIONS = [
  [['amour', 'amoureuse', 'amoureux', 'love', 'amor', 'amore', 'liebe', 'pag ibig', 'saint valentin', 'valentine', 'valentin', '愛', '爱', '사랑'], ['amour', 'passion', 'désir']],
  [['merci', 'remercier', 'thank', 'thanks', 'gracias', 'grazie', 'danke', 'obrigado', 'obrigada', 'salamat', 'ありがとう', '谢谢', '感謝', '감사'], ['reconnaissance', 'gratitude', 'merci']],
  [['amitie', 'ami', 'amie', 'friend', 'friendship', 'amistad', 'amicizia', 'freundschaft', 'amizade', 'kaibigan', '友', '朋友', '친구'], ['amitié']],
  [['pardon', 'desole', 'desolee', 'sorry', 'excuses', 'perdon', 'scusa', 'entschuldigung', 'desculpa', 'ごめん', '对不起', '미안'], ['pardon', 'regret', 'excuse']],
  [['anniversaire', 'birthday', 'cumpleanos', 'compleanno', 'geburtstag', 'aniversario', 'kaarawan', '誕生日', '生日', '생일', 'felicitations', 'congratulations', 'bravo', 'naissance', 'mariage', 'wedding'], ['joie', 'bonheur', 'gaieté', 'fête', 'félicit']],
  [['courage', 'guerison', 'retablissement', 'malade', 'get well', 'hopital', 'hospital', 'mejorate', 'guarisci', 'gute besserung', '早く良く', '早日康复', '쾌유'], ['espoir', 'courage', 'force', 'guérison']],
];
const ACHETER_BOUQUET = ['bouquet', 'bouquets', 'ramo', 'ramos', 'mazzo', 'strauss', 'strau', 'buque', 'buques', 'palumpon', '花束', '꽃다발', 'ブーケ'];
const ACHETER_UNE = ['soliflore', 'soliflores', 'une fleur', 'une seule', 'une tige', 'one flower', 'a flower', 'single flower', 'una flor', 'un fiore', 'eine blume', 'uma flor', 'isang bulaklak', '一輪', '单枝', '한 송이'];

// what the question names
function lit(texte) {
  const t = plie(texte);
  const vu = {};
  for (const [c, mots] of Object.entries(COULEURS)) if (a(t, mots)) (vu.couleurs ||= []).push(c);
  // « rose » alone: a colour only when said as one
  if (ROSE_COULEUR.test(t) || / rose (pale|poudre)/.test(t)) (vu.couleurs ||= []).push('rose');
  MOIS.forEach((mots, i) => a(t, mots) && (vu.mois ||= []).push(i + 1));
  for (const [mots, m] of SAISONS) if (a(t, mots)) (vu.mois ||= []).push(...m);
  if (!vu.mois && a(t, MAINTENANT)) vu.mois = [new Date().getMonth() + 1];
  // a budget: « moins de 20 € », « under 50 », « 30 euros max »
  const b = t.match(/ (?:moins de|max|maximum|au plus|pas plus de|under|less than|below|up to|menos de|meno di|unter|bis|hasta) (\d{1,4}) |(\d{1,4}) (?:euros?|eur|e|€|usd|dollars?|max) /);
  if (b) vu.budget = Number(b[1] || b[2]) * 100;
  for (const [mots, sens] of OCCASIONS) if (a(t, mots)) (vu.sens ||= []).push(...sens);
  // a flower of the shop, by its French or Latin name (singular or plural)
  const fl = SOLI?.fleurs || [];
  // (its whole name, or its first word when that is a flower's own name: « pivoines » for « Pivoine herbacée »)
  const nommees = fl.filter((f) => {
    const n = plie(f.nom).trim();
    const tete = n.split(' ')[0];
    const l = plie(f.latin).trim().split(' ')[0];
    return [n, tete.length > 4 && tete, l.length > 4 && l].some((m) => m && (t.includes(` ${m} `) || t.includes(` ${m}s `) || t.includes(` ${m}x `)));
  });
  if (nommees.length) vu.fleurs = nommees.map((f) => f.sid);
  // another flower named: « roses » after it is its colour (« des pivoines roses »)
  if (nommees.length && !nommees.some((f) => plie(f.nom).trim().startsWith('rose')) && / roses? /.test(t) && !(vu.couleurs || []).includes('rose')) (vu.couleurs ||= []).push('rose');
  vu.bouquet = a(t, ACHETER_BOUQUET);
  vu.une = a(t, ACHETER_UNE);
  return vu;
}

const prixDe = (f) => f.prix;
// the soliflores that answer, with the colourway that does
function soliflores(vu) {
  const out = [];
  for (const f of SOLI.fleurs) {
    if (vu.fleurs && !vu.fleurs.includes(f.sid)) continue;
    if (vu.mois && !(f.toute_annee || vu.mois.some((m) => f.mois.includes(m)))) continue;
    if (vu.budget && prixDe(f) > vu.budget) continue;
    if (vu.sens && !vu.sens.some((s) => (f.sens || '').toLowerCase().includes(s))) continue;
    let k = 0;
    if (vu.couleurs) {
      k = f.coloris.findIndex(([, hex]) => vu.couleurs.includes(teinte(hex)));
      if (k < 0) continue;
    }
    out.push({ f, k });
  }
  // in season now first, a flower of its own season before one sold all year, then the least dear
  const now = new Date().getMonth() + 1;
  out.sort((x, y) => (y.f.mois.includes(now) - x.f.mois.includes(now)) || (x.f.toute_annee - y.f.toute_annee) || prixDe(x.f) - prixDe(y.f));
  return out;
}
// the bouquets that answer: the share of their stems in the colour (abeille-bouquets.json, outils/abeille/
// teintes_bouquets.py), the flower in them, the budget
let teintesBq = null;
const chargeTeintes = () => (teintesBq ||= fetch(new URL('abeille-bouquets.json', import.meta.url)).then((r) => r.json()).catch(() => ({})));
function bouquets(vu, parts) {
  const out = [];
  for (const p of products) {
    if (vu.budget && p.prix.centimes > vu.budget) continue;
    if (vu.fleurs && !(p.tiges || []).some(([sid]) => vu.fleurs.includes(sid))) continue;
    let part = 1;
    if (vu.couleurs) {
      part = vu.couleurs.reduce((s, c) => s + (parts[p.id]?.[c] || 0), 0);
      if (part < 0.25) continue;
    }
    out.push({ p, part });
  }
  out.sort((x, y) => y.part - x.part || x.p.prix.centimes - y.p.prix.centimes);
  return out;
}

export async function conseille(texte) {
  await chargeSoli().catch(() => {});
  if (!SOLI?.fleurs) return null;
  const vu = lit(texte);
  const quoi = vu.couleurs || vu.mois || vu.fleurs || vu.budget || vu.sens;
  if (!quoi) return null;
  const nom = (sid) => fr.flowers?.[sid] || SOLI.fleurs.find((f) => f.sid === sid)?.nom || sid;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const liens = [];
  // a bouquet asked for, or a budget only a bouquet reaches: bouquets first; else soliflores first
  const bq = vu.bouquet || (!vu.une && vu.budget >= 8000) ? bouquets(vu, await chargeTeintes()) : [];
  // no bouquet of the month answers: soliflores, said so
  const aucun = vu.bouquet && !bq.length;
  const so = !vu.bouquet || vu.une || aucun ? soliflores(vu) : [];
  for (const { p } of bq.slice(0, 3)) liens.push({ t: [p.nom, '', plain(p.prix.centimes)], href: lienProduit(p.id) });
  for (const { f, k } of so.slice(0, 3 - Math.min(liens.length, 2))) {
    liens.push({ t: [cap(nom(f.sid)), f.coloris[k]?.[0] || '', plain(prixDe(f))], href: lienFleur(f.sid, null, k || null) });
  }
  const fort = !!(vu.couleurs || vu.fleurs || vu.budget);
  if (!liens.length) return { texte: 'Je n’ai rien trouvé de tel en ce moment. Regardez les soliflores de saison, ou écrivez-nous : l’atelier peut composer sur mesure.', liens: [{ t: ['Les soliflores de saison', '', ''], href: 'soliflore.html' }], fort };
  if (aucun) return { texte: 'Aucun bouquet de la collection ne répond à cela ce mois-ci. En soliflore, je vous propose :', liens: liens.slice(0, 3), fort };
  // fort: the question names the thing itself (a colour, a flower, a budget): advice whatever else it asks
  return { texte: liens.length > 1 ? 'Voici ce que je vous propose :' : 'Je vous propose :', liens: liens.slice(0, 3), fort };
}
window.__conseil = { lit, conseille }; // for checks
