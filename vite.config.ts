import build from '@hono/vite-build/cloudflare-workers';
import adapter from '@hono/vite-dev-server/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import client from 'honox/vite/client';
import honox from 'honox/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const appDir = fileURLToPath(new URL('./app', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': appDir,
    },
  },
  plugins: [
    honox({
      devServer: { adapter },
      client: { input: ['/app/client.ts', '/app/style.css'] },
    }),
    tailwindcss(),
    build(),
    client(),
  ],
});
