const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { extractText } = require('../services/extractText');
const { summarize } = require('../services/summarize');

function normalizeDocType(value) {
  return value === 'bill' ? 'bill' : 'document';
}

function normalizeLength(value) {
  return ['short', 'medium', 'long'].includes(value) ? value : 'medium';
}

/**
 * POST /api/documents/process
 * multipart/form-data: file, length, docType ('document' | 'bill')
 */
router.post('/process', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      const err = new Error('No file uploaded. Please attach a PDF or image file.');
      err.status = 400;
      err.expose = true;
      throw err;
    }

    const length = normalizeLength(req.body.length);
    const docType = normalizeDocType(req.body.docType);

    const extraction = await extractText(req.file, { docType });
    const result = await summarize(extraction.text, length, docType);

    res.json({
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      docType,
      extractionMethod: extraction.method,
      pageCount: extraction.pageCount || null,
      ocrConfidence: extraction.confidence || null,
      originalText: extraction.text,
      wordCount: extraction.text.split(/\s+/).filter(Boolean).length,
      length,
      title: result.title,
      overview: result.overview,
      paragraphs: result.paragraphs,
      summary: result.summary,
      keyPoints: result.keyPoints,
      bill: result.bill || null,
      sentenceCount: result.sentenceCount,
      originalSentenceCount: result.originalSentenceCount,
      summaryMethod: result.method
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/documents/resummarize
 * JSON body: { text, length, docType }
 */
router.post('/resummarize', express.json(), async (req, res, next) => {
  try {
    const { text, length, docType } = req.body;
    if (!text || typeof text !== 'string') {
      const err = new Error('Missing "text" in request body.');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    const validLength = normalizeLength(length);
    const validDocType = normalizeDocType(docType);
    const result = await summarize(text, validLength, validDocType);
    res.json({
      length: validLength,
      docType: validDocType,
      title: result.title,
      overview: result.overview,
      paragraphs: result.paragraphs,
      summary: result.summary,
      keyPoints: result.keyPoints,
      bill: result.bill || null,
      sentenceCount: result.sentenceCount,
      originalSentenceCount: result.originalSentenceCount,
      summaryMethod: result.method
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
