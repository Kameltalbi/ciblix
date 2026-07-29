import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest',
      closeBundle() {
        const dist = resolve(__dirname, 'dist');
        mkdirSync(dist, { recursive: true });
        const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'));
        const isProd = process.env.NODE_ENV === 'production';
        if (isProd) {
          manifest.host_permissions = (manifest.host_permissions as string[]).filter(
            (p) => !p.includes('localhost'),
          );
        }
        writeFileSync(resolve(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
        try {
          copyFileSync(resolve(__dirname, 'public/icons/icon16.png'), resolve(dist, 'icons/icon16.png'));
          copyFileSync(resolve(__dirname, 'public/icons/icon48.png'), resolve(dist, 'icons/icon48.png'));
          copyFileSync(resolve(__dirname, 'public/icons/icon128.png'), resolve(dist, 'icons/icon128.png'));
        } catch {
          // icons optional at dev time
        }
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        'content-linkedin': resolve(__dirname, 'src/content/linkedin/index.ts'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background.js';
          if (chunk.name === 'content-linkedin') return 'content-linkedin.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
