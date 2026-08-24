require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const documentRoutes = require('./routes/documentRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check (useful for Render/Heroku health probes)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    summarizer: process.env.GROQ_API_KEY ? 'groq' : 'textrank',
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
});
