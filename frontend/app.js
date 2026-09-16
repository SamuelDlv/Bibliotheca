// ============================================================
// 1. STATE
// ============================================================
const State = {
  books: [],
  notes: [],
  quotes: [],
  diaryEntries: [],
  vocabulary: [],
  authors: [],
  themeLists: [],
  openQuestions: [],
  categories: [],
  globalTags: [],
  goal: 12,
  speed: 30,
  activeSection: 'dashboard',
  editingBookId: null,
  editingNoteBookId: null,
};

const QUOTES = [
  { text: "Conhece-te a ti mesmo.", author: "— Sócrates" },
  { text: "A virtude é a única nobreza.", author: "— Sêneca" },
  { text: "Somos o que repetidamente fazemos.", author: "— Aristóteles" },
  { text: "Perde tempo para ganhar a si mesmo.", author: "— Sêneca" },
  { text: "O homem que sabe por quê suporta qualquer como.", author: "— Nietzsche" },
  { text: "A vida não examinada não vale a pena ser vivida.", author: "— Sócrates" },
  { text: "Não o que acontece, mas como reagimos.", author: "— Epicteto" },
  { text: "Quem teme a morte perde a vida.", author: "— Marco Aurélio" },
  { text: "A filosofia é um exercício de morte.", author: "— Platão" },
  { text: "O limite do mal está no limite da sabedoria.", author: "— Sêneca" },
  { text: "Toda a história é história do pensamento.", author: "— Collingwood" },
  { text: "A leitura é um diálogo com os mortos.", author: "— Mortimer Adler" },
  { text: "Que cada dia te encontre melhor do que te deixou.", author: "— Sêneca" },
  { text: "Quem não conhece história está condenado a repeti-la.", author: "— Burke" },
];

const CAT_COLORS = {
  filosofia:  '#c9956a',
  historia:   '#7a9cb8',
  mitologia:  '#9a80c0',
  estoicismo: '#7a9e82',
  politica:   '#c47060',
  biologia:   '#7aaa88',
  outro:      '#8a8070',
};

const MOOD_ICONS = {
  focado: '🧠', contemplativo: '🌙', inquieto: '⚡',
  cansado: '😴', inspirado: '✨', confuso: '🌀',
};

const API_BASE = 'http://localhost:5000';

const API = {
  async get(path) {
    try {
      const r = await fetch(API_BASE + path);
      const j = await r.json();
      return j.data !== undefined ? j.data : j;
    } catch(e) {
      console.error('API GET error', path, e);
      return null;
    }
  },
  async post(path, body) {
    try {
      const r = await fetch(API_BASE + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || j.ok === false) { showToast('Erro: ' + (j.error || r.status), 'error'); return null; }
      return j;
    } catch(e) {
      showToast('Erro de conexão com o servidor', 'error');
      console.error('API POST error', path, e);
      return null;
    }
  },
  async put(path, body) {
    try {
      const r = await fetch(API_BASE + path, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || j.ok === false) { showToast('Erro: ' + (j.error || r.status), 'error'); return null; }
      return j;
    } catch(e) {
      showToast('Erro de conexão com o servidor', 'error');
      console.error('API PUT error', path, e);
      return null;
    }
  },
  async patch(path, body = {}) {
    try {
      const r = await fetch(API_BASE + path, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || j.ok === false) { showToast('Erro: ' + (j.error || r.status), 'error'); return null; }
      return j;
    } catch(e) {
      showToast('Erro de conexão com o servidor', 'error');
      console.error('API PATCH error', path, e);
      return null;
    }
  },
  async delete(path) {
    try {
      const r = await fetch(API_BASE + path, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok || j.ok === false) { showToast('Erro: ' + (j.error || r.status), 'error'); return null; }
      return j;
    } catch(e) {
      showToast('Erro de conexão com o servidor', 'error');
      console.error('API DELETE error', path, e);
      return null;
    }
  },
};

// Storage agora é só um proxy para a API
const Storage = {
  async load() {
    const [books, notes, quotes, diary, vocab, authors, lists, questions, categories, tags, settings, activity] =
      await Promise.all([
        API.get('/books'),
        API.get('/notes'),
        API.get('/quotes'),
        API.get('/diary'),
        API.get('/vocabulary'),
        API.get('/authors'),
        API.get('/lists'),
        API.get('/questions'),
        API.get('/categories'),
        API.get('/tags'),
        API.get('/settings'),
        API.get('/activity'),
      ]);

    State.books        = (books        || []).map(normalizeBook);
    State.notes        = (notes        || []).map(normalizeNote);
    State.quotes       = (quotes       || []).map(normalizeQuote);
    State.diaryEntries = (diary        || []).map(normalizeDiary);
    State.vocabulary   = (vocab        || []).map(normalizeVocab);
    State.authors      = (authors      || []).map(normalizeAuthor);
    State.themeLists   = (lists        || []).map(normalizeList);
    State.openQuestions= (questions    || []).map(normalizeQuestion);
    State.categories   = categories    || getDefaultCategories();
    // Store tags as objects {tag, color} — backward compat with string-only responses
    State.globalTags   = Array.isArray(tags)
      ? tags.map(t => typeof t === 'string' ? { tag: t, color: '#7a8090' } : t)
      : [];
    State.goal         = parseInt((settings && settings.goal)  || '12', 10);
    State.speed        = parseInt((settings && settings.speed) || '30', 10);
    State._activity    = activity || [];
  },


  async addActivity(icon, text) {
    // A API adiciona atividade automaticamente nas operações CRUD
    // Reload da activity após operação
    State._activity = await API.get('/activity');
  },
};

// ---- Normalizadores: converte snake_case da API para camelCase do frontend ----
function normalizeBook(b) {
  return {
    id:          b.id,
    title:       b.title,
    author:      b.author,
    category:    b.category_id || b.category,
    status:      b.status,
    totalPages:  b.total_pages  || b.totalPages  || 0,
    pagesRead:   b.pages_read   || b.pagesRead   || 0,
    year:        b.year,
    quickNotes:  b.quick_notes  || b.quickNotes  || '',
    before:      b.before_read  || b.before      || '',
    reviewDays:  b.review_days  || b.reviewDays  || null,
    era:         b.era          || '',
    tags:        Array.isArray(b.tags) ? b.tags : (b.tags || '').split(',').filter(Boolean),
    completedAt: b.completed_at || b.completedAt || null,
    createdAt:   b.created_at   || b.createdAt   || new Date().toISOString(),
  };
}
function normalizeNote(n) {
  return {
    id:        n.id,
    bookId:    n.book_id    || n.bookId,
    quote:     n.quote      || '',
    synthesis: n.synthesis  || '',
    impact:    n.impact     || '',
    questions: n.questions  || '',
    practice:  n.practice   || '',
    after:     n.after_read || n.after || '',
    createdAt: n.created_at || n.createdAt || new Date().toISOString(),
  };
}
function normalizeQuote(q) {
  return {
    id:         q.id,
    text:       q.text       || '',
    bookId:     q.book_id    || q.bookId    || null,
    bookTitle:  q.book_title || q.bookTitle || '',
    reflection: q.reflection || '',
    tags:       Array.isArray(q.tags) ? q.tags : (q.tags || '').split(',').filter(Boolean),
    createdAt:  q.created_at || q.createdAt || new Date().toISOString(),
  };
}
function normalizeDiary(d) {
  return {
    id:         d.id,
    bookId:     d.book_id    || d.bookId    || null,
    date:       d.entry_date || d.date,
    pagesRead:  d.pages_read || d.pagesRead || 0,
    duration:   d.duration   || 0,
    mood:       d.mood       || 'focado',
    note:       d.note       || '',
    createdAt:  d.created_at || d.createdAt || new Date().toISOString(),
  };
}
function normalizeVocab(v) {
  return {
    id:         v.id,
    term:       v.term       || '',
    origin:     v.origin     || '',
    definition: v.definition || '',
    source:     v.source     || '',
    related:    Array.isArray(v.related) ? v.related : (v.related_terms || []),
    createdAt:  v.created_at || v.createdAt || new Date().toISOString(),
  };
}
function normalizeAuthor(a) {
  return {
    id:           a.id,
    name:         a.name          || '',
    life:         a.life          || '',
    school:       a.school        || '',
    origin:       a.origin        || '',
    bio:          a.bio           || '',
    influencedBy: a.influenced_by || a.influencedBy || [],
    influenced:   a.influences    || a.influenced   || [],
    concepts:     Array.isArray(a.concepts) ? a.concepts : [],
    createdAt:    a.created_at    || a.createdAt    || new Date().toISOString(),
  };
}
function normalizeList(l) {
  return {
    id:          l.id,
    name:        l.name        || '',
    description: l.description || '',
    books:       Array.isArray(l.books) ? l.books : [],
    createdAt:   l.created_at  || l.createdAt || new Date().toISOString(),
  };
}
function normalizeQuestion(q) {
  return {
    id:         q.id,
    text:       q.text        || '',
    bookId:     q.book_id     || q.bookId || null,
    resolved:   q.resolved    || false,
    answer:     q.answer      || '',
    createdAt:  q.created_at  || q.createdAt || new Date().toISOString(),
    resolvedAt: q.resolved_at || q.resolvedAt || null,
  };
}

const genId = () => '_' + Math.random().toString(36).substr(2, 9);

function pct(read, total) {
  if (!total || total === 0) return 0;
  return Math.min(100, Math.round((read / total) * 100));
}

function getCurrentYear() { return new Date().getFullYear(); }

function getBooksThisYear() {
  return State.books.filter(b => {
    if (b.status !== 'concluido' || !b.completedAt) return false;
    return new Date(b.completedAt).getFullYear() === getCurrentYear();
  }).length;
}

function timeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return 'agora mesmo';
  if (mins < 60)  return `${mins}m atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${days}d atrás`;
}

