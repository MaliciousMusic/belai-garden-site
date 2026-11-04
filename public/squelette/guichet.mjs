// guichet.mjs: the atelier's panel (guichet.html, owner 2026-11-02): the bee's talks, looked at again every three seconds,
// one opened with its messages and a box to answer; signed with the counter's secret kept in this browser.
import { API } from './ecrire.mjs';
const $ = (id) => document.getElementById(id);
const CLE = 'guichet-jeton';
let secret = '';
try { secret = sessionStorage.getItem(CLE) || ''; localStorage.removeItem(CLE); } catch (_) {}
let ouverte = null;
let vus = new Map(); // conversation -> its new messages last time (to notify only what is new)
const appel = async (chemin, opts = {}) => {
  const r = await fetch(`${API}${chemin}`, { ...opts, headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json', ...(opts.headers || {}) } });
  if (r.status === 401) throw Object.assign(new Error('secret'), { secret: true });
  return r.json();
};
const quand = (t) => new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const qui = { visiteur: 'Visiteur', abeille: 'Abeille', atelier: 'Atelier' };

function connexion(msg = '') {
  $('g-corps').hidden = true;
  $('g-sortir').hidden = true;
  $('g-connexion').hidden = false;
  $('g-erreur').textContent = msg;
}
$('g-connexion').addEventListener('submit', (e) => {
  e.preventDefault();
  secret = $('g-jeton').value.trim();
  demarre();
});
$('g-sortir').addEventListener('click', () => {
  try { sessionStorage.removeItem(CLE); } catch (_) {}
  secret = '';
  connexion();
});
if ('Notification' in window && Notification.permission === 'default') $('g-notifs').hidden = false;
$('g-notifs').addEventListener('click', () => Notification.requestPermission().then(() => ($('g-notifs').hidden = true)));

async function rafraichit() {
  const { conversations } = await appel('/guichet');
  let total = 0;
  $('g-liste').replaceChildren(...conversations.map((c) => {
    total += c.nouveaux;
    // a visitor wrote something new: a notification, when allowed and the panel is not looked at
    if (c.nouveaux > (vus.get(c.id) || 0) && document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Guichet', { body: c.dernier || 'Nouveau message' });
    vus.set(c.id, c.nouveaux);
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-current', String(c.id === ouverte));
    if (c.etat !== 'ouvert') b.classList.add('clos');
    b.innerHTML = '<span class="g-l1"><span class="g-q"></span><span class="g-n"></span></span><span class="g-l2"></span>';
    b.querySelector('.g-q').textContent = `${quand(c.maj)} · ${c.langue || '?'} · ${c.etat}`;
    if (c.nouveaux) b.querySelector('.g-n').outerHTML = `<span class="g-nouveaux">${c.nouveaux}</span>`;
    b.querySelector('.g-l2').textContent = c.dernier || '';
    b.addEventListener('click', () => ouvre(c.id));
    li.append(b);
    return li;
  }));
  document.title = `${total ? `(${total}) ` : ''}Guichet | Belai’s Garden`;
  $('g-etat').textContent = `${conversations.filter((c) => c.etat === 'ouvert').length} ouvertes · à jour ${new Date().toLocaleTimeString('fr-FR')}`;
  if (ouverte) await montre(ouverte);
}
async function montre(id) {
  const { conv, messages } = await appel(`/guichet/${id}/tout`);
  $('g-info').hidden = false;
  $('g-quoi').textContent = `Ouverte le ${quand(conv.cree)} · ${conv.langue || '?'} · ${conv.page || ''}`;
  $('g-clore').textContent = conv.etat === 'ouvert' ? 'Clore' : 'Close';
  $('g-clore').disabled = conv.etat !== 'ouvert';
  $('g-repondre').hidden = false;
  const bas = $('g-messages').scrollHeight - $('g-messages').scrollTop - $('g-messages').clientHeight < 40;
  $('g-messages').replaceChildren(...messages.map((m) => {
    const li = document.createElement('li');
    li.className = `abeille-msg de-${m.de === 'atelier' ? 'visiteur' : m.de === 'abeille' ? 'abeille' : 'atelier'}`;
    const t = document.createElement('b');
    t.textContent = `${qui[m.de] || m.de} · ${quand(m.cree)}`;
    li.append(t, document.createElement('br'), m.texte);
    return li;
  }));
  if (bas) $('g-messages').scrollTop = $('g-messages').scrollHeight;
}
async function ouvre(id) {
  ouverte = id;
  await montre(id);
  $('g-messages').scrollTop = $('g-messages').scrollHeight;
  $('g-texte').focus();
  rafraichit().catch(() => {});
}
$('g-repondre').addEventListener('submit', async (e) => {
  e.preventDefault();
  const texte = $('g-texte').value.trim();
  if (!texte || !ouverte) return;
  $('g-texte').value = '';
  await appel(`/guichet/${ouverte}/reponse`, { method: 'POST', body: JSON.stringify({ texte }) });
  await montre(ouverte);
  $('g-messages').scrollTop = $('g-messages').scrollHeight;
});
$('g-texte').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    $('g-repondre').requestSubmit();
  }
});
$('g-clore').addEventListener('click', async () => {
  if (!ouverte) return;
  await appel(`/guichet/${ouverte}/clos`, { method: 'POST' });
  rafraichit();
});

let tour = 0;
async function demarre() {
  clearTimeout(tour);
  if (!secret) return connexion();
  try {
    await rafraichit();
    try { sessionStorage.setItem(CLE, secret); } catch (_) {}
    $('g-connexion').hidden = true;
    $('g-corps').hidden = false;
    $('g-sortir').hidden = false;
  } catch (err) {
    return connexion(err.secret ? 'Ce secret n’ouvre pas le guichet.' : 'Le serveur ne répond pas.');
  }
  const boucle = async () => {
    try { await rafraichit(); } catch (err) { if (err.secret) return connexion('Ce secret n’ouvre plus le guichet.'); }
    tour = setTimeout(boucle, 3000);
  };
  tour = setTimeout(boucle, 3000);
}
demarre();
