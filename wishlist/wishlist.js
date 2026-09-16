'use strict';

const API_BASE = 'http://localhost:5001';

// ============================================================
// CAMADA DE DADOS — 100% MySQL via API
// ============================================================
const DB = {
  async list(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const r  = await fetch(`${API_BASE}/items?${qs}`);
    if (!r.ok) throw new Error(`Erro ${r.status}`);
    const j  = await r.json();
    return j.data || [];
  },

  async get(id) {
    const r = await fetch(`${API_BASE}/items/${id}`);
    if (!r.ok) throw new Error(`Erro ${r.status}`);
    const j = await r.json();
    return j.data || null;
  },

  async create(data) {
    const r = await fetch(`${API_BASE}/items`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    return j.data;
  },

  async update(id, data) {
    const r = await fetch(`${API_BASE}/items/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    return j.data;
  },

  async delete(id) {
    const r = await fetch(`${API_BASE}/items/${id}`, { method: 'DELETE' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
  },

  async stats() {
    const r = await fetch(`${API_BASE}/stats`);
    if (!r.ok) throw new Error(`Erro ${r.status}`);
    const j = await r.json();
    return j.data?.summary || {};
  },
};

// ============================================================
// STATE
// ============================================================
let editingId  = null;
let deletingId = null;

// ============================================================
// DOM REFS
// ============================================================
const grid           = document.getElementById('wishlist-grid');
const emptyState     = document.getElementById('empty-state');
const modalOverlay   = document.getElementById('modal-overlay');
const confirmOverlay = document.getElementById('confirm-overlay');
const modalTitle     = document.getElementById('modal-title');
const btnAdd         = document.getElementById('btn-add');
const btnSave        = document.getElementById('btn-save');
const btnCancel      = document.getElementById('btn-cancel');
const modalClose     = document.getElementById('modal-close');
const confirmClose   = document.getElementById('confirm-close');
const confirmCancel  = document.getElementById('confirm-cancel');
const confirmDelete  = document.getElementById('confirm-delete');
const confirmName    = document.getElementById('confirm-name');
const searchInput    = document.getElementById('search-input');
const filterPriority = document.getElementById('filter-priority');
const filterStatus   = document.getElementById('filter-status');
const filterSort     = document.getElementById('filter-sort');
const sbFill         = document.getElementById('sb-fill');
const sbCount        = document.getElementById('sb-count');

// ============================================================
// UTILS
// ============================================================
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function fmtPrice(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? '/…' : '');
  } catch {
    return url.slice(0, 32) + (url.length > 32 ? '…' : '');
  }
}

function showError(msg) {
  // Banner de erro não-intrusivo no topo da grid
  const existing = document.getElementById('api-error-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'api-error-banner';
  banner.className = 'api-error-banner';
  banner.innerHTML = `
    <span class="api-error-icon">⚠</span>
    <span>${esc(msg)}</span>
    <button onclick="this.parentElement.remove()">✕</button>
  `;
  grid.parentElement.insertBefore(banner, grid);
}

// ============================================================
// RENDER
// ============================================================
async function renderGrid() {
  const params = {
    priority: filterPriority.value,
    status:   filterStatus.value,
    q:        searchInput.value.trim(),
    sort:     filterSort.value,
  };
  Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });

  // Estado de carregamento
  grid.innerHTML = '<div class="loading-state"><span class="loading-spinner"></span></div>';
  emptyState.style.display = 'none';

  let list = [];
  try {
    list = await DB.list(params);
    // Remove banner de erro anterior se existir
    document.getElementById('api-error-banner')?.remove();
  } catch (e) {
    grid.innerHTML = '';
    showError('Não foi possível conectar ao banco de dados. Verifique se o backend está rodando na porta 5001.');
    return;
  }

  grid.innerHTML = '';
  emptyState.style.display = list.length === 0 ? 'flex' : 'none';

  const priorityAccent = { alta: '#8a3a3a', media: '#7a6a30', baixa: '#4a8a6a' };
  const prLabel        = { alta: 'Alta',    media: 'Média',   baixa: 'Baixa'   };

  list.forEach(it => {
    const card = document.createElement('div');
    card.className = 'wish-card';
    card.style.setProperty('--card-accent', priorityAccent[it.priority] || '#7a6a30');

    const priceStr  = fmtPrice(it.price_est);
    const statusCls = it.status === 'comprado' ? 'badge-comprado' : 'badge-desejo';
    const statusLbl = it.status === 'comprado' ? '✓ Comprado'     : '♡ Desejo';
    const catName   = it.category_name || '';
    const storeName = it.store_name    || '';
    const link      = it.buy_link      || '';

    card.innerHTML = `
      <div class="wish-card-top">
        <div class="wish-badges">
          <span class="badge badge-priority-${it.priority}">${prLabel[it.priority] || it.priority}</span>
          <span class="badge ${statusCls}">${statusLbl}</span>
        </div>
        <div class="wish-card-actions-top">
          <button class="btn-card-icon btn-edit"   title="Editar"  data-id="${it.id}">✎</button>
          <button class="btn-card-icon btn-delete" title="Remover" data-id="${it.id}">✕</button>
        </div>
      </div>

      <div class="wish-card-main">
        <div class="wish-title">${esc(it.title)}</div>
        ${it.author ? `<div class="wish-author">${esc(it.author)}</div>` : ''}
        ${catName   ? `<div class="wish-category">${esc(catName)}</div>` : ''}
      </div>

      <div class="wish-card-meta">
        ${priceStr ? `
        <div class="meta-row">
          <span class="meta-label"><span class="meta-label-icon">◈</span>Preço est.</span>
          <span class="meta-val price">${priceStr}</span>
        </div>` : ''}
        ${storeName ? `
        <div class="meta-row">
          <span class="meta-label"><span class="meta-label-icon">◦</span>Loja</span>
          <span class="meta-val">${esc(storeName)}</span>
        </div>` : ''}
        ${link ? `
        <div class="meta-row">
          <span class="meta-label"><span class="meta-label-icon">↗</span>Link</span>
          <a class="meta-link" href="${esc(link)}" target="_blank" rel="noopener">
            <span class="meta-link-icon">↗</span>
            <span class="meta-link-text">${esc(shortUrl(link))}</span>
          </a>
        </div>` : ''}
      </div>

      ${it.notes ? `
      <div class="wish-notes">
        <span class="notes-icon">✎</span>
        <span>${esc(it.notes)}</span>
      </div>` : '<div></div>'}

      <div class="wish-card-footer">
        <span class="footer-date">Adicionado em ${fmtDate(it.added_at)}</span>
      </div>
    `;
    grid.appendChild(card);
  });

  await updateStats();
  attachCardEvents();
}

async function updateStats() {
  try {
    const s = await DB.stats();
    document.getElementById('stat-total').textContent    = s.total_items         || 0;
    document.getElementById('stat-price').textContent    = fmtPrice(s.estimated_total) || 'R$ 0';
    document.getElementById('stat-priority').textContent = s.high_priority_count || 0;
    const n = s.total_items || 0;
    sbCount.textContent = n + (n === 1 ? ' item' : ' itens');
    sbFill.style.width  = Math.min(100, (n / 50) * 100) + '%';
  } catch (e) {
    console.error('Erro ao carregar stats:', e);
  }
}

// ============================================================
// CARD EVENTS
// ============================================================
function attachCardEvents() {
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => openConfirm(btn.dataset.id));
  });
}

// ============================================================
// MODAL
// ============================================================
function openAddModal() {
  editingId = null;
  modalTitle.textContent = 'Adicionar à Wishlist';
  clearForm();
  modalOverlay.classList.add('open');
  document.getElementById('f-title').focus();
}

async function openEditModal(id) {
  let it;
  try {
    it = await DB.get(id);
  } catch (e) {
    showError('Erro ao carregar item: ' + e.message);
    return;
  }
  if (!it) return;
  editingId = id;
  modalTitle.textContent = 'Editar Item';
  fillForm(it);
  modalOverlay.classList.add('open');
  document.getElementById('f-title').focus();
}

function closeModal() {
  modalOverlay.classList.remove('open');
  editingId = null;
}

function clearForm() {
  ['f-title', 'f-author', 'f-category', 'f-price', 'f-store', 'f-link', 'f-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-priority').value = 'media';
  document.getElementById('f-status').value   = 'desejo';
}

function fillForm(it) {
  document.getElementById('f-title').value    = it.title        || '';
  document.getElementById('f-author').value   = it.author       || '';
  document.getElementById('f-category').value = it.category_name || it.category_id || '';
  document.getElementById('f-price').value    = it.price_est    != null ? it.price_est : '';
  document.getElementById('f-store').value    = it.store_name   || '';
  document.getElementById('f-link').value     = it.buy_link     || '';
  document.getElementById('f-notes').value    = it.notes        || '';
  document.getElementById('f-priority').value = it.priority     || 'media';
  document.getElementById('f-status').value   = it.status       || 'desejo';
}

function readForm() {
  return {
    title:        document.getElementById('f-title').value.trim(),
    author:       document.getElementById('f-author').value.trim()   || null,
    category_id:  document.getElementById('f-category').value.trim() || null,
    price_est:    parseFloat(document.getElementById('f-price').value) || null,
    store_custom: document.getElementById('f-store').value.trim()    || null,
    buy_link:     document.getElementById('f-link').value.trim()     || null,
    notes:        document.getElementById('f-notes').value.trim()    || null,
    priority:     document.getElementById('f-priority').value,
    status:       document.getElementById('f-status').value,
  };
}

btnSave.addEventListener('click', async () => {
  const data = readForm();
  if (!data.title) {
    const el = document.getElementById('f-title');
    el.focus();
    el.style.borderColor = 'var(--red)';
    setTimeout(() => el.style.borderColor = '', 1500);
    return;
  }

  btnSave.disabled    = true;
  btnSave.textContent = 'Salvando…';

  try {
    if (editingId) {
      await DB.update(editingId, data);
    } else {
      await DB.create(data);
    }
    closeModal();
    renderGrid();
  } catch (e) {
    showError('Erro ao salvar: ' + e.message);
  } finally {
    btnSave.disabled    = false;
    btnSave.textContent = 'Salvar';
  }
});

// ============================================================
// DELETE
// ============================================================
async function openConfirm(id) {
  let it;
  try {
    it = await DB.get(id);
  } catch {
    it = null;
  }
  if (!it) return;
  deletingId = id;
  confirmName.textContent = it.title;
  confirmOverlay.classList.add('open');
}

function closeConfirm() {
  confirmOverlay.classList.remove('open');
  deletingId = null;
}

confirmDelete.addEventListener('click', async () => {
  const btn = confirmDelete;
  btn.disabled    = true;
  btn.textContent = 'Removendo…';
  try {
    await DB.delete(deletingId);
    closeConfirm();
    renderGrid();
  } catch (e) {
    showError('Erro ao remover: ' + e.message);
    closeConfirm();
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Remover';
  }
});

// ============================================================
// LISTENERS
// ============================================================
btnAdd.addEventListener('click', openAddModal);
btnCancel.addEventListener('click', closeModal);
modalClose.addEventListener('click', closeModal);
confirmCancel.addEventListener('click', closeConfirm);
confirmClose.addEventListener('click', closeConfirm);
modalOverlay.addEventListener('click',   e => { if (e.target === modalOverlay)   closeModal(); });
confirmOverlay.addEventListener('click', e => { if (e.target === confirmOverlay) closeConfirm(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeConfirm(); } });

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderGrid, 280);
});
[filterPriority, filterStatus, filterSort].forEach(el => el.addEventListener('change', renderGrid));

// ============================================================
// INIT
// ============================================================
renderGrid();
