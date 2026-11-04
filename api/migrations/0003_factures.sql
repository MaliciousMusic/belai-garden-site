-- lot C9 (decor/COMPTE.md, owner 2026-10-27): invoices, the exchange within 24 hours, the account's credit, card disputes.

-- the account's credit (cents): what an exchange for a cheaper bouquet leaves, taken off the next purchases
ALTER TABLE comptes ADD COLUMN cagnotte INTEGER NOT NULL DEFAULT 0;

-- a bouquet's state: 'actif'; 'rendu' (given back in an exchange: its copy is on sale again); 'retire' (taken back after a
-- card dispute lost). fin: its fading, when pushed back (days given back after a defect); else achat + 30 days.
-- echange_de: the bouquet it replaced in an exchange. commande: the order that paid it.
ALTER TABLE bouquets ADD COLUMN etat TEXT NOT NULL DEFAULT 'actif';
ALTER TABLE bouquets ADD COLUMN fin INTEGER;
ALTER TABLE bouquets ADD COLUMN echange_de TEXT;
ALTER TABLE bouquets ADD COLUMN commande TEXT;
-- a copy number is held once in its series, except by a bouquet given back
CREATE UNIQUE INDEX bouquets_numero ON bouquets(produit, mois, numero) WHERE etat <> 'rendu';

-- an order: the credit it uses (taken when the order is made, given back if it is not paid), its card dispute
ALTER TABLE commandes ADD COLUMN cagnotte INTEGER NOT NULL DEFAULT 0;
ALTER TABLE commandes ADD COLUMN litige TEXT;

-- invoices and credit notes, one unbroken sequence of numbers. type: 'facture' or 'avoir' (an avoir's total is negative and
-- names the invoice it cancels). What it says is copied when it is issued: the buyer's first name and masked number, the
-- bouquet's name and copy, the amounts and how they were paid (card, credit, exchange).
CREATE TABLE factures (
  numero INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  compte TEXT NOT NULL REFERENCES comptes(id),
  emise INTEGER NOT NULL,
  bouquet TEXT,
  commande TEXT,
  annule INTEGER REFERENCES factures(numero),
  prenom TEXT,
  numero_masque TEXT,
  libelle TEXT NOT NULL,
  total INTEGER NOT NULL,
  carte INTEGER NOT NULL DEFAULT 0,
  cagnotte INTEGER NOT NULL DEFAULT 0,
  echange INTEGER NOT NULL DEFAULT 0,
  paiement TEXT
);
CREATE INDEX factures_compte ON factures(compte);
CREATE UNIQUE INDEX factures_commande ON factures(commande) WHERE commande IS NOT NULL;
