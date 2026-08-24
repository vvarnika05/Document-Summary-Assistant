const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function parseJSONSafe(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    const looksLikeHtml = /<!doctype html|<html[\s>]/i.test(text);
    if (looksLikeHtml) {
      return {
        error:
          'The app could not reach the backend API. On Netlify, set VITE_API_URL to your Render URL ending in /api, then trigger a new deploy.'
      };
    }
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
    throw new Error(
      `Could not reach the API at ${API_BASE}. If you are on Netlify, set VITE_API_URL to your Render URL ending in /api and redeploy. If the backend is on Render free tier, wait ~60s for it to wake up and try again.`
    );
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
    throw new Error(
      `Could not reach the API at ${API_BASE}. If you are on Netlify, set VITE_API_URL to your Render URL ending in /api and redeploy. If the backend is on Render free tier, wait ~60s for it to wake up and try again.`
    );
  }

  const data = await parseJSONSafe(response);
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }
  return data;
}
