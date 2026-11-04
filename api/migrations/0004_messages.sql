-- « Nous écrire » (owner, 2026-11-01): a message sent from the site, with an e-mail address or a phone number to be
-- answered at; read by the owner (README: Les messages), marked read once answered.
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  cree INTEGER NOT NULL,
  texte TEXT NOT NULL,
  -- 'mail' or 'tel', and the address or the number (E.164) as given
  genre TEXT NOT NULL,
  contact TEXT NOT NULL,
  -- the page it was written from and the reader's language, to answer in it
  page TEXT,
  langue TEXT,
  lu INTEGER
);
CREATE INDEX messages_cree ON messages(cree);
