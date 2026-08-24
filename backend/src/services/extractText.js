const path = require('path');
const Tesseract = require('tesseract.js');

const fs = require('fs');
const TESSDATA_PATH = path.join(__dirname, '..', '..', 'tessdata');
const HAS_LOCAL_TESSDATA = fs.existsSync(path.join(TESSDATA_PATH, 'eng.traineddata.gz'));

// Reuse a single OCR worker across requests instead of spinning one up per
// file — startup (loading the language model) is the slowest part of OCR.
let workerPromise = null;
function getWorker() {
  if (!workerPromise) {
    const options = HAS_LOCAL_TESSDATA
      ? { langPath: TESSDATA_PATH, cachePath: TESSDATA_PATH, gzip: true, logger: () => {} }
      : { logger: () => {} };
    workerPromise = Tesseract.createWorker('eng', 1, options);
  }
  return workerPromise;
}

const STANDARD_FONT_DATA_URL = path.join(
  path.dirname(require.resolve('pdfjs-dist/package.json')),
  'standard_fonts'
) + path.sep;

/**
 * Extracts text from a PDF buffer using pdfjs-dist.
 */
async function extractFromPDF(buffer) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    useSystemFonts: true
  });

  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    throw Object.assign(
      new Error('This PDF could not be read. It may be corrupted, password-protected, or in an unsupported format.'),
      { status: 422, expose: true, cause: err }
    );
  }

  const pageTexts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    pageTexts.push(pageText);
  }

  const text = pageTexts.join('\n\n').replace(/[ \t]+/g, ' ').trim();

  if (!text) {
    throw Object.assign(
      new Error('No extractable text found in this PDF. It may be a scanned/image-only PDF — try uploading a photo or scan (PNG/JPG) so OCR can run.'),
      { status: 422, expose: true }
    );
  }

  return {
    text,
    pageCount: doc.numPages,
    method: 'pdfjs-dist'
  };
}

/**
 * Extracts text from an image buffer using Tesseract OCR.
 * Bill mode uses a single-column page-seg mode that works better on receipts.
 */
async function extractFromImage(buffer, { billMode = false } = {}) {
  const worker = await getWorker();

  // PSM 4 = assume a single column of text (receipts / utility bills).
  // PSM 3 = fully automatic (default for general documents).
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: billMode ? '4' : '3',
      preserve_interword_spaces: '1'
    });
  } catch {
    // Older/newer tesseract.js builds may ignore unknown params — continue.
  }

  const { data } = await worker.recognize(buffer);

  // Keep line breaks — important for bill field heuristics (total on its own line).
  const text = billMode
    ? (data.text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    : (data.text || '').trim();

  if (!text) {
    throw Object.assign(
      new Error('OCR could not detect any text in this image. Try a higher-resolution, well-lit scan.'),
      { status: 422, expose: true }
    );
  }

  return {
    text,
    confidence: data.confidence,
    method: 'tesseract-ocr'
  };
}

/**
 * @param {Express.Multer.File} file
 * @param {{ docType?: 'document'|'bill' }} [options]
 */
async function extractText(file, { docType = 'document' } = {}) {
  const billMode = docType === 'bill';

  if (file.mimetype === 'application/pdf') {
    return extractFromPDF(file.buffer);
  }
  return extractFromImage(file.buffer, { billMode });
}

module.exports = { extractText, extractFromPDF, extractFromImage };
