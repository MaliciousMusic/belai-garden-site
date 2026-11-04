-- lot C3: what an order also keeps: the express waiver given before paying (its text and time, for the receipt), the
-- payment's reference (Stripe's PaymentIntent, or "faux_..." locally), the page to come back to, the buyer's language,
-- the bouquet it gave
ALTER TABLE commandes ADD COLUMN consentement TEXT;
ALTER TABLE commandes ADD COLUMN paiement TEXT;
ALTER TABLE commandes ADD COLUMN retour TEXT;
ALTER TABLE commandes ADD COLUMN langue TEXT;
ALTER TABLE commandes ADD COLUMN bouquet TEXT;
