// Fills the database from Volta-demo-data-pack.csv (made-up founders) plus the invented
// extras in data/pack-overlay.js. Wipes existing demo data first.
//
// For each person:
//   "Lived through" -> a solved blocker with a shared story (sharing choice from the overlay)
//   "Stuck on"      -> an open blocker from a recent month (matching on or off from the overlay)
// The demo hero is different: their "Lived through" item is an open blocker from last month,
// so they can mark it solved during the demo, and their "Stuck on" item is typed live.
import { pool, transaction } from '../src/db.js';
import { embed, storyMatchText } from '../src/embed.js';
import { monthsAgo, toSqlMonth } from '../src/months.js';
import { people } from '../data/pack.js';
import { DEMO_HERO, HERO_PAST_BLOCKER_AGO } from '../data/pack-overlay.js';

const emailFor = (name) => name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '') + '@example.com';
const month = (n) => toSqlMonth(monthsAgo(n));

console.log('Embedding the data pack (first run downloads the model)...');
for (const p of people) {
  const isHero = p.name === DEMO_HERO;
  p.storyEmbedding = isHero ? null : await embed(storyMatchText(p.livedThrough, p.helped, p.canHelpWith));
  p.stuckEmbedding = !isHero && p.consent ? await embed(p.stuckOn) : null;
  p.heroPastEmbedding = isHero ? await embed(p.livedThrough) : null;
}

try {
  await transaction(async (db) => {
    await db.query('TRUNCATE stories, blockers, founders, startups RESTART IDENTITY CASCADE');

    const companyIds = new Map();
    for (const company of new Set(people.map((p) => p.company))) {
      const { rows } = await db.query('INSERT INTO startups (name) VALUES ($1) RETURNING id', [company]);
      companyIds.set(company, rows[0].id);
    }

    for (const p of people) {
      const { rows } = await db.query(
        `INSERT INTO founders (startup_id, name, email, title, location, comes_in, can_help_with, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'founder') RETURNING id`,
        [companyIds.get(p.company), p.name, emailFor(p.name), p.title, p.location, p.comesIn, p.canHelpWith]
      );
      const founderId = rows[0].id;

      if (p.name === DEMO_HERO) {
        await db.query(
          `INSERT INTO blockers (founder_id, text, reported_month, match_consent, embedding)
           VALUES ($1, $2, $3, TRUE, $4)`,
          [founderId, p.livedThrough, month(HERO_PAST_BLOCKER_AGO), p.heroPastEmbedding]
        );
        continue;
      }

      // "Lived through": solved blocker + story.
      const solved = await db.query(
        `INSERT INTO blockers (founder_id, text, reported_month, status, solved_month, match_consent)
         VALUES ($1, $2, $3, 'solved', $4, FALSE) RETURNING id`,
        [founderId, p.livedThrough, month(p.livedAgo + 2), month(p.livedAgo)]
      );
      await db.query(
        `INSERT INTO stories (founder_id, blocker_id, problem, text, share, created_at, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [founderId, solved.rows[0].id, p.livedThrough, p.helped, p.share, monthsAgo(p.livedAgo), p.storyEmbedding]
      );

      // "Stuck on": open blocker.
      await db.query(
        `INSERT INTO blockers (founder_id, text, reported_month, match_consent, embedding)
         VALUES ($1, $2, $3, $4, $5)`,
        [founderId, p.stuckOn, month(p.stuckAgo), Boolean(p.consent), p.stuckEmbedding]
      );
    }

    await db.query(
      `INSERT INTO founders (startup_id, name, email, title, location, role)
       VALUES (NULL, 'Laura (Volta)', 'laura@example.com', 'Residency lead', 'Halifax', 'admin')`
    );
  });

  const counts = await pool.query(
    `SELECT (SELECT count(*) FROM founders) AS people,
            (SELECT count(*) FROM startups) AS companies,
            (SELECT count(*) FROM blockers) AS blockers,
            (SELECT count(*) FROM stories) AS stories`
  );
  console.log('Seeded from the data pack:', counts.rows[0]);
} finally {
  await pool.end();
}
