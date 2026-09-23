/**
 * api.js — Gutendex + Cover layer + Shared Utilities
 * Optimized for instant rendering and high performance.
 */

const GUTENDEX = 'https://gutendex.com/books';
const OL_SEARCH = 'https://openlibrary.org/search.json';
const OL_COVERS = 'https://covers.openlibrary.org/b/id';

const CACHE_PREFIX = 'bs_cache_';
const COVER_CACHE_PREFIX = 'bs_cover_v2_';

// ── In-Memory Caches ─────────────────────────────────────────────────────────
const memoryCache = new Map();
const coverCache = new Map();
const failedCovers = new Set();

// ── Cache Helpers ─────────────────────────────────────────────────────────────
function cacheGet(key) {
  if (memoryCache.has(key)) return memoryCache.get(key);
  try {
    const item = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;
    const { data, ts } = JSON.parse(item);
    if (Date.now() - ts > 15 * 60 * 1000) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    memoryCache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

function cacheSet(key, data) {
  memoryCache.set(key, data);
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // If storage full, clear old cache entries
    try { sessionStorage.clear(); } catch {}
  }
}

// ── Core Fetch with Timeout ───────────────────────────────────────────────────
async function fetchJSON(url, timeoutMs = 10000) {
  const cached = cacheGet(url);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const data = await res.json();
    cacheSet(url, data);
    return data;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── HTML Escaping Utility ─────────────────────────────────────────────────────
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Gutendex API ──────────────────────────────────────────────────────────────
export async function fetchBooks({ page = 1, search = '', topic = '', sort = 'popular' } = {}) {
  const p = new URLSearchParams({ page });
  if (search) p.set('search', search);
  if (topic)  p.set('topic',  topic);
  if (sort)   p.set('sort',   sort);
  return fetchJSON(`${GUTENDEX}?${p}`);
}

export async function fetchBook(id) {
  return fetchJSON(`${GUTENDEX}/${id}`);
}

// ── High-Performance Cover Resolution ─────────────────────────────────────────

/**
 * Synchronously retrieves the best cover URL for a book.
 * 1. Checks memory cache
 * 2. Checks localStorage cache
 * 3. Uses Gutendex formats['image/jpeg'] directly (fastest, no extra network request!)
 * 4. Uses Project Gutenberg's canonical cover image CDN pattern
 */
export function getCoverUrl(book, size = 'M') {
  if (!book || !book.id) return null;
  const cacheKey = `${book.id}_${size}`;

  if (failedCovers.has(cacheKey)) return null;
  if (coverCache.has(cacheKey)) return coverCache.get(cacheKey);

  // Check persistent localStorage cache
  try {
    const stored = localStorage.getItem(COVER_CACHE_PREFIX + cacheKey);
    if (stored) {
      if (stored === 'none') {
        failedCovers.add(cacheKey);
        return null;
      }
      coverCache.set(cacheKey, stored);
      return stored;
    }
  } catch {}

  // 1. Direct cover image provided in Gutendex format metadata
  const formats = book.formats || {};
  const direct = formats['image/jpeg'] || formats['image/png'];
  if (direct) {
    coverCache.set(cacheKey, direct);
    try { localStorage.setItem(COVER_CACHE_PREFIX + cacheKey, direct); } catch {}
    return direct;
  }

  // 2. Canonical Project Gutenberg cache URL
  if (typeof book.id === 'number' || /^\d+$/.test(String(book.id))) {
    const canonical = `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.cover.medium.jpg`;
    coverCache.set(cacheKey, canonical);
    return canonical;
  }

  return null;
}

/**
 * Handles cover image error gracefully.
 * Hides the broken image element so the clean placeholder displays seamlessly.
 */
export function handleCoverError(imgElement, bookId, bookTitle = '') {
  if (!imgElement) return;

  // Mark failed in memory and storage so we don't hammer the failing URL
  if (bookId) {
    const cacheKey = `${bookId}_M`;
    failedCovers.add(cacheKey);
    coverCache.delete(cacheKey);
  }

  // Hide the img element so only the elegant CSS placeholder remains visible
  imgElement.style.display = 'none';
}

// ── Format Helpers ────────────────────────────────────────────────────────────
export function getReadableUrl(formats = {}) {
  return (
    formats['text/html']                     ||
    formats['text/html; charset=utf-8']      ||
    formats['text/plain; charset=utf-8']     ||
    formats['text/plain; charset=us-ascii']  ||
    formats['text/plain']                    ||
    null
  );
}

export function getDownloadUrl(formats = {}) {
  return (
    formats['application/epub+zip'] ||
    formats['application/pdf']      ||
    getReadableUrl(formats)         ||
    null
  );
}

// ── Genre / Topic List ────────────────────────────────────────────────────────
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
