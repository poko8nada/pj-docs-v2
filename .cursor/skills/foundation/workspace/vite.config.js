import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { commentsPlugin } from './vite-plugin-comments.mjs';

// foundation 作業場用 Vite 設定。
// - Tailwind: @tailwindcss/vite
// - comments: dev（configureServer）のみ
// - build: singlefile（CSS/JS を HTML にインライン）＋ public 画像は外出し
const port = Number(process.env.FOUNDATION_PORT) || 5173;

export default defineConfig(({ command }) => ({
  plugins: [tailwindcss(), ...(command === 'serve' ? [commentsPlugin()] : [viteSingleFile()])],
  base: './',
  server: {
    port,
    strictPort: true,
    host: '127.0.0.1',
    watch: {
      ignored: ['**/comments.json'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
