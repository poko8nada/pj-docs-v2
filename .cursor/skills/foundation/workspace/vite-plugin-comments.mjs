// foundation — comments.json を fs で読み書きする Vite プラグイン（dev専用）。
// ブラウザは GET/POST /comments でデータを取得・保存する。これでユーザーの編集が fs に永続化される。
// configureServer は dev server でのみ動く = ビルド（vite build）では無効。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // .../workspace
const commentsFile = join(here, 'comments.json');

export function commentsPlugin() {
  return {
    name: 'foundation-comments',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/comments') return next();

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          // ファイル欠落時は空配列を返す（初回起動・削除後の耐性）。
          res.end(existsSync(commentsFile) ? readFileSync(commentsFile, 'utf8') : '[]');
          return;
        }

        if (req.method === 'POST') {
          const body = await readBody(req);
          writeFileSync(commentsFile, body);
          res.statusCode = 204;
          res.end();
          return;
        }

        res.statusCode = 405;
        res.setHeader('Allow', 'GET, POST');
        res.end();
      });
    },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
