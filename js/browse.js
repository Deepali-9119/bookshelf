/**
 * browse.js — Browse & search page
 * High-performance synchronous card rendering with resilient AbortController lifecycle.
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

// ── AbortController & Request Tracking ────────────────────────────────────────
let currentAbortController = null;
let currentRequestId = 0;

// ── Navbar ────────────────────────────────────────────────────────────────────
initNavbar({
  onSearch: q => {
    search = q.trim();
    topic = '';
    page = 1;
    pushState({ search, topic: '', page: 1 });
    updateActiveSidebar('');
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

// Setup "All Books" link
if (allLink) {
  allLink.setAttribute('data-topic', '');
  allLink.classList.toggle('active', !topic && !search);
  allLink.addEventListener('click', e => {
    e.preventDefault();
    if (!topic && !search && page === 1) return;
    topic = '';
    search = '';
    page = 1;
    pushState({ topic: '', search: '', page: 1 });
    updateActiveSidebar('');
    loadBooks();
  });
  genreWrap.appendChild(allLink);
}

// Setup genre links with SPA navigation
GENRES.forEach(({ label, topic: tp }) => {
  const a = document.createElement('a');
  a.className = 'sidebar__item' + (topic === tp ? ' active' : '');
  a.setAttribute('data-topic', tp);
  a.href = `browse.html?topic=${encodeURIComponent(tp)}`;
  a.textContent = label;

  a.addEventListener('click', e => {
    e.preventDefault();
    if (topic === tp && !search && page === 1) return;
    topic = tp;
    search = '';
    page = 1;
    pushState({ topic: tp, search: '', page: 1 });
    updateActiveSidebar(tp);
    loadBooks();
  });

  genreWrap.appendChild(a);
});

if (sidebarGenres) {
  sidebarGenres.replaceWith(genreWrap);
}

function updateActiveSidebar(selectedTopic) {
  const items = document.querySelectorAll('.sidebar__item');
  items.forEach(el => {
    const itemTopic = el.getAttribute('data-topic');
    if (!selectedTopic) {
      el.classList.toggle('active', itemTopic === '');
    } else {
      el.classList.toggle('active', itemTopic === selectedTopic);
    }
  });
}

// ── Sort ──────────────────────────────────────────────────────────────────────
const sortSelect = document.getElementById('sortSelect');
if (sortSelect) {
  sortSelect.value = sort;
  sortSelect.addEventListener('change', () => {
    sort = sortSelect.value;
    page = 1;
    pushState({ sort, page: 1 });
    loadBooks();
  });
}

// ── URL State Helper ──────────────────────────────────────────────────────────
function pushState(overrides = {}) {
  const p = new URLSearchParams({ search, topic, page, sort, ...overrides });
  // Clean up empty params
  if (!p.get('search')) p.delete('search');
  if (!p.get('topic')) p.delete('topic');
  if (p.get('page') === '1') p.delete('page');
  if (p.get('sort') === 'popular') p.delete('sort');

  const queryString = p.toString() ? `?${p.toString()}` : 'browse.html';
  history.pushState({ search, topic, page, sort, ...overrides }, '', queryString);
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

// ── Main Load with Proper AbortController Lifecycle ───────────────────────────
const browseGrid   = document.getElementById('browseGrid');
const resultsTitle = document.getElementById('resultsTitle');
const resultsCount = document.getElementById('resultsCount');

async function loadBooks() {
  // Cancel previous in-flight request if user switched genres or searched
  if (currentAbortController) {
    currentAbortController.abort();
  }

  const controller = new AbortController();
  currentAbortController = controller;
  const requestId = ++currentRequestId;

  // Show loading spinner
  if (browseGrid) {
    browseGrid.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  }
  const pagination = document.getElementById('pagination');
  if (pagination) pagination.innerHTML = '';

  // Update header text immediately
  if (search) {
    if (resultsTitle) resultsTitle.textContent = `Results for "${search}"`;
  } else if (topic) {
    const genre = GENRES.find(g => g.topic === topic);
    if (resultsTitle) resultsTitle.textContent = genre ? genre.label : topic;
  } else {
    if (resultsTitle) resultsTitle.textContent = 'All Books';
  }
  if (resultsCount) resultsCount.textContent = 'Loading…';

  try {
    const data = await fetchBooks({
      search,
      topic,
      page,
      sort,
      signal: controller.signal
    });

    // Check if this request is still the active one
    if (requestId !== currentRequestId || controller.signal.aborted) {
      return; // A newer request has started; discard obsolete response
    }

    if (resultsCount) {
      resultsCount.textContent = `${data.count ? data.count.toLocaleString() : '0'} books`;
    }

    const results = data.results || [];
    if (!results.length) {
      if (browseGrid) {
        browseGrid.innerHTML = topic
          ? `<p class="empty-state">No books found for this genre. Try another category.</p>`
          : `<p class="empty-state">No books found. Try a different search.</p>`;
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
    // CRITICAL: Silently ignore if request was cancelled due to user navigation or genre switching
    const isAborted =
      err.name === 'AbortError' ||
      controller.signal.aborted ||
      requestId !== currentRequestId ||
      (err.message && err.message.toLowerCase().includes('aborted'));

    if (isAborted) {
      return;
    }

    // Only display error for the CURRENT active failure
    if (browseGrid && requestId === currentRequestId) {
      if (resultsCount) resultsCount.textContent = 'Error';
      browseGrid.innerHTML = `
        <div class="error-state">
          <p style="font-size:2rem;margin-bottom:.5rem">⚠️</p>
          <p><strong>Failed to load books.</strong></p>
          <p><small>${escapeHtml(err.message)}</small></p>
          <button onclick="window.location.reload()" class="btn btn--secondary btn--sm" style="margin-top:1rem">↺ Try Again</button>
        </div>`;
    }
  }
}

// ── Handle Browser Back / Forward ─────────────────────────────────────────────
window.addEventListener('popstate', () => {
  const p = new URLSearchParams(location.search);
  search = p.get('search') || '';
  topic  = p.get('topic') || '';
  page   = parseInt(p.get('page') || '1', 10);
  sort   = p.get('sort') || 'popular';

  updateActiveSidebar(topic);
  if (sortSelect) sortSelect.value = sort;
  loadBooks();
});

// Initial load
loadBooks();
