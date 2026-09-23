/**
 * book.js — Book detail page
 * High-performance rendering with immediate cover and placeholder fallback.
 */
import { fetchBook, getCoverUrl, getReadableUrl, getDownloadUrl, handleCoverError, escapeHtml } from './api.js';
import { initNavbar } from './navbar.js';

window.handleCoverError = handleCoverError;

initNavbar();

const bookContent = document.getElementById('bookContent');
if (bookContent) {
  bookContent.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
}

const id = new URLSearchParams(location.search).get('id');

if (!id) {
  if (bookContent) {
    bookContent.innerHTML =
      '<p class="error-state">No book ID provided. <a href="index.html">← Go home</a></p>';
  }
} else {
  loadBookDetail(id);
}

async function loadBookDetail(bookId) {
  try {
    const book = await fetchBook(bookId);
    const safeTitle = escapeHtml(book.title);
    document.title = `${book.title} — Bookshelf`;

    const coverUrl = getCoverUrl(book, 'L') || getCoverUrl(book, 'M');
    const readUrl  = getReadableUrl(book.formats);
    const dlUrl    = getDownloadUrl(book.formats);

    const authors = book.authors?.map(a => {
      const years = a.birth_year ? ` (${a.birth_year}–${a.death_year ?? ''})` : '';
      return `${a.name}${years}`;
    }).join(', ') ?? 'Unknown Author';
    const safeAuthors = escapeHtml(authors);

    const subjects = book.subjects?.slice(0, 12) ?? [];
    const subjectBadges = subjects.map(s =>
      `<a href="browse.html?search=${encodeURIComponent(s)}" class="badge">${escapeHtml(s)}</a>`
    ).join('');

    const formats = book.formats || {};
    const formatItems = Object.entries(formats)
      .filter(([mime]) => !mime.includes('zip') && !mime.includes('rdf'))
      .map(([mime, url]) => `
        <div class="format-item">
          <span class="format-item__name">${escapeHtml(mimeLabel(mime))}</span>
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="btn btn--sm btn--secondary">Download</a>
        </div>`).join('');

    const readBtn = readUrl
      ? `<a href="reader.html?id=${bookId}" class="btn btn--primary">📖 Read Now</a>` : '';
    const dlBtn = dlUrl
      ? `<a href="${escapeHtml(dlUrl)}" target="_blank" rel="noopener" class="btn btn--secondary">⬇ Download</a>` : '';

    const downloads = typeof book.download_count === 'number'
      ? book.download_count.toLocaleString()
      : (book.download_count || '—');

    bookContent.innerHTML = `
      <div class="book-detail">
        <div class="book-cover-wrap">
          <div class="book-cover-placeholder" aria-hidden="true">
            <div class="placeholder-icon">📖</div>
            <div class="placeholder-title">${safeTitle}</div>
            <div class="placeholder-author">${safeAuthors}</div>
          </div>
          ${coverUrl ? `
            <img
              class="book-cover"
              src="${coverUrl}"
              alt="${safeTitle}"
              loading="eager"
              decoding="async"
              onload="this.classList.add('loaded')"
              onerror="window.handleCoverError(this, ${book.id})"
            >
          ` : ''}
        </div>
        <div class="book-info">
          <h1 class="book-info__title">${safeTitle}</h1>
          <p class="book-info__author">by ${safeAuthors}</p>
          <div class="book-info__meta">
            ${book.languages?.map(l => `<span class="badge">🌐 ${escapeHtml(l.toUpperCase())}</span>`).join('') ?? ''}
            ${book.copyright === false ? '<span class="badge" style="color:var(--accent)">✓ Public Domain</span>' : ''}
            <span class="badge">⬇ ${downloads} downloads</span>
          </div>
          <div class="book-info__actions">${readBtn}${dlBtn}</div>
          <div class="book-info__desc">
            ${book.subjects?.length
              ? `<p>Covers: ${escapeHtml(book.subjects.slice(0, 5).join(', '))}${book.subjects.length > 5 ? '…' : ''}.</p>`
              : '<p>A classic public-domain work from Project Gutenberg.</p>'}
          </div>
          ${subjects.length ? `
          <div class="book-info__subjects">
            <div class="book-info__subjects-title">Subjects &amp; Tags</div>
            <div class="subjects-list">${subjectBadges}</div>
          </div>` : ''}
          ${formatItems ? `
          <div class="formats-section">
            <h3>Available Formats</h3>
            <div class="formats-list">${formatItems}</div>
          </div>` : ''}
        </div>
      </div>`;
  } catch (err) {
    if (bookContent) {
      bookContent.innerHTML =
        `<p class="error-state">Could not load book details.<br><small>${escapeHtml(err.message)}</small><br>
         <a href="index.html" class="btn btn--secondary btn--sm" style="margin-top:1rem">← Go home</a></p>`;
    }
  }
}

function mimeLabel(mime) {
  if (mime.includes('html'))  return 'HTML (read online)';
  if (mime.includes('epub'))  return 'EPUB (e-reader)';
  if (mime.includes('pdf'))   return 'PDF';
  if (mime.includes('plain')) return 'Plain Text';
  if (mime.includes('image')) return 'Cover Image';
  return mime;
}
