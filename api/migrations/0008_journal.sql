-- What was done, by whom, when: an account or the atelier, never a name, a number, an address, a code or a card. Kept a year
-- (compte.js menage).
CREATE TABLE journal (
  n INTEGER PRIMARY KEY AUTOINCREMENT,
  cree INTEGER NOT NULL,
  acteur TEXT NOT NULL,
  action TEXT NOT NULL,
  objet TEXT
);
CREATE INDEX journal_cree ON journal(cree);

-- a month's copies, counted for all its bouquets at once (collection.js)
CREATE INDEX bouquets_mois ON bouquets(mois, produit);
CREATE INDEX commandes_mois ON commandes(mois, produit) WHERE etat = 'en_attente';