function formatHours(h) {
  if (!isFinite(h)) return '—';
  if (h < 1)   return `${Math.round(h * 60)}min`;
  if (h < 100) return `${h.toFixed(1)}h`;
  return `${Math.round(h)}h`;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function renderQuote() {
  const day = new Date().getDate();
  // Try to pull from saved quotes first
  if (State.quotes.length > 0) {
    const q = State.quotes[day % State.quotes.length];
    document.getElementById('daily-quote').textContent = `"${q.text}"`;
    document.getElementById('quote-author').textContent = q.bookTitle ? `— ${q.bookTitle}` : '';
    return;
  }
  const q = QUOTES[day % QUOTES.length];
  document.getElementById('daily-quote').textContent = `"${q.text}"`;
  document.getElementById('quote-author').textContent = q.author;
}

function renderDate() {
  const now = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const el = document.getElementById('dashboard-date');
  if (el) el.textContent = now.toLocaleDateString('pt-BR', opts);
}

function renderClock() {
  const el = document.getElementById('sysinfo-time');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

function renderSysinfo() {
  const totalPages = State.books.reduce((s, b) => s + (b.totalPages || 0), 0);
  const el = document.getElementById('sysinfo-pages');
  if (el) el.textContent = totalPages.toLocaleString('pt-BR') + ' PÁG';
}

function renderStats() {
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('stat-total',        State.books.length);
  setEl('stat-reading',      State.books.filter(b => b.status === 'lendo').length);
  setEl('stat-done',         State.books.filter(b => b.status === 'concluido').length);
  setEl('stat-notes',        State.notes.length);
  setEl('stat-quotes-count', State.quotes.length);
  setEl('stat-vocab',        State.vocabulary.length);
}

function renderBadges() {
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('badge-reading', State.books.filter(b => b.status === 'lendo').length);
  setEl('badge-total',   State.books.length);
  setEl('badge-notes',   State.notes.length);
}

function renderSidebarStatus() {
  const total = State.books.length || 1;
  const done  = State.books.filter(b => b.status === 'concluido').length;
  const colPct = Math.round((done / total) * 100);
  const setBar = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = pct + '%'; };
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setBar('sidebar-col-bar', colPct); setVal('sidebar-col-pct', colPct + '%');

  const goalDone = getBooksThisYear();
  const goalPct  = Math.min(100, Math.round((goalDone / (State.goal || 1)) * 100));
  setBar('sidebar-goal-bar', goalPct); setVal('sidebar-goal-pct', goalPct + '%');
}

function renderGoalCircle() {
  const canvas = document.getElementById('goal-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const done  = getBooksThisYear();
  const goal  = State.goal;
  const ratio = Math.min(1, done / (goal || 1));
  const cx = 70, cy = 70, r = 54, lw = 7;
  const start = -Math.PI / 2;
  const end   = start + ratio * 2 * Math.PI;

  ctx.clearRect(0, 0, 140, 140);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--bg-4').trim();
  ctx.lineWidth = lw;
  ctx.stroke();

  if (ratio > 0) {
    const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    grad.addColorStop(0, '#a5734c');
    grad.addColorStop(1, '#c9956a');
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end);
    ctx.strokeStyle = grad;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#c9956a';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('goal-books-done', done);
  setEl('goal-target', goal);
}

function renderCategoryChart() {
  const container = document.getElementById('category-chart');
  if (!container) return;
  const cats = {};
  State.books.forEach(b => { cats[b.category] = (cats[b.category] || 0) + 1; });
  const total  = State.books.length || 1;
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (sorted.length === 0) { container.innerHTML = '<p class="empty-state">Nenhum livro cadastrado.</p>'; return; }
  container.innerHTML = sorted.map(([cat, count]) => {
    const w = Math.round((count / total) * 100);
    const color = getCatColor(cat);
    return `<div class="cat-bar-row">
      <div class="cat-bar-label"><span>${cat}</span><span style="color:${color}">${count}</span></div>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${w}%;background:${color}"></div></div>
    </div>`;
  }).join('');
}

function renderCurrentReads() {
  const list = document.getElementById('current-reads-list');
  if (!list) return;
  const reading = State.books.filter(b => b.status === 'lendo');
  if (reading.length === 0) { list.innerHTML = '<p class="empty-state">Nenhuma leitura ativa.</p>'; return; }
  list.innerHTML = reading.map(b => {
    const p = pct(b.pagesRead || 0, b.totalPages || 0);
    const color = getCatColor(b.category);
    const remaining = (b.totalPages || 0) - (b.pagesRead || 0);
    const hoursLeft = remaining > 0 ? formatHours(remaining / State.speed) : '—';
    return `<div class="current-read-item">
      <div class="current-read-spine" style="background:${color}"></div>
      <div class="current-read-info">
        <div class="current-read-title">${esc(b.title)}</div>
        <div class="current-read-author">${esc(b.author)} · restam ~${hoursLeft}</div>
      </div>
      <span class="current-read-pct">${p}%</span>
    </div>`;
  }).join('');
}

function renderProgressBars() {
  const container = document.getElementById('progress-bars');
  if (!container) return;
  const reading = State.books.filter(b => b.status === 'lendo');
  if (reading.length === 0) { container.innerHTML = '<p class="empty-state">Nenhum livro em leitura.</p>'; return; }
  container.innerHTML = reading.map(b => {
    const p = pct(b.pagesRead || 0, b.totalPages || 0);
    return `<div class="progress-row">
      <div class="progress-header">
        <span class="progress-book-name">${esc(b.title)}</span>
        <span class="progress-pct">${p}% · ${b.pagesRead || 0} / ${b.totalPages || '?'} pág.</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${p}%"></div></div>
    </div>`;
  }).join('');
}

function renderSpeedWidget() {
  const container = document.getElementById('speed-results');
  if (!container) return;
  const reading = State.books.filter(b => b.status === 'lendo' && b.totalPages > 0);
  if (reading.length === 0) { container.innerHTML = '<p class="empty-state">Adicione livros em leitura.</p>'; return; }
  container.innerHTML = reading.map(b => {
    const remaining = (b.totalPages || 0) - (b.pagesRead || 0);
    const hours = remaining / State.speed;
    return `<div class="speed-result-row">
      <span class="speed-result-book">${esc(b.title)}</span>
      <span class="speed-result-time">~${formatHours(hours)}</span>
    </div>`;
  }).join('');
}

function renderActivityFeed() {
  const container = document.getElementById('activity-feed');
  if (!container) return;
  const acts = State._activity || [];
  if (acts.length === 0) { container.innerHTML = '<p class="empty-state">Nenhuma atividade ainda.</p>'; return; }
  container.innerHTML = acts.slice(0, 8).map(a => `
    <div class="activity-item">
      <div class="activity-icon">${a.icon}</div>
      <div><div class="activity-text">${a.text}</div><div class="activity-time">${timeAgo(a.time)}</div></div>
    </div>`).join('');
}

function renderHeatmap() {
  const container = document.getElementById('heatmap-grid');
  if (!container) return;
  const year   = getCurrentYear();
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const byMonth = Array(12).fill(0);
  State.books.forEach(b => {
    if (b.status !== 'concluido' || !b.completedAt) return;
    const d = new Date(b.completedAt);
    if (d.getFullYear() === year) byMonth[d.getMonth()]++;
  });
  const max = Math.max(...byMonth, 1);
  container.innerHTML = months.map((m, i) => {
    const count = byMonth[i];
    const level = count === 0 ? 0 : count >= max ? 3 : count >= max / 2 ? 2 : 1;
    return `<div class="heatmap-month">
      <div class="heatmap-cell" data-count="${level}" title="${m}: ${count} livro(s)"></div>
      <span class="heatmap-month-label">${m}</span>
    </div>`;
  }).join('');
}

function renderPendingReviews() {
  const container = document.getElementById('pending-reviews');
  if (!container) return;
  const now = Date.now();
  const pending = State.books.filter(b => {
    if (!b.completedAt || !b.reviewDays || b.reviewDays <= 0) return false;
    const reviewDate = new Date(b.completedAt).getTime() + (b.reviewDays * 86400000);
    return reviewDate <= now;
  });
  if (pending.length === 0) { container.innerHTML = '<p class="empty-state">Nenhuma revisão pendente.</p>'; return; }
  container.innerHTML = pending.map(b => {
    const reviewDate = new Date(new Date(b.completedAt).getTime() + (b.reviewDays * 86400000));
    const daysAgo = Math.floor((now - reviewDate.getTime()) / 86400000);
    return `<div class="review-item">
      <div class="review-info">
        <div class="review-title">${esc(b.title)}</div>
        <div class="review-meta">${esc(b.author)} · vence há ${daysAgo} dia(s)</div>
      </div>
      <button class="btn-icon" onclick="openNotesModal('${b.id}')">Revisar ✎</button>
    </div>`;
  }).join('');
}

function renderDashboard() {
  renderStats();
  renderBadges();
  renderSidebarStatus();
  renderGoalCircle();
  renderCategoryChart();
  renderCurrentReads();
  renderProgressBars();
  renderSpeedWidget();
  renderActivityFeed();
  renderHeatmap();
  renderPendingReviews();
  renderSysinfo();
}

function renderBooks(filter = 'all', catFilter = 'all', searchTerm = '', sortBy = 'recent') {
  const grid = document.getElementById('books-grid');
  if (!grid) return;
  let books = [...State.books];
  if (filter !== 'all') books = books.filter(b => b.status === filter);
  if (catFilter !== 'all') books = books.filter(b => b.category === catFilter);
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    books = books.filter(b =>
      b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) ||
      (b.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (b.quickNotes || '').toLowerCase().includes(q)
    );
  }
  const sort = sortBy || document.getElementById('sort-filter')?.value || 'recent';
  books.sort((a, b) => {
    switch(sort) {
      case 'title':    return a.title.localeCompare(b.title);
      case 'author':   return a.author.localeCompare(b.author);
      case 'progress': return pct(b.pagesRead, b.totalPages) - pct(a.pagesRead, a.totalPages);
      default:         return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }
  });

  if (books.length === 0) {
    grid.innerHTML = `<div class="empty-library"><span class="empty-icon">📚</span>
      <p>${State.books.length === 0 ? 'Sua biblioteca está vazia.' : 'Nenhum resultado encontrado.'}</p>
      ${State.books.length === 0 ? '<button class="btn-primary" id="add-book-empty">Adicionar Primeiro Livro</button>' : ''}</div>`;
    const emptyBtn = document.getElementById('add-book-empty');
    if (emptyBtn) emptyBtn.addEventListener('click', () => openBookModal());
    return;
  }

  grid.innerHTML = books.map(b => {
    const p = pct(b.pagesRead || 0, b.totalPages || 0);
    const tags = (b.tags || []).slice(0, 3);
    const color = getCatColor(b.category);
    const statusLabels = { lendo: 'Em leitura', concluido: 'Concluído', futuro: 'Fila' };
    const tagColors = {};
    State.globalTags.forEach(t => { tagColors[typeof t === 'string' ? t : t.tag] = typeof t === 'string' ? '#7a8090' : (t.color || '#7a8090'); });
    return `<div class="book-card" data-id="${b.id}" style="--card-accent:${color}">
      <div class="book-card-top">
        <span class="book-category-badge" style="border-color:${color}44;color:${color}">${esc(b.category)}</span>
        <span class="book-status-dot ${b.status}" title="${statusLabels[b.status] || b.status}"></span>
      </div>
      <div class="book-card-main">
        <div class="book-title">${esc(b.title)}</div>
        <div class="book-author">${esc(b.author)}</div>
      </div>
      ${b.status === 'lendo' ? `<div class="book-progress-mini">
        <div class="book-progress-mini-track"><div class="book-progress-mini-fill" style="width:${p}%"></div></div>
        <span class="book-progress-mini-label">${p}% — ${b.pagesRead || 0} / ${b.totalPages || '?'} pág.</span>
      </div>` : '<div class="book-progress-mini-spacer"></div>'}
      ${tags.length > 0 ? `<div class="book-tags-row">${tags.map(t => `<span class="book-tag" style="border-color:${(tagColors[t]||'#7a8090')}33;color:${tagColors[t]||'#7a8090'};background:${(tagColors[t]||'#7a8090')}11">${esc(t)}</span>`).join('')}</div>` : '<div class="book-tags-placeholder"></div>'}
      <div class="book-card-actions">
        <button class="book-action-main" onclick="openBookView('${b.id}')">Ver detalhes</button>
        <div class="book-action-menu-wrap">
          <button class="book-action-more" onclick="toggleBookMenu(event,'${b.id}')">···</button>
          <div class="book-action-dropdown" id="menu-${b.id}">
            <button onclick="closeAllMenus();openNotesModal('${b.id}')">✎ Anotações</button>
            <button onclick="closeAllMenus();openBookModal('${b.id}')">✏ Editar</button>
            <button class="book-menu-delete" onclick="closeAllMenus();deleteBook('${b.id}')">✕ Excluir</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderNotes(bookFilterId = 'all') {
  const container = document.getElementById('notes-grid');
  const select    = document.getElementById('notes-book-filter');
  if (!container || !select) return;
  select.innerHTML = '<option value="all">Todos os livros</option>' +
    State.books.map(b => `<option value="${b.id}">${esc(b.title)}</option>`).join('');
  select.value = bookFilterId;

  let notes = bookFilterId === 'all' ? [...State.notes] : State.notes.filter(n => n.bookId === bookFilterId);
  if (notes.length === 0) { container.innerHTML = '<p class="empty-state">Nenhuma anotação. Clique em "✎ Notas" em um livro para adicionar.</p>'; return; }

  const groups = {};
  notes.forEach(n => { if (!groups[n.bookId]) groups[n.bookId] = []; groups[n.bookId].push(n); });

  container.innerHTML = Object.entries(groups).map(([bookId, bookNotes]) => {
    const book = State.books.find(b => b.id === bookId);
    if (!book) return '';
    return bookNotes.map(n => {
      const beforeAfter = (book.before || n.after) ? `
        <div class="note-field full">
          <span class="note-field-label">Antes / Depois</span>
          <div class="note-before-after">
            ${book.before ? `<div class="before-block"><span>Antes:</span>${esc(book.before)}</div>` : ''}
            ${n.after ? `<div class="after-block"><span>Depois:</span>${esc(n.after)}</div>` : ''}
          </div>
        </div>` : '';
      return `<div class="note-card">
        <div class="note-book-header">
          <div>
            <div class="note-book-title">${esc(book.title)}</div>
            <div class="note-book-author">${esc(book.author)}</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn-icon" onclick="openNotesModal('${bookId}', '${n.id}')">✏ Editar</button>
            <button class="btn-icon" style="color:var(--red)" onclick="deleteNote('${n.id}')">✕</button>
          </div>
        </div>
        <div class="note-fields">
          ${n.quote ? `<div class="note-field full"><span class="note-field-label">Citação</span><div class="note-quote-block">${esc(n.quote)}</div></div>` : ''}
          ${n.synthesis ? `<div class="note-field ${!n.impact ? 'full' : ''}"><span class="note-field-label">Síntese</span><div class="note-field-content">${esc(n.synthesis)}</div></div>` : ''}
          ${n.impact ? `<div class="note-field"><span class="note-field-label">Impacto Pessoal</span><div class="note-field-content">${esc(n.impact)}</div></div>` : ''}
          ${n.questions ? `<div class="note-field"><span class="note-field-label">Perguntas Geradas</span><div class="note-field-content">${esc(n.questions)}</div></div>` : ''}
          ${n.practice ? `<div class="note-field"><span class="note-field-label">Aplicação Prática</span><div class="note-field-content">${esc(n.practice)}</div></div>` : ''}
          ${beforeAfter}
        </div>
        <div class="note-export-bar">
          <button class="btn-icon" onclick="exportNoteAsText('${n.id}')">↓ txt</button>
          <button class="btn-icon" onclick="exportNoteAsMd('${n.id}')">↓ md</button>
        </div>
      </div>`;
    }).join('');
  }).join('');
}

function renderQuotesMural() {
  const container = document.getElementById('quotes-mural');
  if (!container) return;

  // Populate filter selects
  const bookFilter = document.getElementById('quotes-book-filter');
  const tagFilter  = document.getElementById('quotes-tag-filter');
  if (bookFilter) {
    bookFilter.innerHTML = '<option value="all">Todas as obras</option>' +
      State.books.map(b => `<option value="${b.id}">${esc(b.title)}</option>`).join('');
  }
  if (tagFilter) {
    const allTags = new Set();
    State.quotes.forEach(q => (q.tags || []).forEach(t => allTags.add(t)));
    tagFilter.innerHTML = '<option value="all">Todos os conceitos</option>' +
      [...allTags].sort().map(t => `<option value="${t}">${esc(t)}</option>`).join('');
  }

  const bookVal = bookFilter?.value || 'all';
  const tagVal  = tagFilter?.value  || 'all';
  let quotes = [...State.quotes];
  if (bookVal !== 'all') quotes = quotes.filter(q => q.bookId === bookVal);
  if (tagVal  !== 'all') quotes = quotes.filter(q => (q.tags || []).includes(tagVal));

  if (quotes.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhuma citação ainda. Adicione usando "+ Nova Citação".</p>';
    return;
  }

  container.innerHTML = quotes.map(q => {
    const book = State.books.find(b => b.id === q.bookId);
    return `<div class="quote-card">
      <div class="quote-glyph">❝</div>
      <div class="quote-text">${esc(q.text)}</div>
      ${book ? `<div class="quote-source">— ${esc(book.title)}, ${esc(book.author)}</div>` : ''}
      ${q.reflection ? `<div class="quote-reflection">${esc(q.reflection)}</div>` : ''}
      ${(q.tags || []).length > 0 ? `<div class="quote-tags">${q.tags.map(t => `<span class="book-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="quote-actions">
        <button class="btn-icon" onclick="editQuote('${q.id}')">✏</button>
        <button class="btn-icon" style="color:var(--red)" onclick="deleteQuote('${q.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

function renderDiary() {
  const container = document.getElementById('diary-entries');
  if (!container) return;

  // Stats
  const statsEl = document.getElementById('diary-stats');
  if (statsEl && State.diaryEntries.length > 0) {
    const totalPages = State.diaryEntries.reduce((s, e) => s + (e.pages || 0), 0);
    const totalMins  = State.diaryEntries.reduce((s, e) => s + (e.duration || 0), 0);
    const moodCounts = {};
    State.diaryEntries.forEach(e => { moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1; });
    const topMood = Object.entries(moodCounts).sort((a,b) => b[1]-a[1])[0];
    statsEl.innerHTML = `
      <div class="diary-stat"><span>${State.diaryEntries.length}</span><small>sessões</small></div>
      <div class="diary-stat"><span>${totalPages.toLocaleString('pt-BR')}</span><small>páginas</small></div>
      <div class="diary-stat"><span>${formatHours(totalMins/60)}</span><small>tempo total</small></div>
      ${topMood ? `<div class="diary-stat"><span>${MOOD_ICONS[topMood[0]] || topMood[0]}</span><small>humor frequente</small></div>` : ''}`;
  } else if (statsEl) {
    statsEl.innerHTML = '';
  }

  if (State.diaryEntries.length === 0) { container.innerHTML = '<p class="empty-state">Nenhuma sessão registrada ainda.</p>'; return; }

  const sorted = [...State.diaryEntries].sort((a,b) => new Date(b.date) - new Date(a.date));
  container.innerHTML = sorted.map(e => {
    const book = State.books.find(b => b.id === e.bookId);
    return `<div class="diary-entry">
      <div class="diary-entry-header">
        <div class="diary-entry-meta">
          <span class="diary-mood">${MOOD_ICONS[e.mood] || ''} ${e.mood}</span>
          <span class="diary-date">${formatDate(e.date)}</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-icon" style="color:var(--red)" onclick="deleteDiaryEntry('${e.id}')">✕</button>
        </div>
      </div>
      ${book ? `<div class="diary-book-ref">${esc(book.title)}</div>` : ''}
      <div class="diary-numbers">
        ${e.pages ? `<span>📖 ${e.pages} páginas</span>` : ''}
        ${e.duration ? `<span>⏱ ${e.duration} min</span>` : ''}
      </div>
      ${e.note ? `<div class="diary-note">${esc(e.note)}</div>` : ''}
    </div>`;
  }).join('');
}

function renderVocabulary() {
  const container = document.getElementById('vocab-grid');
  if (!container) return;
  const searchTerm = document.getElementById('vocab-search')?.value.toLowerCase() || '';
  let vocab = [...State.vocabulary];
  if (searchTerm) vocab = vocab.filter(v => v.term.toLowerCase().includes(searchTerm) || v.definition.toLowerCase().includes(searchTerm));
  vocab.sort((a,b) => a.term.localeCompare(b.term));

  if (vocab.length === 0) { container.innerHTML = '<p class="empty-state">Nenhum conceito definido ainda.</p>'; return; }
  container.innerHTML = vocab.map(v => `
    <div class="vocab-card">
      <div class="vocab-term">${esc(v.term)}</div>
      ${v.origin ? `<div class="vocab-origin">${esc(v.origin)}</div>` : ''}
      <div class="vocab-def">${esc(v.definition)}</div>
      ${v.source ? `<div class="vocab-source">Em: ${esc(v.source)}</div>` : ''}
      ${(v.related || []).length > 0 ? `<div class="vocab-related">${v.related.map(r => `<span class="book-tag">${esc(r)}</span>`).join('')}</div>` : ''}
      <div class="vocab-actions">
        <button class="btn-icon" onclick="editVocab('${v.id}')">✏</button>
        <button class="btn-icon" style="color:var(--red)" onclick="deleteVocab('${v.id}')">✕</button>
      </div>
    </div>`).join('');
}

function renderAuthors() {
  const container = document.getElementById('authors-grid');
  if (!container) return;
  if (State.authors.length === 0) { container.innerHTML = '<p class="empty-state">Nenhum autor cadastrado.</p>'; return; }
  container.innerHTML = State.authors.map(a => {
    const booksInLib = State.books.filter(b => b.author.toLowerCase() === a.name.toLowerCase());
    return `<div class="author-card">
      <div class="author-name">${esc(a.name)}</div>
      <div class="author-meta">${[a.life, a.school, a.origin].filter(Boolean).map(esc).join(' · ')}</div>
      ${a.bio ? `<div class="author-bio">${esc(a.bio)}</div>` : ''}
      ${(a.influencedBy || []).length > 0 ? `<div class="author-influences"><span class="author-label">Influenciado por:</span> ${a.influencedBy.map(esc).join(', ')}</div>` : ''}
      ${(a.influenced || []).length > 0 ? `<div class="author-influences"><span class="author-label">Influenciou:</span> ${a.influenced.map(esc).join(', ')}</div>` : ''}
      ${(a.concepts || []).length > 0 ? `<div class="vocab-related">${a.concepts.map(c => `<span class="book-tag">${esc(c)}</span>`).join('')}</div>` : ''}
      ${booksInLib.length > 0 ? `<div class="author-books-count">📚 ${booksInLib.length} livro(s) na biblioteca</div>` : ''}
      <div class="vocab-actions">
        <button class="btn-icon" onclick="editAuthor('${a.id}')">✏</button>
        <button class="btn-icon" style="color:var(--red)" onclick="deleteAuthor('${a.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

function renderGenealogy() {
  const container = document.getElementById('genealogy-view');
  if (!container) return;
  if (State.authors.length === 0) { container.innerHTML = '<p class="empty-state">Cadastre autores com campos de influência para ver a genealogia.</p>'; return; }

  const nodes = new Map();
  State.authors.forEach(a => { nodes.set(a.name.toLowerCase(), a); });

  const lines = [];
  State.authors.forEach(a => {
    (a.influencedBy || []).forEach(inf => {
      lines.push({ from: inf, to: a.name });
    });
  });

  if (lines.length === 0) { container.innerHTML = '<p class="empty-state">Preencha "Influenciado por" nos autores para ver a árvore.</p>'; return; }

  container.innerHTML = `<div class="genealogy-tree">` +
    lines.map(l => `<div class="genealogy-line">
      <span class="genealogy-node from">${esc(l.from)}</span>
      <span class="genealogy-arrow">→</span>
      <span class="genealogy-node to">${esc(l.to)}</span>
    </div>`).join('') + `</div>`;
}

function renderLists() {
  const container = document.getElementById('lists-container');
  if (!container) return;
  if (State.themeLists.length === 0) { container.innerHTML = '<p class="empty-state">Nenhuma lista criada ainda.</p>'; return; }
  container.innerHTML = State.themeLists.map(list => {
    const listBooks = State.books.filter(b => (list.bookIds || []).includes(b.id));
    const done = listBooks.filter(b => b.status === 'concluido').length;
    return `<div class="list-card">
      <div class="list-card-header">
        <div>
          <div class="list-title">${esc(list.name)}</div>
          ${list.description ? `<div class="list-desc">${esc(list.description)}</div>` : ''}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-icon" onclick="editList('${list.id}')">✏</button>
          <button class="btn-icon" style="color:var(--red)" onclick="deleteList('${list.id}')">✕</button>
        </div>
      </div>
      <div class="list-progress-bar">
        <div class="list-progress-fill" style="width:${listBooks.length ? Math.round(done/listBooks.length*100) : 0}%"></div>
      </div>
      <div class="list-books">
        ${listBooks.length === 0 ? '<p class="empty-state" style="font-size:.8rem">Nenhum livro nesta lista.</p>' :
          listBooks.map(b => `<div class="list-book-item">
            <span class="book-status-dot ${b.status}"></span>
            <span class="list-book-title">${esc(b.title)}</span>
            <span class="list-book-author">${esc(b.author)}</span>
          </div>`).join('')}
      </div>
      <div class="list-footer">${done}/${listBooks.length} concluídos</div>
    </div>`;
  }).join('');
}

function renderConnections() {
  const container = document.getElementById('connections-view');
  if (!container) return;
  const activeBtn = document.querySelector('[data-conn].active');
  const mode = activeBtn?.dataset.conn || 'concepts';

  if (State.books.length === 0) { container.innerHTML = '<p class="empty-state">Adicione livros para ver conexões.</p>'; return; }

  if (mode === 'concepts') {
    // Group books by shared tags
    const tagMap = {};
    State.books.forEach(b => {
      (b.tags || []).forEach(t => {
        const key = t.trim().toLowerCase();
        if (!key) return;
        if (!tagMap[key]) tagMap[key] = [];
        tagMap[key].push(b);
      });
    });
    const sorted = Object.entries(tagMap).filter(([,v]) => v.length > 0).sort((a,b) => b[1].length - a[1].length);
    container.innerHTML = `<div class="connections-grid">` +
      sorted.map(([tag, books]) => `
        <div class="connection-cluster">
          <div class="connection-tag">✦ ${esc(tag)}</div>
          <div class="connection-books">
            ${books.map(b => `<div class="connection-book-pill" style="border-color:${getCatColor(b.category)}66">${esc(b.title)}</div>`).join('')}
          </div>
        </div>`).join('') + `</div>`;
  } else if (mode === 'authors') {
    renderGenealogy();
  } else if (mode === 'era') {
    const eraMap = {};
    State.books.forEach(b => {
      const era = b.era || 'Indefinida';
      if (!eraMap[era]) eraMap[era] = [];
      eraMap[era].push(b);
    });
    container.innerHTML = `<div class="connections-grid">` +
      Object.entries(eraMap).sort((a,b) => a[0].localeCompare(b[0])).map(([era, books]) => `
        <div class="connection-cluster">
          <div class="connection-tag">◈ ${esc(era)}</div>
          <div class="connection-books">
            ${books.map(b => `<div class="connection-book-pill">${esc(b.title)}</div>`).join('')}
          </div>
        </div>`).join('') + `</div>`;
  }
}

function switchConnView(mode, btn) {
  document.querySelectorAll('[data-conn]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderConnections();
}

function renderOpenQuestions() {
  const container = document.getElementById('questions-list');
  if (!container) return;
  if (State.openQuestions.length === 0) { container.innerHTML = '<p class="empty-state">Nenhuma pergunta registrada ainda.</p>'; return; }

  const open     = State.openQuestions.filter(q => !q.resolved);
  const resolved = State.openQuestions.filter(q => q.resolved);

  const renderQ = (q) => {
    const book = State.books.find(b => b.id === q.bookId);
    return `<div class="question-item ${q.resolved ? 'resolved' : ''}">
      <div class="question-content">
        <div class="question-text">${esc(q.text)}</div>
        ${book ? `<div class="question-source">de: ${esc(book.title)}</div>` : ''}
        ${q.answer ? `<div class="question-answer">→ ${esc(q.answer)}</div>` : ''}
      </div>
      <div class="question-actions">
        ${!q.resolved ? `<button class="btn-icon" onclick="resolveQuestion('${q.id}')">✓ Resolver</button>` : '<span class="resolved-badge">Resolvida</span>'}
        <button class="btn-icon" style="color:var(--red)" onclick="deleteQuestion('${q.id}')">✕</button>
      </div>
    </div>`;
  };

  container.innerHTML =
    (open.length > 0 ? `<h3 class="questions-subheader">Abertas (${open.length})</h3>${open.map(renderQ).join('')}` : '') +
    (resolved.length > 0 ? `<h3 class="questions-subheader resolved-header">Resolvidas (${resolved.length})</h3>${resolved.map(renderQ).join('')}` : '');
}

function renderInsights() {
  const completed = State.books.filter(b => b.status === 'concluido');
  const allBooks  = State.books;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  const avgPages = completed.length > 0
    ? Math.round(completed.reduce((s, b) => s + (b.totalPages || 0), 0) / completed.length) : null;
  setEl('ins-avg-pages', avgPages ? avgPages.toLocaleString('pt-BR') : '—');

  setEl('ins-avg-rating', '—');

  const catCount = {};
  allBooks.forEach(b => { catCount[b.category] = (catCount[b.category] || 0) + 1; });
  const bestCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
  setEl('ins-best-cat', bestCat ? bestCat[0] : '—');
  setEl('ins-streak', State.diaryEntries.length);

  const totalHours = State.diaryEntries.reduce((s, e) => s + (e.duration || 0), 0) / 60;
  setEl('ins-total-hours', State.diaryEntries.length > 0 ? formatHours(totalHours) : '—');

  const topBooks = document.getElementById('top-books-list');
  if (topBooks) {
    const top = [...completed].slice(-5).reverse();
    if (top.length === 0) { topBooks.innerHTML = '<p class="empty-state">Nenhum livro avaliado ainda.</p>'; }
    else topBooks.innerHTML = top.map((b, i) => `
      <div class="current-read-item" style="cursor:default">
        <div class="current-read-spine" style="background:${getCatColor(b.category)}"></div>
        <div class="current-read-info">
          <div class="current-read-title">${i + 1}. ${esc(b.title)}</div>
          <div class="current-read-author">${esc(b.author)}</div>
        </div>
      </div>`).join('');
  }

  const queueList = document.getElementById('queue-list');
  if (queueList) {
    const queue = State.books.filter(b => b.status === 'futuro');
    if (queue.length === 0) { queueList.innerHTML = '<p class="empty-state">Fila de espera vazia.</p>'; }
    else queueList.innerHTML = queue.map(b => `
      <div class="current-read-item" style="cursor:default">
        <div class="current-read-spine" style="background:${getCatColor(b.category)}"></div>
        <div class="current-read-info">
          <div class="current-read-title">${esc(b.title)}</div>
          <div class="current-read-author">${esc(b.author)}</div>
        </div>
        <span class="current-read-pct" style="color:var(--text-3)">fila</span>
      </div>`).join('');
  }

  const catBreak = document.getElementById('ins-cat-breakdown');
  if (catBreak) {
    const cats = Object.entries(catCount).sort((a, b) => b[1] - a[1]);
    const total = allBooks.length || 1;
    catBreak.innerHTML = cats.map(([cat, count]) => {
      const w = Math.round((count / total) * 100);
      const color = getCatColor(cat);
      const doneInCat = State.books.filter(b => b.category === cat && b.status === 'concluido').length;
      return `<div class="cat-bar-row" style="margin-bottom:12px">
        <div class="cat-bar-label">
          <span style="font-size:0.85rem;color:var(--text)">${cat}</span>
          <span style="font-family:var(--font-mono);font-size:0.75rem;color:${color}">${count} total · ${doneInCat} concluídos</span>
        </div>
        <div class="cat-bar-track" style="height:8px">
          <div class="cat-bar-fill" style="width:${w}%;background:${color}"></div>
        </div>
      </div>`;
    }).join('');
  }
}

function renderTimeline() {
  const container = document.getElementById('timeline-container');
  if (!container) return;
  const byYear = {};
  State.books.forEach(b => {
    const yr = b.year || getCurrentYear();
    if (!byYear[yr]) byYear[yr] = [];
    byYear[yr].push(b);
  });
  const years = Object.keys(byYear).sort((a, b) => b - a);
  if (years.length === 0) { container.innerHTML = '<p class="empty-state">Nenhum livro com ano cadastrado.</p>'; return; }
  container.innerHTML = years.map(yr => {
    const books = byYear[yr];
    const booksHtml = books.map(b => `
      <div class="timeline-book-item">
        <div class="timeline-book-info">
          <div class="timeline-book-title">${esc(b.title)}</div>
          <div class="timeline-book-meta">
            <span>${esc(b.author)}</span>
            <span>${b.status === 'concluido' ? '✓ concluído' : b.status === 'lendo' ? '↻ lendo' : '◷ fila'}</span>
          </div>
        </div>
        <span class="timeline-badge" style="border-color:${getCatColor(b.category)}44;color:${getCatColor(b.category)}">${b.category}</span>
      </div>`).join('');
    const yearDone = books.filter(b => b.status === 'concluido').length;
    return `<div class="timeline-year-group">
      <div class="timeline-year-label" title="${yearDone}/${books.length} concluídos">${yr}</div>
      <div class="timeline-books">${booksHtml}</div>
    </div>`;
  }).join('');
}

function renderTagsCloud() {
  const cloud = document.getElementById('tags-cloud');
  if (!cloud) return;
  const tagMap = {};
  State.books.forEach(b => {
    (b.tags || []).forEach(t => {
      const key = t.trim().toLowerCase();
      if (!key) return;
      if (!tagMap[key]) tagMap[key] = [];
      tagMap[key].push(b.id);
    });
  });
  const sorted = Object.entries(tagMap).sort((a, b) => b[1].length - a[1].length);
  if (sorted.length === 0) { cloud.innerHTML = '<p class="empty-state">Nenhuma tag cadastrada.</p>'; return; }
  const max = sorted[0][1].length;
  cloud.innerHTML = sorted.map(([tag, ids]) => {
    const size = 0.7 + (ids.length / max) * 0.55;
    return `<span class="tag-pill" style="font-size:${size}rem" onclick="filterByTag('${esc(tag)}')" data-tag="${esc(tag)}">${esc(tag)}<span class="tag-count">${ids.length}</span></span>`;
  }).join('');
}

function filterByTag(tag) {
  document.querySelectorAll('.tag-pill').forEach(p => p.classList.toggle('active', p.dataset.tag === tag));
  const tagMap = {};
  State.books.forEach(b => {
    (b.tags || []).forEach(t => {
      const key = t.trim().toLowerCase();
      if (!tagMap[key]) tagMap[key] = [];
      tagMap[key].push(b.id);
    });
  });
  const bookIds = tagMap[tag] || [];
  const result  = document.getElementById('tag-books-result');
  if (!result) return;
  if (bookIds.length === 0) { result.innerHTML = ''; return; }
  const books = State.books.filter(b => bookIds.includes(b.id));
  result.innerHTML = `<h3 style="font-family:var(--font-display);margin-bottom:16px">Obras com o conceito <em>${esc(tag)}</em></h3>
    <div class="tag-results-grid">
      ${books.map(b => `<div class="book-card" style="--card-accent:${getCatColor(b.category)}">
        <div class="book-card-top">
          <span class="book-category-badge" style="border-color:${getCatColor(b.category)}44;color:${getCatColor(b.category)}">${b.category}</span>
          <span class="book-status-dot ${b.status}"></span>
        </div>
        <div><div class="book-title">${esc(b.title)}</div><div class="book-author">${esc(b.author)}</div></div>
          <div class="book-card-actions">
          <button class="btn-icon" onclick="openNotesModal('${b.id}')">✎ Notas</button>
          <button class="btn-icon" onclick="openBookModal('${b.id}')">✏ Editar</button>
        </div>
      </div>`).join('')}
    </div>`;
}

function renderFocusMode() {
  const picker  = document.getElementById('focus-book-picker');
  const content = document.getElementById('focus-content');
  if (!picker) return;

  if (State.books.length === 0) {
    picker.innerHTML = '<p class="empty-state">Nenhum livro na biblioteca.</p>';
    return;
  }

  picker.innerHTML = State.books.map(b => `
    <div class="focus-book-option" onclick="activateFocus('${b.id}')">
      <span style="color:${getCatColor(b.category)}">◉</span>
      <span>${esc(b.title)}</span>
    </div>`).join('');
}

function activateFocus(bookId) {
  const book = State.books.find(b => b.id === bookId);
  if (!book) return;

  const intro = document.getElementById('focus-intro');
  const content = document.getElementById('focus-content');
  if (intro) intro.style.display = 'none';
  if (!content) return;

  // Get best quote for this book
  const bookQuotes = State.quotes.filter(q => q.bookId === bookId);
  const bookNotes  = State.notes.filter(n => n.bookId === bookId);
  const day = new Date().getDate();
  const focusQuote = bookQuotes.length > 0 ? bookQuotes[day % bookQuotes.length] : null;
  const focusNote  = bookNotes.length  > 0 ? bookNotes[day % bookNotes.length]   : null;

  content.innerHTML = `
    <div class="focus-book-title">${esc(book.title)}</div>
    <div class="focus-author">${esc(book.author)}</div>
    ${focusQuote ? `<div class="focus-quote-block">
      <div class="quote-glyph" style="font-size:2rem;margin-bottom:12px">❝</div>
      <div class="focus-quote-text">${esc(focusQuote.text)}</div>
    </div>` : ''}
    ${focusNote ? `<div class="focus-notes-block">
      ${focusNote.synthesis ? `<div class="focus-note-section"><div class="note-field-label">Síntese</div><p>${esc(focusNote.synthesis)}</p></div>` : ''}
      ${focusNote.impact ? `<div class="focus-note-section"><div class="note-field-label">Impacto Pessoal</div><p>${esc(focusNote.impact)}</p></div>` : ''}
    </div>` : '<p class="empty-state" style="margin-top:32px">Sem anotações para este livro.</p>'}
    <button class="btn-ghost" style="margin-top:32px" onclick="exitFocus()">← Sair do Foco</button>`;
  content.classList.remove('hidden');
}

function exitFocus() {
  const intro = document.getElementById('focus-intro');
  const content = document.getElementById('focus-content');
  if (intro) intro.style.display = '';
  if (content) content.classList.add('hidden');
}

function openBookModal(bookId = null) {
  State.editingBookId = bookId;
  const modal = document.getElementById('book-modal-overlay');
  const form  = document.getElementById('book-form');
  form.reset();
  document.getElementById('book-id').value = '';
  document.getElementById('modal-title').textContent = 'Novo Livro';

  populateCategorySelects();
  if (bookId) {
    const b = State.books.find(b => b.id === bookId);
    if (!b) return;
    document.getElementById('modal-title').textContent = 'Editar Livro';
    document.getElementById('book-id').value         = b.id;
    document.getElementById('book-title').value      = b.title;
    document.getElementById('book-author').value     = b.author;
    document.getElementById('book-category').value   = b.category;
    document.getElementById('book-status').value     = b.status;
    document.getElementById('book-total-pages').value= b.totalPages || '';
    document.getElementById('book-pages-read').value = b.pagesRead || '';
    document.getElementById('book-year').value       = b.year || '';
    document.getElementById('book-tags').value       = (b.tags || []).join(', ');
    document.getElementById('book-quick-notes').value= b.quickNotes || '';
    document.getElementById('book-review-days').value= b.reviewDays || '';
    document.getElementById('book-era').value        = b.era || '';
    const beforeEl = document.getElementById('book-before');
    if (beforeEl) beforeEl.value = b.before || '';
  }
  modal.classList.add('active');
}

function closeBookModal() {
  // Don't close if the new-tag dialog is still active
  const tagDialog = document.getElementById('new-tag-dialog-overlay');
  if (tagDialog && tagDialog.classList.contains('active')) return;
  document.getElementById('book-modal-overlay').classList.remove('active');
  State.editingBookId = null;
}

function openBookView(bookId) {
  const b = State.books.find(b => b.id === bookId);
  if (!b) return;
  const color = getCatColor(b.category);
  const p = pct(b.pagesRead || 0, b.totalPages || 0);
  const statusLabels = { lendo: 'Em leitura', concluido: 'Concluído', futuro: 'Fila de espera' };
  const tags = (b.tags || []);
  const tagColors = {};
  State.globalTags.forEach(t => { tagColors[typeof t === 'string' ? t : t.tag] = typeof t === 'string' ? '#7a8090' : (t.color || '#7a8090'); });

  const overlay = document.getElementById('book-view-overlay');
  overlay.innerHTML = `
    <div class="modal modal-wide book-view-modal">
      <div class="book-view-header" style="--view-accent:${color}">
        <div class="book-view-header-left">
          <span class="book-view-category" style="color:${color};border-color:${color}44">${esc(b.category)}</span>
          <span class="book-view-status ${b.status}">${statusLabels[b.status] || b.status}</span>
        </div>
        <button class="modal-close" onclick="closeBookView()">✕</button>
      </div>
      <div class="book-view-body">
        <div class="book-view-title">${esc(b.title)}</div>
        <div class="book-view-author">${esc(b.author)}</div>

        ${b.totalPages ? `
        <div class="book-view-progress">
          <div class="book-view-progress-track"><div class="book-view-progress-fill" style="width:${p}%;background:${color}"></div></div>
          <span class="book-view-progress-label">${p}% concluído — ${b.pagesRead || 0} / ${b.totalPages} páginas</span>
        </div>` : ''}

        <div class="book-view-meta-row">
          ${b.year     ? `<div class="book-view-meta-item"><span class="book-view-meta-label">Ano</span><span>${b.year}</span></div>` : ''}
          ${b.era      ? `<div class="book-view-meta-item"><span class="book-view-meta-label">Época</span><span>${esc(b.era)}</span></div>` : ''}
          ${b.reviewDays ? `<div class="book-view-meta-item"><span class="book-view-meta-label">Revisão</span><span>${b.reviewDays} dias</span></div>` : ''}
        </div>

        ${tags.length > 0 ? `
        <div class="book-view-tags">
          ${tags.map(t => `<span class="book-view-tag" style="border-color:${(tagColors[t]||'#7a8090')}44;color:${tagColors[t]||'#7a8090'}">${esc(t)}</span>`).join('')}
        </div>` : ''}

        ${b.quickNotes ? `
        <div class="book-view-section">
          <div class="book-view-section-label">📝 Notas Rápidas</div>
          <div class="book-view-section-text">${esc(b.quickNotes)}</div>
        </div>` : ''}

        ${b.before ? `
        <div class="book-view-section">
          <div class="book-view-section-label">💭 Antes de ler</div>
          <div class="book-view-section-text">${esc(b.before)}</div>
        </div>` : ''}
      </div>
      <div class="book-view-footer">
        <button class="btn-ghost" onclick="closeBookView()">Fechar</button>
        <button class="btn-secondary" onclick="closeBookView();openNotesModal('${b.id}')">✎ Anotações</button>
        <button class="btn-primary" onclick="closeBookView();openBookModal('${b.id}')">✏ Editar</button>
      </div>
    </div>`;
  overlay.classList.add('active');
}

function closeBookView() {
  document.getElementById('book-view-overlay').classList.remove('active');
}

function toggleBookMenu(e, bookId) {
  e.stopPropagation();
  const menu = document.getElementById(`menu-${bookId}`);
  const isOpen = menu.classList.contains('open');
  closeAllMenus();
  if (!isOpen) menu.classList.add('open');
}

function closeAllMenus() {
  document.querySelectorAll('.book-action-dropdown.open').forEach(m => m.classList.remove('open'));
}

function saveBook(e) {
  e.preventDefault();
  const id     = document.getElementById('book-id').value;
  const status = document.getElementById('book-status').value;
  const bookData = {
    title:      document.getElementById('book-title').value.trim(),
    author:     document.getElementById('book-author').value.trim(),
    category:   document.getElementById('book-category').value,
    status,
    totalPages: parseInt(document.getElementById('book-total-pages').value) || 0,
    pagesRead:  parseInt(document.getElementById('book-pages-read').value) || 0,
    year:       parseInt(document.getElementById('book-year').value) || getCurrentYear(),
    tags:       document.getElementById('book-tags').value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
    quickNotes: document.getElementById('book-quick-notes').value.trim(),
    reviewDays: parseInt(document.getElementById('book-review-days').value) || null,
    era:        document.getElementById('book-era')?.value.trim() || '',
    before:     document.getElementById('book-before')?.value.trim() || '',
  };

  // Verificar tags desconhecidas — perguntar antes de criar
  const knownTags = new Set(State.globalTags.map(t => typeof t === 'string' ? t : t.tag));
  const unknownTags = bookData.tags.filter(t => !knownTags.has(t));
  if (unknownTags.length > 0) {
    showNewTagDialog(unknownTags[0], bookData, id, unknownTags.slice(1));
    return;
  }

  _doSaveBook(id, bookData);
}

function _doSaveBook(id, bookData) {
  const op = id ? API.put(`/books/${id}`, bookData) : API.post('/books', bookData);
  op.then(result => {
    if (!result) return; // erro já mostrado pelo API
    Storage.load().then(() => {
      populateCategorySelects();
      populateTagSuggestions();
      closeBookModal();
      refreshAll();
      showToast(id ? 'Livro atualizado!' : 'Livro adicionado!', 'success');
    });
  });
}

// New-tag dialog queue
let _pendingNewTagResolve = null;
let _pendingNewTagBookData = null;
let _pendingNewTagBookId = null;
let _pendingNewTagQueue = [];

function showNewTagDialog(tag, bookData, bookId, queue) {
  _pendingNewTagResolve = tag;
  _pendingNewTagBookData = bookData;
  _pendingNewTagBookId = bookId;
  _pendingNewTagQueue = queue;
  document.getElementById('new-tag-dialog-name').textContent = `"${tag}"`;
  document.getElementById('new-tag-dialog-overlay').classList.add('active');
}

function _initNewTagDialog() {
  const overlay = document.getElementById('new-tag-dialog-overlay');
  if (!overlay) return;

  document.getElementById('new-tag-dialog-yes').addEventListener('click', () => {
    overlay.classList.remove('active');
    const tag = _pendingNewTagResolve;
    API.post('/tags', { tag, color: '#7a8090' }).then(() => {
      Storage.load().then(() => {
        populateTagSuggestions();
        if (_pendingNewTagQueue.length > 0) {
          const next = _pendingNewTagQueue[0];
          showNewTagDialog(next, _pendingNewTagBookData, _pendingNewTagBookId, _pendingNewTagQueue.slice(1));
        } else {
          _doSaveBook(_pendingNewTagBookId, _pendingNewTagBookData);
        }
      });
    });
  });

  document.getElementById('new-tag-dialog-no').addEventListener('click', () => {
    overlay.classList.remove('active');
    // Remove this unknown tag from the list and check for more
    const tag = _pendingNewTagResolve;
    if (_pendingNewTagBookData) {
      _pendingNewTagBookData.tags = _pendingNewTagBookData.tags.filter(t => t !== tag);
    }
    if (_pendingNewTagQueue.length > 0) {
      // Still more unknown tags to resolve — show next
      const next = _pendingNewTagQueue[0];
      showNewTagDialog(next, _pendingNewTagBookData, _pendingNewTagBookId, _pendingNewTagQueue.slice(1));
    } else {
      // No more unknown tags — return focus to book modal WITHOUT saving
      // Book modal stays open so user can adjust tags manually
      _pendingNewTagBookData = null;
      _pendingNewTagBookId = null;
    }
  });

  overlay.addEventListener('click', e => {
    e.stopPropagation();
  });
}

function deleteBook(id) {
  confirmDialog('Excluir Livro', 'Este livro e todas as suas anotações serão removidos permanentemente.', 'Excluir', () => {
    API.delete(`/books/${id}`).then(() => {
      Storage.load().then(() => refreshAll());
    });
  });
}

function openNotesModal(bookId, noteId = null) {
  State.editingNoteBookId = bookId;
  const modal = document.getElementById('notes-modal-overlay');
  const form  = document.getElementById('notes-form');
  form.reset();
  const book = State.books.find(b => b.id === bookId);
  document.getElementById('notes-modal-title').textContent = book ? `Anotações — ${book.title}` : 'Anotações';
  document.getElementById('note-book-id').value = bookId;
  document.getElementById('note-id').value = '';

  if (noteId) {
    const note = State.notes.find(n => n.id === noteId);
    if (note) {
      document.getElementById('note-id').value        = note.id;
      document.getElementById('note-quote').value     = note.quote || '';
      document.getElementById('note-synthesis').value = note.synthesis || '';
      document.getElementById('note-impact').value    = note.impact || '';
      document.getElementById('note-questions').value = note.questions || '';
      document.getElementById('note-practice').value  = note.practice || '';
      const afterEl = document.getElementById('note-after');
      if (afterEl) afterEl.value = note.after || '';
    }
  }
  modal.classList.add('active');
}

function closeNotesModal() {
  document.getElementById('notes-modal-overlay').classList.remove('active');
  State.editingNoteBookId = null;
}

function saveNote(e) {
  e.preventDefault();
  const id     = document.getElementById('note-id').value;
  const bookId = document.getElementById('note-book-id').value;
  const noteData = {
    bookId,
    quote:     document.getElementById('note-quote').value.trim(),
    synthesis: document.getElementById('note-synthesis').value.trim(),
    impact:    document.getElementById('note-impact').value.trim(),
    questions: document.getElementById('note-questions').value.trim(),
    practice:  document.getElementById('note-practice').value.trim(),
    after:     document.getElementById('note-after')?.value.trim() || '',
  };
  const op = id ? API.put(`/notes/${id}`, noteData) : API.post('/notes', noteData);
  op.then(() => {
    Storage.load().then(() => {
      closeNotesModal();
      renderStats(); renderBadges(); renderActivityFeed();
      if (State.activeSection === 'notes') renderNotes();
      if (State.activeSection === 'dashboard') renderDashboard();
    });
  });
}

function deleteNote(id) {
  confirmDialog('Excluir Anotação', 'Esta anotação será removida permanentemente.', 'Excluir', () => {
    API.delete(`/notes/${id}`).then(() => {
      Storage.load().then(() => { renderStats(); renderBadges(); renderNotes(); });
    });
  });
}

function openQuoteModal(quoteId = null) {
  const modal = document.getElementById('quote-modal-overlay');
  const form  = document.getElementById('quote-form');
  form.reset();
  document.getElementById('quote-id').value = '';
  document.getElementById('quote-modal-title').textContent = 'Nova Citação';

  const bookSelect = document.getElementById('q-book');
  bookSelect.innerHTML = '<option value="">— avulsa —</option>' +
    State.books.map(b => `<option value="${b.id}">${esc(b.title)}</option>`).join('');

  if (quoteId) {
    const q = State.quotes.find(q => q.id === quoteId);
    if (q) {
      document.getElementById('quote-id').value  = q.id;
      document.getElementById('q-text').value    = q.text || '';
      document.getElementById('q-book').value    = q.bookId || '';
      document.getElementById('q-tags').value    = (q.tags || []).join(', ');
      document.getElementById('q-reflection').value = q.reflection || '';
      document.getElementById('quote-modal-title').textContent = 'Editar Citação';
    }
  }
  modal.classList.add('active');
}

function closeQuoteModal() {
  document.getElementById('quote-modal-overlay').classList.remove('active');
}

function saveQuote(e) {
  e.preventDefault();
  const id = document.getElementById('quote-id').value;
  const bookId = document.getElementById('q-book').value;
  const quoteData = {
    text:       document.getElementById('q-text').value.trim(),
    bookId:     bookId || null,
    tags:       document.getElementById('q-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    reflection: document.getElementById('q-reflection').value.trim(),
  };
  const op = id ? API.put(`/quotes/${id}`, quoteData) : API.post('/quotes', quoteData);
  op.then(() => {
    Storage.load().then(() => {
      closeQuoteModal();
      renderStats(); renderBadges();
      if (State.activeSection === 'quotes') renderQuotesMural();
    });
  });
}

function editQuote(id) { openQuoteModal(id); }
function deleteQuote(id) {
  confirmDialog('Excluir Citação', 'Esta citação será removida permanentemente.', 'Excluir', () => {
    API.delete(`/quotes/${id}`).then(() => {
      Storage.load().then(() => { renderStats(); renderQuotesMural(); });
    });
  });
}

function openDiaryModal() {
  const modal = document.getElementById('diary-modal-overlay');
  document.getElementById('diary-id').value = '';
  const dateInput = document.getElementById('diary-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  const bookSelect = document.getElementById('diary-book');
  if (bookSelect) {
    bookSelect.innerHTML = '<option value="">Selecionar…</option>' +
      State.books.map(b => `<option value="${b.id}">${esc(b.title)}</option>`).join('');
  }
  modal.classList.add('active');
}

function closeDiaryModal() {
  document.getElementById('diary-modal-overlay').classList.remove('active');
}

function saveDiaryEntry(e) {
  e.preventDefault();
  const id = document.getElementById('diary-id').value;
  const bookId = document.getElementById('diary-book').value;
  const entry = {
    bookId:   bookId || null,
    date:     document.getElementById('diary-date').value || new Date().toISOString().split('T')[0],
    pagesRead: parseInt(document.getElementById('diary-pages').value) || 0,
    duration: parseInt(document.getElementById('diary-duration').value) || 0,
    mood:     document.getElementById('diary-mood').value,
    note:     document.getElementById('diary-note').value.trim(),
  };
  const op = id ? API.delete(`/diary/${id}`).then(() => API.post('/diary', entry)) : API.post('/diary', entry);
  op.then(() => {
    Storage.load().then(() => {
      closeDiaryModal();
      renderDiary();
      if (State.activeSection === 'dashboard') renderDashboard();
    });
  });
}

function deleteDiaryEntry(id) {
  confirmDialog('Excluir Entrada', 'Esta entrada do diário será removida permanentemente.', 'Excluir', () => {
    API.delete(`/diary/${id}`).then(() => {
      Storage.load().then(() => renderDiary());
    });
  });
}

function openVocabModal(vocabId = null) {
  const modal = document.getElementById('vocab-modal-overlay');
  document.getElementById('vocab-id').value = '';
  document.getElementById('vocab-modal-title').textContent = 'Novo Conceito';
  ['vocab-term','vocab-origin','vocab-def','vocab-source','vocab-related'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  if (vocabId) {
    const v = State.vocabulary.find(v => v.id === vocabId);
    if (v) {
      document.getElementById('vocab-id').value      = v.id;
      document.getElementById('vocab-term').value    = v.term || '';
      document.getElementById('vocab-origin').value  = v.origin || '';
      document.getElementById('vocab-def').value     = v.definition || '';
      document.getElementById('vocab-source').value  = v.source || '';
      document.getElementById('vocab-related').value = (v.related || []).join(', ');
      document.getElementById('vocab-modal-title').textContent = 'Editar Conceito';
    }
  }
  modal.classList.add('active');
}

function closeVocabModal() {
  document.getElementById('vocab-modal-overlay').classList.remove('active');
}

function saveVocab(e) {
  e.preventDefault();
  const id = document.getElementById('vocab-id').value;
  const vocabData = {
    term:       document.getElementById('vocab-term').value.trim(),
    origin:     document.getElementById('vocab-origin').value.trim(),
    definition: document.getElementById('vocab-def').value.trim(),
    source:     document.getElementById('vocab-source').value.trim(),
    related:    document.getElementById('vocab-related').value.split(',').map(t => t.trim()).filter(Boolean),
  };
  const op = id ? API.put(`/vocabulary/${id}`, vocabData) : API.post('/vocabulary', vocabData);
  op.then(() => {
    Storage.load().then(() => {
      closeVocabModal();
      renderStats(); renderVocabulary();
    });
  });
}

function editVocab(id) { openVocabModal(id); }
function deleteVocab(id) {
  confirmDialog('Excluir Conceito', 'Este conceito será removido do vocabulário.', 'Excluir', () => {
    API.delete(`/vocabulary/${id}`).then(() => {
      Storage.load().then(() => { renderStats(); renderVocabulary(); });
    });
  });
}

function openAuthorModal(authorId = null) {
  const modal = document.getElementById('author-modal-overlay');
  document.getElementById('author-id').value = '';
  document.getElementById('author-modal-title').textContent = 'Novo Autor';
  ['author-name','author-life','author-school','author-origin','author-bio','author-influenced-by','author-influenced','author-concepts'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  if (authorId) {
    const a = State.authors.find(a => a.id === authorId);
    if (a) {
      document.getElementById('author-id').value            = a.id;
      document.getElementById('author-name').value          = a.name || '';
      document.getElementById('author-life').value          = a.life || '';
      document.getElementById('author-school').value        = a.school || '';
      document.getElementById('author-origin').value        = a.origin || '';
      document.getElementById('author-bio').value           = a.bio || '';
      document.getElementById('author-influenced-by').value = (a.influencedBy || []).join(', ');
      document.getElementById('author-influenced').value    = (a.influenced || []).join(', ');
      document.getElementById('author-concepts').value      = (a.concepts || []).join(', ');
      document.getElementById('author-modal-title').textContent = 'Editar Autor';
    }
  }
  modal.classList.add('active');
}

function closeAuthorModal() {
  document.getElementById('author-modal-overlay').classList.remove('active');
}

function saveAuthor(e) {
  e.preventDefault();
  const id = document.getElementById('author-id').value;
  const authorData = {
    name:         document.getElementById('author-name').value.trim(),
    life:         document.getElementById('author-life').value.trim(),
    school:       document.getElementById('author-school').value.trim(),
    origin:       document.getElementById('author-origin').value.trim(),
    bio:          document.getElementById('author-bio').value.trim(),
    influencedBy: document.getElementById('author-influenced-by').value.split(',').map(t => t.trim()).filter(Boolean),
    influenced:   document.getElementById('author-influenced').value.split(',').map(t => t.trim()).filter(Boolean),
    concepts:     document.getElementById('author-concepts').value.split(',').map(t => t.trim()).filter(Boolean),
  };
  const op = id ? API.put(`/authors/${id}`, authorData) : API.post('/authors', authorData);
  op.then(() => {
    Storage.load().then(() => {
      closeAuthorModal();
      renderAuthors();
    });
  });
}

function editAuthor(id) { openAuthorModal(id); }
function deleteAuthor(id) {
  confirmDialog('Excluir Autor', 'Esta ficha de autor será removida permanentemente.', 'Excluir', () => {
    API.delete(`/authors/${id}`).then(() => {
      Storage.load().then(() => renderAuthors());
    });
  });
}

function openListModal(listId = null) {
  const modal = document.getElementById('list-modal-overlay');
  document.getElementById('list-id').value = '';
  document.getElementById('list-modal-title').textContent = 'Nova Lista';
  document.getElementById('list-name').value = '';
  document.getElementById('list-desc').value = '';

  // Books picker
  const picker = document.getElementById('list-books-picker');
  let selectedIds = [];
  if (listId) {
    const lst = State.themeLists.find(l => l.id === listId);
    if (lst) {
      document.getElementById('list-id').value = lst.id;
      document.getElementById('list-name').value = lst.name || '';
      document.getElementById('list-desc').value = lst.description || '';
      selectedIds = [...(lst.bookIds || [])];
      document.getElementById('list-modal-title').textContent = 'Editar Lista';
    }
  }

  if (picker) {
    picker.innerHTML = State.books.map(b => `
      <label class="picker-item">
        <input type="checkbox" value="${b.id}" ${selectedIds.includes(b.id) ? 'checked' : ''}>
        <span>${esc(b.title)}</span>
      </label>`).join('') || '<p class="empty-state" style="font-size:.8rem">Nenhum livro na biblioteca.</p>';
  }
  modal.classList.add('active');
}

function closeListModal() {
  document.getElementById('list-modal-overlay').classList.remove('active');
}

function saveList(e) {
  e.preventDefault();
  const id = document.getElementById('list-id').value;
  const bookIds = [...document.querySelectorAll('#list-books-picker input[type=checkbox]:checked')].map(cb => cb.value);
  const listData = {
    name:        document.getElementById('list-name').value.trim(),
    description: document.getElementById('list-desc').value.trim(),
    bookIds,
  };
  const op = id ? API.put(`/lists/${id}`, listData) : API.post('/lists', listData);
  op.then(() => {
    Storage.load().then(() => {
      closeListModal();
      renderLists();
    });
  });
}

function editList(id) { openListModal(id); }
function deleteList(id) {
  confirmDialog('Excluir Lista', 'Esta lista temática será removida permanentemente.', 'Excluir', () => {
    API.delete(`/lists/${id}`).then(() => {
      Storage.load().then(() => renderLists());
    });
  });
}

function openExportModal() {
  const modal = document.getElementById('export-modal-overlay');
  const select = document.getElementById('export-book-select');
  if (select) {
    select.innerHTML = '<option value="all">Todos os livros</option>' +
      State.books.map(b => `<option value="${b.id}">${esc(b.title)}</option>`).join('');
  }
  modal.classList.add('active');
}

function closeExportModal() {
  document.getElementById('export-modal-overlay').classList.remove('active');
}

function doExport() {
  const bookId = document.getElementById('export-book-select').value;
  const format = document.getElementById('export-format').value;
  const books = bookId === 'all' ? State.books : State.books.filter(b => b.id === bookId);

  let content = '';
  books.forEach(book => {
    const notes = State.notes.filter(n => n.bookId === book.id);
    const bookQuotes = State.quotes.filter(q => q.bookId === book.id);

    if (format === 'md') {
      content += `# ${book.title}\n**Autor:** ${book.author}\n**Categoria:** ${book.category}\n`;
      
      if (book.tags?.length) content += `**Tags:** ${book.tags.join(', ')}\n`;
      if (book.before) content += `\n## Antes de ler\n${book.before}\n`;
      content += '\n';
      notes.forEach(n => {
        if (n.quote)     content += `## Citação\n> ${n.quote}\n\n`;
        if (n.synthesis) content += `## Síntese\n${n.synthesis}\n\n`;
        if (n.impact)    content += `## Impacto Pessoal\n${n.impact}\n\n`;
        if (n.questions) content += `## Perguntas\n${n.questions}\n\n`;
        if (n.practice)  content += `## Aplicação Prática\n${n.practice}\n\n`;
        if (n.after)     content += `## Depois de ler\n${n.after}\n\n`;
      });
      bookQuotes.forEach(q => {
        content += `## Citação em destaque\n> "${q.text}"\n`;
        if (q.reflection) content += `*${q.reflection}*\n`;
        content += '\n';
      });
      content += '---\n\n';
    } else {
      content += `=== ${book.title.toUpperCase()} ===\n`;
      content += `Autor: ${book.author} | Categoria: ${book.category}\n`;
      if (book.before) content += `\nAntes de ler: ${book.before}\n`;
      content += '\n';
      notes.forEach(n => {
        if (n.quote)     content += `[Citação] ${n.quote}\n\n`;
        if (n.synthesis) content += `[Síntese] ${n.synthesis}\n\n`;
        if (n.impact)    content += `[Impacto] ${n.impact}\n\n`;
        if (n.questions) content += `[Perguntas] ${n.questions}\n\n`;
        if (n.practice)  content += `[Prática] ${n.practice}\n\n`;
        if (n.after)     content += `[Depois de ler] ${n.after}\n\n`;
      });
      bookQuotes.forEach(q => {
        content += `[Citação em destaque] "${q.text}"\n\n`;
      });
      content += '\n---\n\n';
    }
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `bibliotheca-anotacoes.${format === 'md' ? 'md' : 'txt'}`;
  a.click();
  URL.revokeObjectURL(url);
  closeExportModal();
}

function exportNoteAsText(noteId) {
  const note = State.notes.find(n => n.id === noteId);
  if (!note) return;
  const book = State.books.find(b => b.id === note.bookId);
  let content = `=== ANOTAÇÃO: ${book ? book.title.toUpperCase() : 'SEM LIVRO'} ===\n\n`;
  if (note.quote)     content += `[Citação]\n${note.quote}\n\n`;
  if (note.synthesis) content += `[Síntese]\n${note.synthesis}\n\n`;
  if (note.impact)    content += `[Impacto Pessoal]\n${note.impact}\n\n`;
  if (note.questions) content += `[Perguntas]\n${note.questions}\n\n`;
  if (note.practice)  content += `[Prática]\n${note.practice}\n\n`;
  if (note.after)     content += `[Depois de ler]\n${note.after}\n\n`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'anotacao.txt'; a.click();
  URL.revokeObjectURL(url);
}

function exportNoteAsMd(noteId) {
  const note = State.notes.find(n => n.id === noteId);
  if (!note) return;
  const book = State.books.find(b => b.id === note.bookId);
  let content = `# Anotação: ${book ? book.title : 'Sem livro'}\n\n`;
  if (note.quote)     content += `## Citação\n> ${note.quote}\n\n`;
  if (note.synthesis) content += `## Síntese\n${note.synthesis}\n\n`;
  if (note.impact)    content += `## Impacto Pessoal\n${note.impact}\n\n`;
  if (note.questions) content += `## Perguntas\n${note.questions}\n\n`;
  if (note.practice)  content += `## Aplicação Prática\n${note.practice}\n\n`;
  if (note.after)     content += `## Depois de ler\n${note.after}\n\n`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'anotacao.md'; a.click();
  URL.revokeObjectURL(url);
}

function openQuestionModal() {
  const modal = document.getElementById('question-modal-overlay');
  if (!modal) return;
  document.getElementById('question-id').value  = '';
  document.getElementById('question-text').value = '';
  document.getElementById('question-book').innerHTML = '<option value="">— sem livro específico —</option>' +
    State.books.map(b => `<option value="${b.id}">${esc(b.title)}</option>`).join('');
  modal.classList.add('active');
}

function closeQuestionModal() {
  const modal = document.getElementById('question-modal-overlay');
  if (modal) modal.classList.remove('active');
}

function saveQuestion(e) {
  e.preventDefault();
  const text = document.getElementById('question-text').value.trim();
  if (!text) return;
  const bookId = document.getElementById('question-book').value;
  API.post('/questions', { text, bookId: bookId || null }).then(() => {
    Storage.load().then(() => {
      closeQuestionModal();
      renderOpenQuestions();
    });
  });
}

function resolveQuestion(id) {
  const answer = prompt('Como você encontrou a resposta? (opcional)');
  if (answer === null) return;
  API.patch(`/questions/${id}/resolve`, { answer }).then(() => {
    Storage.load().then(() => renderOpenQuestions());
  });
}

function deleteQuestion(id) {
  confirmDialog('Excluir Pergunta', 'Esta pergunta será removida permanentemente.', 'Excluir', () => {
    API.delete(`/questions/${id}`).then(() => {
      Storage.load().then(() => renderOpenQuestions());
    });
  });
}

function showSection(name) {
  State.activeSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  const sec = document.getElementById(`section-${name}`);
  if (sec) sec.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === name);
  });

  switch(name) {
    case 'dashboard':   renderDashboard(); break;
    case 'books':       renderBooks(); break;
    case 'notes':       renderNotes(); break;
    case 'quotes':      renderQuotesMural(); break;
    case 'diary':       renderDiary(); break;
    case 'vocabulary':  renderVocabulary(); break;
    case 'authors':     renderAuthors(); break;
    case 'lists':       renderLists(); break;
    case 'connections': renderConnections(); break;
    case 'insights':    renderInsights(); break;
    case 'timeline':    renderTimeline(); break;
    case 'tags':        renderTagsCloud(); break;
    case 'focus':       renderFocusMode(); break;
    case 'questions':   renderOpenQuestions(); break;
    case 'settings':    renderSettings(); break;
  }
}

function refreshAll() {
  renderDashboard();
  const s = State.activeSection;
  if (s === 'books')       renderBooks();
  if (s === 'notes')       renderNotes();
  if (s === 'quotes')      renderQuotesMural();
  if (s === 'diary')       renderDiary();
  if (s === 'vocabulary')  renderVocabulary();
  if (s === 'authors')     renderAuthors();
  if (s === 'lists')       renderLists();
  if (s === 'connections') renderConnections();
  if (s === 'insights')    renderInsights();
  if (s === 'timeline')    renderTimeline();
  if (s === 'tags')        renderTagsCloud();
  if (s === 'questions')   renderOpenQuestions();
  if (s === 'settings')    renderSettings();
}

function initEvents() {
  // Nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      if (item.dataset.section === 'wishlist') return; // link externo, deixa navegar
      e.preventDefault();
      showSection(item.dataset.section);
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-overlay').classList.remove('active');
    });
  });

  // Book modal
  document.getElementById('add-book-btn').addEventListener('click', () => openBookModal());
  document.getElementById('add-book-btn-mobile')?.addEventListener('click', () => openBookModal());
  document.getElementById('book-form').addEventListener('submit', saveBook);
  document.getElementById('modal-close').addEventListener('click', closeBookModal);
  document.getElementById('modal-cancel').addEventListener('click', closeBookModal);

  // Auto-preencher páginas lidas ao marcar como concluído
  document.getElementById('book-status').addEventListener('change', function() {
    if (this.value === 'concluido') {
      const total = parseInt(document.getElementById('book-total-pages').value) || 0;
      if (total > 0) document.getElementById('book-pages-read').value = total;
    }
  });
  document.getElementById('book-modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'book-modal-overlay') {
      // Don't close book modal if the new-tag dialog is open on top
      const tagDialog = document.getElementById('new-tag-dialog-overlay');
      if (tagDialog && tagDialog.classList.contains('active')) return;
      closeBookModal();
    }
  });

  // Notes modal
  document.getElementById('notes-form').addEventListener('submit', saveNote);
  document.getElementById('notes-modal-close').addEventListener('click', closeNotesModal);
  document.getElementById('notes-modal-cancel').addEventListener('click', closeNotesModal);
  document.getElementById('notes-modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'notes-modal-overlay') closeNotesModal();
  });

  // Quote modal
  document.getElementById('quote-form')?.addEventListener('submit', saveQuote);
  document.getElementById('quote-modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'quote-modal-overlay') closeQuoteModal();
  });

  // Diary modal
  document.getElementById('diary-form')?.addEventListener('submit', saveDiaryEntry);
  document.getElementById('diary-modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'diary-modal-overlay') closeDiaryModal();
  });

  // Vocab modal
  document.getElementById('vocab-form')?.addEventListener('submit', saveVocab);
  document.getElementById('vocab-modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'vocab-modal-overlay') closeVocabModal();
  });

  // Author modal
  document.getElementById('author-form')?.addEventListener('submit', saveAuthor);
  document.getElementById('author-modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'author-modal-overlay') closeAuthorModal();
  });

  // List modal
  document.getElementById('list-form')?.addEventListener('submit', saveList);
  document.getElementById('list-modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'list-modal-overlay') closeListModal();
  });

  // Export modal
  document.getElementById('export-modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'export-modal-overlay') closeExportModal();
  });

  // Question modal
  document.getElementById('question-form')?.addEventListener('submit', saveQuestion);
  document.getElementById('question-modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'question-modal-overlay') closeQuestionModal();
  });

  // Quotes filter
  document.getElementById('quotes-book-filter')?.addEventListener('change', renderQuotesMural);
  document.getElementById('quotes-tag-filter')?.addEventListener('change', renderQuotesMural);

  // Filter buttons
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderBooks(btn.dataset.filter, document.getElementById('category-filter').value, document.getElementById('global-search').value);
    });
  });
  document.getElementById('category-filter')?.addEventListener('change', e => {
    const af = document.querySelector('[data-filter].active')?.dataset.filter || 'all';
    renderBooks(af, e.target.value, document.getElementById('global-search').value);
  });
  document.getElementById('sort-filter')?.addEventListener('change', () => {
    const af = document.querySelector('[data-filter].active')?.dataset.filter || 'all';
    renderBooks(af, document.getElementById('category-filter').value, document.getElementById('global-search').value);
  });

  // Global search
  let searchTimeout;
  document.getElementById('global-search').addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const term = e.target.value;
      if (term.length > 0) { showSection('books'); renderBooks('all', 'all', term); }
      else if (State.activeSection === 'books') renderBooks();
    }, 280);
  });

  // Notes filter
  document.getElementById('notes-book-filter')?.addEventListener('change', e => renderNotes(e.target.value));

  // Goal
  const goalInput = document.getElementById('goal-input');
  if (goalInput) {
    goalInput.value = State.goal;
    goalInput.addEventListener('input', e => {
      State.goal = parseInt(e.target.value) || 12;
      API.patch('/settings', { goal: String(State.goal) });
      renderGoalCircle();
      renderSidebarStatus();
    });
  }

  // Speed
  const speedInput = document.getElementById('speed-input');
  if (speedInput) {
    speedInput.value = State.speed;
    speedInput.addEventListener('input', e => {
      State.speed = parseInt(e.target.value) || 30;
      API.patch('/settings', { speed: String(State.speed) });
      renderSpeedWidget();
      renderCurrentReads();
    });
  }

  // Mobile burger
  document.getElementById('burger-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  });

  // Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeBookModal(); closeNotesModal(); closeQuoteModal(); closeDiaryModal();
      closeVocabModal(); closeAuthorModal(); closeListModal(); closeExportModal();
      closeQuestionModal(); exitFocus();
    }
  });

  // Clock
  setInterval(renderClock, 1000);
  renderClock();
}

