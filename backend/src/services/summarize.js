/**
 * Fully offline extractive summarizer.
 *
 * Approach: TextRank (a graph-based ranking algorithm, the same family as
 * Google's PageRank). Sentences are treated as graph nodes; edges are
 * weighted by how similar two sentences are (word overlap, normalized by
 * sentence length so long sentences don't dominate). Running PageRank over
 * this graph surfaces the sentences that are most "central" to the
 * document's meaning — the ones most other sentences relate to.
 *
 * Output is structured for readability: a one-sentence overview, grouped
 * body paragraphs, and diverse key takeaways — not a wall of copied text.
 *
 * No API keys, no external calls, no model downloads. Pure JS + math.
 */

const STOPWORDS = new Set([
  'a','an','the','and','or','but','if','then','so','than','that','this','these','those',
  'is','are','was','were','be','been','being','to','of','in','on','at','for','with','as',
  'by','from','it','its','into','about','over','after','before','between','through','during',
  'i','you','he','she','we','they','them','his','her','their','our','your','my','me','us',
  'not','no','do','does','did','have','has','had','will','would','can','could','should',
  'may','might','must','shall','also','there','here','which','who','whom','what','when',
  'where','why','how','all','each','few','more','most','other','some','such','only','own',
  'same','too','very','just','up','out','down','off','again','further','once'
]);

function splitSentences(text) {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();

  const protectedText = normalized.replace(
    /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|St|Inc|Ltd|Co|Fig|No)\./gi,
    (m) => m.replace('.', '<PERIOD>')
  );

  return protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map(s => s.replace(/<PERIOD>/g, '.').trim())
    .filter(s => s.length > 0);
}

function cleanSentence(sentence) {
  let s = sentence.replace(/\s+/g, ' ').trim();
  if (s.length === 0) return s;
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?]$/.test(s)) s += '.';
  return s;
}

function tokenize(sentence) {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

function sentenceSimilarity(wordsA, wordsB) {
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  const setB = new Set(wordsB);
  let overlap = 0;
  for (const w of wordsA) {
    if (setB.has(w)) overlap++;
  }
  const denom = Math.log(wordsA.length + 1) + Math.log(wordsB.length + 1);
  return denom === 0 ? 0 : overlap / denom;
}

function rankSentences(sentences, tokenized, damping = 0.85, iterations = 30) {
  const n = sentences.length;
  if (n === 0) return [];

  const sim = Array.from({ length: n }, () => new Array(n).fill(0));
  const outWeightSum = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const s = sentenceSimilarity(tokenized[i], tokenized[j]);
      sim[i][j] = s;
      outWeightSum[i] += s;
    }
  }

  let scores = new Array(n).fill(1 / n);

  for (let iter = 0; iter < iterations; iter++) {
    const next = new Array(n).fill((1 - damping) / n);
    for (let i = 0; i < n; i++) {
      let incoming = 0;
      for (let j = 0; j < n; j++) {
        if (j === i || outWeightSum[j] === 0) continue;
        incoming += (sim[j][i] / outWeightSum[j]) * scores[j];
      }
      next[i] += damping * incoming;
    }
    scores = next;
  }

  return scores;
}

/**
 * Maximal Marginal Relevance — pick sentences that score well but aren't
 * near-duplicates of sentences already chosen.
 */
function selectWithMMR(scores, tokenized, count, exclude = new Set(), lambda = 0.72) {
  const selected = [];
  const candidates = scores
    .map((score, idx) => ({ score, idx }))
    .filter(({ idx }) => !exclude.has(idx))
    .sort((a, b) => b.score - a.score);

  const pool = new Set(candidates.map(c => c.idx));

  while (selected.length < count && pool.size > 0) {
    let bestIdx = -1;
    let bestMmr = -Infinity;

    for (const idx of pool) {
      const relevance = scores[idx];
      let maxSim = 0;
      for (const sIdx of selected) {
        maxSim = Math.max(maxSim, sentenceSimilarity(tokenized[idx], tokenized[sIdx]));
      }
      const mmr = lambda * relevance - (1 - lambda) * maxSim;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = idx;
      }
    }

    selected.push(bestIdx);
    pool.delete(bestIdx);
  }

  return selected.sort((a, b) => a - b);
}

function groupIntoParagraphs(sortedIndices, sentences) {
  if (sortedIndices.length === 0) return [];

  const paragraphs = [];
  let group = [sortedIndices[0]];

  for (let i = 1; i < sortedIndices.length; i++) {
    if (sortedIndices[i] - sortedIndices[i - 1] > 1) {
      paragraphs.push(group.map(idx => cleanSentence(sentences[idx])).join(' '));
      group = [sortedIndices[i]];
    } else {
      group.push(sortedIndices[i]);
    }
  }

  paragraphs.push(group.map(idx => cleanSentence(sentences[idx])).join(' '));
  return paragraphs.filter(Boolean);
}

function isTooSimilar(textA, textB, tokenized, idxA, idxB, threshold = 0.55) {
  if (textA === textB) return true;
  return sentenceSimilarity(tokenized[idxA], tokenized[idxB]) >= threshold;
}

function formatSummaryText(overview, paragraphs) {
  const parts = [];
  if (overview) parts.push(overview);
  parts.push(...paragraphs);
  return parts.join('\n\n');
}

const LENGTH_RATIOS = {
  short: 0.15,
  medium: 0.30,
  long: 0.50
};
const LENGTH_MIN_SENTENCES = {
  short: 2,
  medium: 4,
  long: 6
};

