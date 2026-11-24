// antirobot.mjs: Cloudflare Turnstile, asked only when a form is sent (a code, a message, a talk), never on a page's load: no
// request leaves for it before. Without a key, as in the previews and on the developer's machine, nothing at all happens. The
// answer is checked by the server (api/src/antirobot.js): a page's word is worth nothing.

// the site's public key (Cloudflare, Turnstile): to fill in when the shop's server opens
export const CLE = '';

let pret = null;
const charge = () =>
  (pret ||= new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.onload = ok;
    s.onerror = () => {
      pret = null;
      s.remove();
      ko(new Error('antirobot'));
    };
    document.head.append(s);
  }));

// a token for this action (« code », « message », « guichet »), shown in hote only if Cloudflare wants a gesture; undefined
// without a key or when it fails (the server then says no, and the form says so)
export async function jeton(action, hote = document.body) {
  if (!CLE) return undefined;
  try {
    await charge();
  } catch (_) {
    return undefined;
  }
  return new Promise((ok) => {
    const boite = document.createElement('div');
    boite.className = 'antirobot';
    hote.append(boite);
    let id;
    const fin = (v) => {
      setTimeout(() => {
        window.turnstile.remove(id);
        boite.remove();
      });
      ok(v);
      return true;
    };
    id = window.turnstile.render(boite, {
      sitekey: CLE,
      action,
      appearance: 'interaction-only',
      language: document.documentElement.lang || 'auto',
      callback: (t) => void fin(t),
      'error-callback': () => fin(undefined),
      'timeout-callback': () => fin(undefined),
      'unsupported-callback': () => fin(undefined),
    });
  });
}