async function init() {
  await Storage.load();
  populateCategorySelects();
  populateTagSuggestions();
  renderQuote();
  renderDate();
  const goalInput = document.getElementById('goal-input');
  if (goalInput) goalInput.value = State.goal;
  const speedInput = document.getElementById('speed-input');
  if (speedInput) speedInput.value = State.speed;
  initEvents();
  const hashSection = window.location.hash.replace('#', '');
  const validSections = ['dashboard','books','notes','quotes','diary','vocabulary','authors','lists','connections','insights','timeline','tags','focus','questions','settings'];
  showSection(validSections.includes(hashSection) ? hashSection : 'dashboard');
}

// Global exposures
window.openBookModal     = openBookModal;
window.openNotesModal    = openNotesModal;
window.deleteBook        = deleteBook;
window.deleteNote        = deleteNote;
window.filterByTag       = filterByTag;
window.openQuoteModal    = openQuoteModal;
window.closeQuoteModal   = closeQuoteModal;
window.editQuote         = editQuote;
window.deleteQuote       = deleteQuote;
window.openDiaryModal    = openDiaryModal;
window.closeDiaryModal   = closeDiaryModal;
window.deleteDiaryEntry  = deleteDiaryEntry;
window.openVocabModal    = openVocabModal;
window.closeVocabModal   = closeVocabModal;
window.editVocab         = editVocab;
window.deleteVocab       = deleteVocab;
window.openAuthorModal   = openAuthorModal;
window.closeAuthorModal  = closeAuthorModal;
window.editAuthor        = editAuthor;
window.deleteAuthor      = deleteAuthor;
window.openListModal     = openListModal;
window.closeListModal    = closeListModal;
window.editList          = editList;
window.deleteList        = deleteList;
window.openExportModal   = openExportModal;
window.closeExportModal  = closeExportModal;
window.doExport          = doExport;
window.exportNoteAsText  = exportNoteAsText;
window.exportNoteAsMd    = exportNoteAsMd;
window.switchConnView    = switchConnView;
window.activateFocus     = activateFocus;
window.exitFocus         = exitFocus;
window.openQuestionModal = openQuestionModal;
window.closeQuestionModal= closeQuestionModal;
window.resolveQuestion   = resolveQuestion;
window.deleteQuestion    = deleteQuestion;
window.renderVocabulary  = renderVocabulary;
window.addCategory       = addCategory;
window.deleteCategory    = deleteCategory;
window.updateCategoryColor = updateCategoryColor;
window.addTag            = addTag;
window.deleteTag         = deleteTag;
window.updateTagColor    = updateTagColor;
window.appendTag         = appendTag;
window.openBookView      = openBookView;
window.closeBookView     = closeBookView;
window.toggleBookMenu    = toggleBookMenu;
window.closeAllMenus     = closeAllMenus;

