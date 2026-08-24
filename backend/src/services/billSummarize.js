/**
 * Smart bill / receipt summarizer.
 *
 * Uses Groq (free tier) to extract structured bill fields and write a short
 * review. Falls back to heuristic OCR parsing when the API is unavailable.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const MAX_SOURCE_CHARS = 12000;

const MONEY_RE = /(?:(?:USD|INR|EUR|GBP|Rs\.?|₹|\$|€|£)\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2}))/gi;
const DATE_RE = /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4})\b/gi;
const TOTAL_HINT = /\b(total|amount\s*due|balance\s*due|grand\s*total|net\s*payable|amount\s*payable|pay\s*this\s*amount)\b/i;
const DUE_HINT = /\b(due\s*date|payment\s*due|pay\s*by|due\s*on)\b/i;
const INVOICE_HINT = /\b(invoice\s*(?:#|no\.?|number)?|bill\s*(?:#|no\.?|number)?|receipt\s*(?:#|no\.?)?)\s*[:#]?\s*([A-Z0-9][-A-Z0-9/]*)/i;

function clipSource(text) {
  const cleaned = String(text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
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

function asString(value) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function asStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean);
}

function asLineItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') {
        return { description: asString(item), amount: '' };
      }
      return {
        description: asString(item?.description || item?.name || item?.item),
        amount: asString(item?.amount || item?.price || item?.total)
      };
    })
    .filter((item) => item.description);
}

function emptyBill() {
  return {
    vendor: '',
    total: '',
    currency: '',
    billDate: '',
    dueDate: '',
    invoiceNumber: '',
    category: '',
    statusHint: '',
    lineItems: [],
    flags: []
  };
}

function normalizeBillReview(parsed) {
  const billRaw = parsed.bill || parsed.fields || {};
  const bill = {
    vendor: asString(billRaw.vendor || billRaw.merchant || billRaw.payee),
    total: asString(billRaw.total || billRaw.amountDue || billRaw.amount),
    currency: asString(billRaw.currency),
    billDate: asString(billRaw.billDate || billRaw.date || billRaw.invoiceDate),
    dueDate: asString(billRaw.dueDate),
    invoiceNumber: asString(billRaw.invoiceNumber || billRaw.receiptNumber || billRaw.billNumber),
    category: asString(billRaw.category),
    statusHint: asString(billRaw.statusHint || billRaw.paymentStatus),
    lineItems: asLineItems(billRaw.lineItems || billRaw.items),
    flags: asStringList(billRaw.flags || parsed.flags)
  };

  const title = asString(parsed.title) || (bill.vendor ? `${bill.vendor} — bill summary` : 'Bill summary');
  const overview = asString(parsed.overview || parsed.summary);
  const paragraphs = asStringList(parsed.paragraphs || parsed.findings || parsed.details);
  const keyPoints = asStringList(parsed.keyPoints || parsed.takeaways || parsed.bullets);

  if (!overview && !bill.total && paragraphs.length === 0) {
    throw new Error('Model returned an empty bill review.');
  }

  const summary = [overview, ...paragraphs].filter(Boolean).join('\n\n');

  return {
    title,
    overview: overview || buildHeuristicOverview(bill),
    paragraphs,
    summary,
    keyPoints: keyPoints.length ? keyPoints : buildHeuristicKeyPoints(bill),
    bill
  };
}

function pickLikelyTotal(text) {
  const lines = text.split(/\n+/);
  let best = '';
  for (const line of lines) {
    if (!TOTAL_HINT.test(line)) continue;
    const matches = [...line.matchAll(MONEY_RE)];
    if (matches.length) best = matches[matches.length - 1][0].trim();
  }
  if (best) return best;

  const all = [...text.matchAll(MONEY_RE)].map((m) => m[0].trim());
  if (!all.length) return '';
  // Prefer the largest numeric value as a rough total guess.
  return all.sort((a, b) => {
    const na = parseFloat(a.replace(/[^0-9.]/g, '')) || 0;
    const nb = parseFloat(b.replace(/[^0-9.]/g, '')) || 0;
    return nb - na;
  })[0];
}

function pickDueDate(text) {
  const lines = text.split(/\n+/);
  for (const line of lines) {
    if (!DUE_HINT.test(line)) continue;
    const match = line.match(DATE_RE);
    if (match) return match[0];
  }
  return '';
}

function pickBillDate(text) {
  const match = text.match(DATE_RE);
  return match ? match[0] : '';
}

function pickVendor(text) {
  const firstLine = text.split(/\n+/).map((l) => l.trim()).find((l) => l.length > 2);
  if (!firstLine) return '';
  if (/^(total|amount|invoice|receipt|bill|date|tel|phone)/i.test(firstLine)) return '';
  return firstLine.slice(0, 80);
}

function buildHeuristicOverview(bill) {
  const parts = [];
  if (bill.vendor) parts.push(`Bill from ${bill.vendor}`);
  else parts.push('Bill / receipt summary');
  if (bill.total) parts.push(`total ${bill.total}${bill.currency ? ` ${bill.currency}` : ''}`);
  if (bill.dueDate) parts.push(`due ${bill.dueDate}`);
  else if (bill.billDate) parts.push(`dated ${bill.billDate}`);
  return `${parts.join(' · ')}.`;
}

function buildHeuristicKeyPoints(bill) {
  const points = [];
  if (bill.vendor) points.push(`Vendor: ${bill.vendor}`);
  if (bill.total) points.push(`Total / amount due: ${bill.total}${bill.currency ? ` ${bill.currency}` : ''}`);
  if (bill.billDate) points.push(`Bill date: ${bill.billDate}`);
  if (bill.dueDate) points.push(`Due date: ${bill.dueDate}`);
  if (bill.invoiceNumber) points.push(`Invoice / receipt #: ${bill.invoiceNumber}`);
  if (bill.category) points.push(`Category: ${bill.category}`);
  if (bill.statusHint) points.push(bill.statusHint);
  bill.flags.forEach((f) => points.push(f));
  return points.slice(0, 7);
}

function summarizeBillHeuristic(text) {
  const source = String(text || '').trim();
  const invoiceMatch = source.match(INVOICE_HINT);
  const bill = {
    ...emptyBill(),
    vendor: pickVendor(source),
    total: pickLikelyTotal(source),
    billDate: pickBillDate(source),
    dueDate: pickDueDate(source),
    invoiceNumber: invoiceMatch ? invoiceMatch[2] : '',
    category: /electric|water|gas|utility/i.test(source)
      ? 'Utilities'
      : /hospital|clinic|pharmacy|medical/i.test(source)
        ? 'Medical'
        : /restaurant|cafe|food|grocery/i.test(source)
          ? 'Food & dining'
          : '',
    flags: []
  };

  if (!bill.total) bill.flags.push('Total amount could not be confidently detected from OCR text.');
  if (!bill.dueDate) bill.flags.push('No clear due date found.');

  const overview = buildHeuristicOverview(bill);
  const paragraphs = [
    'This summary was produced from OCR text with local field detection (no AI call). Verify totals and dates against the original bill before paying.'
  ];
  if (bill.lineItems.length === 0 && source.length > 40) {
    paragraphs.push('Line items were not clearly separated in the scan; check the extracted source text below for item-level detail.');
  }

  const keyPoints = buildHeuristicKeyPoints(bill);

  return {
    title: bill.vendor ? `${bill.vendor} — bill summary` : 'Bill summary',
    overview,
    paragraphs,
    summary: [overview, ...paragraphs].join('\n\n'),
    keyPoints,
    bill,
    method: 'heuristic'
  };
}

async function summarizeBillWithGroq(text) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set.');

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
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You are a bill and receipt analyst.',
            'Extract structured payment details and write a short smart summary.',
            'Never invent amounts, dates, or vendors that are not supported by the text.',
            'If a field is unclear, leave it as an empty string and mention uncertainty in flags.',
            'Return JSON only.'
          ].join(' ')
        },
        {
          role: 'user',
          content: [
            'Analyze this bill/receipt OCR text and return JSON with:',
            'title: short heading',
            'overview: 1–2 sentence smart summary of what this bill is and what is owed',
            'paragraphs: 1–2 short paragraphs covering charges, dates, and anything notable',
            'keyPoints: 4–6 short actionable bullets (due date, total, late fee risk, etc.)',
            'bill: object with vendor, total, currency, billDate, dueDate, invoiceNumber, category, statusHint, lineItems[{description,amount}], flags[]',
            '',
            'OCR text:',
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
  return {
    ...normalizeBillReview(parseJsonPayload(content)),
    method: 'groq'
  };
}

/**
 * @param {string} text
 */
async function summarizeBill(text) {
  const fallback = summarizeBillHeuristic(text);

  if (!process.env.GROQ_API_KEY) {
    return fallback;
  }

  try {
    return await summarizeBillWithGroq(text);
  } catch (err) {
    console.error('[summarizeBill] Groq failed, using heuristic fallback:', err.message);
    return fallback;
  }
}

module.exports = {
  summarizeBill,
  summarizeBillHeuristic,
  emptyBill
};
