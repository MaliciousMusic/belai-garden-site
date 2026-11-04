// vocal.mjs: the gift's voice message (owner, 2026-11-02: « Ajoute le vocal au mot et à la musique, mais tout reste
// optionnel »; no photo, no video). One recording, a minute at most, listened to before it goes; recorded again or cleared
// at will. Prepared, not yet carried to the payment: the recording stays in this page (enregistrement()), and at
// integration it is sent with the gift to the account server, which gives the gift's page its address.

const MAX = 60 * 1000; // a minute (proposed: the length is a question for the owner, RAPPORT-DECISIONS-2NOV.md)
let blob = null;

// the recording made, or null: what the gift will carry
export const enregistrement = () => blob;

// wires a recorder: its button (record, then stop), its player, its clear button and its status line
export function vocal({ rec, ecoute, effacer, etat }) {
  const repos = etat.textContent;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    rec.disabled = true;
    etat.textContent = 'Ce navigateur n’enregistre pas le son : le mot et la musique suffisent.';
    return;
  }
  let mr = null;
  let fin = 0;
  let tic = 0;
  const arrete = () => mr?.state === 'recording' && mr.stop();
  rec.addEventListener('click', async () => {
    if (mr?.state === 'recording') return arrete();
    let flux;
    try {
      // the microphone is asked on the very click, and let go as soon as the recording stops
      flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (_) {
      etat.textContent = 'Le micro n’est pas autorisé : le mot et la musique suffisent, ou autorisez-le puis recommencez.';
      return;
    }
    const morceaux = [];
    mr = new MediaRecorder(flux);
    mr.addEventListener('dataavailable', (e) => e.data.size && morceaux.push(e.data));
    mr.addEventListener('stop', () => {
      clearTimeout(fin);
      clearInterval(tic);
      for (const t of flux.getTracks()) t.stop();
      blob = new Blob(morceaux, { type: mr.mimeType || 'audio/webm' });
      if (ecoute.src) URL.revokeObjectURL(ecoute.src);
      ecoute.src = URL.createObjectURL(blob);
      ecoute.hidden = effacer.hidden = false;
      rec.textContent = 'Enregistrer à nouveau';
      etat.textContent = 'Écoutez-le : il partira tel quel avec le cadeau.';
    });
    mr.start();
    const debut = Date.now();
    rec.textContent = 'Arrêter';
    const reste = () => (etat.textContent = `Enregistrement… ${Math.max(0, Math.ceil((MAX - (Date.now() - debut)) / 1000))} s`);
    reste();
    tic = setInterval(reste, 1000);
    fin = setTimeout(arrete, MAX);
  });
  effacer.addEventListener('click', () => {
    blob = null;
    if (ecoute.src) URL.revokeObjectURL(ecoute.src);
    ecoute.removeAttribute('src');
    ecoute.hidden = effacer.hidden = true;
    rec.textContent = 'Enregistrer';
    etat.textContent = repos;
    rec.focus();
  });
}
