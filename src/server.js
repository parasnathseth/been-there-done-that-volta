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

// Laura's summary: totals only, no names. Hidden when based on fewer than 3 founders.
app.get('/api/summary', adminOnly, wrap(async (req, res) => {
  const since = toSqlMonth(monthsAgo(5));
  const opened = await query(
    `SELECT reported_month AS month, count(*)::int AS n, count(DISTINCT founder_id)::int AS founders
       FROM blockers WHERE reported_month >= $1 GROUP BY reported_month`, [since]);
  const solved = await query(
    `SELECT solved_month AS month, count(*)::int AS n, count(DISTINCT founder_id)::int AS founders
       FROM blockers WHERE status = 'solved' AND solved_month >= $1 GROUP BY solved_month`, [since]);
  const durations = await query(
    `SELECT reported_month, solved_month, founder_id FROM blockers WHERE status = 'solved'`);
  const totals = await query(
    `SELECT (SELECT count(*) FROM blockers WHERE status = 'open')::int AS open_now,
            (SELECT count(DISTINCT founder_id) FROM blockers WHERE status = 'open')::int AS open_founders,
            (SELECT count(*) FROM stories WHERE share <> 'private')::int AS shared_stories,
            (SELECT count(DISTINCT founder_id) FROM stories WHERE share <> 'private')::int AS sharing_founders`);
  // Proposal measures, over the same 6 months as the table.
  const recent = since;
  const outreach = await query(
    `SELECT count(DISTINCT founder_id)::int AS founders, count(*)::int AS clicks
       FROM outreach_clicks WHERE created_at >= $1`, [recent]);
  const helped = await query(
    `SELECT count(*) FILTER (WHERE story_helped)::int AS yes,
            count(*) FILTER (WHERE story_helped IS NOT NULL)::int AS answered,
            count(DISTINCT founder_id) FILTER (WHERE story_helped IS NOT NULL)::int AS founders
       FROM blockers WHERE status = 'solved' AND solved_month >= $1`, [recent]);

  const hide = (n, founders) => (founders >= MIN_FOUNDERS_FOR_TOTALS ? n : null);
  const key = (d) => toSqlMonth(new Date(d));
  const openedBy = new Map(opened.rows.map((r) => [key(r.month), r]));
  const solvedBy = new Map(solved.rows.map((r) => [key(r.month), r]));

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const m = monthsAgo(i);
    const o = openedBy.get(toSqlMonth(m));
    const s = solvedBy.get(toSqlMonth(m));
    months.push({
      month: monthLabel(m),
      opened: o ? hide(o.n, o.founders) : 0,
      solved: s ? hide(s.n, s.founders) : 0,
    });
  }

  const d = durations.rows;
  const avgMonths = d.length
    ? d.reduce((sum, r) => sum + monthsBetween(new Date(r.reported_month), new Date(r.solved_month)), 0) / d.length
    : null;
  const t = totals.rows[0];
  res.json({
    months,
    averageMonthsToSolve: new Set(d.map((r) => r.founder_id)).size >= MIN_FOUNDERS_FOR_TOTALS && avgMonths !== null
      ? Math.round(avgMonths * 10) / 10 : null,
    openNow: hide(t.open_now, t.open_founders),
    sharedStories: hide(t.shared_stories, t.sharing_founders),
    reachedOut: hide(outreach.rows[0].founders, outreach.rows[0].founders),
    storyHelped: helped.rows[0].founders >= MIN_FOUNDERS_FOR_TOTALS
      ? { yes: helped.rows[0].yes, answered: helped.rows[0].answered } : null,
    minFounders: MIN_FOUNDERS_FOR_TOTALS,
  });
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
