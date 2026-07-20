// foundation — メタ層（クローム）。
// #board の中身には関知しない。浮遊ボタン(FAB)＋右ドロワーパネル＋ホバー補助線を生成し、
// クリック→コメント、マーカ表示、編集時の POST /comments 保存を担う。
// スタイルは style.css に任せる（Tailwind非依存）。クロームは製品と影/浮遊で区別する。

const SAVE_DEBOUNCE_MS = 400;

// 要素の安定キー。data-aid 優先、無ければ生成セレクタ（fallback・やや脆い）。
function aidFor(el, board) {
  if (el.dataset && el.dataset.aid) return el.dataset.aid;
  return cssSelector(el, board);
}

// 生成CSSセレクタ（data-aid 無し時の fallback）。nth-of-type 鎖で一意化。
function cssSelector(el, board) {
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && node !== board) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      parts.unshift('#' + node.id);
      break;
    }
    const parent = node.parentElement;
    if (parent) {
      const sibs = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
      if (sibs.length > 1) part += ':nth-of-type(' + (sibs.indexOf(node) + 1) + ')';
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(' > ');
}

function findByAid(aid, board) {
  const byData = board.querySelector('[data-aid="' + cssEscape(aid) + '"]');
  if (byData) return byData;
  try {
    return board.querySelector(aid);
  } catch {
    return null;
  }
}