const DISCOURSE_STARTERS = /^(however|but|and|also|in addition|furthermore|moreover|additionally|nevertheless|nonetheless|therefore|thus|so|yet|still|then|instead|otherwise|meanwhile|similarly|likewise|conversely|for example|for instance|in contrast|on the other hand|as a result|in summary|in conclusion|finally|secondly|thirdly|firstly|next|subsequently)\b/i;

function pickOverviewIndex(sentences, scores) {
  const total = sentences.length;
  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let idx = 0; idx < total; idx++) {
    let weighted = scores[idx];
    const pos = idx / total;
    if (pos <= 0.25) weighted *= 1.12;
    if (pos >= 0.85) weighted *= 1.08;
    if (DISCOURSE_STARTERS.test(sentences[idx].trim())) weighted *= 0.55;
    if (sentences[idx].length < 40) weighted *= 0.75;
    if (sentences[idx].length > 240) weighted *= 0.88;

    if (weighted > bestScore) {
      bestScore = weighted;
      bestIdx = idx;
    }
  }

  return bestIdx;
}

/**
 * Offline extractive fallback used when Groq is unavailable.
 * @param {string} text
 * @param {'short'|'medium'|'long'} length
 */
function summarizeExtractive(text, length = 'medium') {
  const sentences = splitSentences(text);

  if (sentences.length === 0) {
    return {
      title: 'Document review',
      overview: '',
      paragraphs: [],
      summary: '',
      keyPoints: [],
      sentenceCount: 0,
      originalSentenceCount: 0,
      method: 'textrank'
    };
  }

  const tokenized = sentences.map(tokenize);
  const scores = rankSentences(sentences, tokenized);

  const ratio = LENGTH_RATIOS[length] || LENGTH_RATIOS.medium;
  const minSentences = LENGTH_MIN_SENTENCES[length] || LENGTH_MIN_SENTENCES.medium;
  const targetCount = Math.max(
    Math.min(minSentences, sentences.length),
    Math.round(sentences.length * ratio)
  );
  const count = Math.min(targetCount, sentences.length);

  // Overview: the best standalone takeaway sentence (not a dangling "However…").
  const overviewIdx = pickOverviewIndex(sentences, scores);
  const overview = cleanSentence(sentences[overviewIdx]);

  // Body: diverse, high-scoring sentences in original reading order.
  const bodyCount = Math.max(0, count - 1);
  const bodyIndices = selectWithMMR(
    scores,
    tokenized,
    bodyCount,
    new Set([overviewIdx])
  );
  const paragraphs = groupIntoParagraphs(bodyIndices, sentences);

  const summarySentences = [overview, ...bodyIndices.map(idx => sentences[idx])];
  const summary = formatSummaryText(overview, paragraphs);

  // Key takeaways: up to 5 diverse bullets, excluding content already prominent
  // in the overview or body.
  const usedIndices = new Set([overviewIdx, ...bodyIndices]);
  const keyPointCandidates = scores
    .map((score, idx) => ({ score, idx }))
    .filter(({ idx }) => !usedIndices.has(idx))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(15, sentences.length));

  const keyPointPool = new Map(keyPointCandidates.map(c => [c.idx, c.score]));
  const keyPointIndices = selectWithMMR(
    scores,
    tokenized,
    Math.min(5, keyPointPool.size || sentences.length),
    usedIndices
  );

  const keyPoints = keyPointIndices
    .map(idx => cleanSentence(sentences[idx]))
    .filter((point, i, arr) => {
      if (point === overview) return false;
      const idx = keyPointIndices[i];
      if (paragraphs.some(p => p.includes(point))) return false;
      return !arr.slice(0, i).some((other, j) =>
        isTooSimilar(point, other, tokenized, idx, keyPointIndices[j])
      );
    });

  return {
    title: 'Document review',
    overview,
    paragraphs,
    summary,
    keyPoints,
    sentenceCount: summarySentences.length,
    originalSentenceCount: sentences.length,
    method: 'textrank'
  };
}

const { summarizeWithGroq } = require('./groqSummarize');
const { summarizeBill } = require('./billSummarize');

function countSentences(text) {
  return splitSentences(text).length;
}

/**
 * Prefer Groq (free-tier LLM) so the output is a written review.
 * Falls back to TextRank if the key is missing or the API call fails.
 * Bill mode uses a dedicated smart bill summarizer.
 *
 * @param {string} text - full extracted document text
 * @param {'short'|'medium'|'long'} length
 * @param {'document'|'bill'} [docType]
 */
async function summarize(text, length = 'medium', docType = 'document') {
  if (docType === 'bill') {
    const review = await summarizeBill(text);
    const written = [review.overview, ...(review.paragraphs || [])].join(' ');
    return {
      ...review,
      sentenceCount: countSentences(written) || (review.paragraphs?.length || 0) + (review.overview ? 1 : 0),
      originalSentenceCount: splitSentences(text).length,
      method: review.method || 'heuristic'
    };
  }

  const fallback = summarizeExtractive(text, length);

  if (!process.env.GROQ_API_KEY) {
    return fallback;
  }

  try {
    const review = await summarizeWithGroq(text, length);
    const written = [review.overview, ...(review.paragraphs || [])].join(' ');
    return {
      ...review,
      sentenceCount: countSentences(written) || review.paragraphs.length + (review.overview ? 1 : 0),
      originalSentenceCount: fallback.originalSentenceCount,
      method: 'groq'
    };
  } catch (err) {
    console.error('[summarize] Groq failed, using extractive fallback:', err.message);
    return fallback;
  }
}

module.exports = { summarize, summarizeExtractive, splitSentences, cleanSentence };
