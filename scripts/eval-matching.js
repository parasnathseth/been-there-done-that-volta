// Measures matching quality on test blockers from the data pack and suggests a minimum score.
// Runs in memory on the data pack; it does not touch the database.
import { embed, storyMatchText } from '../src/embed.js';
import { rankStories, DEFAULT_MIN_SCORE } from '../src/match.js';
import { people, keyOf } from '../data/pack.js';
import { DEMO_HERO } from '../data/pack-overlay.js';
import { evalPairs } from '../data/eval-pairs.js';

// Same as the seeded app: private stories are never candidates, and the demo hero's
// "Lived through" item starts as an open blocker, not a story.
const candidates = [];
for (const p of people) {
  if (p.share === 'private' || p.name === DEMO_HERO) continue;
  candidates.push({ key: keyOf(p.name), embedding: await embed(storyMatchText(p.livedThrough, p.helped, p.canHelpWith)) });
}
const blockers = [];
for (const p of evalPairs) {
  const expect = p.expect === null ? null : [].concat(p.expect);
  blockers.push({ ...p, expect, embedding: await embed(p.blocker) });
}

function evaluate(minScore) {
  let top1 = 0, top3 = 0, positives = 0, quietNegatives = 0, negatives = 0, shownWrong = 0;
  for (const b of blockers) {
    const ranked = rankStories(b.embedding, candidates, { minScore });
    if (b.expect) {
      positives++;
      if (ranked[0] && b.expect.includes(ranked[0].key)) top1++;
      if (ranked.some((r) => b.expect.includes(r.key))) top3++;
      if (ranked.length && !b.expect.includes(ranked[0].key)) shownWrong++;
    } else {
      negatives++;
      if (ranked.length === 0) quietNegatives++;
    }
  }
  return { minScore, top1, top3, positives, quietNegatives, negatives, shownWrong };
}

const pct = (a, b) => `${Math.round((100 * a) / b)}%`;

console.log(`\n${blockers.length} test blockers, ${candidates.length} shareable stories`);
console.log('\nMin score | Right story first | Right story in top 3 | No match when none fits | Wrong story shown first');
for (let t = 0.25; t <= 0.651; t += 0.05) {
  const r = evaluate(Number(t.toFixed(2)));
  const mark = Math.abs(r.minScore - DEFAULT_MIN_SCORE) < 1e-9 ? '  <- current setting' : '';
  console.log(
    `${r.minScore.toFixed(2).padStart(9)} | ${pct(r.top1, r.positives).padStart(17)} | ${pct(r.top3, r.positives).padStart(20)} | ${pct(r.quietNegatives, r.negatives).padStart(23)} | ${String(r.shownWrong).padStart(23)}${mark}`
  );
}

console.log(`\nDetail at min score ${DEFAULT_MIN_SCORE}:`);
for (const b of blockers) {
  const ranked = rankStories(b.embedding, candidates, { minScore: 0 });
  const best = ranked[0];
  const shown = best.score >= DEFAULT_MIN_SCORE;
  const ok = b.expect ? shown && b.expect.includes(best.key) : !shown;
  console.log(`${ok ? 'ok  ' : 'MISS'} ${best.score.toFixed(2)} ${b.blocker}  ->  ${shown ? best.key : '(no match shown)'}${b.expect && !ok ? `  [expected ${b.expect.join(' or ')}]` : ''}`);
}
