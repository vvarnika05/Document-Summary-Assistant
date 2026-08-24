import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // During local dev, forward API calls to the Express backend so you
      // don't need CORS config or a full URL in the frontend.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});
