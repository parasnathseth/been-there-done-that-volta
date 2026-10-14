// Backend for the Been There, Done That demo.
// Four jobs: save what founders submit, apply the consent rules, match, and add up Laura's totals.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { query, transaction } from './db.js';
import { embed, storyMatchText } from './embed.js';
import { rankStories } from './match.js';
import { currentMonth, toSqlMonth, monthsAgo, monthsBetween } from './months.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SHARE_CHOICES = ['email', 'anonymous', 'private'];
const MIN_FOUNDERS_FOR_TOTALS = 3;

app.use(express.json({ limit: '20kb' }));
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:",
  });
  next();
});
app.use(express.static(fileURLToPath(new URL('../public/', import.meta.url))));

// ---------- Demo sign-in ----------
// Stand-in for real sign-in: the page sends the chosen person's id in a header.
// Replace with portal sign-in (or email-link sign-in) before any real use.
async function currentUser(req, res, next) {
  const id = Number(req.get('X-Demo-User'));
  if (!Number.isInteger(id)) return res.status(401).json({ error: 'Choose who you are viewing as.' });
  const { rows } = await query('SELECT id, name, email, role, startup_id, can_help_with FROM founders WHERE id = $1', [id]);
  if (!rows[0]) return res.status(401).json({ error: 'That person does not exist.' });
  req.user = rows[0];
  next();
}
const founderOnly = (req, res, next) =>
  req.user.role === 'founder' ? next() : res.status(403).json({ error: 'Only founders can do this.' });
const adminOnly = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Only Laura can see this page.' });

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

const monthLabel = (d) => new Date(d).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// ---------- Matching with consent rules ----------
// Returns only what the viewer is allowed to see. Private stories, other founders'
// blockers and the meaning-numbers never leave the server.
async function findMatches(user, blockerEmbedding) {
  const { rows } = await query(
    `SELECT s.id, s.problem, s.text, s.share, s.created_at, s.embedding,
            f.name AS author_name, f.email AS author_email, f.title AS author_title,
            f.location AS author_location, st.name AS author_startup
       FROM stories s
       JOIN founders f ON f.id = s.founder_id
       LEFT JOIN startups st ON st.id = f.startup_id
      WHERE s.share <> 'private'
        AND s.founder_id <> $1
        AND f.startup_id IS DISTINCT FROM $2`,
    [user.id, user.startup_id]
  );
  return rankStories(blockerEmbedding, rows).map((s) => ({
    id: s.id,
    problem: s.problem,
    text: s.text,
    score: Math.round(s.score * 100) / 100,
    // Name, startup, email and date only when the author chose to share their email.
    author: s.share === 'email'
      ? { name: s.author_name, title: s.author_title, startup: s.author_startup, location: s.author_location,
          email: s.author_email, solved: monthLabel(s.created_at) }
      : null,
  }));
}

// ---------- Routes ----------

// Demo only: the list for the "View as" switcher.
app.get('/api/people', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT f.id, f.name, f.role, f.location, f.comes_in, st.name AS startup
       FROM founders f LEFT JOIN startups st ON st.id = f.startup_id
      ORDER BY f.role DESC, f.name`
  );
  res.json(rows);
}));

app.use('/api', wrap(currentUser));

app.get('/api/me', (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, role: req.user.role });
});

// The monthly update: open blockers from previous months.
app.get('/api/update', founderOnly, wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT id, text, reported_month FROM blockers
      WHERE founder_id = $1 AND status = 'open' AND reported_month < $2
      ORDER BY reported_month DESC, id`,
    [req.user.id, toSqlMonth(currentMonth())]
  );
  res.json({
    month: monthLabel(currentMonth()),
    pastBlockers: rows.map((b) => ({ id: b.id, text: b.text, reported: monthLabel(b.reported_month) })),
  });
}));

