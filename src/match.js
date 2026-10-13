// Ranks stories by how close their meaning is to a blocker.
import { similarity } from './embed.js';

export const DEFAULT_MIN_SCORE = Number(process.env.MATCH_MIN_SCORE ?? 0.35);
export const MAX_MATCHES = 3;

/**
 * candidates: [{ ...story, embedding: number[] }], already filtered by the consent rules.
 * Returns up to `limit` stories at or above `minScore`, closest first, each with a `score`.
 */
export function rankStories(blockerEmbedding, candidates, { minScore = DEFAULT_MIN_SCORE, limit = MAX_MATCHES } = {}) {
  return candidates
    .map((story) => ({ ...story, score: similarity(blockerEmbedding, story.embedding) }))
    .filter((story) => story.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
