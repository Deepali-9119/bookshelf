/**
 * home.js — Home page logic
 */
import { fetchBooks, getCoverUrl, GENRES } from './api.js';
import { initNavbar } from './navbar.js';

// ── Navbar (theme + hamburger + search routing) ───────────────────────────────
initNavbar();

// ── Genre strip ──────────────────────────────────────────────────────────────
const genreStrip = document.getElementById('genreStrip');
GENRES.forEach(({ label, topic }) => {
  const a = document.createElement('a');
  a.className = 'genre-chip';
  a.href = `browse.html?topic=${topic}`;
  a.textContent = label;
  genreStrip.appendChild(a);
});

// ── Hero search ───────────────────────────────────────────────────────────────
document.getElementById('heroSearchForm').addEventListener('submit', e => {
  e.preventDefault();
  const q = document.getElementById('heroSearch').value.trim();
  if (q) window.location.href = `browse.html?search=${encodeURIComponent(q)}`;
});

// ── Book card helper ──────────────────────────────────────────────────────────
async function buildCard(book) {
  const card = document.createElement('div');
  card.className = 'book-card';

  const author    = book.authors?.[0]?.name ?? 'Unknown Author';
  const downloads = book.download_count?.toLocaleString() ?? '—';

  card.innerHTML = `
    <a href="book.html?id=${book.id}" aria-label="${book.title}">
      <div class="book-card__cover-wrap">
        <img src="" alt="${book.title}" loading="lazy">
      </div>
    </a>
    <div class="book-card__body">
      <a href="book.html?id=${book.id}" class="book-card__title">${book.title}</a>
      <div class="book-card__author">${author}</div>
      <div class="book-card__downloads">⬇ ${downloads} downloads</div>
    </div>`;

  const img = card.querySelector('img');
  getCoverUrl(book).then(url => { img.src = url; }).catch(() => {});
  return card;
}

// ── Trending ──────────────────────────────────────────────────────────────────
const trendingGrid = document.getElementById('trendingGrid');
const loadMoreBtn  = document.getElementById('loadMoreBtn');
let trendingPage   = 1;

async function loadTrending(page = 1) {
  try {
    const data = await fetchBooks({ page, sort: 'popular' });
    if (page === 1) trendingGrid.innerHTML = '';

    const frag = document.createDocumentFragment();
    for (const book of data.results) frag.appendChild(await buildCard(book));
    trendingGrid.appendChild(frag);

    loadMoreBtn.style.display = data.next ? 'inline-flex' : 'none';

    if (page === 1 && data.count) {
      document.getElementById('heroStats').textContent =
        `📚 ${data.count.toLocaleString()} books available — powered by Project Gutenberg & Open Library`;
    }
  } catch (err) {
    trendingGrid.innerHTML = `<p class="error-state">Could not load books. Please check your internet connection.<br><small>${err.message}</small></p>`;
  }
}

loadMoreBtn.addEventListener('click', async () => {
  trendingPage++;
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = 'Loading…';
  await loadTrending(trendingPage);
  loadMoreBtn.disabled = false;
  loadMoreBtn.textContent = 'Load More Books';
});

// ── Newly Added ───────────────────────────────────────────────────────────────
const newGrid = document.getElementById('newGrid');
async function loadNew() {
  try {
    const data = await fetchBooks({ sort: 'ascending', page: 5 });
    const frag = document.createDocumentFragment();
    for (const book of data.results.slice(0, 8)) frag.appendChild(await buildCard(book));
    newGrid.appendChild(frag);
  } catch { /* silently skip if it fails */ }
}

loadTrending(1);
loadNew();
