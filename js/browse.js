/**
 * browse.js — Browse & search page
 */
import { fetchBooks, getCoverUrl, GENRES } from './api.js';
import { initNavbar } from './navbar.js';

// ── State from URL ────────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
let search   = params.get('search') || '';
let topic    = params.get('topic')  || '';
let page     = parseInt(params.get('page') || '1', 10);
let sort     = params.get('sort')   || 'popular';

// ── Navbar ────────────────────────────────────────────────────────────────────
initNavbar({
  onSearch: q => {
    search = q; topic = ''; page = 1;
    pushState({ search, topic, page });
    loadBooks();
  }
});

// Pre-fill desktop search bar
if (search) {
  document.getElementById('navSearch').value = search;
  document.getElementById('drawerSearch').value = search;
}

// ── Sidebar genres ────────────────────────────────────────────────────────────
const sidebar       = document.querySelector('.sidebar');
const sidebarGenres = document.getElementById('sidebarGenres');
const allLink       = sidebar.querySelector('a.sidebar__item');

// Wrap everything in a scroll container (CSS handles mobile vs desktop display)
const genreWrap = document.createElement('div');
genreWrap.className = 'sidebar-genres-wrap';

// "All Books"
if (allLink) {
  allLink.classList.toggle('active', !topic);
  genreWrap.appendChild(allLink);
}

// Genre links
GENRES.forEach(({ label, topic: tp }) => {
  const a = document.createElement('a');
  a.className = 'sidebar__item' + (topic === tp ? ' active' : '');
  a.href = `browse.html?topic=${tp}`;
  a.textContent = label;
  genreWrap.appendChild(a);
});

// Replace placeholder div with the wrapped genres
sidebarGenres.replaceWith(genreWrap);

// ── Sort ──────────────────────────────────────────────────────────────────────
const sortSelect = document.getElementById('sortSelect');
sortSelect.value = sort;
sortSelect.addEventListener('change', () => {
  sort = sortSelect.value;
  page = 1;
  pushState({ sort, page });
  loadBooks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function pushState(overrides = {}) {
  const p = new URLSearchParams({ search, topic, page, sort, ...overrides });
  history.pushState({}, '', `?${p}`);
}

async function buildCard(book) {
  const card = document.createElement('div');
  card.className = 'book-card';
  const author = book.authors?.[0]?.name ?? 'Unknown';
  const dl = book.download_count?.toLocaleString() ?? '—';
  card.innerHTML = `
    <a href="book.html?id=${book.id}" aria-label="${book.title}">
      <div class="book-card__cover-wrap"><img src="" alt="${book.title}" loading="lazy"></div>
    </a>
    <div class="book-card__body">
      <a href="book.html?id=${book.id}" class="book-card__title">${book.title}</a>
      <div class="book-card__author">${author}</div>
      <div class="book-card__downloads">⬇ ${dl} downloads</div>
    </div>`;
  const img = card.querySelector('img');
  getCoverUrl(book).then(url => { img.src = url; }).catch(() => {});
  return card;
}

function renderPagination(data) {
  const pagination = document.getElementById('pagination');
  pagination.innerHTML = '';
  const prev = document.createElement('button');
  prev.className = 'page-btn';
  prev.textContent = '← Prev';
  prev.disabled = !data.previous;
  prev.addEventListener('click', () => { page--; pushState({ page }); loadBooks(); });

  const cur = document.createElement('span');
  cur.className = 'page-btn active';
  cur.textContent = `Page ${page}`;

  const next = document.createElement('button');
  next.className = 'page-btn';
  next.textContent = 'Next →';
  next.disabled = !data.next;
  next.addEventListener('click', () => { page++; pushState({ page }); loadBooks(); });
  pagination.append(prev, cur, next);
}

// ── Main load ─────────────────────────────────────────────────────────────────
const browseGrid   = document.getElementById('browseGrid');
const resultsTitle = document.getElementById('resultsTitle');
const resultsCount = document.getElementById('resultsCount');

async function loadBooks() {
  browseGrid.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  document.getElementById('pagination').innerHTML = '';

  if (search) resultsTitle.textContent = `Results for "${search}"`;
  else if (topic) {
    const genre = GENRES.find(g => g.topic === topic);
    resultsTitle.textContent = genre ? genre.label : topic;
  } else {
    resultsTitle.textContent = 'All Books';
  }

  try {
    const data = await fetchBooks({ search, topic, page, sort });
    resultsCount.textContent = `${data.count?.toLocaleString() ?? '?'} books`;

    if (!data.results.length) {
      browseGrid.innerHTML = '<p class="empty-state">No books found. Try a different search.</p>';
      return;
    }
    browseGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const book of data.results) frag.appendChild(await buildCard(book));
    browseGrid.appendChild(frag);
    renderPagination(data);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    browseGrid.innerHTML = `<p class="error-state">Failed to load books.<br><small>${err.message}</small></p>`;
  }
}

window.addEventListener('popstate', () => {
  const p = new URLSearchParams(location.search);
  search = p.get('search') || '';
  topic  = p.get('topic') || '';
  page   = parseInt(p.get('page') || '1', 10);
  sort   = p.get('sort') || 'popular';
  loadBooks();
});

loadBooks();
