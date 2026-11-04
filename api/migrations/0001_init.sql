-- The shop's account and gift server (decor/COMPTE.md): accounts verified by text message, their sessions, and the
-- tables the purchase (lot C3) and the gifts (lots C4, C5) will fill. Times are milliseconds since 1970 (UTC).

-- an account: found by a keyed fingerprint of its phone number (HMAC); the number itself stored encrypted (AES-GCM),
-- read back only to send it a text message
CREATE TABLE comptes (
  id TEXT PRIMARY KEY,
  empreinte TEXT NOT NULL UNIQUE,
  numero_chiffre TEXT NOT NULL,
  prenom TEXT,
  cree INTEGER NOT NULL,
  -- the account asked to be deleted at that time: erased 30 days later (privacy policy)
  supprime INTEGER
);

-- the code sent by text message to a number, kept as a hash, valid 10 minutes, 5 wrong attempts at most
CREATE TABLE codes_sms (
  empreinte TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expire INTEGER NOT NULL,
  essais INTEGER NOT NULL DEFAULT 0
);

-- a signed-in device: the site (a cookie) or Belai Bureau (a bearer token); only the token's hash is kept
CREATE TABLE sessions (
  jeton_hash TEXT PRIMARY KEY,
  compte TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  client TEXT NOT NULL,
  cree INTEGER NOT NULL,
  expire INTEGER NOT NULL
);
CREATE INDEX sessions_compte ON sessions(compte);

-- counters for the limits (texts per number and per address, wrong codes): a key, a count, the start of its window
CREATE TABLE limites (
  cle TEXT PRIMARY KEY,
  nombre INTEGER NOT NULL,
  debut INTEGER NOT NULL
);

-- the month's collections and the copies of each bouquet (decided by the owner each month; 100 at first)
CREATE TABLE collections (
  mois TEXT PRIMARY KEY,
  exemplaires INTEGER NOT NULL
);
CREATE TABLE exemplaires (
  produit TEXT NOT NULL,
  mois TEXT NOT NULL,
  nombre INTEGER NOT NULL,
  PRIMARY KEY (produit, mois)
);

-- lot C3: an order through Stripe Checkout (a copy held while its page is open)
CREATE TABLE commandes (
  id TEXT PRIMARY KEY,
  session_stripe TEXT UNIQUE,
  compte TEXT NOT NULL REFERENCES comptes(id),
  produit TEXT NOT NULL,
  mois TEXT NOT NULL,
  centimes INTEGER NOT NULL,
  etat TEXT NOT NULL,
  cree INTEGER NOT NULL,
  expire INTEGER NOT NULL,
  paye INTEGER
);
CREATE INDEX commandes_produit ON commandes(produit, mois, etat);

-- a bouquet on an account: bought, or received as a gift; its copy number in its series
CREATE TABLE bouquets (
  id TEXT PRIMARY KEY,
  compte TEXT NOT NULL REFERENCES comptes(id),
  produit TEXT NOT NULL,
  mois TEXT NOT NULL,
  numero INTEGER NOT NULL,
  achat INTEGER NOT NULL,
  origine TEXT NOT NULL
);
CREATE INDEX bouquets_compte ON bouquets(compte);

-- lots C4, C5: a gift (the code kept as a hash; valid until the bouquet fades; 5 wrong attempts, then an hour's block)
CREATE TABLE cadeaux (
  id TEXT PRIMARY KEY,
  bouquet TEXT NOT NULL REFERENCES bouquets(id),
  expediteur TEXT NOT NULL REFERENCES comptes(id),
  prenom_expediteur TEXT NOT NULL,
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
