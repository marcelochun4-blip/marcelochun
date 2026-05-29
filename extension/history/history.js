// history.js
// 번역 히스토리 뷰어 (F-15). 필터(F-16), CSV 내보내기(F-17), 삭제(F-18).
// 백엔드 SQLite 에서 데이터를 읽어 표시한다.

const PAGE_SIZE = 50;
let backendUrl = 'http://127.0.0.1:8787';
let offset = 0;
let total = 0;

const $ = (id) => document.getElementById(id);

async function getBackendUrl() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ backendUrl: 'http://127.0.0.1:8787' }, (cfg) => resolve(cfg.backendUrl));
  });
}

function currentFilter() {
  const f = {
    room: $('roomFilter').value,
    direction: $('directionFilter').value,
    q: $('qFilter').value.trim(),
    limit: PAGE_SIZE,
    offset,
  };
  if ($('fromFilter').value) f.from = `${$('fromFilter').value}T00:00:00`;
  if ($('toFilter').value) f.to = `${$('toFilter').value}T23:59:59`;
  return f;
}

function buildQuery(filter) {
  const p = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== '' && v != null) p.set(k, v);
  });
  return p.toString();
}

async function loadRooms() {
  try {
    const res = await fetch(`${backendUrl}/api/history/rooms`);
    const { rooms } = await res.json();
    const sel = $('roomFilter');
    const current = sel.value;
    sel.innerHTML = '<option value="">전체</option>';
    rooms.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r.room;
      opt.textContent = `${r.room} (${r.count})`;
      sel.appendChild(opt);
    });
    sel.value = current;
  } catch {
    /* 방 목록 로드 실패는 치명적이지 않음 */
  }
}

async function loadRows() {
  $('backendWarn').hidden = true;
  try {
    const res = await fetch(`${backendUrl}/api/history?${buildQuery(currentFilter())}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    total = data.total;
    renderRows(data.rows);
    renderMeta();
  } catch (err) {
    $('backendWarn').hidden = false;
    $('rows').innerHTML = '';
    $('countLabel').textContent = '';
  }
}

function fmtTime(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderRows(rows) {
  const tbody = $('rows');
  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="hh-empty">표시할 번역 이력이 없습니다.</td></tr>';
    return;
  }
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtTime(r.timestamp)}</td>
      <td>${escapeHtml(r.room)}</td>
      <td>${escapeHtml(r.sender)}</td>
      <td><span class="hh-dir ${r.direction}">${r.direction === 'VI2KO' ? 'VI→KO' : 'KO→VI'}</span></td>
      <td class="src"></td>
      <td class="dst"></td>
      <td><button class="hh-del" data-id="${r.id}">삭제</button></td>
    `;
    // 텍스트는 textContent 로 안전하게 주입 (XSS 방지)
    tr.querySelector('.src').textContent = r.sourceText;
    tr.querySelector('.dst').textContent = r.translatedText;
    tr.querySelector('.hh-del').addEventListener('click', () => deleteOne(r.id));
    tbody.appendChild(tr);
  }
}

function renderMeta() {
  $('countLabel').textContent = `총 ${total}건`;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  $('pageLabel').textContent = `${page} / ${pages}`;
  $('prevBtn').disabled = offset === 0;
  $('nextBtn').disabled = offset + PAGE_SIZE >= total;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));
}

// F-18: 단건 삭제
async function deleteOne(id) {
  if (!confirm('이 항목을 삭제할까요?')) return;
  await fetch(`${backendUrl}/api/history/${id}`, { method: 'DELETE' });
  loadRows();
}

// F-18: 조건부 일괄 삭제
async function deleteFiltered() {
  const f = currentFilter();
  const body = { room: f.room || undefined, direction: f.direction || undefined };
  if (f.to) body.before = f.to;
  const desc = body.room || body.direction || body.before ? '현재 필터 조건의' : '전체';
  if (!confirm(`${desc} 번역 이력을 삭제합니다. 계속할까요?`)) return;
  const res = await fetch(`${backendUrl}/api/history/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  alert(`${data.removed}건 삭제됨`);
  offset = 0;
  await loadRooms();
  loadRows();
}

// F-17: CSV 내보내기 (백엔드에서 BOM 포함 CSV 생성)
function exportCsv() {
  const f = currentFilter();
  delete f.limit;
  delete f.offset;
  window.open(`${backendUrl}/api/history/export.csv?${buildQuery(f)}`, '_blank');
}

// ── 이벤트 바인딩 ──────────────────────────────────────
$('applyBtn').addEventListener('click', () => { offset = 0; loadRows(); });
$('resetBtn').addEventListener('click', () => {
  ['roomFilter', 'directionFilter', 'fromFilter', 'toFilter', 'qFilter'].forEach((id) => ($(id).value = ''));
  offset = 0;
  loadRows();
});
$('prevBtn').addEventListener('click', () => { offset = Math.max(0, offset - PAGE_SIZE); loadRows(); });
$('nextBtn').addEventListener('click', () => { offset += PAGE_SIZE; loadRows(); });
$('exportBtn').addEventListener('click', exportCsv);
$('deleteFilteredBtn').addEventListener('click', deleteFiltered);

(async function init() {
  backendUrl = await getBackendUrl();
  await loadRooms();
  loadRows();
})();
