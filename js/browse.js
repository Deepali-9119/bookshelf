/**
 * browse.js — Browse & search page
 * High-performance synchronous card rendering with independent cover loading.
 */
import { fetchBooks, getCoverUrl, handleCoverError, escapeHtml, GENRES } from './api.js';
import { initNavbar } from './navbar.js';

// Expose handleCoverError globally so inline onerror can invoke it
window.handleCoverError = handleCoverError;

// ── State from URL ────────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
let search   = params.get('search') || '';
let topic    = params.get('topic')  || '';
let page     = parseInt(params.get('page') || '1', 10);
let sort     = params.get('sort')   || 'popular';

// ── Navbar ────────────────────────────────────────────────────────────────────
initNavbar({
  onSearch: q => {
    search = q;
    topic = '';
    page = 1;
    pushState({ search, topic, page });
    loadBooks();
  }
});

// Pre-fill search inputs
if (search) {
  const navInput = document.getElementById('navSearch');
  const drawerInput = document.getElementById('drawerSearch');
  if (navInput) navInput.value = search;
  if (drawerInput) drawerInput.value = search;
}

// ── Sidebar Genres ────────────────────────────────────────────────────────────
const sidebar = document.querySelector('.sidebar');
const sidebarGenres = document.getElementById('sidebarGenres');
const allLink = sidebar?.querySelector('a.sidebar__item');

const genreWrap = document.createElement('div');
genreWrap.className = 'sidebar-genres-wrap';

if (allLink) {
  allLink.classList.toggle('active', !topic);
  genreWrap.appendChild(allLink);
}

GENRES.forEach(({ label, topic: tp }) => {
  const a = document.createElement('a');
  a.className = 'sidebar__item' + (topic === tp ? ' active' : '');
  a.href = `browse.html?topic=${encodeURIComponent(tp)}`;
  a.textContent = label;
  genreWrap.appendChild(a);
});

if (sidebarGenres) {
  sidebarGenres.replaceWith(genreWrap);
}

// ── Sort ──────────────────────────────────────────────────────────────────────
const sortSelect = document.getElementById('sortSelect');
if (sortSelect) {
  sortSelect.value = sort;
  sortSelect.addEventListener('change', () => {
    sort = sortSelect.value;
    page = 1;
    pushState({ sort, page });
    loadBooks();
  });
}

// ── URL State Helper ──────────────────────────────────────────────────────────
function pushState(overrides = {}) {
  const p = new URLSearchParams({ search, topic, page, sort, ...overrides });
  history.pushState({}, '', `?${p}`);
}

// ── Instant Synchronous Book Card Builder ─────────────────────────────────────
function buildCard(book, index = 0) {
  const card = document.createElement('div');
  card.className = 'book-card';

  const author = book.authors?.[0]?.name ?? 'Unknown';
  const downloads = typeof book.download_count === 'number'
    ? book.download_count.toLocaleString()
    : (book.download_count || '—');
  const safeTitle = escapeHtml(book.title);
  const safeAuthor = escapeHtml(author);
  const coverUrl = getCoverUrl(book, 'M');
  const isAboveFold = index < 6;

  card.innerHTML = `
    <a href="book.html?id=${book.id}" aria-label="${safeTitle}">
      <div class="book-card__cover-wrap">
        <div class="book-card__placeholder" aria-hidden="true">
          <div class="placeholder-icon">📖</div>
          <div class="placeholder-title">${safeTitle}</div>
          <div class="placeholder-author">${safeAuthor}</div>
        </div>
        ${coverUrl ? `
          <img
            src="${coverUrl}"
            alt="${safeTitle}"
            class="book-card__img"
            loading="${isAboveFold ? 'eager' : 'lazy'}"
            decoding="async"
            ${isAboveFold ? 'fetchpriority="high"' : ''}
            onload="this.classList.add('loaded')"
            onerror="window.handleCoverError(this, ${book.id})"
          >
        ` : ''}
      </div>
    </a>
    <div class="book-card__body">
      <a href="book.html?id=${book.id}" class="book-card__title" title="${safeTitle}">${safeTitle}</a>
      <div class="book-card__author">${safeAuthor}</div>
      <div class="book-card__downloads">⬇ ${downloads} downloads</div>
    </div>`;

  return card;
}

// ── Pagination Builder ────────────────────────────────────────────────────────
function renderPagination(data) {
  const pagination = document.getElementById('pagination');
  if (!pagination) return;
  pagination.innerHTML = '';

  const prev = document.createElement('button');
  prev.className = 'page-btn';
  prev.textContent = '← Prev';
  prev.disabled = !data.previous;
  prev.addEventListener('click', () => {
    page--;
    pushState({ page });
    loadBooks();
  });

  const cur = document.createElement('span');
  cur.className = 'page-btn active';
  cur.textContent = `Page ${page}`;

  const next = document.createElement('button');
  next.className = 'page-btn';
  next.textContent = 'Next →';
  next.disabled = !data.next;
  next.addEventListener('click', () => {
    page++;
    pushState({ page });
    loadBooks();
  });

  pagination.append(prev, cur, next);
}

// ── Main Load ─────────────────────────────────────────────────────────────────
const browseGrid   = document.getElementById('browseGrid');
const resultsTitle = document.getElementById('resultsTitle');
const resultsCount = document.getElementById('resultsCount');

async function loadBooks() {
  if (browseGrid) {
    browseGrid.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  }
  const pagination = document.getElementById('pagination');
  if (pagination) pagination.innerHTML = '';

  if (search) {
    if (resultsTitle) resultsTitle.textContent = `Results for "${search}"`;
  } else if (topic) {
    const genre = GENRES.find(g => g.topic === topic);
    if (resultsTitle) resultsTitle.textContent = genre ? genre.label : topic;
  } else {
    if (resultsTitle) resultsTitle.textContent = 'All Books';
  }

  try {
    const data = await fetchBooks({ search, topic, page, sort });
    if (resultsCount) {
      resultsCount.textContent = `${data.count ? data.count.toLocaleString() : '0'} books`;
    }

    const results = data.results || [];
    if (!results.length) {
      if (browseGrid) {
        browseGrid.innerHTML = '<p class="empty-state">No books found. Try a different search.</p>';
      }
      return;
    }

    if (browseGrid) {
      browseGrid.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (let i = 0; i < results.length; i++) {
        frag.appendChild(buildCard(results[i], i));
      }
      browseGrid.appendChild(frag);
    }

    renderPagination(data);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    if (browseGrid) {
      browseGrid.innerHTML = `<p class="error-state">Failed to load books.<br><small>${escapeHtml(err.message)}</small></p>`;
    }
  }
}

// Listen for browser navigation (back / forward)
window.addEventListener('popstate', () => {
  const p = new URLSearchParams(location.search);
  search = p.get('search') || '';
  topic  = p.get('topic') || '';
  page   = parseInt(p.get('page') || '1', 10);
  sort   = p.get('sort') || 'popular';
  loadBooks();
});

loadBooks();
