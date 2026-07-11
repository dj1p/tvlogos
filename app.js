// ============================================================================
// State
// ============================================================================
let allLogos = [];
let displayedLogos = [];
const LOGOS_PER_PAGE = 60;
let currentPage = 1;
let scrollObserver = null;

const el = {
  loading: document.getElementById('loading'),
  content: document.getElementById('content'),
  logosGrid: document.getElementById('logosGrid'),
  noResults: document.getElementById('noResults'),
  searchBox: document.getElementById('searchBox'),
  resetBtn: document.getElementById('resetBtn'),
  logoCount: document.getElementById('logoCount'),
  stats: document.getElementById('stats'),
  notification: document.getElementById('notification'),
};

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|svg|gif)$/i;

// ============================================================================
// Custom combobox for country filter -- same component as epg-browser, for
// the same reason: native <select> popups are rendered by the OS on some
// browsers and can silently ignore page CSS (white-on-white text), and this
// filter has 65+ options where a search box inside genuinely helps.
// ============================================================================
function createCombobox(container, { placeholder, onChange }) {
  let options = [];
  let selected = '';
  let open = false;
  let activeIndex = -1;
  let filterText = '';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'combo-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');

  const btnLabel = document.createElement('span');
  btnLabel.className = 'truncate';
  const chevron = document.createElement('svg');
  chevron.setAttribute('class', 'w-4 h-4 flex-shrink-0 text-[var(--text-lo)]');
  chevron.setAttribute('fill', 'none');
  chevron.setAttribute('stroke', 'currentColor');
  chevron.setAttribute('viewBox', '0 0 24 24');
  chevron.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';
  btn.appendChild(btnLabel);
  btn.appendChild(chevron);

  const panel = document.createElement('div');
  panel.className = 'combo-panel hidden';
  panel.setAttribute('role', 'listbox');

  const searchWrap = document.createElement('div');
  searchWrap.className = 'combo-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Filter…';
  searchInput.autocomplete = 'off';
  searchWrap.appendChild(searchInput);
  panel.appendChild(searchWrap);

  const list = document.createElement('div');
  list.className = 'combo-list';
  panel.appendChild(list);

  container.appendChild(btn);
  container.appendChild(panel);

  function renderLabel() {
    const match = options.find(o => o.value === selected);
    if (match) { btnLabel.textContent = match.label; btnLabel.classList.remove('placeholder'); }
    else { btnLabel.textContent = placeholder; btnLabel.classList.add('placeholder'); }
  }

  function renderList() {
    const q = filterText.trim().toLowerCase();
    const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
    if (!filtered.length) { list.innerHTML = '<div class="combo-empty">No matches</div>'; return; }
    list.innerHTML = '';
    filtered.forEach((opt, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'combo-opt' + (opt.value === selected ? ' is-selected' : '');
      item.textContent = opt.label;
      item.setAttribute('role', 'option');
      if (i === activeIndex) item.classList.add('is-active');
      item.addEventListener('click', () => selectValue(opt.value));
      list.appendChild(item);
    });
  }

  function selectValue(value) {
    selected = value;
    renderLabel();
    closePanel();
    onChange && onChange(value);
  }

  function openPanel() {
    open = true; activeIndex = -1; filterText = '';
    searchInput.value = '';
    panel.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
    renderList();
    setTimeout(() => searchInput.focus(), 0);
  }

  function closePanel() {
    open = false;
    panel.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', () => (open ? closePanel() : openPanel()));
  searchInput.addEventListener('input', () => { filterText = searchInput.value; activeIndex = -1; renderList(); });
  searchInput.addEventListener('keydown', (e) => {
    const q = filterText.trim().toLowerCase();
    const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, filtered.length - 1); renderList(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); renderList(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[activeIndex]) selectValue(filtered[activeIndex].value); }
    else if (e.key === 'Escape') { closePanel(); btn.focus(); }
  });
  document.addEventListener('click', (e) => { if (open && !container.contains(e.target)) closePanel(); });

  renderLabel();

  return {
    setOptions(opts) { options = opts; renderLabel(); if (open) renderList(); },
    getValue() { return selected; },
    reset() { selected = ''; renderLabel(); },
  };
}

const countryCombo = createCombobox(document.getElementById('countryCombo'), {
  placeholder: 'All countries',
  onChange: () => filterLogos(),
});

// ============================================================================
// Loading
// ============================================================================
async function loadLogos() {
  try {
    const response = await fetch('/logos-manifest.json');
    if (!response.ok) throw new Error(`Manifest returned ${response.status}`);
    const data = await response.json();
    allLogos = data.logos || [];
    if (allLogos.length === 0) throw new Error('Manifest loaded but contains no logos');

    el.logoCount.textContent = allLogos.length.toLocaleString();
    populateCountryFilter();
    displayLogos(allLogos);
    updateStats();

    el.loading.classList.add('hidden');
    el.content.classList.remove('hidden');
  } catch (error) {
    el.loading.innerHTML = `
      <div class="text-center">
        <p class="text-xl font-display text-[var(--text-hi)] mb-2">Failed to load logo index</p>
        <p class="text-sm text-[var(--text-lo)] mb-4">${escHtml(error.message)}</p>
        <button onclick="location.reload()" class="btn btn-amber">Retry</button>
      </div>`;
  }
}

function populateCountryFilter() {
  const counts = {};
  for (const logo of allLogos) {
    const c = (logo.country || 'unknown').split('/')[0]; // collapse subfolders like "germany/sky-sport"
    counts[c] = (counts[c] || 0) + 1;
  }
  const countries = Object.keys(counts).sort();
  countryCombo.setOptions(countries.map(c => ({
    value: c,
    label: `${prettyCountry(c)} (${counts[c].toLocaleString()})`,
  })));
}