// DOMContentLoaded handled by notification system block below

function getDefaultCategories() {
  return [
    { id: 'filosofia',  name: 'Filosofia',   color: '#5a7ab8' },
    { id: 'historia',   name: 'História',    color: '#6a90a8' },
    { id: 'mitologia',  name: 'Mitologia',   color: '#8070b0' },
    { id: 'estoicismo', name: 'Estoicismo',  color: '#5a9870' },
    { id: 'politica',   name: 'Política',    color: '#a06060' },
    { id: 'biologia',   name: 'Biologia',    color: '#5a9080' },
    { id: 'outro',      name: 'Outro',       color: '#7a8090' },
  ];
}

function getCatColor(catId) {
  const cat = State.categories.find(c => c.id === catId);
  return cat ? cat.color : '#7a8090';
}

function populateCategorySelects() {
  const selects = ['book-category', 'category-filter'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    if (id === 'category-filter') {
      el.innerHTML = '<option value="all">Todas Categorias</option>' +
        State.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    } else {
      el.innerHTML = State.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    }
    if (current) el.value = current;
  });
}

function populateTagSuggestions() {
  const row = document.getElementById('tags-suggestion-row');
  if (!row) return;
  row.innerHTML = State.globalTags.slice(0, 20).map(t => {
    const name = typeof t === 'string' ? t : t.tag;
    const color = typeof t === 'string' ? '#7a8090' : (t.color || '#7a8090');
    return `<span class="tag-suggestion" style="border-color:${color}44;color:${color}" onclick="appendTag('${esc(name)}')">${esc(name)}</span>`;
  }).join('');
}

