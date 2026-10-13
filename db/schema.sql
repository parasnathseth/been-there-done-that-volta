-- Been There, Done That: baseline schema.
-- Three main lists: founders, blockers (always private), stories (shown only as the author chose).

CREATE TABLE IF NOT EXISTS startups (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS founders (
  id          SERIAL PRIMARY KEY,
  startup_id  INTEGER REFERENCES startups(id),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'founder' CHECK (role IN ('founder', 'admin'))
);

-- What a founder was stuck on. Never shown to anyone else.
CREATE TABLE IF NOT EXISTS blockers (
  id              SERIAL PRIMARY KEY,
  founder_id      INTEGER NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  text            TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 1000),
  reported_month  DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'solved')),
  solved_month    DATE,
  match_consent   BOOLEAN NOT NULL DEFAULT FALSE,
  -- Meaning-numbers; only stored when the founder ticked "use for matching".
  embedding       REAL[]
);

-- What helped, written when a blocker is marked solved.
CREATE TABLE IF NOT EXISTS stories (
  id          SERIAL PRIMARY KEY,
  founder_id  INTEGER NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  blocker_id  INTEGER REFERENCES blockers(id) ON DELETE SET NULL,
  text        TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 1500),
  share       TEXT NOT NULL CHECK (share IN ('email', 'anonymous', 'private')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  embedding   REAL[] NOT NULL
);

CREATE INDEX IF NOT EXISTS blockers_founder_idx ON blockers (founder_id);
CREATE INDEX IF NOT EXISTS stories_founder_idx  ON stories (founder_id);
CREATE INDEX IF NOT EXISTS stories_share_idx    ON stories (share);

-- The app connects with its own credentials from the server, so turn on row level
-- security with no policies: Supabase's public API keys can't read these tables.
ALTER TABLE startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE founders ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories  ENABLE ROW LEVEL SECURITY;
