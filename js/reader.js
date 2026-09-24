/**
 * reader.js — In-browser book reader
 * Fetches plain-text or HTML from Project Gutenberg and renders
 * with chapter navigation, theming, font controls, fullscreen,
 * and localStorage-based reading progress.
 */
import { fetchBook, getReadableUrl, getAllReadableUrls } from './api.js';

// ── Storage ───────────────────────────────────────────────────────────────────
const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ── Theme — apply before paint to avoid flash ─────────────────────────────────
const THEME_KEY = 'bs_theme';
let currentTheme = localStorage.getItem(THEME_KEY) || 'light';
document.documentElement.dataset.theme = currentTheme;

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.classList.toggle('active', btn.dataset.theme === currentTheme);
  btn.addEventListener('click', () => {
    currentTheme = btn.dataset.theme;
    document.documentElement.dataset.theme = currentTheme;
    localStorage.setItem(THEME_KEY, currentTheme);
    document.querySelectorAll('.theme-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.theme === currentTheme));
  });
});

// ── Font size ─────────────────────────────────────────────────────────────────
const FONT_KEY = 'bs_fontSize';
let fontSize = LS.get(FONT_KEY) ?? 18;
const readerContent = document.getElementById('readerContent');
applyFontSize();

document.getElementById('fontIncBtn').addEventListener('click', () => {
  fontSize = Math.min(fontSize + 2, 32);
  LS.set(FONT_KEY, fontSize);
  applyFontSize();
});
document.getElementById('fontDecBtn').addEventListener('click', () => {
  fontSize = Math.max(fontSize - 2, 12);
  LS.set(FONT_KEY, fontSize);
  applyFontSize();
});
function applyFontSize() {
  readerContent.style.fontSize = `${fontSize}px`;
}

// ── Font family ───────────────────────────────────────────────────────────────
const FONTFAM_KEY = 'bs_fontFamily';
let fontFamily = LS.get(FONTFAM_KEY) || 'sans';
applyFontFamily();

document.getElementById('fontSans').addEventListener('click', () => setFont('sans'));
document.getElementById('fontSerif').addEventListener('click', () => setFont('serif'));

function setFont(fam) {
  fontFamily = fam;
  LS.set(FONTFAM_KEY, fam);
  applyFontFamily();
}
function applyFontFamily() {
  readerContent.style.fontFamily = fontFamily === 'serif'
    ? "'Lora', Georgia, serif"
    : "'Inter', system-ui, sans-serif";
  document.getElementById('fontSans').classList.toggle('active', fontFamily === 'sans');
  document.getElementById('fontSerif').classList.toggle('active', fontFamily === 'serif');
}

// ── Fullscreen ────────────────────────────────────────────────────────────────
const fullscreenBtn = document.getElementById('fullscreenBtn');
fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
    fullscreenBtn.textContent = '⊡';
  } else {
    document.exitFullscreen?.();
    fullscreenBtn.textContent = '⛶';
  }
});
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) fullscreenBtn.textContent = '⛶';
});

// ── Chapters panel ────────────────────────────────────────────────────────────
const chaptersPanel   = document.getElementById('chaptersPanel');
const chaptersOverlay = document.getElementById('chaptersOverlay');
const readerScroll    = document.getElementById('readerScroll');

function openPanel()  {
  chaptersPanel.classList.add('open');
  chaptersOverlay.classList.add('open');
}
function closePanel() {
  chaptersPanel.classList.remove('open');
  chaptersOverlay.classList.remove('open');
}
document.getElementById('tocBtn').addEventListener('click', openPanel);
document.getElementById('closePanelBtn').addEventListener('click', closePanel);
chaptersOverlay.addEventListener('click', closePanel);

// ── Progress bar ──────────────────────────────────────────────────────────────
const progressFill    = document.getElementById('progressFill');
const PROGRESS_PREFIX = 'bs_progress_';

// bookId declared early so scroll handler can use it
const params  = new URLSearchParams(location.search);
const bookId  = params.get('id');

readerScroll.addEventListener('scroll', () => {
  const { scrollTop, scrollHeight, clientHeight } = readerScroll;
  const total = scrollHeight - clientHeight;
  const pct = total > 0 ? Math.round((scrollTop / total) * 100) : 0;
  progressFill.style.width = `${pct}%`;
  if (bookId) LS.set(PROGRESS_PREFIX + bookId, scrollTop);
}, { passive: true });

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  // Skip when typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'f' || e.key === 'F') fullscreenBtn.click();
  if (e.key === '+' || e.key === '=') document.getElementById('fontIncBtn').click();
  if (e.key === '-')                  document.getElementById('fontDecBtn').click();
  if (e.key === 'Escape')             closePanel();
});

// ── Back button ───────────────────────────────────────────────────────────────
const backBtn = document.getElementById('backBtn');
backBtn.href  = bookId ? `book.html?id=${bookId}` : 'index.html';

// ── Text helpers ──────────────────────────────────────────────────────────────
const CHAPTER_RE = /^\s*(chapter|part|book|section|act|scene|prologue|epilogue|introduction|preface)\s+[\dIVXivx\w]*/i;

function parseChapters(text) {
  const chapters = [];
  text.split('\n').forEach(line => {
    if (CHAPTER_RE.test(line) && line.trim().length < 80) {
      chapters.push(line.trim());
    }
  });
  return chapters;
}

