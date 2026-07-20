// foundation — 殺壳ローダ（統合版）。
// 中身は index.html の #board に直書きなので注入は不要。コメントを取得して annotate(メタ層)を起動する。
// データ(comments.json)・クローム(annotate.js/style.css)は別ファイル。
import './style.css';
import { initAnnotate } from './annotate.js';

const board = document.getElementById('board');
if (!board) throw new Error('foundation: #board が見つかりません');

init();
async function init() {
  const comments = await loadComments();
  initAnnotate({ board, comments });
}

async function loadComments() {
  try {
    const res = await fetch('/comments');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
