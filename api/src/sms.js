// sms.js: sends a text message. Two senders (env.SMS): "faux" writes it to the console (local work, tests: the code is
// read there), "ovh" sends it through OVHcloud SMS (the owner's account, sender "Belai"; decor/COMPTE.md).
//
// OVHcloud API: POST https://eu.api.ovh.com/1.0/sms/{service}/jobs, signed with the application's keys:
//   X-Ovh-Signature = "$1$" + SHA1(applicationSecret + "+" + consumerKey + "+" + METHOD + "+" + URL + "+" + body + "+" + timestamp)
// The keys come from the environment (wrangler secret put): OVH_APP_KEY, OVH_APP_SECRET, OVH_CONSUMER_KEY, OVH_SERVICE
// (the SMS account's name, sms-xx00000-1), OVH_EXPEDITEUR (Belai, once OVH has accepted it).

const OVH = 'https://eu.api.ovh.com/1.0';

export async function envoie(env, destinataire, message) {
  // (no sender set is an error, never the simulated one: compte.js lets "faux" work on the developer's machine only)
  if (env.SMS === 'faux') {
    console.log(`[sms faux] à ${destinataire} : ${message}`);
    // the tests read the last message here
    if (env.__sms) env.__sms.push({ a: destinataire, message });
    return { ok: true, faux: true };
  }
  if (env.SMS === 'ovh') return ovh(env, destinataire, message);
  throw new Error(`SMS : expéditeur inconnu « ${env.SMS} »`);
}

async function sha1(text) {
  const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function ovh(env, destinataire, message) {
  for (const k of ['OVH_APP_KEY', 'OVH_APP_SECRET', 'OVH_CONSUMER_KEY', 'OVH_SERVICE'])
    if (!env[k]) throw new Error(`SMS OVH : ${k} manquant`);
  const url = `${OVH}/sms/${encodeURIComponent(env.OVH_SERVICE)}/jobs`;
  const body = JSON.stringify({
    message,
    receivers: [destinataire],
    sender: env.OVH_EXPEDITEUR || undefined,
    senderForResponse: false,
    noStopClause: true,
    priority: 'high',
    charset: 'UTF-8',
    coding: '8bit',
  });
  // OVH's clock, not ours: the signature is refused when they differ by more than a few seconds
  const temps = await fetch(`${OVH}/auth/time`).then((r) => r.text());
  const signature = '$1$' + (await sha1([env.OVH_APP_SECRET, env.OVH_CONSUMER_KEY, 'POST', url, body, temps].join('+')));
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Ovh-Application': env.OVH_APP_KEY,
      'X-Ovh-Consumer': env.OVH_CONSUMER_KEY,
      'X-Ovh-Timestamp': temps,
      'X-Ovh-Signature': signature,
    },
    body,
  });
  if (!r.ok) throw new Error(`SMS OVH ${r.status} : ${(await r.text()).slice(0, 200)}`);
  return { ok: true };
}
