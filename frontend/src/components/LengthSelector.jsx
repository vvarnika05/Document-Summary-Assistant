import React from 'react';

const OPTIONS = [
  { value: 'short', label: 'Short', hint: 'Key sentences only' },
  { value: 'medium', label: 'Medium', hint: 'Balanced overview' },
  { value: 'long', label: 'Long', hint: 'Detailed digest' }
];

export default function LengthSelector({ value, onChange, disabled }) {
  return (
    <fieldset className="length-selector" disabled={disabled}>
      <legend className="length-selector__legend">Summary length</legend>
      <div className="length-selector__options">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`length-option${value === opt.value ? ' length-option--active' : ''}`}
          >
            <input
              type="radio"
              name="summary-length"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span className="length-option__label">{opt.label}</span>
            <span className="length-option__hint">{opt.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
