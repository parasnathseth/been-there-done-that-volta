-- Been There, Done That: baseline schema.
-- Three main lists: founders, blockers (always private), stories (shown only as the author chose).

ALTER TABLE IF EXISTS stories ADD COLUMN IF NOT EXISTS problem TEXT;
ALTER TABLE IF EXISTS founders ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE IF EXISTS founders ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE IF EXISTS founders ADD COLUMN IF NOT EXISTS comes_in TEXT;
ALTER TABLE IF EXISTS founders ADD COLUMN IF NOT EXISTS can_help_with TEXT;
ALTER TABLE IF EXISTS blockers ADD COLUMN IF NOT EXISTS story_helped BOOLEAN;

CREATE TABLE IF NOT EXISTS startups (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS founders (
  id          SERIAL PRIMARY KEY,
  startup_id  INTEGER REFERENCES startups(id),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  title       TEXT,            -- e.g. Co-founder and CEO
  location    TEXT,
  comes_in    TEXT,            -- how often they come into Volta
  can_help_with TEXT,          -- what they said they can help with
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
  -- Answer to "Did a resident's story help you solve this?" (null = not answered).
  story_helped    BOOLEAN,
  -- Meaning-numbers; only stored when the founder ticked "use for matching".
  embedding       REAL[]
);

-- What helped, written when a blocker is marked solved.
CREATE TABLE IF NOT EXISTS stories (
  id          SERIAL PRIMARY KEY,
  founder_id  INTEGER NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  blocker_id  INTEGER REFERENCES blockers(id) ON DELETE SET NULL,
  -- The problem it solved, shown on the story card. The author sees it in the preview before sharing.
  problem     TEXT NOT NULL CHECK (length(problem) BETWEEN 1 AND 300),
  text        TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 1500),
  share       TEXT NOT NULL CHECK (share IN ('email', 'anonymous', 'private')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Meaning-numbers of "problem. what helped", used for matching.
  embedding   REAL[] NOT NULL
);

-- A founder opened "Write to ..." on a story. Records that they tried to reach out;
-- no message content is stored.
CREATE TABLE IF NOT EXISTS outreach_clicks (
  id          SERIAL PRIMARY KEY,
  founder_id  INTEGER NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  story_id    INTEGER REFERENCES stories(id) ON DELETE SET NULL,
  method      TEXT NOT NULL CHECK (method IN ('gmail', 'outlook', 'app', 'copy')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
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
ALTER TABLE outreach_clicks ENABLE ROW LEVEL SECURITY;