// Submit the monthly update.
// Body: { pastBlockers: [{ id, status: 'open'|'solved', storyHelped?: boolean, story?: { text, share } }],
//         newBlocker?: { text, matchConsent } }
app.post('/api/update', founderOnly, wrap(async (req, res) => {
  const past = Array.isArray(req.body.pastBlockers) ? req.body.pastBlockers.slice(0, 20) : [];
  const nb = req.body.newBlocker || {};
  const newText = cleanText(nb.text, 1000);
  const matchConsent = nb.matchConsent === true;

  // Validate everything before writing anything.
  const solved = [];
  for (const item of past) {
    if (!['open', 'solved'].includes(item.status)) return res.status(400).json({ error: 'Mark each blocker as solved or still working on it.' });
    if (item.status !== 'solved') continue;
    const storyText = cleanText(item.story?.text, 1500);
    const share = item.story?.share;
    if (storyText && !SHARE_CHOICES.includes(share)) {
      return res.status(400).json({ error: 'Choose how to share each story you wrote.' });
    }
    const storyHelped = typeof item.storyHelped === 'boolean' ? item.storyHelped : null;
    solved.push({ id: Number(item.id), storyText, share, storyHelped });
  }

  // Ownership: every blocker must belong to this founder and still be open.
  if (solved.length) {
    const ids = solved.map((s) => s.id);
    const { rows } = await query(
      `SELECT id, text FROM blockers WHERE id = ANY($1::int[]) AND founder_id = $2 AND status = 'open'`,
      [ids, req.user.id]
    );
    if (rows.length !== ids.length) return res.status(403).json({ error: 'You can only update your own open blockers.' });
    const problems = new Map(rows.map((r) => [r.id, r.text]));
    for (const s of solved) {
      s.problem = problems.get(s.id);
      if (s.storyText) s.embedding = await embed(storyMatchText(s.problem, s.storyText, req.user.can_help_with));
    }
  }

  // Meaning-numbers are only created when the founder agreed to matching.
  const newEmbedding = newText && matchConsent ? await embed(newText) : null;
  const month = toSqlMonth(currentMonth());

  const newBlockerId = await transaction(async (db) => {
    for (const s of solved) {
      await db.query(
        `UPDATE blockers SET status = 'solved', solved_month = $1, story_helped = $2 WHERE id = $3 AND founder_id = $4`,
        [month, s.storyHelped, s.id, req.user.id]
      );
      if (s.storyText) {
        await db.query(
          `INSERT INTO stories (founder_id, blocker_id, problem, text, share, embedding)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.user.id, s.id, s.problem, s.storyText, s.share, s.embedding]
        );
      }
    }
    if (!newText) return null;
    const { rows } = await db.query(
      `INSERT INTO blockers (founder_id, text, reported_month, match_consent, embedding)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.user.id, newText, month, matchConsent, newEmbedding]
    );
    return rows[0].id;
  });

  res.json({
    newBlockerId,
    matches: newEmbedding ? await findMatches(req.user, newEmbedding) : null,
  });
}));

// Record that a founder opened "Write to ..." on a story (no message content is stored).
// Only for stories shared with email, from someone else's startup.
const OUTREACH_METHODS = ['gmail', 'outlook', 'app', 'copy'];
app.post('/api/outreach', founderOnly, wrap(async (req, res) => {
  const method = req.body.method;
  if (!OUTREACH_METHODS.includes(method)) return res.status(400).json({ error: 'Unknown way of reaching out.' });
  const { rows } = await query(
    `SELECT s.id FROM stories s JOIN founders f ON f.id = s.founder_id
      WHERE s.id = $1 AND s.share = 'email' AND s.founder_id <> $2 AND f.startup_id IS DISTINCT FROM $3`,
    [Number(req.body.storyId), req.user.id, req.user.startup_id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Story not found.' });
  await query('INSERT INTO outreach_clicks (founder_id, story_id, method) VALUES ($1, $2, $3)', [req.user.id, rows[0].id, method]);
  res.json({ ok: true });
}));

// Matches for each of my open blockers where I turned matching on.
app.get('/api/my-matches', founderOnly, wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT id, text, reported_month, embedding FROM blockers
      WHERE founder_id = $1 AND status = 'open' AND match_consent AND embedding IS NOT NULL
      ORDER BY reported_month DESC, id`,
    [req.user.id]
  );
  const result = [];
  for (const b of rows) {
    result.push({ blocker: { id: b.id, text: b.text, reported: monthLabel(b.reported_month) }, matches: await findMatches(req.user, b.embedding) });
  }
  res.json(result);
}));

// My stories and blockers, with their consent settings.
app.get('/api/mine', founderOnly, wrap(async (req, res) => {
  const stories = await query(
    `SELECT id, problem, text, share, created_at FROM stories WHERE founder_id = $1 ORDER BY created_at DESC`,
    [req.user.id]
  );
  const blockers = await query(
    `SELECT id, text, status, reported_month, match_consent FROM blockers
      WHERE founder_id = $1 AND status = 'open' ORDER BY reported_month DESC, id`,
    [req.user.id]
  );
  res.json({
    stories: stories.rows.map((s) => ({ id: s.id, problem: s.problem, text: s.text, share: s.share, shared: monthLabel(s.created_at) })),
    blockers: blockers.rows.map((b) => ({ id: b.id, text: b.text, reported: monthLabel(b.reported_month), matchConsent: b.match_consent })),
  });
}));

// Change how a story is shared. Takes effect on the next match.
app.patch('/api/stories/:id', founderOnly, wrap(async (req, res) => {
  const share = req.body.share;
  if (!SHARE_CHOICES.includes(share)) return res.status(400).json({ error: 'Choose email, anonymous or private.' });
  const { rowCount } = await query(
    'UPDATE stories SET share = $1 WHERE id = $2 AND founder_id = $3',
    [share, Number(req.params.id), req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Story not found.' });
  res.json({ ok: true, share });
}));

// Delete a story for good.
app.delete('/api/stories/:id', founderOnly, wrap(async (req, res) => {
  const { rowCount } = await query('DELETE FROM stories WHERE id = $1 AND founder_id = $2', [Number(req.params.id), req.user.id]);
  if (!rowCount) return res.status(404).json({ error: 'Story not found.' });
  res.json({ ok: true });
}));

// Turn matching on or off for one of my blockers.
app.patch('/api/blockers/:id', founderOnly, wrap(async (req, res) => {
  const on = req.body.matchConsent === true;
  const { rows } = await query('SELECT text FROM blockers WHERE id = $1 AND founder_id = $2', [Number(req.params.id), req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Blocker not found.' });
  // Turning it off deletes the meaning-numbers, not just the flag.
  const embedding = on ? await embed(rows[0].text) : null;
  await query('UPDATE blockers SET match_consent = $1, embedding = $2 WHERE id = $3 AND founder_id = $4',
    [on, embedding, Number(req.params.id), req.user.id]);
  res.json({ ok: true, matchConsent: on });
}));

// ---------- Laura's summary ----------
// Each figure is worked out twice: now, and as things stood at the start of this month,
// so the page can show how it changed since last month.
// Whole-residency view: totals only, hidden when based on fewer than 3 founders.
// One-startup view (?startup=ID): exact figures and details for that startup, since Laura
// already sees each startup's monthly updates in the portal.

const HIGHER_IS_BETTER = { averageMonthsToSolve: false, openNow: false, sharedStories: true, reachedOut: true, storyHelped: true };
const WINDOW_MONTHS = 6;

async function loadSummaryRows(startupId) {
  const filter = startupId ? 'WHERE f.startup_id = $1' : '';
  const params = startupId ? [startupId] : [];
  const [blockers, stories, outreach] = await Promise.all([
    query(`SELECT b.id, b.founder_id, b.text, b.reported_month, b.status, b.solved_month, b.match_consent, b.story_helped,
                  f.name AS founder_name
             FROM blockers b JOIN founders f ON f.id = b.founder_id ${filter}`, params),
    query(`SELECT s.id, s.founder_id, s.problem, s.share, s.created_at, f.name AS founder_name
             FROM stories s JOIN founders f ON f.id = s.founder_id ${filter}`, params),
    query(`SELECT o.founder_id, o.created_at FROM outreach_clicks o JOIN founders f ON f.id = o.founder_id ${filter}`, params),
  ]);
  return { blockers: blockers.rows, stories: stories.rows, outreach: outreach.rows };
}

/** Figures as they stood just before `cutoff` (the first day of a month). */
function figuresAt(rows, cutoff, hideSmall) {
  const windowStart = monthsAgo(WINDOW_MONTHS, cutoff);
  const before = (d) => new Date(d) < cutoff;
  const inWindow = (d) => new Date(d) >= windowStart && new Date(d) < cutoff;
  const people = (list) => new Set(list.map((r) => r.founder_id)).size;
  const hide = (value, list) => (!hideSmall || people(list) >= MIN_FOUNDERS_FOR_TOTALS ? value : null);

  const open = rows.blockers.filter((b) => before(b.reported_month) && (b.status === 'open' || !before(b.solved_month)));
  const solved = rows.blockers.filter((b) => b.status === 'solved' && before(b.solved_month));
  const shared = rows.stories.filter((s) => s.share !== 'private' && before(s.created_at));
  const clicks = rows.outreach.filter((o) => inWindow(o.created_at));
  const answered = rows.blockers.filter((b) => b.status === 'solved' && b.story_helped !== null && inWindow(b.solved_month));

  const avg = solved.length
    ? Math.round((solved.reduce((sum, b) => sum + monthsBetween(new Date(b.reported_month), new Date(b.solved_month)), 0) / solved.length) * 10) / 10
    : null;
  const helpedYes = answered.filter((b) => b.story_helped).length;
  return {
    averageMonthsToSolve: hide(avg, solved),
    openNow: hide(open.length, open),
    sharedStories: hide(shared.length, shared),
    reachedOut: hide(people(clicks), clicks),
    storyHelped: hide(answered.length ? { yes: helpedYes, answered: answered.length, share: helpedYes / answered.length } : null, answered),
  };
}

/** Change since last month for each figure: direction, amount and whether it's good. */
function trends(now, then) {
  const out = {};
  for (const key of Object.keys(HIGHER_IS_BETTER)) {
    const a = key === 'storyHelped' ? now[key]?.share : now[key];
    const b = key === 'storyHelped' ? then[key]?.share : then[key];
    if (a === null || a === undefined || b === null || b === undefined) { out[key] = null; continue; }
    const change = Math.round((a - b) * (key === 'storyHelped' ? 100 : 10)) / (key === 'storyHelped' ? 1 : 10);
    out[key] = {
      change,                                   // storyHelped: percentage points
      unit: key === 'storyHelped' ? 'points' : '',
      good: change === 0 ? null : (change > 0) === HIGHER_IS_BETTER[key],
    };
  }
  return out;
}

function monthTable(rows, hideSmall) {
  const months = [];
  for (let i = WINDOW_MONTHS - 1; i >= 0; i--) {
    const m = monthsAgo(i);
    const same = (d) => d && toSqlMonth(new Date(d)) === toSqlMonth(m);
    const opened = rows.blockers.filter((b) => same(b.reported_month));
    const solved = rows.blockers.filter((b) => b.status === 'solved' && same(b.solved_month));
    const shown = (list) => (!hideSmall || new Set(list.map((b) => b.founder_id)).size >= MIN_FOUNDERS_FOR_TOTALS || list.length === 0 ? list.length : null);
    months.push({ month: monthLabel(m), opened: shown(opened), solved: shown(solved) });
  }
  return months;
}

// List of startups for Laura's dropdown.
app.get('/api/startups', adminOnly, wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT st.id, st.name, count(f.id)::int AS people
       FROM startups st JOIN founders f ON f.startup_id = st.id
      GROUP BY st.id ORDER BY st.name`);
  res.json(rows);
}));

