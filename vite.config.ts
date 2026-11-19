import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { createMusicStreamMiddleware } from './src/server/middleware/musicStream';

function musicRangePlugin(): Plugin {
  const handler = createMusicStreamMiddleware();
  return {
    name: 'dreamerize-music-range-stream',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), musicRangePlugin()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@client': path.resolve(__dirname, './src/client')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist/client'
  }
});
