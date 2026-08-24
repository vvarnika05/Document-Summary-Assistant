import React, { useMemo, useState } from 'react';

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" className="copy-btn" onClick={handleCopy}>
      {copied ? 'Copied' : label}
    </button>
  );
}

function buildCopyText({ title, overview, paragraphs, keyPoints, bill, isBill }) {
  const sections = [];
  if (title) sections.push(title);
  if (overview) sections.push(`Overview\n${overview}`);

  if (isBill && bill) {
    const fields = [
      bill.vendor && `Vendor: ${bill.vendor}`,
      bill.total && `Total: ${bill.total}${bill.currency ? ` ${bill.currency}` : ''}`,
      bill.billDate && `Bill date: ${bill.billDate}`,
      bill.dueDate && `Due date: ${bill.dueDate}`,
      bill.invoiceNumber && `Invoice #: ${bill.invoiceNumber}`,
      bill.category && `Category: ${bill.category}`,
      bill.statusHint && `Status: ${bill.statusHint}`
    ].filter(Boolean);
    if (fields.length) sections.push(['Bill details', ...fields].join('\n'));
    if (bill.lineItems?.length) {
      sections.push([
        'Line items',
        ...bill.lineItems.map((item) =>
          item.amount ? `• ${item.description} — ${item.amount}` : `• ${item.description}`
        )
      ].join('\n'));
    }
  }

  if (paragraphs?.length) {
    sections.push(['In detail', ...paragraphs].join('\n\n'));
  }
  if (keyPoints?.length) {
    sections.push(['Key takeaways', ...keyPoints.map((p, i) => `${i + 1}. ${p}`)].join('\n'));
  }
  return sections.join('\n\n');
}