function prettyCountry(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ============================================================================
// Rendering
// ============================================================================
function displayLogos(logos) {
  if (logos.length === 0) {
    el.logosGrid.classList.add('hidden');
    el.noResults.classList.remove('hidden');
    return;
  }
  el.logosGrid.classList.remove('hidden');
  el.noResults.classList.add('hidden');

  displayedLogos = logos.slice(0, LOGOS_PER_PAGE);
  currentPage = 1;
  renderLogos(displayedLogos, true);
  setupInfiniteScroll(logos);
}

function renderLogos(logos, replace) {
  const html = logos.map(logo => {
    const fullUrl = window.location.origin + logo.path;
    const gridSrc = logo.thumb || logo.path;
    return `
      <div class="logo-card" data-url="${escHtml(fullUrl)}" data-full="${escHtml(logo.path)}" tabindex="0" role="button" aria-label="Copy URL for ${escHtml(logo.name)}">
        <img src="${escHtml(gridSrc)}" alt="${escHtml(logo.name)}" loading="lazy" decoding="async"
             onerror="handleImgError(this)">
        <div class="logo-name">${escHtml(logo.name.replace(IMAGE_EXT_RE, ''))}</div>
        <span class="copy-chip">Copy URL</span>
      </div>`;
  }).join('');

  el.logosGrid.innerHTML = replace ? html : el.logosGrid.innerHTML + html;

  el.logosGrid.querySelectorAll('.logo-card:not([data-wired])').forEach(card => {
    card.dataset.wired = 'true';
    const activate = () => copyToClipboard(card.dataset.url, card);
    card.addEventListener('click', activate);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
  });
}

// A thumbnail 404 (not yet generated, e.g. for a logo added before the last
// generate-thumbnails.js run) is a completely different situation from the
// SOURCE file itself being missing -- the former just needs the full image
// as a fallback, the latter is a genuinely broken entry worth flagging.
function handleImgError(img) {
  const card = img.closest('.logo-card');
  const triedThumb = !img.dataset.triedFull;
  if (triedThumb && card && card.dataset.full && img.src !== window.location.origin + card.dataset.full) {
    img.dataset.triedFull = 'true';
    img.src = card.dataset.full;
    return;
  }
  markBroken(img);
}

function markBroken(img) {
  img.onerror = null;
  const card = img.closest('.logo-card');
  if (!card || card.classList.contains('is-broken')) return;
  card.classList.add('is-broken');
  const badge = document.createElement('div');
  badge.className = 'broken-badge';
  badge.textContent = '⚠ file missing';
  card.insertBefore(badge, card.firstChild);
}

function setupInfiniteScroll(logos) {
  if (scrollObserver) scrollObserver.disconnect();

  let sentinel = document.getElementById('scrollSentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.id = 'scrollSentinel';
    sentinel.style.height = '1px';
    el.logosGrid.insertAdjacentElement('afterend', sentinel);
  }

  let loading = false;
  scrollObserver = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting || loading) return;
    loading = true;
    const start = currentPage * LOGOS_PER_PAGE;
    const next = logos.slice(start, start + LOGOS_PER_PAGE);
    if (next.length > 0) {
      currentPage++;
      displayedLogos = displayedLogos.concat(next);
      renderLogos(next, false);
    }
    loading = false;
  }, { rootMargin: '600px' });

  scrollObserver.observe(sentinel);
}

// ============================================================================
// Search / filter
// ============================================================================
let searchTimer;
function handleSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(filterLogos, 150);
}

function normalizeForSearch(name) {
  return name
    .toLowerCase()
    .replace(IMAGE_EXT_RE, '')
    .replace(/[-_]/g, ' ');
}

function filterLogos() {
  const searchTerm = el.searchBox.value.toLowerCase().trim();
  const countryFilter = countryCombo.getValue();

  const filtered = allLogos.filter(logo => {
    const normalized = normalizeForSearch(logo.name);
    const words = searchTerm.split(/\s+/).filter(Boolean);
    const matchesSearch = searchTerm === '' || words.every(w =>
      normalized.includes(' ' + w) || normalized.startsWith(w) || normalized.includes('-' + w)
    );
    const matchesCountry = !countryFilter || (logo.country || '').split('/')[0] === countryFilter;
    return matchesSearch && matchesCountry;
  });

  displayLogos(filtered);
  updateStats(filtered.length);
}

function updateStats(count = null) {
  const total = count !== null ? count : allLogos.length;
  el.stats.textContent = `Showing ${total.toLocaleString()} logo${total !== 1 ? 's' : ''}`;
}

function resetFilters() {
  el.searchBox.value = '';
  countryCombo.reset();
  filterLogos();
}

// ============================================================================
// Clipboard
// ============================================================================
async function copyToClipboard(text, card) {
  try {
    await navigator.clipboard.writeText(text);
    const chip = card.querySelector('.copy-chip');
    const orig = chip.textContent;
    chip.textContent = 'Copied!';
    chip.style.color = 'var(--cyan)';
    showNotification();
    setTimeout(() => { chip.textContent = orig; chip.style.color = ''; }, 1800);
  } catch (e) {
    alert('Copy failed -- your browser may be blocking clipboard access.');
  }
}

function showNotification() {
  el.notification.classList.add('show');
  setTimeout(() => el.notification.classList.remove('show'), 2200);
}

function escHtml(t) {
  if (t == null) return '';
  const d = document.createElement('div');
  d.textContent = String(t);
  return d.innerHTML;
}

// ============================================================================
// Init
// ============================================================================
el.searchBox.addEventListener('input', handleSearchInput);
el.resetBtn.addEventListener('click', resetFilters);

document.addEventListener('DOMContentLoaded', loadLogos);
