/**
 * home.js — Home page logic
 * High-performance synchronous card rendering with independent cover loading.
 */
import { fetchBooks, getCoverUrl, handleCoverError, escapeHtml, GENRES } from './api.js';
import { initNavbar } from './navbar.js';

// Expose handleCoverError globally so inline onerror can invoke it
window.handleCoverError = handleCoverError;

// ── Navbar (theme + hamburger + search routing) ───────────────────────────────
initNavbar();

// ── Genre strip ──────────────────────────────────────────────────────────────
const genreStrip = document.getElementById('genreStrip');
GENRES.forEach(({ label, topic }) => {
  const a = document.createElement('a');
  a.className = 'genre-chip';
  a.href = `browse.html?topic=${encodeURIComponent(topic)}`;
  a.textContent = label;
  genreStrip.appendChild(a);
});

// ── Hero search ───────────────────────────────────────────────────────────────
document.getElementById('heroSearchForm').addEventListener('submit', e => {
  e.preventDefault();
  const q = document.getElementById('heroSearch').value.trim();
  if (q) window.location.href = `browse.html?search=${encodeURIComponent(q)}`;
});

// ── Instant Synchronous Book Card Builder ─────────────────────────────────────
export function buildCard(book, index = 0) {
  const card = document.createElement('div');
  card.className = 'book-card';

  const author = book.authors?.[0]?.name ?? 'Unknown Author';
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

// ── Trending Books ────────────────────────────────────────────────────────────
const trendingGrid = document.getElementById('trendingGrid');
const loadMoreBtn  = document.getElementById('loadMoreBtn');
let trendingPage   = 1;

async function loadTrending(page = 1) {
  try {
    const data = await fetchBooks({ page, sort: 'popular' });
    if (page === 1 && trendingGrid) trendingGrid.innerHTML = '';

    const frag = document.createDocumentFragment();
    const results = data.results || [];
    for (let i = 0; i < results.length; i++) {
      frag.appendChild(buildCard(results[i], (page - 1) * 32 + i));
    }
    if (trendingGrid) trendingGrid.appendChild(frag);

    if (loadMoreBtn) {
      loadMoreBtn.style.display = data.next ? 'inline-flex' : 'none';
    }

    if (page === 1 && data.count) {
      const statsEl = document.getElementById('heroStats');
      if (statsEl) {
        statsEl.textContent =
          `📚 ${data.count.toLocaleString()} books available — powered by Project Gutenberg & Open Library`;
      }
    }
  } catch (err) {
    if (page === 1 && trendingGrid) {
      const msg = (err.message && err.message.toLowerCase().includes('aborted'))
        ? 'Connection was interrupted. Please try again.'
        : (err.message || 'Please check your internet connection.');
      trendingGrid.innerHTML = `
        <div class="error-state">
          <p style="font-size:2rem;margin-bottom:.5rem">⚠️</p>
          <p><strong>Could not load books.</strong></p>
          <p><small>${escapeHtml(msg)}</small></p>
          <button onclick="window.location.reload()" class="btn btn--secondary btn--sm" style="margin-top:1rem">↺ Try Again</button>
        </div>`;
    }
  }
}

if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', async () => {
    trendingPage++;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading…';
    await loadTrending(trendingPage);
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Load More Books';
  });
}

// ── Newly Added / More Discoveries ───────────────────────────────────────────
const newGrid = document.getElementById('newGrid');
async function loadNew() {
  try {
    // Fetch second page for "More to Discover" without forcing unindexed database sort
    const data = await fetchBooks({ page: 2, sort: 'popular' });
    const frag = document.createDocumentFragment();
    const items = (data.results || []).slice(0, 8);
    for (let i = 0; i < items.length; i++) {
      frag.appendChild(buildCard(items[i], i));
    }
    if (newGrid) {
      newGrid.innerHTML = '';
      newGrid.appendChild(frag);
    }
  } catch {
    // Silently skip if secondary row fails to load
  }
}

// Initial page load: load primary trending books first, then secondary
async function initHome() {
  await loadTrending(1);
  loadNew();
}

initHome();
