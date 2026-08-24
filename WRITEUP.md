# Approach

I built a Node/Express API and a React (Vite) frontend. Users pick **Document**
or **Bill** first. PDFs use `pdfjs-dist`; scans and receipts use `tesseract.js`
OCR (English model pre-downloaded at install; bill mode uses a receipt-friendly
page-seg setting and keeps line breaks for amounts/dates).

Summarization uses Groq’s free-tier LLM: documents get an abstractive review
(title, overview, paragraphs, takeaways); bills get a smart structured summary
(vendor, total, dates, invoice #, line items, action items). If Groq is
unavailable, documents fall back to TextRank and bills to heuristic field
parsing from OCR text.

The UI has staged loading, inline errors, and length control for documents.
Tested with public PDFs and sample bill images. Deploys as Netlify/Vercel
frontend + Render/Heroku backend.
