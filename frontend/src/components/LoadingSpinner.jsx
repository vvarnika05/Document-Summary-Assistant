import React from 'react';

export default function LoadingSpinner({ stage }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <div className="loading-block__scanline" aria-hidden="true">
        <div className="loading-block__page">
          <span className="loading-block__line" />
          <span className="loading-block__line" />
          <span className="loading-block__line loading-block__line--short" />
        </div>
      </div>
      <p className="loading-block__text">{stage}</p>
    </div>
  );
}
