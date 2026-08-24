# Frontend — Document Summary Assistant

React + Vite single-page app. See the [root README](../README.md) for full
setup and deployment instructions.

## Structure
```
src/
├── App.jsx                     Top-level state & flow
├── api.js                      fetch wrapper for the backend API
├── components/
│   ├── DocTypeSelector.jsx      Document vs Bill / receipt
│   ├── FileUpload.jsx           Drag-and-drop / file picker
│   ├── LengthSelector.jsx       Short / medium / long control
│   ├── LoadingSpinner.jsx       Staged loading indicator
│   └── SummaryView.jsx          Review + smart bill summary display
└── styles/index.css             Global styles (mobile-responsive)
```

## Quick start
```bash
npm install
npm run dev      # http://localhost:5173
```

`vite.config.js` proxies `/api` requests to `http://localhost:5000` during
local development, so no environment variable is needed unless you're
pointing at a deployed backend (see `.env.example`).
