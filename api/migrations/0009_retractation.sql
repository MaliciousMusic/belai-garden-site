-- The withdrawals asked for on line (retractation.js): one by order, kept as asked, with the moment it was received. What it gives right
-- to is a person's to say: nothing is refunded nor taken back by itself.
CREATE TABLE retractations (
  id TEXT PRIMARY KEY,
  commande TEXT NOT NULL UNIQUE REFERENCES commandes(id),
  compte TEXT NOT NULL REFERENCES comptes(id),
  cree INTEGER NOT NULL,
  -- 'recue', then 'acceptee' or 'refusee' (README, Les rétractations)
  etat TEXT NOT NULL DEFAULT 'recue'
);
