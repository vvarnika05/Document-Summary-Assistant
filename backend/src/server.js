require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const documentRoutes = require('./routes/documentRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Browsers send Origin without a trailing slash. Normalize so a common
// Render misconfig like "https://site.netlify.app/" still works.
function normalizeOrigin(value) {
  if (!value || value === '*') return value || '*';
  return value.replace(/\/+$/, '');
}

const corsOrigin = normalizeOrigin(process.env.CORS_ORIGIN || '*');

app.use(cors({
  origin: corsOrigin === '*'
    ? '*'
    : (origin, callback) => {
        if (!origin || normalizeOrigin(origin) === corsOrigin) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check (useful for Render/Heroku health probes)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    summarizer: process.env.GROQ_API_KEY ? 'groq' : 'textrank',
    corsOrigin,
    timestamp: new Date().toISOString()
  });
});

// Main API routes
app.use('/api/documents', documentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Centralized error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Document Summary Assistant API running on port ${PORT}`);
  console.log(`CORS origin: ${corsOrigin}`);
});