function BillFacts({ bill }) {
  if (!bill) return null;

  const rows = [
    { label: 'Vendor', value: bill.vendor },
    {
      label: 'Total',
      value: bill.total
        ? `${bill.total}${bill.currency ? ` ${bill.currency}` : ''}`
        : ''
    },
    { label: 'Bill date', value: bill.billDate },
    { label: 'Due date', value: bill.dueDate },
    { label: 'Invoice #', value: bill.invoiceNumber },
    { label: 'Category', value: bill.category },
    { label: 'Status', value: bill.statusHint }
  ].filter((row) => row.value);

  if (rows.length === 0 && !bill.lineItems?.length && !bill.flags?.length) {
    return null;
  }

  return (
    <section className="bill-facts" aria-labelledby="bill-facts-heading">
      <h3 id="bill-facts-heading" className="bill-facts__label">Bill details</h3>
      {rows.length > 0 && (
        <dl className="bill-facts__grid">
          {rows.map((row) => (
            <div key={row.label} className="bill-facts__row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {bill.lineItems?.length > 0 && (
        <div className="bill-line-items">
          <p className="bill-line-items__label">Line items</p>
          <ul>
            {bill.lineItems.map((item, i) => (
              <li key={i}>
                <span>{item.description}</span>
                {item.amount && <strong>{item.amount}</strong>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {bill.flags?.length > 0 && (
        <ul className="bill-flags">
          {bill.flags.map((flag, i) => (
            <li key={i}>{flag}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function SummaryView({ result }) {
  const [showOriginal, setShowOriginal] = useState(false);

  const {
    fileName,
    docType,
    extractionMethod,
    pageCount,
    ocrConfidence,
    originalText,
    wordCount,
    title,
    overview,
    paragraphs,
    summary,
    keyPoints,
    bill,
    sentenceCount,
    originalSentenceCount,
    summaryMethod
  } = result;

  const isBill = docType === 'bill';

  const bodyParagraphs = useMemo(() => {
    if (paragraphs?.length) return paragraphs;
    if (!summary) return [];
    const chunks = summary.split(/\n\n+/).filter(Boolean);
    return overview && chunks[0] === overview ? chunks.slice(1) : chunks;
  }, [paragraphs, summary, overview]);

  const copyText = useMemo(
    () => buildCopyText({
      title: title || (isBill ? 'Bill summary' : 'Document review'),
      overview,
      paragraphs: bodyParagraphs,
      keyPoints,
      bill,
      isBill
    }),
    [title, overview, bodyParagraphs, keyPoints, bill, isBill]
  );

  const methodLabel = extractionMethod === 'tesseract-ocr' ? 'OCR' : 'PDF text layer';
  const reviewLabel = isBill
    ? (summaryMethod === 'groq' ? 'Smart bill summary' : 'OCR field summary')
    : (summaryMethod === 'groq' ? 'AI-written review' : 'Extractive summary');
  const isAiReview = summaryMethod === 'groq';

  return (
    <div className="results">
      <div className="doc-card">
        <div className="doc-card__title">
          <span className="doc-card__filename">{fileName}</span>
          <span className="doc-card__stamp">{isBill ? 'Bill' : methodLabel}</span>
        </div>
        <dl className="doc-card__meta">
          <div>
            <dt>Words</dt>
            <dd>{wordCount.toLocaleString()}</dd>
          </div>
          {pageCount != null && (
            <div>
              <dt>Pages</dt>
              <dd>{pageCount}</dd>
            </div>
          )}
          {ocrConfidence != null && (
            <div>
              <dt>OCR confidence</dt>
              <dd>{Math.round(ocrConfidence)}%</dd>
            </div>
          )}
          <div>
            <dt>Summary type</dt>
            <dd>{reviewLabel}</dd>
          </div>
          {!isAiReview && !isBill && (
            <div>
              <dt>Sentences used</dt>
              <dd>{sentenceCount} of {originalSentenceCount}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="tear-divider" aria-hidden="true" />

      <article className="summary-card">
        <div className="summary-card__header">
          <div>
            <p className="summary-card__eyebrow">
              {isBill ? 'Smart bill summary' : 'Document review'}
            </p>
            <h2>{title || (isBill ? 'Bill summary' : 'Document review')}</h2>
          </div>
          <CopyButton text={copyText} label={isBill ? 'Copy bill summary' : 'Copy review'} />
        </div>

        {overview && (
          <section className="summary-overview" aria-labelledby="overview-heading">
            <h3 id="overview-heading" className="summary-overview__label">Overview</h3>
            <p className="summary-overview__text">{overview}</p>
          </section>
        )}

        {isBill && <BillFacts bill={bill} />}

        {bodyParagraphs.length > 0 && (
          <section className="summary-body" aria-labelledby="detail-heading">
            <h3 id="detail-heading" className="summary-body__label">In detail</h3>
            {bodyParagraphs.map((paragraph, i) => (
              <p key={i} className="summary-body__paragraph">{paragraph}</p>
            ))}
          </section>
        )}

        {!overview && bodyParagraphs.length === 0 && summary && (
          <p className="summary-card__text">{summary}</p>
        )}
      </article>

      {keyPoints?.length > 0 && (
        <section className="keypoints-card" aria-labelledby="takeaways-heading">
          <h3 id="takeaways-heading">{isBill ? 'Action items' : 'Key takeaways'}</h3>
          <ol className="keypoints-list">
            {keyPoints.map((point, i) => (
              <li key={i}>
                <span className="keypoints-list__index">{i + 1}</span>
                <span className="keypoints-list__text">{point}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="original-card">
        <button
          type="button"
          className="original-card__toggle"
          onClick={() => setShowOriginal((s) => !s)}
          aria-expanded={showOriginal}
        >
          {showOriginal ? 'Hide extracted source text' : 'View extracted source text'}
        </button>
        {showOriginal && (
          <div className="original-card__body">
            <p className="original-card__hint">
              {isBill
                ? 'Raw OCR / extracted text from the bill. The smart summary above is generated separately.'
                : 'This is the raw text pulled from the file. The review above is rewritten separately.'}
            </p>
            <CopyButton text={originalText} label="Copy full text" />
            <pre className="original-card__text">{originalText}</pre>
          </div>
        )}
      </section>
    </div>
  );
}
