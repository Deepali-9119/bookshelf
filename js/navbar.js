/**
 * navbar.js — shared mobile navbar logic
 * Call initNavbar() on every page.
 */
export function initNavbar({ onSearch, themeKey = 'bs_theme' } = {}) {
  // ── Theme ──────────────────────────────────────────────────────────────────
  let currentTheme = localStorage.getItem(themeKey) || 'light';
  document.documentElement.dataset.theme = currentTheme;

  const LABELS = { light: '🌙 Dark', dark: '☀️ Light' };
  const getLabel = () => LABELS[currentTheme] || '🌙 Dark';

  function applyTheme(t) {
    currentTheme = t;
    document.documentElement.dataset.theme = t;
    localStorage.setItem(themeKey, t);
    const label = getLabel();
    document.querySelectorAll('#themeToggle, #drawerTheme').forEach(el => {
      el.textContent = label;
    });
  }

  // Init label
  applyTheme(currentTheme);

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });
  document.getElementById('drawerTheme')?.addEventListener('click', () => {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  // ── Hamburger ──────────────────────────────────────────────────────────────
  const hamburger = document.getElementById('hamburger');
  const navDrawer  = document.getElementById('navDrawer');

  hamburger?.addEventListener('click', () => {
    const isOpen = navDrawer.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) document.getElementById('drawerSearch')?.focus();
  });

  // Close drawer on outside click
  document.addEventListener('click', e => {
    if (!hamburger || !navDrawer) return;
    if (!hamburger.contains(e.target) && !navDrawer.contains(e.target)) {
      navDrawer.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
  });

  // ── Search routing ─────────────────────────────────────────────────────────
  function handleSearch(query) {
    const q = query.trim();
    if (!q) return;
    if (onSearch) {
      onSearch(q);
    } else {
      window.location.href = `browse.html?search=${encodeURIComponent(q)}`;
    }
  }

  ['navSearchForm', 'drawerSearchForm'].forEach(id => {
    document.getElementById(id)?.addEventListener('submit', e => {
      e.preventDefault();
      const input = e.target.querySelector('input[type="search"]');
      handleSearch(input?.value ?? '');
      // Close drawer after search
      navDrawer?.classList.remove('open');
      hamburger?.classList.remove('open');
    });
  });
}
