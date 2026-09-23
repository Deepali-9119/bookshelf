/**
 * book.js — Book detail page
 */
import { fetchBook, getCoverUrl, getReadableUrl, getDownloadUrl } from './api.js';
import { initNavbar } from './navbar.js';

initNavbar();

document.getElementById('bookContent').innerHTML =
  '<div class="loading-state"><div class="spinner"></div></div>';

const id = new URLSearchParams(location.search).get('id');

if (!id) {
  document.getElementById('bookContent').innerHTML =
    '<p class="error-state">No book ID provided. <a href="index.html">Go home</a></p>';
} else {
  loadBookDetail(id);
}

async function loadBookDetail(bookId) {
  try {
    const book     = await fetchBook(bookId);
    document.title = `${book.title} — Bookshelf`;

    const coverUrl = await getCoverUrl(book, 'L');
    const readUrl  = getReadableUrl(book.formats);
    const dlUrl    = getDownloadUrl(book.formats);

    const authors = book.authors?.map(a => {
      const years = a.birth_year ? ` (${a.birth_year}–${a.death_year ?? ''})` : '';
      return `${a.name}${years}`;
    }).join(', ') ?? 'Unknown Author';

    const subjects = book.subjects?.slice(0, 12) ?? [];
    const subjectBadges = subjects.map(s =>
      `<a href="browse.html?search=${encodeURIComponent(s)}" class="badge">${s}</a>`
    ).join('');

    const formatItems = Object.entries(book.formats)
      .filter(([mime]) => !mime.includes('zip') && !mime.includes('rdf'))
      .map(([mime, url]) => `
        <div class="format-item">
          <span class="format-item__name">${mimeLabel(mime)}</span>
          <a href="${url}" target="_blank" rel="noopener" class="btn btn--sm btn--secondary">Download</a>
        </div>`).join('');

    const readBtn = readUrl
      ? `<a href="reader.html?id=${bookId}" class="btn btn--primary">📖 Read Now</a>` : '';
    const dlBtn = dlUrl
      ? `<a href="${dlUrl}" target="_blank" rel="noopener" class="btn btn--secondary">⬇ Download</a>` : '';

    document.getElementById('bookContent').innerHTML = `
      <div class="book-detail">
        <div class="book-cover-wrap">
          <img class="book-cover" src="${coverUrl}" alt="${book.title}" loading="eager">
        </div>
        <div class="book-info">
          <h1 class="book-info__title">${book.title}</h1>
          <p class="book-info__author">by ${authors}</p>
          <div class="book-info__meta">
            ${book.languages?.map(l => `<span class="badge">🌐 ${l.toUpperCase()}</span>`).join('') ?? ''}
            ${book.copyright === false ? '<span class="badge" style="color:var(--accent)">✓ Public Domain</span>' : ''}
            <span class="badge">⬇ ${book.download_count?.toLocaleString()} downloads</span>
          </div>
          <div class="book-info__actions">${readBtn}${dlBtn}</div>
          <div class="book-info__desc">
            ${book.subjects?.length
              ? `<p>Covers: ${book.subjects.slice(0, 5).join(', ')}${book.subjects.length > 5 ? '…' : ''}.</p>`
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
    document.getElementById('bookContent').innerHTML =
      `<p class="error-state">Could not load book details.<br><small>${err.message}</small><br>
       <a href="index.html" class="btn btn--secondary btn--sm" style="margin-top:1rem">← Go home</a></p>`;
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
