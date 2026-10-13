// Measures matching quality on 40 invented blockers and suggests a minimum score.
// Runs in memory on the sample data; it does not touch the database.
import { embed, storyMatchText } from '../src/embed.js';
import { rankStories, DEFAULT_MIN_SCORE } from '../src/match.js';
import { stories } from '../data/sample.js';
import { evalPairs } from '../data/eval-pairs.js';

// Same rule as the app: private stories are never candidates.
const candidates = [];
for (const s of stories) {
  if (s.share === 'private') continue;
  candidates.push({ key: s.key, embedding: await embed(storyMatchText(s.blocker, s.text)) });
}
const blockers = [];
for (const p of evalPairs) blockers.push({ ...p, embedding: await embed(p.blocker) });

function evaluate(minScore) {
  let top1 = 0, top3 = 0, positives = 0, quietNegatives = 0, negatives = 0, shownWrong = 0;
  for (const b of blockers) {
    const ranked = rankStories(b.embedding, candidates, { minScore });
    if (b.expect) {
      positives++;
      if (ranked[0]?.key === b.expect) top1++;
      if (ranked.some((r) => r.key === b.expect)) top3++;
      if (ranked.length && ranked[0].key !== b.expect) shownWrong++;
    } else {
      negatives++;
      if (ranked.length === 0) quietNegatives++;
    }
  }
  return { minScore, top1, top3, positives, quietNegatives, negatives, shownWrong };
}

const pct = (a, b) => `${Math.round((100 * a) / b)}%`;

console.log('\nMin score | Right story first | Right story in top 3 | No match when none fits | Wrong story shown first');
for (let t = 0.25; t <= 0.651; t += 0.05) {
  const r = evaluate(Number(t.toFixed(2)));
  const mark = Math.abs(r.minScore - DEFAULT_MIN_SCORE) < 1e-9 ? '  <- current setting' : '';
  console.log(
    `${r.minScore.toFixed(2).padStart(9)} | ${pct(r.top1, r.positives).padStart(17)} | ${pct(r.top3, r.positives).padStart(20)} | ${pct(r.quietNegatives, r.negatives).padStart(23)} | ${String(r.shownWrong).padStart(23)}${mark}`
  );
}

// Detail at the current setting, so misses can be inspected.
console.log(`\nDetail at min score ${DEFAULT_MIN_SCORE}:`);
for (const b of blockers) {
  const ranked = rankStories(b.embedding, candidates, { minScore: 0 });
  const best = ranked[0];
  const shown = best.score >= DEFAULT_MIN_SCORE;
  const ok = b.expect ? shown && best.key === b.expect : !shown;
  console.log(`${ok ? 'ok  ' : 'MISS'} ${best.score.toFixed(2)} ${b.blocker}  ->  ${shown ? best.key : '(no match shown)'}${b.expect && !ok ? `  [expected ${b.expect}]` : ''}`);
}
