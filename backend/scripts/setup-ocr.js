/**
 * Downloads the English Tesseract OCR language model into ./tessdata so
 * that OCR runs fully offline at request time (no CDN calls, no API keys).
 * Run automatically via `npm install` (see postinstall in package.json),
 * or manually with `npm run setup-ocr`.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const TESSDATA_DIR = path.join(__dirname, '..', 'tessdata');
const DEST_FILE = path.join(TESSDATA_DIR, 'eng.traineddata.gz');
const SOURCE_URL = 'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_best/eng.traineddata.gz';

function download(url, dest, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest, redirectsLeft - 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`Download failed with status ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

(async () => {
  if (fs.existsSync(DEST_FILE) && fs.statSync(DEST_FILE).size > 1_000_000) {
    console.log('[setup-ocr] eng.traineddata.gz already present, skipping download.');
    return;
  }

  fs.mkdirSync(TESSDATA_DIR, { recursive: true });
  console.log('[setup-ocr] Downloading English OCR language model (~12MB)...');
  try {
    await download(SOURCE_URL, DEST_FILE);
    console.log('[setup-ocr] Done. Saved to', DEST_FILE);
  } catch (err) {
    console.warn('[setup-ocr] Could not pre-download OCR language data:', err.message);
    console.warn('[setup-ocr] tesseract.js will fall back to fetching it from a CDN on first OCR request.');
  }
})();
