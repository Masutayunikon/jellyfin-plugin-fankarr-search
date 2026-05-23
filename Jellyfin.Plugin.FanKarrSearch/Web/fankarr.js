/**
 * FanKarr Jellyfin Plugin
 * ========================
 * Injecte une section "Découvrir sur FanKarr" dans la page de recherche Jellyfin.
 */

(async function FanKarr() {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. Config
  // ---------------------------------------------------------------------------

  let API_URL = '';
  let fankarrToken = sessionStorage.getItem('fankarr_token') || '';

  try {
    const res = await fetch('/FanKarrSearch/config');
    const data = await res.json();
    API_URL = (data.ApiUrl || data.apiUrl || '').replace(/\/$/, '');
  } catch (e) {
    console.error('[FanKarr] Impossible de charger la config :', e);
    return;
  }

  if (!API_URL) {
    console.warn('[FanKarr] Aucune URL API configurée. Configure le plugin dans le Dashboard.');
    return;
  }

  // ---------------------------------------------------------------------------
  // 2. Auth
  // ---------------------------------------------------------------------------

  async function authenticate() {
    const credentials = localStorage.getItem('jellyfin_credentials');
    if (!credentials) {
      console.warn('[FanKarr] Token Jellyfin introuvable.');
      return false;
    }

    const parsed = JSON.parse(credentials);
    const jellyfinToken = parsed?.Servers?.[0]?.AccessToken;
    const jellyfinUserId = parsed?.Servers?.[0]?.UserId;

    if (!jellyfinToken || !jellyfinUserId) {
      console.warn('[FanKarr] Token ou UserId Jellyfin introuvable.');
      return false;
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/jellyfin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jellyfinToken, jellyfinUserId }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      fankarrToken = data.token || data.accessToken || '';
      sessionStorage.setItem('fankarr_token', fankarrToken);
      return true;
    } catch (e) {
      console.error('[FanKarr] Échec de l\'authentification :', e);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. API helpers
  // ---------------------------------------------------------------------------

  async function apiGet(path) {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${fankarrToken}` },
    });
    if (res.status === 401) {
      await authenticate();
      return apiGet(path);
    }
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${fankarrToken}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      await authenticate();
      return apiPost(path, body);
    }
    return res.json();
  }

  // ---------------------------------------------------------------------------
  // 4. UI
  // ---------------------------------------------------------------------------

  const SECTION_ID = 'fankarr-results-section';

  const STYLES = `
  #${SECTION_ID} {
    padding: 1.5em 1.5em 0.5em;
  }
  #${SECTION_ID} .fankarr-header {
    display: flex;
    align-items: center;
    gap: 0.5em;
    margin-bottom: 0.75em;
    font-size: 1.1em;
    font-weight: 600;
  }
  #${SECTION_ID} .fankarr-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em;
  }
  #${SECTION_ID} .fankarr-card {
    width: 130px;
    position: relative;
  }
  #${SECTION_ID} .fankarr-card img {
    width: 100%;
    aspect-ratio: 2/3;
    object-fit: cover;
    display: block;
  }
  #${SECTION_ID} .fankarr-btn {
    display: block;
    width: 100%;
    margin-top: 5px;
  }
