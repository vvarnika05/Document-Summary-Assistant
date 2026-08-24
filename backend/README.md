# Backend — Document Summary Assistant API

Express API that accepts a PDF or image (document or bill), extracts text via
pdfjs / Tesseract OCR, and returns a written review or smart bill summary.
See the [root README](../README.md) for full setup and deployment.

## Structure
```
src/
├── server.js               Express app entry point
├── routes/documentRoutes.js    /api/documents/* endpoints
├── services/summarize.js       Orchestrates document / bill summarization
├── services/groqSummarize.js   Free-tier Groq abstractive document review
├── services/billSummarize.js   Smart bill summary (Groq + OCR heuristics)
├── services/extractText.js     PDF (pdfjs-dist) + OCR (tesseract.js)
└── middleware/
    ├── upload.js            Multer config (type/size validation)
    └── errorHandler.js      Centralized error responses
scripts/setup-ocr.js         Pre-downloads the OCR language model (postinstall)
```

## Quick start
```bash
cp .env.example .env   # set GROQ_API_KEY for AI-written reviews
npm install            # also downloads tessdata/eng.traineddata.gz (~12MB)
npm run dev
```

## Environment variables
See `.env.example`:
- `PORT` (default `5000`)
- `CORS_ORIGIN` (default `*`)
- `GROQ_API_KEY` — free key from https://console.groq.com/keys
- `GROQ_MODEL` (optional)
