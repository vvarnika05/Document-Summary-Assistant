import React from 'react';

const OPTIONS = [
  {
    id: 'document',
    label: 'Document',
    hint: 'Reports, articles, letters — written review'
  },
  {
    id: 'bill',
    label: 'Bill / receipt',
    hint: 'Invoices & receipts — totals, dates, takeaways'
  }
];

export default function DocTypeSelector({ value, onChange, disabled }) {
  return (
    <fieldset className="doc-type-selector" disabled={disabled}>
      <legend className="doc-type-selector__legend">What are you uploading?</legend>
      <div className="doc-type-selector__options">
        {OPTIONS.map((opt) => (
          <label
            key={opt.id}
            className={`doc-type-option${value === opt.id ? ' doc-type-option--selected' : ''}`}
          >
            <input
              type="radio"
              name="doc-type"
              value={opt.id}
              checked={value === opt.id}
              onChange={() => onChange(opt.id)}
              disabled={disabled}
            />
            <span className="doc-type-option__label">{opt.label}</span>
            <span className="doc-type-option__hint">{opt.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