function cssEscape(s) {
  return String(s).replace(/["\\]/g, '\\$&');
}

// 公開API。main.js から呼ばれる。
export function initAnnotate({ board, comments }) {
  // 状態: aid -> { aid, selector, text }
  const state = new Map();
  for (const c of comments) {
    state.set(c.aid, { aid: c.aid, selector: c.selector || '', text: c.text || '' });
  }

  // クロームDOMを生成（殺壳index.htmlには置かない）。
  const fab = createFab();
  const meta = createPanel();
  const hover = createHoverOverlay();
  document.body.append(fab, meta, hover);

  renderRows();
  renderMarkers();
  updateFabCount();

  // クリックで対象要素を特定し、コメント行を用意してパネルを開く。
  // 見本の <a href="#"> 等のデフォルト遷移を止める（アノテーションが主用途のため）。
  board.addEventListener('click', (e) => {
    if (e.target === board) return;
    if (e.target.closest('.vl-marker')) return;
    e.preventDefault();
    const el = e.target;
    const aid = aidFor(el, board);
    if (!state.has(aid)) state.set(aid, { aid, selector: cssSelector(el, board), text: '' });
    renderRows();
    renderMarkers();
    updateFabCount();
    openPanel();
    focusRow(aid);
  });

  // ホバー補助線（dev tool風）。要素に入った瞬間に矩形とaidを表示。
  let currentHover = null;
  board.addEventListener('mouseover', (e) => {
    if (e.target === board) {
      hideHover();
      return;
    }
    currentHover = e.target;
    showHover(e.target);
  });
  board.addEventListener('mouseleave', hideHover);
  window.addEventListener(
    'scroll',
    () => {
      if (currentHover) showHover(currentHover);
    },
    true,
  );

  function showHover(el) {
    const r = el.getBoundingClientRect();
    hover.style.display = 'block';
    hover.style.left = r.left + window.scrollX + 'px';
    hover.style.top = r.top + window.scrollY + 'px';
    hover.style.width = r.width + 'px';
    hover.style.height = r.height + 'px';
    const label = hover.querySelector('.vl-hover-label');
    if (label) label.textContent = aidFor(el, board);
  }
  function hideHover() {
    hover.style.display = 'none';
    currentHover = null;
  }

  function createHoverOverlay() {
    const box = document.createElement('div');
    box.className = 'vl-hover';
    box.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'vl-hover-label';
    box.append(label);
    return box;
  }

  function createFab() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vl-fab';
    btn.title = 'Comments';
    btn.setAttribute('aria-label', 'Comments');
    btn.textContent = '💬';
    const count = document.createElement('span');
    count.className = 'vl-fab-count';
    count.textContent = '0';
    btn.append(count);
    btn.addEventListener('click', () => togglePanel());
    return btn;
  }

  function createPanel() {
    const aside = document.createElement('aside');
    aside.id = 'meta';
    aside.setAttribute('aria-label', 'Comments');
    const h = document.createElement('div');
    h.className = 'vl-h';
    const title = document.createElement('span');
    title.textContent = 'Comments';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'vl-close';
    close.title = 'close';
    close.setAttribute('aria-label', 'Close comments');
    close.textContent = '×';
    close.addEventListener('click', () => closePanel());
    h.append(title, close);
    aside.append(h);
    const list = document.createElement('div');
    list.className = 'vl-list';
    aside.append(list);
    return aside;
  }

  function togglePanel() {
    meta.classList.toggle('vl-open');
    fab.dataset.open = meta.classList.contains('vl-open') ? 'true' : 'false';
  }
  function openPanel() {
    meta.classList.add('vl-open');
    fab.dataset.open = 'true';
  }
  function closePanel() {
    meta.classList.remove('vl-open');
    fab.dataset.open = 'false';
  }

  function focusRow(aid) {
    const row = meta.querySelector('.vl-row[data-aid="' + cssEscape(aid) + '"]');
    if (row) {
      const ta = row.querySelector('textarea');
      if (ta) ta.focus();
    }
  }

  function renderRows() {
    const list = meta.querySelector('.vl-list');
    list.innerHTML = '';
    if (state.size === 0) {
      const empty = document.createElement('div');
      empty.className = 'vl-empty';
      empty.textContent = 'ボード内の要素をクリックするとコメント行が追加されます。';
      list.append(empty);
      return;
    }
    for (const c of state.values()) list.append(buildRow(c));
  }

  function buildRow(c) {
    const row = document.createElement('div');
    row.className = 'vl-row';
    row.dataset.aid = c.aid;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'vl-del';
    del.title = 'delete';
    del.textContent = '×';
    del.addEventListener('click', () => {
      state.delete(c.aid);
      renderRows();
      renderMarkers();
      updateFabCount();
      saveSoon();
    });
    row.append(del);

    const label = document.createElement('div');
    label.className = 'vl-aid';
    label.textContent = c.aid;
    row.append(label);

    const ta = document.createElement('textarea');
    ta.className = 'vl-text';
    ta.value = c.text || '';
    ta.placeholder = 'comment…  (⌘/Ctrl + Enter で保存して閉じる)';
    ta.addEventListener('input', () => {
      c.text = ta.value;
      saveSoon();
    });
    // Cmd/Ctrl + Enter で即保存してドロワーを閉じる。
    ta.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        c.text = ta.value;
        saveNow().then(() => closePanel());
      }
    });
    row.append(ta);

    return row;
  }

  function renderMarkers() {
    const old = board.querySelectorAll('.vl-marker');
    for (const m of old) m.remove();

    for (const c of state.values()) {
      const el = findByAid(c.aid, board);
      if (!el) continue;
      el.classList.add('vl-anchored');
      const marker = document.createElement('span');
      marker.className = 'vl-marker';
      marker.title = c.aid;
      el.append(marker);
    }
  }

  function updateFabCount() {
    const count = fab.querySelector('.vl-fab-count');
    if (count) count.textContent = String(state.size);
  }

  // debounce 保存。状態を JSON にして POST /comments → Vite プラグインが comments.json 書込。
  let timer = null;
  function saveSoon() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(saveNow, SAVE_DEBOUNCE_MS);
  }

  async function saveNow() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const payload = JSON.stringify(Array.from(state.values()));
    try {
      await fetch('/comments', { method: 'POST', body: payload });
    } catch {
      // dev server が落ちている場合は黙って無視（リロードで再送される）。
    }
  }
}
