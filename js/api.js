/**
 * api.js — Gutendex + Cover layer + Shared Utilities
 * Optimized for instant rendering, high performance, and resilient fetch/abort lifecycle.
 */

const GUTENDEX = 'https://gutendex.com/books/';

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
    try { sessionStorage.clear(); } catch {}
  }
}

// ── Resilient Core Fetch with External Signal & Timeout ───────────────────────
async function fetchJSON(url, { signal = null, timeoutMs = 30000 } = {}) {
  const cached = cacheGet(url);
  if (cached) return cached;

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const internalController = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    internalController.abort();
  }, timeoutMs);

  function handleExternalAbort() {
    clearTimeout(timer);
    internalController.abort();
  }

  if (signal) {
    signal.addEventListener('abort', handleExternalAbort, { once: true });
  }

  try {
    const res = await fetch(url, { signal: internalController.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching catalog`);
    const data = await res.json();
    cacheSet(url, data);
    return data;
  } catch (err) {
    clearTimeout(timer);

    // If caller explicitly aborted this request or browser reported abort
    if (signal?.aborted || (err.name === 'AbortError' && !timedOut) || (err.message && err.message.toLowerCase().includes('aborted') && !timedOut)) {
      throw new DOMException('Aborted', 'AbortError');
    }

    // If internal timeout fired
    if (timedOut) {
      throw new Error('Catalog request timed out. Please try again.');
    }

    throw err;
  } finally {
    clearTimeout(timer);
    if (signal) {
      signal.removeEventListener('abort', handleExternalAbort);
    }
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
export async function fetchBooks({ page = 1, search = '', topic = '', sort = 'popular', signal = null } = {}) {
  const p = new URLSearchParams({ page });
  if (search) p.set('search', search);
  if (topic)  p.set('topic',  topic);
  if (sort && sort !== 'popular') p.set('sort', sort);

  const url = `${GUTENDEX}?${p}`;

  try {
    // For topic queries, use a 6s timeout so we can gracefully fall back to search if Gutendex's topic SQL is slow
    const timeoutMs = (topic && !search) ? 6000 : 25000;
    return await fetchJSON(url, { signal, timeoutMs });
  } catch (err) {
    // If request was aborted/cancelled by user navigation, re-throw as AbortError immediately
    if (signal?.aborted || err.name === 'AbortError') {
      throw err;
    }

    // Fallback strategy: if Gutendex topic query times out or fails on server side,
    // fallback to searching by keyword which uses Gutendex's fast indexed search engine
    if (topic && !search) {
      const fallbackParams = new URLSearchParams({ page, search: topic });
      if (sort && sort !== 'popular') fallbackParams.set('sort', sort);
      return await fetchJSON(`${GUTENDEX}?${fallbackParams}`, { signal, timeoutMs: 25000 });
    }

    throw err;
  }
}

export async function fetchBook(id, { signal = null } = {}) {
  return fetchJSON(`${GUTENDEX}${id}/`, { signal, timeoutMs: 25000 });
}

// ── High-Performance Cover Resolution ─────────────────────────────────────────
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

export function handleCoverError(imgElement, bookId) {
  if (!imgElement) return;

  if (bookId) {
    const cacheKey = `${bookId}_M`;
    failedCovers.add(cacheKey);
    coverCache.delete(cacheKey);
  }

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

export function getAllReadableUrls(formats = {}) {
  const candidates = [
    formats['text/html'],
    formats['text/html; charset=utf-8'],
    formats['text/plain; charset=utf-8'],
    formats['text/plain; charset=us-ascii'],
    formats['text/plain']
  ].filter(Boolean);
  return [...new Set(candidates)];
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
