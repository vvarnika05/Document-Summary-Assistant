import React, { useCallback, useRef, useState } from 'react';
import DocTypeSelector from './components/DocTypeSelector.jsx';
import FileUpload from './components/FileUpload.jsx';
import LengthSelector from './components/LengthSelector.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import SummaryView from './components/SummaryView.jsx';
import { processDocument, resummarize } from './api.js';

const STAGE_MESSAGES = {
  uploading: 'Uploading document…',
  extracting: 'Reading document contents…',
  extractingBill: 'Running OCR on bill…',
  summarizing: 'Generating summary…',
  summarizingBill: 'Building smart bill summary…'
};

export default function App() {
  const [docType, setDocType] = useState('document');
  const [file, setFile] = useState(null);
  const [length, setLength] = useState('medium');
  const [status, setStatus] = useState('idle'); // idle | working | done | error
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const abortRef = useRef(null);

  const handleDocTypeChange = useCallback((next) => {
    setDocType(next);
    setFile(null);
    setResult(null);
    setError('');
    setStatus('idle');
  }, []);

  const handleFileSelected = useCallback((selected) => {
    setFile(selected);
    setError('');
    setResult(null);
    setStatus('idle');
  }, []);

  const runProcess = useCallback(async (selectedFile, selectedLength, selectedDocType) => {
    setStatus('working');
    setError('');
    setStage(STAGE_MESSAGES.uploading);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const stageTimer = setTimeout(
        () => setStage(
          selectedDocType === 'bill'
            ? STAGE_MESSAGES.extractingBill
            : STAGE_MESSAGES.extracting
        ),
        400
      );
      const stageTimer2 = setTimeout(
        () => setStage(
          selectedDocType === 'bill'
            ? STAGE_MESSAGES.summarizingBill
            : STAGE_MESSAGES.summarizing
        ),
        1400
      );

      const data = await processDocument(
        selectedFile,
        selectedLength,
        selectedDocType,
        { signal: controller.signal }
      );

      clearTimeout(stageTimer);
      clearTimeout(stageTimer2);
      setResult(data);
      setStatus('done');
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  }, []);

  const handleGenerate = useCallback(() => {
    if (!file) {
      setError('Choose a file first.');
      setStatus('error');
      return;
    }
    runProcess(file, length, docType);
  }, [file, length, docType, runProcess]);

  const handleLengthChange = useCallback(async (newLength) => {
    setLength(newLength);
    if (result?.originalText && result?.docType !== 'bill') {
      setStatus('working');
      setStage(STAGE_MESSAGES.summarizing);
      try {
        const data = await resummarize(result.originalText, newLength, result.docType || 'document');
        setResult((prev) => ({ ...prev, ...data }));
        setStatus('done');
      } catch (err) {
        setError(err.message || 'Could not regenerate the summary.');
        setStatus('error');
      }
    }
  }, [result]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setFile(null);
    setResult(null);
    setError('');
    setStatus('idle');
  }, []);

  const isWorking = status === 'working';
  const isBill = docType === 'bill';

  return (
    <div className="page">
      <header className="masthead">
        <h1 className="masthead__title">Document Summary Assistant</h1>
        <p className="masthead__subtitle">
          Choose a document or a bill, upload a PDF or scan, and get a structured summary —
          written reviews for docs, smart totals and due dates for bills.
        </p>
      </header>

      <main className="card">
        {!result && (
          <>
            <DocTypeSelector
              value={docType}
              onChange={handleDocTypeChange}
              disabled={isWorking}
            />

            <FileUpload
              onFileSelected={handleFileSelected}
              disabled={isWorking}
              variant={docType}
            />

            {file && (
              <div className="selected-file">
                <span className="selected-file__name">{file.name}</span>
                <span className="selected-file__size">{(file.size / 1024).toFixed(0)} KB</span>
                <button type="button" className="link-btn" onClick={handleReset} disabled={isWorking}>
                  Remove
                </button>
              </div>
            )}

            {!isBill && (
              <LengthSelector value={length} onChange={setLength} disabled={isWorking} />
            )}

            {error && status === 'error' && (
              <p className="field-error" role="alert">{error}</p>
            )}

            <button
              type="button"
              className="primary-btn"
              onClick={handleGenerate}
              disabled={!file || isWorking}
            >
              {isWorking
                ? 'Working…'
                : isBill
                  ? 'Generate bill summary'
                  : 'Generate summary'}
            </button>

            {isWorking && <LoadingSpinner stage={stage} />}
          </>
        )}

        {result && (
          <>
            <div className="results-toolbar">
              {result.docType !== 'bill' && (
                <LengthSelector value={length} onChange={handleLengthChange} disabled={isWorking} />
              )}
              <button type="button" className="link-btn" onClick={handleReset}>
                Start over with a new {result.docType === 'bill' ? 'bill' : 'document'}
              </button>
            </div>

            {isWorking && <LoadingSpinner stage={stage} />}
            {error && status === 'error' && (
              <p className="field-error" role="alert">{error}</p>
            )}
            {!isWorking && <SummaryView result={result} />}
          </>
        )}
      </main>


    </div>
  );
}
