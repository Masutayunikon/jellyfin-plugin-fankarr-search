/**
 * FanKarr Jellyfin Plugin
 * ========================
 * Injecte une section "Découvrir sur FanKarr" dans la page de recherche Jellyfin.
 *
 * Flow:
 *  1. Au chargement, récupère l'URL de l'API via /FanKarr/config
 *  2. Échange le token Jellyfin contre un token FanKarr (POST /api/v1/auth/jellyfin)
 *  3. Observe les changements de page via MutationObserver
 *  4. Sur la page de recherche, intercepte la saisie et affiche les résultats FanKarr
 *  5. Bouton "Demander" → POST /api/v1/requests
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
  // 2. Auth — échange du token Jellyfin
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
      // Token expiré — réauthentifier et réessayer une fois
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
  // 4. UI — section de résultats
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
      color: var(--text-color-emphasis, #fff);
    }
    #${SECTION_ID} .fankarr-header img {
      width: 22px;
      height: 22px;
    }
    #${SECTION_ID} .fankarr-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    #${SECTION_ID} .fankarr-card {
      width: 130px;
      cursor: default;
      position: relative;
    }
    #${SECTION_ID} .fankarr-card img {
      width: 100%;
      border-radius: 6px;
      aspect-ratio: 2/3;
      object-fit: cover;
      background: #222;
    }
    #${SECTION_ID} .fankarr-card .fankarr-title {
      font-size: 0.78em;
      margin-top: 4px;
      text-align: center;
      color: var(--text-color, #ddd);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${SECTION_ID} .fankarr-card .fankarr-meta {
      font-size: 0.7em;
      text-align: center;
      color: var(--text-color-secondary, #999);
    }
    #${SECTION_ID} .fankarr-card .fankarr-badge {
      position: absolute;
      top: 5px;
      left: 5px;
      background: var(--accent-color, #00a4dc);
      color: #fff;
      font-size: 0.65em;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    #${SECTION_ID} .fankarr-btn {
      display: block;
      width: 100%;
      margin-top: 6px;
      padding: 4px 0;
      border: none;
      border-radius: 4px;
      background: var(--accent-color, #00a4dc);
      color: #fff;
      font-size: 0.72em;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    #${SECTION_ID} .fankarr-btn:hover { opacity: 0.85; }
    #${SECTION_ID} .fankarr-btn:disabled {
      background: #555;
      cursor: default;
      opacity: 1;
    }
    #${SECTION_ID} .fankarr-btn.requested {
      background: #2e7d32;
    }
    #${SECTION_ID} .fankarr-empty {
      color: var(--text-color-secondary, #888);
      font-size: 0.9em;
    }
    #${SECTION_ID} .fankarr-spinner {
      color: var(--text-color-secondary, #888);
      font-size: 0.9em;
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
          <span>🎬</span>
          <span>Découvrir sur FanKarr</span>
        </div>
        <div class="fankarr-grid"></div>
      `;
      // Insérer avant les résultats Jellyfin existants ou à la fin du container
      const firstChild = container.firstChild;
      if (firstChild) {
        container.insertBefore(section, firstChild);
      } else {
        container.appendChild(section);
      }
    }
    return section;
  }

  function renderResults(section, results, requestedIds) {
    const grid = section.querySelector('.fankarr-grid');
    grid.innerHTML = '';

    if (!results || results.length === 0) {
      grid.innerHTML = '<span class="fankarr-empty">Aucun résultat sur FanKarr.</span>';
      return;
    }

    results.forEach(item => {
      const card = document.createElement('div');
      card.className = 'fankarr-card';

      const isRequested = requestedIds.has(item.id);
      const type = item.type === 'series' ? 'SÉRIE' : 'FILM';
      const year = item.year ? item.year : '';
      const poster = item.posterPath
        ? `https://image.tmdb.org/t/p/w200${item.posterPath}`
        : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="130" height="195" viewBox="0 0 130 195"><rect fill="%23333" width="130" height="195"/><text fill="%23666" font-size="12" x="50%25" y="50%25" text-anchor="middle" dy=".3em">No Image</text></svg>';

      card.innerHTML = `
        <span class="fankarr-badge">${type}</span>
        <img src="${poster}" alt="${escapeHtml(item.title)}" loading="lazy" />
        <div class="fankarr-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
        <div class="fankarr-meta">${year}</div>
        <button
          class="fankarr-btn ${isRequested ? 'requested' : ''}"
          data-id="${item.id}"
          data-type="${item.type}"
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
        mediaId: item.id,
        mediaType: item.type,
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

  // Récupère les IDs déjà demandés pour afficher le bon état des boutons
  async function fetchRequestedIds() {
    try {
      const data = await apiGet('/api/v1/requests');
      const items = data.results || data || [];
      return new Set(items.map(r => r.media?.id || r.mediaId));
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

    const section = getOrCreateSection(container);
    const grid = section.querySelector('.fankarr-grid');
    grid.innerHTML = '<span class="fankarr-spinner">Recherche sur FanKarr…</span>';

    try {
      const [searchData, requestedIds] = await Promise.all([
        apiGet(`/api/v1/series/search?q=${encodeURIComponent(query)}`),
        fetchRequestedIds(),
      ]);

      const results = searchData.results || searchData || [];
      renderResults(section, results, requestedIds);
    } catch (e) {
      console.error('[FanKarr] Erreur de recherche :', e);
      grid.innerHTML = '<span class="fankarr-empty">Erreur lors de la recherche.</span>';
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Observer — détecte la page de recherche et l'input
  // ---------------------------------------------------------------------------

  function findSearchInput() {
    return document.querySelector('#searchTextInput');
  }

  function findSearchContainer() {
    // Cherche le conteneur parent de la page de recherche
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
      }, 400); // debounce 400ms
    });

    // Si l'input a déjà une valeur (retour sur la page)
    if (input.value) {
      const container = findSearchContainer();
      if (container) onSearch(input.value.trim(), container);
    }
  }

  // MutationObserver pour détecter les changements de page (SPA)
  const observer = new MutationObserver(() => {
    if (isSearchPage()) {
      injectStyles();
      attachInputListener();
    } else {
      // Réinitialiser quand on quitte la page de recherche
      inputListenerAttached = false;
      lastQuery = '';
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  injectStyles();

  // Auth initiale
  if (!fankarrToken) {
    await authenticate();
  }

  // Au cas où on charge directement sur la page de recherche
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