function appendTag(tag) {
  const input = document.getElementById('book-tags');
  if (!input) return;
  const current = input.value.split(',').map(t => t.trim()).filter(Boolean);
  if (!current.includes(tag)) {
    current.push(tag);
    input.value = current.join(', ');
  }
}

function addCategory() {
  const input = document.getElementById('new-category-input');
  const colorInput = document.getElementById('new-category-color');
  const name = input?.value.trim();
  if (!name) return;
  const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (State.categories.find(c => c.id === id)) { alert('Categoria já existe.'); return; }
  const color = colorInput?.value || '#5a7ab8';
  API.post('/categories', { id, name, color }).then(() => {
    Storage.load().then(() => {
      input.value = '';
      populateCategorySelects();
      renderSettings();
    });
  });
}

function deleteCategory(id) {
  const inUse = State.books.some(b => b.category === id);
  if (inUse) { alert('Esta categoria está em uso em um ou mais livros. Reatribua os livros antes de excluir.'); return; }
  confirmDialog('Excluir Categoria', 'Esta categoria será removida permanentemente.', 'Excluir', () => {
    API.delete(`/categories/${id}`).then(() => {
      Storage.load().then(() => {
        populateCategorySelects();
        renderSettings();
      });
    });
  });
}

function addTag() {
  const input = document.getElementById('new-tag-input');
  const colorInput = document.getElementById('new-tag-color');
  const tag = input?.value.trim().toLowerCase();
  if (!tag) return;
  if (State.globalTags.some(t => (typeof t === 'string' ? t : t.tag) === tag)) { alert('Tag já existe.'); return; }
  const color = colorInput?.value || '#7a8090';
  API.post('/tags', { tag, color }).then(() => {
    Storage.load().then(() => {
      input.value = '';
      populateTagSuggestions();
      renderSettings();
    });
  });
}

