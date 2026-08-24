import React, { useCallback, useRef, useState } from 'react';

const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

export default function FileUpload({ onFileSelected, disabled, variant = 'document' }) {
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState('');
  const inputRef = useRef(null);
  const isBill = variant === 'bill';

  const validateAndEmit = useCallback((file) => {
    if (!file) return;
    setLocalError('');

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLocalError('Unsupported file type. Please use a PDF, PNG, or JPG.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setLocalError('File is too large. Maximum size is 15MB.');
      return;
    }
    onFileSelected(file);
  }, [onFileSelected]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    validateAndEmit(file);
  }, [disabled, validateAndEmit]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    validateAndEmit(file);
    e.target.value = ''; // allow re-selecting the same file
  }, [validateAndEmit]);

  return (
    <div className="upload-block">
      <div
        className={`dropzone${isDragging ? ' dropzone--active' : ''}${disabled ? ' dropzone--disabled' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <div className="dropzone__stamp" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="40" height="40" fill="none">
            <path d="M14 4h14l8 8v28a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M28 4v8h8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M17 24h14M17 30h14M17 36h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="dropzone__title">
          {isDragging
            ? 'Drop it in'
            : isBill
              ? 'Drag a bill or receipt here'
              : 'Drag a document here'}
        </p>
        <p className="dropzone__subtitle">
          {isBill
            ? 'Photo or scan works best for OCR — PDF, PNG, JPG, up to 15MB'
            : 'or click to browse — PDF, PNG, JPG, up to 15MB'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleInputChange}
          disabled={disabled}
          hidden
        />
      </div>
      {localError && <p className="field-error" role="alert">{localError}</p>}
    </div>
  );
}
