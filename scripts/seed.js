// Fills the database with invented sample data. Wipes existing demo data first.
import { pool, transaction } from '../src/db.js';
import { embed, storyMatchText } from '../src/embed.js';
import { monthsAgo, toSqlMonth } from '../src/months.js';
import { startups, founders, stories, otherBlockers } from '../data/sample.js';

const emailFor = (name) =>
  name.toLowerCase().replace(/\(.*\)/, '').trim().replace(/[^a-z]+/g, '.') + '@example.com';

console.log('Embedding sample text (first run downloads the model)...');
const storyVectors = [];
for (const s of stories) storyVectors.push(await embed(storyMatchText(s.blocker, s.text)));
const blockerVectors = [];
for (const b of otherBlockers) blockerVectors.push(b.consent ? await embed(b.text) : null);

try {
  await transaction(async (db) => {
    await db.query('TRUNCATE stories, blockers, founders, startups RESTART IDENTITY CASCADE');

    const startupIds = [];
    for (const name of startups) {
      const { rows } = await db.query('INSERT INTO startups (name) VALUES ($1) RETURNING id', [name]);
      startupIds.push(rows[0].id);
    }

    const founderIds = {};
    for (const f of founders) {
      const { rows } = await db.query(
        'INSERT INTO founders (startup_id, name, email, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [f.startup === null ? null : startupIds[f.startup], f.name, emailFor(f.name), f.role]
      );
      founderIds[f.key] = rows[0].id;
    }

    for (const [i, s] of stories.entries()) {
      const { rows } = await db.query(
        `INSERT INTO blockers (founder_id, text, reported_month, status, solved_month, match_consent)
         VALUES ($1, $2, $3, 'solved', $4, FALSE) RETURNING id`,
        [founderIds[s.founder], s.blocker, toSqlMonth(monthsAgo(s.reportedAgo)), toSqlMonth(monthsAgo(s.solvedAgo))]
      );
      await db.query(
        `INSERT INTO stories (founder_id, blocker_id, problem, text, share, created_at, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [founderIds[s.founder], rows[0].id, s.blocker, s.text, s.share, monthsAgo(s.solvedAgo), storyVectors[i]]
      );
    }

    for (const [i, b] of otherBlockers.entries()) {
      await db.query(
        `INSERT INTO blockers (founder_id, text, reported_month, status, solved_month, match_consent, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          founderIds[b.founder], b.text, toSqlMonth(monthsAgo(b.reportedAgo)), b.status,
          b.status === 'solved' ? toSqlMonth(monthsAgo(b.solvedAgo)) : null,
          Boolean(b.consent), blockerVectors[i],
        ]
      );
    }
  });

  const counts = await pool.query(
    `SELECT (SELECT count(*) FROM founders) AS founders,
            (SELECT count(*) FROM blockers) AS blockers,
            (SELECT count(*) FROM stories) AS stories`
  );
  console.log('Seeded:', counts.rows[0]);
} finally {
  await pool.end();
}