function deleteTag(tag) {
  const inUse = State.books.some(b => (b.tags || []).includes(tag));
  if (inUse) { alert('Esta tag está em uso em um ou mais livros. Remova-a dos livros antes de excluir.'); return; }
  confirmDialog('Excluir Tag', `A tag <strong>${esc(tag)}</strong> será removida permanentemente.`, 'Excluir', () => {
    API.delete(`/tags/${encodeURIComponent(tag)}`).then(() => {
      Storage.load().then(() => {
        populateTagSuggestions();
        renderSettings();
      });
    });
  });
}

function updateCategoryColor(id, color) {
  API.patch(`/categories/${id}`, { color }).then(() => {
    Storage.load().then(() => {
      populateCategorySelects();
      renderSettings();
    });
  });
}

function updateTagColor(tag, color) {
  API.patch(`/tags/${encodeURIComponent(tag)}`, { color }).then(() => {
    Storage.load().then(() => {
      populateTagSuggestions();
      renderSettings();
    });
  });
}

function renderSettings() {
  const catList = document.getElementById('categories-list');
  if (catList) {
    catList.innerHTML = State.categories.map(c => `
      <div class="settings-list-item">
        <input type="color" class="settings-color-inline" value="${c.color || '#7a8090'}" title="Mudar cor"
          onchange="updateCategoryColor('${c.id}', this.value)" />
        <span class="settings-item-name">${esc(c.name)}</span>
        <button class="btn-icon" style="color:var(--red);margin-left:auto" onclick="deleteCategory('${c.id}')">✕</button>
      </div>`).join('') || '<p class="empty-state" style="font-size:.8rem">Nenhuma categoria.</p>';
  }

  const tagList = document.getElementById('tags-list');
  if (tagList) {
    const bookTags = new Set();
    State.books.forEach(b => (b.tags || []).forEach(t => bookTags.add(t)));
    const tagMap = {};
    State.globalTags.forEach(t => {
      const name = typeof t === 'string' ? t : t.tag;
      const color = typeof t === 'string' ? '#7a8090' : (t.color || '#7a8090');
      tagMap[name] = color;
    });
    bookTags.forEach(t => { if (!tagMap[t]) tagMap[t] = '#7a8090'; });
    const allTags = Object.keys(tagMap).sort();
    tagList.innerHTML = allTags.map(t => {
      const inUse = State.books.some(b => (b.tags || []).includes(t));
      return `<div class="settings-list-item">
        <input type="color" class="settings-color-inline" value="${tagMap[t]}" title="Mudar cor"
          onchange="updateTagColor('${esc(t)}', this.value)" />
        <span class="tag-pill" style="font-size:.78rem;padding:2px 8px;cursor:default;border-color:${tagMap[t]}55;color:${tagMap[t]}">${esc(t)}</span>
        ${inUse ? '<span class="tag-in-use">em uso</span>' : ''}
        <button class="btn-icon" style="color:var(--red);margin-left:auto" onclick="deleteTag('${esc(t)}')">✕</button>
      </div>`;
    }).join('') || '<p class="empty-state" style="font-size:.8rem">Nenhuma tag cadastrada.</p>';
  }
}

