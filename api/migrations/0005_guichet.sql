-- The bee's counter (owner, 2026-11-02): when the bee does not know, she puts someone of the atelier on the line. A talk
-- (conversation) is opened with what was said to the bee; the visitor and the atelier then write in it; the community
-- manager sees every open talk live in the atelier's panel (guichet.html) and answers there.
CREATE TABLE guichet (
  id TEXT PRIMARY KEY,
  cree INTEGER NOT NULL,
  -- the last message's time, to sort the panel
  maj INTEGER NOT NULL,
  -- 'ouvert' or 'clos'
  etat TEXT NOT NULL DEFAULT 'ouvert',
  -- the visitor's token, kept as a hash: only the visitor's page reads and writes in its talk
  jeton_hash TEXT NOT NULL,
  langue TEXT,
  page TEXT,
  -- the last message the atelier has read, to count the new ones in the panel
  lu INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX guichet_maj ON guichet(maj);

-- a message in a talk: from the visitor, the bee (what she said before handing over) or the atelier
CREATE TABLE guichet_messages (
  n INTEGER PRIMARY KEY AUTOINCREMENT,
  conv TEXT NOT NULL REFERENCES guichet(id) ON DELETE CASCADE,
  cree INTEGER NOT NULL,
  de TEXT NOT NULL,
  texte TEXT NOT NULL
);
CREATE INDEX guichet_messages_conv ON guichet_messages(conv, n);
