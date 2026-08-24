/**
 * Abstractive document review via Groq's free-tier LLM API
 * (OpenAI-compatible chat completions).
 *
 * The model is instructed to rewrite in its own words — not to stitch
 * source sentences together — so the result reads as a review.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const MAX_SOURCE_CHARS = 14000;

const LENGTH_GUIDANCE = {
  short: {
    overview: '1–2 sentences',
    paragraphs: '1 short paragraph',
    takeaways: '3 bullets'
  },
  medium: {
    overview: '2–3 sentences',
    paragraphs: '2–3 short paragraphs',
    takeaways: '5 bullets'
  },
  long: {
    overview: '3–4 sentences',
    paragraphs: '3–4 short paragraphs',
    takeaways: '6–7 bullets'
  }
};

function clipSource(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= MAX_SOURCE_CHARS) return cleaned;
  return `${cleaned.slice(0, MAX_SOURCE_CHARS)}…`;
}

function parseJsonPayload(raw) {
  const trimmed = String(raw || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Model did not return JSON.');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function asStringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizeReview(parsed) {
  const title = String(parsed.title || parsed.heading || '').trim();
  const overview = String(parsed.overview || parsed.summary || '').trim();
  const paragraphs = asStringList(parsed.paragraphs || parsed.findings || parsed.details);
  const keyPoints = asStringList(parsed.keyPoints || parsed.takeaways || parsed.bullets);

  if (!overview && paragraphs.length === 0) {
    throw new Error('Model returned an empty review.');
  }

  const summary = [overview, ...paragraphs].filter(Boolean).join('\n\n');

  return {
    title: title || 'Document review',
    overview,
    paragraphs,
    summary,
    keyPoints
  };
}

async function summarizeWithGroq(text, length = 'medium') {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set.');
  }

  const guide = LENGTH_GUIDANCE[length] || LENGTH_GUIDANCE.medium;
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const source = clipSource(text);

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 1100,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You are a professional document reviewer.',
            'Write an original review in your own words.',
            'Do not copy, quote, or lightly rephrase source sentences.',
            'Paraphrase the ideas. Use a clear report voice.',
            'Never invent facts that are not supported by the source.',
            'Return JSON only with keys: title, overview, paragraphs, keyPoints.'
          ].join(' ')
        },
        {
          role: 'user',
          content: [
            `Write a ${length} document review.`,
            `Overview length: ${guide.overview}.`,
            `Body: ${guide.paragraphs}, each 2–4 original sentences.`,
            `Key points: ${guide.takeaways}, each a short original phrase (not a copied sentence).`,
            'title: a short original heading for the review.',
            'overview: the main takeaway in original prose.',
            'paragraphs: an array of original body paragraphs covering the important themes.',
            'keyPoints: an array of original takeaway bullets.',
            '',
            'Source document:',
            source
          ].join('\n')
        }
      ]
    }),
    signal: AbortSignal.timeout(25000)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Groq request failed (${response.status}): ${detail.slice(0, 240)}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  return normalizeReview(parseJsonPayload(content));
}

module.exports = { summarizeWithGroq };