// Override CAT_COLORS dynamic lookup
function getCategoryMap() {
  const map = {};
  State.categories.forEach(c => { map[c.id] = c.color; });
  return map;
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

let _confirmCallback = null;

function confirmDialog(title, message, okLabel = 'Confirmar', callback) {
  _confirmCallback = callback;
  const overlay = document.getElementById('confirm-modal-overlay');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').innerHTML = message;
  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.textContent = okLabel;
  overlay.classList.add('active');
}

function _initConfirmModal() {
  const overlay = document.getElementById('confirm-modal-overlay');
  if (!overlay) return;
  document.getElementById('confirm-ok-btn').addEventListener('click', () => {
    overlay.classList.remove('active');
    if (_confirmCallback) { _confirmCallback(); _confirmCallback = null; }
  });
  document.getElementById('confirm-cancel-btn').addEventListener('click', () => {
    overlay.classList.remove('active');
    _confirmCallback = null;
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { overlay.classList.remove('active'); _confirmCallback = null; }
  });
}

const Notifications = {
  _cache: [],

  getAll() { return this._cache; },

  async loadFromAPI() {
    this._cache = await API.get('/notifications');
    renderNotifBadge();
  },

  async add(icon, title, message, bookId = null) {
    await API.post('/notifications', { icon, title, message, bookId });
    await this.loadFromAPI();
  },

  async markAllRead() {
    await API.patch('/notifications/read-all');
    await this.loadFromAPI();
  },

  async clear() {
    await API.delete('/notifications');
    this._cache = [];
    renderNotifBadge();
  },
};

function renderNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const unread = Notifications.getAll().filter(n => !n.read && !n.is_read).length;
  badge.textContent = unread > 9 ? '9+' : unread;
  badge.classList.toggle('hidden', unread === 0);
}