app.get('/api/summary', adminOnly, wrap(async (req, res) => {
  const startupId = req.query.startup ? Number(req.query.startup) : null;
  let startup = null;
  if (startupId) {
    const { rows } = await query('SELECT id, name FROM startups WHERE id = $1', [startupId]);
    if (!rows[0]) return res.status(404).json({ error: 'Startup not found.' });
    startup = rows[0];
  }
  const hideSmall = !startup;
  const rows = await loadSummaryRows(startup?.id);
  const now = figuresAt(rows, monthsAgo(-1), hideSmall);     // everything up to today
  const then = figuresAt(rows, currentMonth(), hideSmall);   // as of the start of this month

  const result = { ...now, trends: trends(now, then), months: monthTable(rows, hideSmall), minFounders: MIN_FOUNDERS_FOR_TOTALS, startup };

  if (startup) {
    const team = await query(
      `SELECT name, title, location, comes_in FROM founders WHERE startup_id = $1 ORDER BY name`, [startup.id]);
    result.team = team.rows;
    result.openBlockers = rows.blockers.filter((b) => b.status === 'open')
      .sort((a, b) => new Date(a.reported_month) - new Date(b.reported_month))
      .map((b) => ({
        text: b.text, person: b.founder_name, reported: monthLabel(b.reported_month),
        monthsOpen: monthsBetween(new Date(b.reported_month), currentMonth()), matching: b.match_consent,
      }));
    result.solvedBlockers = rows.blockers.filter((b) => b.status === 'solved')
      .sort((a, b) => new Date(b.solved_month) - new Date(a.solved_month))
      .map((b) => ({
        text: b.text, person: b.founder_name, solved: monthLabel(b.solved_month),
        monthsToSolve: monthsBetween(new Date(b.reported_month), new Date(b.solved_month)), storyHelped: b.story_helped,
      }));
    result.stories = rows.stories.map((s) => ({ problem: s.problem, person: s.founder_name, share: s.share, shared: monthLabel(s.created_at) }));
  }
  res.json(result);
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Errors: log the type of failure, never the request body (it can contain private blockers).
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}: ${err.message}`);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// Load the model at start so the first submission isn't slow.
embed('warm up').then(() => console.log('Matching model ready.'));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Been There, Done That demo: http://localhost:${PORT}`);
});
