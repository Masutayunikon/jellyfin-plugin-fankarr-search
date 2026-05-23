/**
 * FanKarr Jellyfin Plugin
 * ========================
 * Injecte une section "Découvrir sur FanKaï" dans la page de recherche Jellyfin.
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
    if (!credentials) { console.warn('[FanKarr] Token Jellyfin introuvable.'); return false; }

    const parsed = JSON.parse(credentials);
    const jellyfinToken = parsed?.Servers?.[0]?.AccessToken;
    const jellyfinUserId = parsed?.Servers?.[0]?.UserId;

    if (!jellyfinToken || !jellyfinUserId) { console.warn('[FanKarr] Token ou UserId introuvable.'); return false; }

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
      console.error('[FanKarr] Échec auth :', e);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. API helpers
  // ---------------------------------------------------------------------------

  async function apiGet(path) {
    const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${fankarrToken}` } });
    if (res.status === 401) { await authenticate(); return apiGet(path); }
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fankarrToken}` },
      body: JSON.stringify(body),
    });
    if (res.status === 401) { await authenticate(); return apiPost(path, body); }
    return res.json();
  }

  // ---------------------------------------------------------------------------
  // 4. Styles
  // ---------------------------------------------------------------------------

  const SECTION_ID = 'fankarr-results-section';
  const MODAL_ID = 'fankarr-modal';

  const STYLES = `
    #${SECTION_ID} {
      padding: 0.5em 0 1em;
    }
    #${SECTION_ID} .fankarr-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5em;
      padding: 0.5em 1em;
    }
    #${SECTION_ID} .fankarr-card {
      width: 130px;
      position: relative;
      cursor: pointer;
    }
    #${SECTION_ID} .fankarr-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;
      border-radius: inherit;
      padding: 0.5em;
      box-sizing: border-box;
    }
    #${SECTION_ID} .fankarr-card:hover .fankarr-overlay {
      opacity: 1;
    }
    #${SECTION_ID} .fankarr-btn {
      width: 100%;
      font-size: 0.75em;
      padding: 0.5em 0.25em;
      white-space: nowrap;
    }

    /* ── Modale ── */
    #${MODAL_ID}-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 9998;
      display: none;
      align-items: flex-end;
      justify-content: center;
    }
    #${MODAL_ID}-backdrop.open {
      display: flex;
    }
    @media (min-width: 600px) {
      #${MODAL_ID}-backdrop {
        align-items: center;
      }
    }
    #${MODAL_ID} {
      background: var(--theme-body-background-color, #202020);
      border-radius: 16px 16px 0 0;
      width: 100%;
      max-width: 500px;
      max-height: 85vh;
      overflow-y: auto;
      padding: 1.5em;
      box-sizing: border-box;
      font-family: var(--font-family, inherit);
      color: var(--text-color, #fff);
      transform: translateY(100%);
      transition: transform 0.3s ease;
    }
    #${MODAL_ID}-backdrop.open #${MODAL_ID} {
      transform: translateY(0);
    }
    @media (min-width: 600px) {
      #${MODAL_ID} {
        border-radius: 12px;
        max-height: 80vh;
        transform: scale(0.95);
        opacity: 0;
        transition: transform 0.2s ease, opacity 0.2s ease;
      }
      #${MODAL_ID}-backdrop.open #${MODAL_ID} {
        transform: scale(1);
        opacity: 1;
      }
    }
    #${MODAL_ID} .fankarr-modal-header {
      display: flex;
      align-items: center;
      gap: 1em;
      margin-bottom: 1.25em;
    }
    #${MODAL_ID} .fankarr-modal-poster {
      width: 60px;
      aspect-ratio: 2/3;
      object-fit: cover;
      border-radius: 6px;
      flex-shrink: 0;
    }
    #${MODAL_ID} .fankarr-modal-title {
      font-size: 1.1em;
      font-weight: 600;
    }
    #${MODAL_ID} .fankarr-modal-close {
      margin-left: auto;
      background: none;
      border: none;
      color: var(--text-color-secondary, #aaa);
      font-size: 1.5em;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    #${MODAL_ID} .fankarr-modal-subtitle {
      font-size: 0.85em;
      color: var(--text-color-secondary, #aaa);
      margin-bottom: 1em;
    }
    #${MODAL_ID} .fankarr-seasons-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 0.5em;
      margin-bottom: 1.25em;
    }
    #${MODAL_ID} .fankarr-season-btn {
      padding: 0.6em 0.25em;
      border: 2px solid var(--text-color-secondary, #555);
      border-radius: 8px;
      background: transparent;
      color: var(--text-color, #fff);
      font-size: 0.8em;
      font-family: var(--font-family, inherit);
      cursor: pointer;
      text-align: center;
      transition: border-color 0.15s, background 0.15s;
    }
    #${MODAL_ID} .fankarr-season-btn.selected {
      border-color: var(--accent-color, var(--accent, #00a4dc));
      background: var(--accent-color, var(--accent, #00a4dc));
      color: #fff;
    }
    #${MODAL_ID} .fankarr-select-all {
      width: 100%;
      padding: 0.6em;
      border: 2px dashed var(--text-color-secondary, #555);
      border-radius: 8px;
      background: transparent;
      color: var(--text-color-secondary, #aaa);
      font-size: 0.8em;
      font-family: var(--font-family, inherit);
      cursor: pointer;
      margin-bottom: 0.75em;
      transition: border-color 0.15s, color 0.15s;
    }
    #${MODAL_ID} .fankarr-select-all.selected {
      border-color: var(--accent-color, var(--accent, #00a4dc));
      color: var(--accent-color, var(--accent, #00a4dc));
    }
    #${MODAL_ID} .fankarr-modal-actions {
      display: flex;
      gap: 0.75em;
      margin-top: 1em;
    }
    #${MODAL_ID} .fankarr-modal-cancel {
      flex: 1;
    }
    #${MODAL_ID} .fankarr-modal-submit {
      flex: 2;
    }
    #${MODAL_ID} .fankarr-modal-loading {
      text-align: center;
      padding: 2em 0;
      color: var(--text-color-secondary, #aaa);
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

  // ---------------------------------------------------------------------------
  // 5. Modale
  // ---------------------------------------------------------------------------

  function createModal() {
    if (document.getElementById(`${MODAL_ID}-backdrop`)) return;

    const backdrop = document.createElement('div');
    backdrop.id = `${MODAL_ID}-backdrop`;
    backdrop.innerHTML = `<div id="${MODAL_ID}"></div>`;
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  function openModal() {
    const backdrop = document.getElementById(`${MODAL_ID}-backdrop`);
    if (backdrop) {
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal() {
    const backdrop = document.getElementById(`${MODAL_ID}-backdrop`);
    if (backdrop) {
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  async function showRequestModal(item) {
    createModal();
    const modal = document.getElementById(MODAL_ID);

    // Afficher le loader
    modal.innerHTML = `
      <div class="fankarr-modal-header">
        ${item.image ? `<img class="fankarr-modal-poster" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />` : ''}
        <div class="fankarr-modal-title">${escapeHtml(item.title)}</div>
        <button class="fankarr-modal-close" aria-label="Fermer">×</button>
      </div>
      <div class="fankarr-modal-loading">Chargement des saisons…</div>
    `;

    modal.querySelector('.fankarr-modal-close').addEventListener('click', closeModal);
    openModal();

    // Charger les saisons
    let seasons = [];
    try {
      const data = await apiGet(`/api/v1/series/${item.id}`);
      seasons = data.seasons || [];
    } catch (e) {
      console.error('[FanKarr] Erreur chargement saisons :', e);
    }

    // Rendre la modale avec les saisons
    const selectedSeasons = new Set();

    function renderModal() {
      const allSelected = seasons.length > 0 && selectedSeasons.size === seasons.length;

      modal.innerHTML = `
        <div class="fankarr-modal-header">
          ${item.image ? `<img class="fankarr-modal-poster" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />` : ''}
          <div>
            <div class="fankarr-modal-title">${escapeHtml(item.title)}</div>
            <div class="fankarr-modal-subtitle">${seasons.length} saison${seasons.length > 1 ? 's' : ''}</div>
          </div>
          <button class="fankarr-modal-close" aria-label="Fermer">×</button>
        </div>

        <button class="fankarr-select-all${allSelected ? ' selected' : ''}">
          ${allSelected ? '✓ Toute la série sélectionnée' : 'Sélectionner toute la série'}
        </button>

        <div class="fankarr-seasons-grid">
          ${seasons.map(s => `
            <button
              class="fankarr-season-btn${selectedSeasons.has(s.season_number) ? ' selected' : ''}"
              data-season="${s.season_number}"
            >
              Saison ${s.season_number}
            </button>
          `).join('')}
        </div>

        <div class="fankarr-modal-actions">
          <button class="fankarr-modal-cancel emby-button raised">Annuler</button>
          <button class="fankarr-modal-submit emby-button raised button-submit">
            ${selectedSeasons.size === 0 ? 'Toute la série' : `${selectedSeasons.size} saison${selectedSeasons.size > 1 ? 's' : ''}`}
          </button>
        </div>
      `;

      modal.querySelector('.fankarr-modal-close').addEventListener('click', closeModal);
      modal.querySelector('.fankarr-modal-cancel').addEventListener('click', closeModal);

      // Toggle toute la série
      modal.querySelector('.fankarr-select-all').addEventListener('click', () => {
        if (allSelected) {
          selectedSeasons.clear();
        } else {
          seasons.forEach(s => selectedSeasons.add(s.season_number));
        }
        renderModal();
      });

      // Toggle saison individuelle
      modal.querySelectorAll('.fankarr-season-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const n = parseInt(btn.dataset.season);
          if (selectedSeasons.has(n)) {
            selectedSeasons.delete(n);
          } else {
            selectedSeasons.add(n);
          }
          renderModal();
        });
      });

      // Soumettre
      modal.querySelector('.fankarr-modal-submit').addEventListener('click', async () => {
        const submitBtn = modal.querySelector('.fankarr-modal-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = '…';

        try {
          await apiPost('/api/v1/requests', {
            serieId: item.id,
            serieName: item.title,
            seasons: selectedSeasons.size > 0 ? [...selectedSeasons].sort((a, b) => a - b) : [],
          });

          // Succès
          modal.innerHTML = `
            <div style="text-align:center;padding:2em 1em;">
              <div style="font-size:2em;margin-bottom:0.5em;">✓</div>
              <div style="font-weight:600;margin-bottom:0.5em;">${escapeHtml(item.title)}</div>
              <div style="color:var(--text-color-secondary,#aaa);font-size:0.9em;">
                ${selectedSeasons.size === 0
              ? 'Toute la série demandée !'
              : `Saison${selectedSeasons.size > 1 ? 's' : ''} ${[...selectedSeasons].sort((a, b) => a - b).join(', ')} demandée${selectedSeasons.size > 1 ? 's' : ''} !`
          }
              </div>
              <button class="emby-button raised button-submit" style="margin-top:1.5em;width:100%;">Fermer</button>
            </div>
          `;
          modal.querySelector('button').addEventListener('click', closeModal);

          // Mettre à jour le bouton de la card
          const card = document.querySelector(`[data-fankarr-id="${item.id}"]`);
          if (card) {
            const btn = card.querySelector('.fankarr-btn');
            if (btn) {
              btn.textContent = '✓ Demandé';
              btn.classList.add('button-submit');
              btn.disabled = true;
            }
          }
        } catch (e) {
          console.error('[FanKarr] Erreur demande :', e);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Réessayer';
        }
      });
    }

    renderModal();
  }

  // ---------------------------------------------------------------------------
  // 6. UI — section et cards
  // ---------------------------------------------------------------------------

  function getOrCreateSection(container) {
    let section = document.getElementById(SECTION_ID);
    if (!section) {
      section = document.createElement('div');
      section.id = SECTION_ID;
      section.innerHTML = `
        <h2 class="sectionTitle sectionTitle-cards focuscontainer-x padded-left padded-right">
          Découvrir sur FanKaï
        </h2>
        <div class="fankarr-grid"></div>
      `;

      const allSections = container.querySelectorAll('.verticalSection');
      let targetSection = null;
      for (const s of allSections) {
        const title = s.querySelector('.sectionTitle')?.textContent?.toLowerCase() || '';
        if (title.includes('épisode')) { targetSection = s; break; }
      }

      if (targetSection) {
        container.insertBefore(section, targetSection);
      } else {
        container.appendChild(section);
      }
    }
    return section;
  }

  function renderResults(section, results, requestedIds) {
    const grid = section.querySelector('.fankarr-grid');
    grid.innerHTML = '';

    results.forEach(item => {
      const isRequested = requestedIds.has(item.id);
      const poster = item.image || (item.posterPath ? `https://image.tmdb.org/t/p/w200${item.posterPath}` : null);

      const card = document.createElement('div');
      card.className = 'fankarr-card card overflowPortraitCard card-withuserdata';
      card.dataset.fankarrId = item.id;

      card.innerHTML = `
        <div class="cardBox cardBox-bottompadded">
          <div class="cardScalable">
            <div class="cardPadder cardPadder-overflowPortrait"></div>
            ${poster
          ? `<div class="cardImageContainer coveredImage cardContent" style="background-image:url('${escapeHtml(poster)}');"></div>`
          : `<div class="cardImageContainer defaultCardBackground defaultCardBackground1 cardContent">
                   <span class="cardImageIcon material-icons tv" aria-hidden="true"></span>
                 </div>`
      }
            <div class="fankarr-overlay">
              <button class="fankarr-btn emby-button raised${isRequested ? ' button-submit' : ''}" ${isRequested ? 'disabled' : ''}>
                ${isRequested ? '✓ Demandé' : '+ Demander'}
              </button>
            </div>
          </div>
          <div class="cardText cardTextCentered cardText-first"><bdi>${escapeHtml(item.title)}</bdi></div>
          <div class="cardText cardTextCentered cardText-secondary">${item.year || ''}</div>
        </div>
      `;

      if (!isRequested) {
        card.querySelector('.fankarr-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          showRequestModal(item);
        });
      }

      grid.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------------
  // 7. Search hook
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
      console.error('[FanKarr] Erreur recherche :', e);
      const existing = document.getElementById(SECTION_ID);
      if (existing) existing.remove();
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Observer
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
    return window.location.hash.includes('search') || !!document.querySelector('#searchTextInput');
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
      closeModal();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  injectStyles();
  createModal();

  if (!fankarrToken) await authenticate();
  if (isSearchPage()) attachInputListener();

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