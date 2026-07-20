import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { commentsPlugin } from './vite-plugin-comments.mjs';

// foundation ボード用 Vite 設定。
// - Tailwind は @tailwindcss/vite プラグインで（CDNボルトオンではない）
// - comments プラグインで GET/POST /comments を生やす（dev専用・保存用）
// - comments.json は watch 対象から除外し、POST書き込みでリロード嵐にならないようにする
export default defineConfig({
  plugins: [tailwindcss(), commentsPlugin()],
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    watch: {
      ignored: ['**/comments.json'],
    },
  },
});