function renderNotifPanel() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  const all = Notifications.getAll();
  if (all.length === 0) {
    list.innerHTML = '<div class="notif-empty">Nenhuma notificação</div>';
    return;
  }
  list.innerHTML = all.map(n => `
    <div class="notif-item ${n.read ? 'read' : 'unread'}">
      <span class="notif-item-icon">${n.icon}</span>
      <div class="notif-item-body">
        <div class="notif-item-title">${esc(n.title)}</div>
        <div class="notif-item-msg">${n.message}</div>
        <div class="notif-item-time">${timeAgo(n.time)}</div>
      </div>
      ${n.bookId ? `<button class="btn-icon notif-goto" onclick="gotoBook('${n.bookId}')">→</button>` : ''}
    </div>`).join('');
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const isOpen = !panel.classList.contains('hidden');
  if (isOpen) {
    panel.classList.add('hidden');
  } else {
    panel.classList.remove('hidden');
    Notifications.markAllRead().then(() => {
      renderNotifPanel();
      renderNotifBadge();
    });
  }
}

function clearNotifications() {
  Notifications.clear().then(() => renderNotifPanel());
}

function gotoBook(bookId) {
  document.getElementById('notif-panel')?.classList.add('hidden');
  showSection('books');
  // Scroll to book card
  setTimeout(() => {
    const card = document.querySelector(`.book-card[data-id="${bookId}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 200);
}

function checkReviewNotifications() {
  const now = Date.now();
  const existing = Notifications.getAll();

  State.books.forEach(b => {
    if (!b.completedAt || !b.reviewDays || b.reviewDays <= 0) return;
    const reviewDate = new Date(b.completedAt).getTime() + (b.reviewDays * 86400000);
    if (reviewDate > now) return;

    // Don't duplicate: check if notification for this book already exists recently
    const alreadyNotified = existing.some(n =>
      n.bookId === b.id && n.title === 'Hora de Revisitar' &&
      (now - new Date(n.time).getTime()) < 86400000 * 7 // within last 7 days
    );
    if (alreadyNotified) return;

    const daysAgo = Math.floor((now - reviewDate) / 86400000);
    Notifications.add(
      '📖',
      'Hora de Revisitar',
      `<strong>${esc(b.title)}</strong> — você configurou uma revisão e já ${daysAgo === 0 ? 'chegou o dia!' : `faz ${daysAgo} dia(s) que venceu.`}`,
      b.id
    );
  });
  renderNotifBadge();
}

// Close notif panel when clicking outside
document.addEventListener('click', e => {
  const wrapper = document.getElementById('notif-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    document.getElementById('notif-panel')?.classList.add('hidden');
  }
});

// Expose globals
window.toggleNotifPanel    = toggleNotifPanel;
window.clearNotifications  = clearNotifications;
window.gotoBook            = gotoBook;
window.confirmDialog       = confirmDialog;

// Patch init to add confirm modal init + notification check
document.addEventListener('DOMContentLoaded', async () => {
  await init();
  await Notifications.loadFromAPI();
  _initConfirmModal();
  _initNewTagDialog();
  document.addEventListener('click', () => closeAllMenus());
  checkReviewNotifications();
  setInterval(checkReviewNotifications, 3600000);
});
