// Centralized error handler. Keeps error shape consistent for the frontend
// and avoids leaking stack traces in production.
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Multer file-size / file-type errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 15MB.' });
  }
  if (err.message && err.message.startsWith('UNSUPPORTED_FILE_TYPE')) {
    return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF, PNG, or JPG file.' });
  }

  const status = err.status || 500;
  const message = err.expose ? err.message : (status === 500 ? 'Something went wrong while processing your document.' : err.message);

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
