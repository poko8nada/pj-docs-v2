import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { commentsPlugin } from './vite-plugin-comments.mjs';

// foundation ボード用 Vite 設定。
// - Tailwind は @tailwindcss/vite プラグイン
// - comments プラグインで GET/POST /comments（dev 専用）
// - comments.json は watch 除外（POST 書き込みでリロード嵐を防ぐ）
const port = Number(process.env.FOUNDATION_PORT) || 5173;

export default defineConfig({
  plugins: [tailwindcss(), commentsPlugin()],
  server: {
    port,
    strictPort: true,
    host: '127.0.0.1',
    watch: {
      ignored: ['**/comments.json'],
    },
  },
});
