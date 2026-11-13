import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// After the build: write the list of output files into dist/sw.js so the app works offline,
// and version the cache by a hash of those files (a new deploy = a new cache = an update toast).
function precacheServiceWorker() {
  let outDir = 'dist';
  let bundle = null;
  return {
    name: 'pinkas-precache-sw',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    writeBundle(_, b) {
      bundle = b;
    },
    // after everything (including public/) is written
    closeBundle() {
      if (!bundle) return;
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const extra = ['manifest.webmanifest', 'img/guilloche.svg', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];
      const list = ['./', ...[...files, ...extra].map((f) => `./${f}`)];
      const hash = createHash('sha256');
      for (const f of files) {
        const item = bundle[f];
        hash.update(item.type === 'chunk' ? item.code : item.source);
      }
      const swPath = resolve(outDir, 'sw.js');
      const sw = readFileSync(swPath, 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 10))
        .replace('__PRECACHE__', JSON.stringify(list, null, 2));
      writeFileSync(swPath, sw);
    },
  };
}

export default defineConfig({
  base: './', // works on GitHub Pages under /pinkas/ and on any other host
  plugins: [react(), precacheServiceWorker()],
  css: {
    preprocessorOptions: { scss: { api: 'modern-compiler' } },
  },
  server: { port: 5178, strictPort: true },
  preview: { port: 5178, strictPort: true },
  test: {
    environment: 'jsdom',
    include: ['tests/ui/**/*.test.jsx'],
    setupFiles: ['tests/ui/setup.js'],
    css: false,
  },
});
