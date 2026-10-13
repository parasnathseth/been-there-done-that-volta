// Turns text into a list of numbers (an "embedding") that represents its meaning.
// The model runs on this server; no text is sent to an outside AI service.
import { fileURLToPath } from 'node:url';
import { pipeline, env } from '@huggingface/transformers';

const MODEL_ID = process.env.MODEL_ID || 'Xenova/all-MiniLM-L6-v2';

// Keep downloaded model files inside the project (gitignored), not in a global cache.
env.cacheDir = fileURLToPath(new URL('../.cache/', import.meta.url));

let extractorPromise = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL_ID, { dtype: 'fp32' });
  }
  return extractorPromise;
}

/**
 * Returns a 384-number array for the given text.
 * Numbers are normalized, so the similarity of two embeddings is their dot product.
 */
export async function embed(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * The text used to match a story: the problem it solved plus what helped.
 * Matching on both is much more accurate than the story text alone (see npm run eval).
 */
export function storyMatchText(problem, text) {
  return `${problem}. ${text}`;
}

/** Similarity from about 0 (unrelated) to 1 (same meaning). */
export function similarity(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
