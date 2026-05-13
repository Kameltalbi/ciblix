import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function injectServiceWorkerVersion(): Plugin {
  return {
    name: 'inject-service-worker-version',
    apply: 'build',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist/service-worker.js');
      if (!fs.existsSync(swPath)) return;
      const version = `${Date.now()}`;
      const original = fs.readFileSync(swPath, 'utf-8');
      const replaced = original.replace(/__BUILD_VERSION__/g, version);
      fs.writeFileSync(swPath, replaced);
    },
  };
}

export default defineConfig({
  plugins: [react(), injectServiceWorkerVersion()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('xlsx') || id.includes('exceljs') || id.includes('papaparse')) return 'spreadsheet';
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('pdf-lib')) return 'pdf';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n';
          // Everything else (react, react-dom, react-router, react-query, axios, ...)
          // stays together to avoid cross-chunk circular deps that React triggers easily.
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    // Sans Docker : le front appelle `/api` (voir `src/lib/api.ts`). Vite doit relayer vers le backend local.
    // Surcharge éventuelle : VITE_DEV_PROXY_TARGET=http://127.0.0.1:4000 npm run dev
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
  },
});