`;

  function injectStyles() {
    if (document.getElementById('fankarr-styles')) return;
    const style = document.createElement('style');
    style.id = 'fankarr-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function getOrCreateSection(container) {
    let section = document.getElementById(SECTION_ID);
    if (!section) {
      section = document.createElement('div');
      section.id = SECTION_ID;
      section.innerHTML = `
        <div class="fankarr-header">
          <span>Découvrir sur FanKaï</span>
        </div>
        <div class="fankarr-grid"></div>
      `;
      container.appendChild(section);
    }
    return section;
  }

  function renderResults(section, results, requestedIds) {
    const grid = section.querySelector('.fankarr-grid');
    grid.innerHTML = '';

    results.forEach(item => {
      const card = document.createElement('div');
      card.className = 'fankarr-card';

      const isRequested = requestedIds.has(item.id);
      const type = item.available ? 'DISPONIBLE' : (item.type === 'series' ? 'SÉRIE' : 'FILM');
      const poster = item.image || (item.posterPath ? `https://image.tmdb.org/t/p/w200${item.posterPath}` : null);

      const imgHtml = poster
          ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(item.title)}" loading="lazy" class="cardContent coveredImage" />`
          : `<div class="cardContent defaultCardBackground defaultCardBackground1" style="aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;"><span class="cardImageIcon material-icons tv" aria-hidden="true"></span></div>`;

      card.innerHTML = `
      <div class="card portraitCard card-withuserdata">
        <div class="cardBox">
          <div class="cardScalable">
            <div class="cardPadder cardPadder-portrait"></div>
            ${imgHtml}
            <div class="cardIndicators">
              <div class="cardIndicator cardIndicator-right">
                <span style="background:var(--accent-color,var(--accent,#00a4dc));color:#fff;font-size:0.6em;font-weight:700;padding:2px 5px;border-radius:3px;text-transform:uppercase;">${type}</span>
              </div>
            </div>
          </div>
          <div class="cardText cardTextCentered">${escapeHtml(item.title)}</div>
          <div class="cardText cardTextCentered cardText-secondary">${item.year || ''}</div>
        </div>
      </div>
      <button
        class="fankarr-btn raised emby-button${isRequested ? ' button-submit' : ''}"
        ${isRequested ? 'disabled' : ''}
      >${isRequested ? '✓ Demandé' : '+ Demander'}</button>
    `;

      const btn = card.querySelector('.fankarr-btn');
      if (!isRequested) {
        btn.addEventListener('click', () => handleRequest(btn, item));
      }

      grid.appendChild(card);
    });
  }

  async function handleRequest(btn, item) {
    btn.disabled = true;
    btn.textContent = '…';

    try {
      await apiPost('/api/v1/requests', {
        serieId: item.id,
        serieName: item.title,
      });
      btn.textContent = '✓ Demandé';
      btn.classList.add('requested');
    } catch (e) {
      console.error('[FanKarr] Erreur lors de la demande :', e);
      btn.disabled = false;
      btn.textContent = '+ Demander';
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Search hook
  // ---------------------------------------------------------------------------

  let searchTimeout = null;
  let lastQuery = '';

  async function fetchRequestedIds() {
    try {
      const data = await apiGet('/api/v1/requests');
      const items = data.results || data || [];
      return new Set(items.map(r => r.serieId || r.media?.id || r.mediaId));
    } catch {
      return new Set();
    }
  }

  async function onSearch(query, container) {
    if (!query || query.length < 2) {
      const existing = document.getElementById(SECTION_ID);
      if (existing) existing.remove();
      return;
    }

    if (query === lastQuery) return;
    lastQuery = query;

    try {
      const [searchData, requestedIds] = await Promise.all([
        apiGet(`/api/v1/series/search?q=${encodeURIComponent(query)}`),
        fetchRequestedIds(),
      ]);

      const results = searchData.results || searchData || [];

      if (!results || results.length === 0) {
        const existing = document.getElementById(SECTION_ID);
        if (existing) existing.remove();
        return;
      }

      const section = getOrCreateSection(container);
      renderResults(section, results, requestedIds);
    } catch (e) {
      console.error('[FanKarr] Erreur de recherche :', e);
      const existing = document.getElementById(SECTION_ID);
      if (existing) existing.remove();
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Observer
  // ---------------------------------------------------------------------------

  function findSearchInput() {
    return document.querySelector('#searchTextInput');
  }

  function findSearchContainer() {
    return (
        document.querySelector('.searchResults') ||
        document.querySelector('.padded-left.padded-right') ||
        document.querySelector('.itemsContainer')?.closest('.pageTabContent, .tabContent, [data-role="page"]') ||
        document.querySelector('#searchTextInput')?.closest('[data-role="page"]')
    );
  }

  function isSearchPage() {
    return (
        window.location.hash.includes('search') ||
        !!document.querySelector('#searchTextInput')
    );
  }

  let inputListenerAttached = false;

  function attachInputListener() {
    if (inputListenerAttached) return;

    const input = findSearchInput();
    if (!input) return;

    inputListenerAttached = true;

    input.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const query = input.value.trim();
      searchTimeout = setTimeout(() => {
        const container = findSearchContainer();
        if (container) onSearch(query, container);
      }, 400);
    });

    if (input.value) {
      const container = findSearchContainer();
      if (container) onSearch(input.value.trim(), container);
    }
  }

  const observer = new MutationObserver(() => {
    if (isSearchPage()) {
      injectStyles();
      attachInputListener();
    } else {
      inputListenerAttached = false;
      lastQuery = '';
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  injectStyles();

  if (!fankarrToken) {
    await authenticate();
  }

  if (isSearchPage()) {
    attachInputListener();
  }

  console.info('[FanKarr] Plugin chargé ✓');

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
  }
})();