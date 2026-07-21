// foundation — メタ層（クローム）。
// 見た目 HTML には関知しない。FAB＋backdrop＋右ドロワー＋ホバー補助線を body に生成し、
// クリック→下書き、テキストが入って初めてコメント確定、POST /comments を担う。
// ルートは document.body。クローム自身への操作は除外する。

const SAVE_DEBOUNCE_MS = 400;
const CHROME_SEL = '#meta, .vl-fab, .vl-backdrop, .vl-hover, .vl-marker';

function isChrome(el) {
  return Boolean(el && el.closest && el.closest(CHROME_SEL));
}

function hasText(c) {
  return Boolean(c && String(c.text || '').trim());
}

// 要素の安定キー。data-aid 優先、無ければ生成セレクタ（fallback・やや脆い）。
function aidFor(el, root) {
  if (el.dataset && el.dataset.aid) return el.dataset.aid;
  return cssSelector(el, root);
}

function cssSelector(el, root) {
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && node !== root) {
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

function findByAid(aid, root) {
  const matches = root.querySelectorAll('[data-aid="' + cssEscape(aid) + '"]');
  for (const el of matches) {
    if (!isChrome(el)) return el;
  }
  if (!/[\s>#:.]/.test(aid)) return null;
  try {
    const el = root.querySelector(aid);
    if (el && !isChrome(el)) return el;
    return null;
  } catch {
    return null;
  }
}

const VOID_TAGS = new Set([
  'img',
  'input',
  'br',
  'hr',
  'meta',
  'link',
  'area',
  'base',
  'col',
  'embed',
  'source',
  'track',
  'wbr',
]);

function canHostMarker(el) {
  return el && el.nodeType === 1 && !VOID_TAGS.has(el.tagName.toLowerCase());
}

function cssEscape(s) {
  return String(s).replace(/["\\]/g, '\\$&');
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

export function initAnnotate({ root, comments }) {
  // 確定コメントのみ（テキストあり）。空は載せない。
  const state = new Map();
  for (const c of comments) {
    if (!hasText(c)) continue;
    state.set(c.aid, { aid: c.aid, selector: c.selector || '', text: c.text || '' });
  }

  // クリック直後の下書き。テキストが付くまで state / comments.json に入れない。
  let draft = null;

  const backdrop = createBackdrop();
  const fab = createFab();
  const meta = createPanel();
  const hover = createHoverOverlay();
  document.body.append(backdrop, fab, meta, hover);

  renderRows();
  renderMarkers();
  updateFabCount();

  root.addEventListener('click', (e) => {
    if (e.target === root) return;
    if (isChrome(e.target)) return;
    e.preventDefault();
    const el = e.target;
    const aid = aidFor(el, root);
    const selector = cssSelector(el, root);

    discardEmptyDraft();

    if (state.has(aid)) {
      draft = null;
      openPanel();
      renderRows();
      focusRow(aid);
      return;
    }

    draft = { aid, selector, text: '' };
    openPanel();
    renderRows();
    renderMarkers();
    updateFabCount();
    focusRow(aid);
  });

  let currentHover = null;
  root.addEventListener('mouseover', (e) => {
    if (e.target === root || isChrome(e.target)) {
      hideHover();
      return;
    }
    currentHover = e.target;
    showHover(e.target);
  });
  root.addEventListener('mouseleave', hideHover);
  window.addEventListener(
    'scroll',
    () => {
      if (currentHover) showHover(currentHover);
    },
    true,
  );

  function showHover(el) {
    if (isChrome(el)) {
      hideHover();
      return;
    }
    const r = el.getBoundingClientRect();
    hover.style.display = 'block';
    hover.style.left = r.left + window.scrollX + 'px';
    hover.style.top = r.top + window.scrollY + 'px';
    hover.style.width = r.width + 'px';
    hover.style.height = r.height + 'px';
    const label = hover.querySelector('.vl-hover-label');
    if (label) label.textContent = aidFor(el, root);
  }
  function hideHover() {
    hover.style.display = 'none';
    currentHover = null;
  }

  function createBackdrop() {
    const el = document.createElement('div');
    el.className = 'vl-backdrop';
    el.setAttribute('aria-hidden', 'true');
    el.addEventListener('click', () => closePanel());
    return el;
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
    if (meta.classList.contains('vl-open')) closePanel();
    else openPanel();
  }

  function openPanel() {
    meta.classList.add('vl-open');
    backdrop.classList.add('vl-open');
    fab.dataset.open = 'true';
    backdrop.setAttribute('aria-hidden', 'false');
  }

  function closePanel() {
    discardEmptyDraft();
    pruneEmptyFromState();
    meta.classList.remove('vl-open');
    backdrop.classList.remove('vl-open');
    fab.dataset.open = 'false';
    backdrop.setAttribute('aria-hidden', 'true');
    renderRows();
    renderMarkers();
    updateFabCount();
    saveSoon();
  }

  function discardEmptyDraft() {
    if (draft && !hasText(draft)) draft = null;
  }

  function pruneEmptyFromState() {
    for (const [aid, c] of state.entries()) {
      if (!hasText(c)) state.delete(aid);
    }
  }

  /** 下書きに文字が入ったら state へ昇格。空に戻したら state から外す。行 DOM は壊さない。 */
  function syncDraftOrState(aid, selector, text, rowEl) {
    const entry = { aid, selector, text };
    const wasCommitted = state.has(aid) && hasText(state.get(aid));
    const nowCommitted = hasText(entry);

    if (nowCommitted) {
      state.set(aid, entry);
      if (draft && draft.aid === aid) draft = null;
    } else {
      state.delete(aid);
      draft = { aid, selector, text: '' };
    }

    if (rowEl) {
      rowEl.classList.toggle('vl-row-draft', !nowCommitted);
      const label = rowEl.querySelector('.vl-aid');
      if (label) label.textContent = nowCommitted ? aid : aid + ' (draft)';
    }

    if (wasCommitted !== nowCommitted) {
      renderMarkers();
      updateFabCount();
    }
    saveSoon();
  }

  function focusRow(aid) {
    const row = meta.querySelector('.vl-row[data-aid="' + cssEscape(aid) + '"]');
    if (row) {
      const ta = row.querySelector('textarea');
      if (ta) ta.focus();
    }
  }

  function committedList() {
    return Array.from(state.values()).filter(hasText);
  }

  function renderRows() {
    const list = meta.querySelector('.vl-list');
    list.innerHTML = '';
    const committed = committedList();
    const showDraft = draft && !state.has(draft.aid);

    if (committed.length === 0 && !showDraft) {
      const empty = document.createElement('div');
      empty.className = 'vl-empty';
      empty.textContent =
        '要素をクリックして下書きを開き、文字を入れるとコメントになります。空のまま閉じると付きません。';
      list.append(empty);
      return;
    }

    if (showDraft) list.append(buildRow(draft, true));
    for (const c of committed) list.append(buildRow(c, false));
  }

  function buildRow(c, isDraft) {
    const row = document.createElement('div');
    row.className = 'vl-row' + (isDraft ? ' vl-row-draft' : '');
    row.dataset.aid = c.aid;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'vl-del';
    del.title = 'delete';
    del.textContent = '×';
    del.addEventListener('click', () => {
      if (draft && draft.aid === c.aid) draft = null;
      state.delete(c.aid);
      renderRows();
      renderMarkers();
      updateFabCount();
      saveSoon();
    });
    row.append(del);

    const label = document.createElement('div');
    label.className = 'vl-aid';
    label.textContent = isDraft ? c.aid + ' (draft)' : c.aid;
    row.append(label);

    const ta = document.createElement('textarea');
    ta.className = 'vl-text';
    ta.value = c.text || '';
    ta.placeholder = isDraft
      ? 'コメントを書く…（空のまま閉じると付きません）'
      : 'comment…  (⌘/Ctrl + Enter で保存して閉じる)';
    ta.addEventListener('input', () => {
      syncDraftOrState(c.aid, c.selector, ta.value, row);
    });
    ta.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        syncDraftOrState(c.aid, c.selector, ta.value, row);
        if (hasText({ text: ta.value })) closePanel();
      }
    });
    row.append(ta);

    return row;
  }

  function renderMarkers() {
    for (const m of root.querySelectorAll('.vl-marker')) m.remove();
    for (const el of root.querySelectorAll('.vl-anchored, .vl-anchored-void')) {
      if (isChrome(el)) continue;
      el.classList.remove('vl-anchored', 'vl-anchored-void');
    }

    for (const c of committedList()) {
      const el = findByAid(c.aid, root);
      if (!el) continue;
      const pos = getComputedStyle(el).position;
      if (pos === 'static') el.classList.add('vl-anchored');
      if (!canHostMarker(el)) {
        el.classList.add('vl-anchored-void');
        continue;
      }
      const marker = document.createElement('span');
      marker.className = 'vl-marker';
      marker.title = c.aid;
      el.append(marker);
    }
  }

  function updateFabCount() {
    const count = fab.querySelector('.vl-fab-count');
    if (count) count.textContent = String(committedList().length);
  }

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
    pruneEmptyFromState();
    const payload = JSON.stringify(committedList());
    try {
      await fetch('/comments', { method: 'POST', body: payload });
    } catch {
      // dev server が落ちている場合は黙って無視。
    }
  }
}
