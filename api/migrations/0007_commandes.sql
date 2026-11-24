-- Orders, credit and invoices held by the database itself, not only by the code.

-- one open order per account and per bouquet: pressing twice, or two tabs, cannot hold two copies nor open two payments
CREATE UNIQUE INDEX commandes_ouverte ON commandes(compte, produit) WHERE etat = 'en_attente';
CREATE INDEX commandes_paiement ON commandes(paiement);

-- the account's credit is never negative: a statement that would make it so fails, and its whole batch with it
CREATE TRIGGER comptes_cagnotte BEFORE UPDATE OF cagnotte ON comptes WHEN NEW.cagnotte < 0
BEGIN
  SELECT RAISE(ABORT, 'cagnotte negative');
END;

-- an invoice or a credit note, once issued, neither changes nor goes
CREATE TRIGGER factures_fixes BEFORE UPDATE ON factures
BEGIN
  SELECT RAISE(ABORT, 'facture figee');
END;
CREATE TRIGGER factures_gardees BEFORE DELETE ON factures
BEGIN
  SELECT RAISE(ABORT, 'facture figee');
END;

-- the card disputes by payment: Stripe's events come in any order, even before the order is marked paid
CREATE TABLE litiges (
  paiement TEXT PRIMARY KEY,
  etat TEXT NOT NULL,
  maj INTEGER NOT NULL
);
