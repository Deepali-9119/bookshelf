/**
 * api.js — Gutendex + Open Library API layer
 * All responses cached in sessionStorage (10-min TTL) to reduce repeat calls.
 */

const GUTENDEX  = 'https://gutendex.com/books';
const OL_SEARCH = 'https://openlibrary.org/search.json';
const OL_COVERS = 'https://covers.openlibrary.org/b/id';

const CACHE_PREFIX = 'bs_cache_';

// ── Cache helpers ─────────────────────────────────────────────────────────────
function cacheGet(key) {
  try {
    const item = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;
    const { data, ts } = JSON.parse(item);
    if (Date.now() - ts > 10 * 60 * 1000) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data;
  } catch { return null; }
}

function cacheSet(key, data) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* storage full — silent */ }
}

// ── Core fetch ────────────────────────────────────────────────────────────────
async function fetchJSON(url) {
  const cached = cacheGet(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const data = await res.json();
  cacheSet(url, data);
  return data;
}

// ── Gutendex API ──────────────────────────────────────────────────────────────

/**
 * List/search books from Gutendex.
 * @param {object} opts
 * @param {number} opts.page
 * @param {string} opts.search  — free-text search (title, author)
 * @param {string} opts.topic   — subject/genre filter
 * @param {string} opts.sort    — 'popular' | 'ascending'
 */
export async function fetchBooks({ page = 1, search = '', topic = '', sort = 'popular' } = {}) {
  const p = new URLSearchParams({ page });
  if (search) p.set('search', search);
  if (topic)  p.set('topic',  topic);
  if (sort)   p.set('sort',   sort);
  return fetchJSON(`${GUTENDEX}?${p}`);
}

/**
 * Fetch a single book by Gutenberg ID.
 */
export async function fetchBook(id) {
  return fetchJSON(`${GUTENDEX}/${id}`);
}

// ── Cover images ──────────────────────────────────────────────────────────────

// In-memory cover cache (avoids repeat Open Library calls within a session)
const coverCache = new Map();

/**
 * Returns the best cover image URL for a Gutenberg book.
 * Looks up Open Library by title; falls back to a text placeholder.
 * @param {object} book  — Gutendex book object
 * @param {string} size  — 'S' | 'M' | 'L'
 */
export async function getCoverUrl(book, size = 'M') {
  const cacheKey = `${book.id}_${size}`;
  if (coverCache.has(cacheKey)) return coverCache.get(cacheKey);

  try {
    const q    = encodeURIComponent(book.title);
    const data = await fetchJSON(`${OL_SEARCH}?title=${q}&fields=cover_i&limit=1`);
    const coverId = data?.docs?.[0]?.cover_i;
    if (coverId) {
      const url = `${OL_COVERS}/${coverId}-${size}.jpg`;
      coverCache.set(cacheKey, url);
      return url;
    }
  } catch { /* fall through */ }

  // Placeholder with truncated title
  const label = encodeURIComponent(book.title.slice(0, 22));
  const url   = `https://placehold.co/200x300/1e293b/a5b4fc?text=${label}`;
  coverCache.set(cacheKey, url);
  return url;
}

// ── Format helpers ────────────────────────────────────────────────────────────

/**
 * Return the best URL for in-browser reading.
 * Priority: text/html > text/plain (UTF-8) > text/plain (ASCII) > text/plain
 */
export function getReadableUrl(formats) {
  return (
    formats['text/html']                     ||
    formats['text/plain; charset=utf-8']     ||
    formats['text/plain; charset=us-ascii']  ||
    formats['text/plain']                    ||
    null
  );
}

/**
 * Return the best URL for downloading.
 * Priority: EPUB > PDF > readable URL
 */
export function getDownloadUrl(formats) {
  return (
    formats['application/epub+zip'] ||
    formats['application/pdf']      ||
    getReadableUrl(formats)         ||
    null
  );
}

// ── Genre/topic list ──────────────────────────────────────────────────────────
export const GENRES = [
  { label: '🔮 Fiction',     topic: 'fiction' },
  { label: '🏛️ History',     topic: 'history' },
  { label: '🔬 Science',     topic: 'science' },
  { label: '💡 Philosophy',  topic: 'philosophy' },
  { label: '🗺️ Adventure',   topic: 'adventure' },
  { label: '❤️ Romance',     topic: 'romance' },
  { label: '😱 Horror',      topic: 'horror' },
  { label: '🕵️ Mystery',     topic: 'mystery' },
  { label: '🧒 Children',    topic: 'children' },
  { label: '🎭 Drama',       topic: 'drama' },
];
