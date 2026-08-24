const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function parseJSONSafe(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text || 'Unexpected server response.' };
  }
}

/**
 * Uploads a document and returns extracted text + generated summary.
 * @param {'document'|'bill'} [docType]
 */
export async function processDocument(file, length, docType = 'document', { signal } = {}) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('length', length);
  formData.append('docType', docType);

  let response;
  try {
    response = await fetch(`${API_BASE}/documents/process`, {
      method: 'POST',
      body: formData,
      signal
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  const data = await parseJSONSafe(response);
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }
  return data;
}

/**
 * Regenerates a summary at a new length from already-extracted text.
 */
export async function resummarize(text, length, docType = 'document', { signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}/documents/resummarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, length, docType }),
      signal
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  const data = await parseJSONSafe(response);
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }
  return data;
}
