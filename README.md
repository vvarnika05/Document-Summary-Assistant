# Document Summary Assistant

Upload a **document** or a **bill/receipt**, extract the text (PDF parse or
Tesseract OCR), and get a structured summary — written reviews for docs, smart
totals / due dates / action items for bills.

**Live demo:** https://beamish-platypus-38a209.netlify.app

**Stack:** Node.js/Express · React (Vite) · `pdfjs-dist` · `tesseract.js` ·
[Groq](https://console.groq.com) free-tier LLM (with offline fallbacks)

```
document-summary-assistant/
├── backend/     Express API — upload, text extraction, summarization
├── frontend/    React + Vite single-page app
├── netlify.toml Frontend deploy config (monorepo-aware)
└── WRITEUP.md   ≤200-word approach summary (submission deliverable)
```

## Submission deliverables

| # | Deliverable | Where |
|---|---|---|
| 1 | Working application URL | Deploy frontend (Netlify/Vercel) + backend (Render/Heroku) |
| 2 | GitHub repository + README | This repo |
| 3 | Approach write-up (≤200 words) | [`WRITEUP.md`](./WRITEUP.md) |

## How it works

1. **Choose type** — Document (reports, letters) or Bill / receipt.
2. **Upload** — PDF, PNG, JPG, WEBP (≤15MB). Photos/scans recommended for bills.
3. **Extraction**
   - PDFs: `pdfjs-dist` text layer.
   - Images: Tesseract OCR (`tesseract.js`). Bill mode uses a single-column
     page segmentation setting and keeps line breaks so totals/dates parse better.
4. **Summarization**
   - **Document:** Groq writes an abstractive review (overview, detail, takeaways).
     Length = short / medium / long. TextRank fallback if no API key.
   - **Bill:** Groq extracts vendor, total, dates, invoice #, category, line items
     and writes a smart summary + action items. Heuristic OCR parsing as fallback.
5. **Display** — structured review or bill facts panel; collapsible source text.

## Running locally

Requires Node.js 18+.

### 1. Free Groq API key
1. [console.groq.com/keys](https://console.groq.com/keys) → create key  
2. Put it in `backend/.env` as `GROQ_API_KEY=gsk_...`

### 2. Backend
```bash
cd backend
cp .env.example .env   # set GROQ_API_KEY
npm install
npm run dev            # http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

### Test data
Public-domain PDFs (e.g. [Project Gutenberg](https://www.gutenberg.org/)),
open government PDFs, and your own photographed receipts for bill OCR.

## API reference

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/api/health` | — | Health check |
| POST | `/api/documents/process` | `file`, `length`, `docType` | Extract + summarize |
| POST | `/api/documents/resummarize` | `{ text, length, docType }` | Re-summarize |

`docType`: `document` \| `bill` · `length`: `short` \| `medium` \| `long`

## Deployment

Deploy the backend first so you have its URL for the frontend env var.

### Backend → Render
1. Push this repo to GitHub.
2. On [render.com](https://render.com): **New → Web Service**, connect the repo.
3. Root directory: `backend`
4. Build: `npm install` · Start: `npm start`
5. Env vars: `GROQ_API_KEY`, `CORS_ORIGIN` (frontend URL or `*`)
6. Deploy.

### Frontend → Netlify
1. Import the repo on Netlify (`netlify.toml` sets `frontend` as the base).
2. Env var `VITE_API_URL` = `https://<your-backend-url>/api`
3. Deploy — this URL is deliverable #1.

Then set the backend `CORS_ORIGIN` to the exact frontend URL.

## Known limitations

- OCR quality depends on lighting and resolution.
- Image-only PDFs need a photo/PNG/JPG upload for OCR.
- Groq free-tier rate limits; offline fallbacks still return a usable summary.
