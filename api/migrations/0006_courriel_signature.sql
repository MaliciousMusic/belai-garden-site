-- The owner's decisions of 2026-11-02 (decor/squelette/outils/abeille/flotte/DECISIONS.md).

-- the account validated by e-mail too: canal says whether numero_chiffre holds a mobile number ('sms') or an e-mail address
-- ('mail'), both encrypted alike; the codes sent by e-mail live in codes_sms with their own fingerprint (« mail: » keyed)
ALTER TABLE comptes ADD COLUMN canal TEXT NOT NULL DEFAULT 'sms';

-- an unsigned gift: the word is signed as the giver likes, or not at all, and the giver's e-mail never shows. The giver's
-- first name becomes the signature, optional; no route writes the gifts yet (lots C4, C5), so the table is rebuilt as it is
CREATE TABLE cadeaux_neuf (
  id TEXT PRIMARY KEY,
  bouquet TEXT NOT NULL REFERENCES bouquets(id),
  expediteur TEXT NOT NULL REFERENCES comptes(id),
  signature TEXT,
  code_hash TEXT NOT NULL,
  message TEXT,
  musique TEXT,
  insectes TEXT,
  etat TEXT NOT NULL,
  essais INTEGER NOT NULL DEFAULT 0,
  bloque_jusqua INTEGER,
  expire INTEGER NOT NULL,
  recu_par TEXT REFERENCES comptes(id),
  recu INTEGER
);
INSERT INTO cadeaux_neuf SELECT id, bouquet, expediteur, prenom_expediteur, code_hash, message, musique, insectes, etat, essais, bloque_jusqua, expire, recu_par, recu FROM cadeaux;
DROP TABLE cadeaux;
ALTER TABLE cadeaux_neuf RENAME TO cadeaux;