function plainTextToHTML(text) {
  const paras = text.split(/\n{2,}/);
  return paras.map(para => {
    const t = para.trim();
    if (!t) return '';
    if (CHAPTER_RE.test(t) && t.length < 100) {
      const slug = slugify(t);
      return `<h2 id="${slug}" class="chapter-heading">${escapeHtml(t)}</h2>`;
    }
    return `<p>${escapeHtml(t).replace(/\n/g, ' ')}</p>`;
  }).join('\n');
}

function slugify(s) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 80);
}
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildChapterList(titles) {
  const list = document.getElementById('chaptersList');
  if (!titles.length) {
    list.innerHTML = '<p style="padding:.5rem .875rem;color:var(--text-muted);font-size:.85rem">No chapters detected.</p>';
    return;
  }
  titles.forEach(title => {
    const slug = slugify(title);
    const btn  = document.createElement('button');
    btn.className   = 'chapter-item';
    btn.textContent = title;
    btn.addEventListener('click', () => {
      const heading = readerContent.querySelector(`#${CSS.escape(slug)}`);
      if (heading) {
        // Scroll within the reader container, not the window
        const offset = heading.offsetTop - 16;
        readerScroll.scrollTo({ top: offset, behavior: 'smooth' });
      }
      closePanel();
    });
    list.appendChild(btn);
  });
}

function stripGutenbergBoilerplate(text) {
  const start = text.search(/\*\*\* START OF (THE|THIS) PROJECT GUTENBERG/i);
  const end   = text.search(/\*\*\* END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (start !== -1) {
    const afterHeader = text.indexOf('\n', start) + 1;
    return end !== -1 ? text.slice(afterHeader, end) : text.slice(afterHeader);
  }
  return text;
}

async function fetchBookTextWithFallback(targetUrl) {
  // Ensure Gutenberg URLs are https to prevent browser mixed-content blocks
  const secureUrl = targetUrl.replace(/^http:\/\//i, 'https://');

  const endpoints = [
    `/api/read?url=${encodeURIComponent(secureUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(secureUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(secureUrl)}`,
    secureUrl
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(endpoint, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        // If local static server served the api/read.js source code, bypass it
        if (endpoint.startsWith('/api/read') && (text.includes('export default async function handler') || text.includes('Target domain not permitted'))) {
          continue;
        }
        if (text && text.trim().length > 50) {
          return text;
        }
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('All content proxies failed to fetch book.');
}

// ── Main load ─────────────────────────────────────────────────────────────────
const readerLoading = document.getElementById('readerLoading');
const toolbarTitle  = document.getElementById('toolbarTitle');

if (!bookId) {
  readerLoading.innerHTML = '<p class="error-state">No book ID provided. <a href="index.html">← Go home</a></p>';
} else {
  loadReader(bookId);
}

async function loadReader(id) {
  let book = null;
  let candidates = [];
  try {
    book = await fetchBook(id);
    document.title = `${book.title} — Reading — Bookshelf`;
    toolbarTitle.textContent = book.title;

    candidates = getAllReadableUrls(book.formats);
    if (!candidates.length) {
      throw new Error('No readable format available for this book.');
    }

    let loadedContent = null;
    let successfulUrl = null;
    let isHTML = false;

    // Try candidate formats in sequence (e.g. HTML first, plain-text fallback)
    for (const url of candidates) {
      try {
        const text = await fetchBookTextWithFallback(url);
        if (text && text.trim().length > 50) {
          loadedContent = text;
          successfulUrl = url;
          isHTML = url.includes('.htm') || book.formats['text/html'] === url;
          break;
        }
      } catch {
        // Continue to next available format
      }
    }

    if (!loadedContent) {
      throw new Error('Could not load readable text across all available formats and proxies.');
    }

    if (isHTML) {
      const doc = new DOMParser().parseFromString(loadedContent, 'text/html');
      doc.querySelectorAll('script, style, link, meta').forEach(el => el.remove());
      readerContent.innerHTML = doc.body?.innerHTML ?? '';
      // Try to extract chapter headings from injected HTML
      const headings = [...readerContent.querySelectorAll('h1, h2, h3')]
        .filter(h => CHAPTER_RE.test(h.textContent))
        .map(h => {
          if (!h.id) h.id = slugify(h.textContent);
          return h.textContent.trim();
        });
      buildChapterList(headings);
    } else {
      // Plain text formatting with boilerplate cleanup
      const stripped = stripGutenbergBoilerplate(loadedContent);
      readerContent.innerHTML = plainTextToHTML(stripped);
      buildChapterList(parseChapters(stripped));
    }

    readerLoading.style.display = 'none';
    readerContent.style.display = '';

    // Restore saved scroll position
    const savedPos = LS.get(PROGRESS_PREFIX + id);
    if (savedPos) {
      requestAnimationFrame(() => { readerScroll.scrollTop = savedPos; });
    }

  } catch (err) {
    const fallbackLink = candidates[0] || (book && getReadableUrl(book.formats));
    readerLoading.innerHTML = `
      <div class="error-state">
        <p style="font-size:2.5rem;margin-bottom:.5rem">📖</p>
        <p><strong>Could not load reading content directly.</strong></p>
        <p style="max-width:480px;margin:0 auto .75rem"><small>${escapeHtml(err.message)}</small></p>
        <div style="margin-top:1.5rem;display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">
          <button onclick="location.reload()" class="btn btn--primary btn--sm">↺ Try Again</button>
          ${fallbackLink ? `<a href="${escapeHtml(fallbackLink)}" target="_blank" rel="noopener" class="btn btn--secondary btn--sm">Open Source Book ↗</a>` : ''}
          <a href="book.html?id=${id}" class="btn btn--secondary btn--sm">← Book Details</a>
        </div>
      </div>`;
  }
}
