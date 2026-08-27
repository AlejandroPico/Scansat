import './styles.css';
import { OrbitalScene } from './scene.js';
import {
  GROUP_STYLES,
  LIBRARY_CATEGORIES,
  LIBRARY_ENTRIES,
  ORBIT_STYLES,
  describeRecord,
} from './catalog.js';
import { loadCatalogMetadata, loadOrbitalCatalog } from './data-service.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;

const state = {
  records: [],
  selected: null,
  mode: 'earth',
  running: true,
  autoRotate: true,
  orbitFilters: new Set(['LEO', 'MEO', 'GEO', 'HEO']),
  groupFilters: new Set(Object.keys(GROUP_STYLES)),
  libraryCategory: 'all',
  librarySelected: null,
};

const scene = new OrbitalScene($('#scene-container'), {
  onSelect: (item) => showDetail(item),
  onFrame: (record) => updateLiveMetrics(record),
});

function formatNumber(value, decimals = 0) {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('es-ES', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function formatCoordinate(value, positive, negative) {
  if (!Number.isFinite(value)) return '—';
  return `${formatNumber(Math.abs(value), 2)}° ${value >= 0 ? positive : negative}`;
}

function toast(message, tone = 'info') {
  const element = document.createElement('div');
  element.className = `toast ${tone}`;
  element.textContent = message;
  $('#toast-region').appendChild(element);
  requestAnimationFrame(() => element.classList.add('visible'));
  setTimeout(() => {
    element.classList.remove('visible');
    setTimeout(() => element.remove(), 240);
  }, 3400);
}

function setView(mode) {
  state.mode = mode;
  scene.setMode(mode);
  $$('.body-button').forEach((button) => button.classList.toggle('active', button.dataset.view === mode));
  $('#layers-section').classList.toggle('context-disabled', mode !== 'earth');
  $('#filters-section').classList.toggle('context-disabled', mode !== 'earth');
  $('#scene-legend').hidden = mode !== 'earth';
  closeDetail();

  const content = {
    earth: ['TIERRA · ÓRBITA BAJA A GEOESTACIONARIA', 'Tráfico orbital en tiempo real', 'Posiciones propagadas con SGP4 a partir del catálogo público.', 'Altitudes orbitales comprimidas para facilitar la lectura.'],
    moon: ['SISTEMA TIERRA–LUNA', 'Entorno orbital lunar', 'Misiones activas destacadas y contexto Tierra–Luna.', 'Órbitas lunares y distancia a la Tierra representadas de forma esquemática.'],
    solar: ['SISTEMA SOLAR · CONTEXTO DE MISIÓN', 'Exploración más allá de la Tierra', 'Planetas, trayectorias heliocéntricas y sondas de espacio profundo.', 'Distancias, radios y posiciones de sondas usan escalas esquemáticas independientes.'],
  }[mode];
  $('#view-eyebrow').textContent = content[0];
  $('#view-title').textContent = content[1];
  $('#view-description').textContent = content[2];
  $('#scale-note').textContent = content[3];
}

function currentFilters() {
  return { orbits: state.orbitFilters, groups: state.groupFilters };
}

function applyFilters() {
  scene.setFilters(currentFilters());
  $('#visible-count').textContent = formatNumber(scene.visibleRecords.length);
}

function renderConstellationFilters() {
  const counts = state.records.reduce((accumulator, record) => {
    accumulator[record.group] = (accumulator[record.group] || 0) + 1;
    return accumulator;
  }, {});
  const order = Object.keys(GROUP_STYLES).sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  $('#constellation-list').replaceChildren(...order.map((key) => {
    const style = GROUP_STYLES[key];
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${key}" checked><span class="group-dot" style="--group-color:${style.color}"></span><span>${style.label}</span><small>${formatNumber(counts[key] || 0)}</small>`;
    return label;
  }));
  $$('#constellation-list input').forEach((input) => input.addEventListener('change', () => {
    input.checked ? state.groupFilters.add(input.value) : state.groupFilters.delete(input.value);
    applyFilters();
  }));
}

function renderOrbitCounts() {
  const counts = state.records.reduce((accumulator, record) => {
    accumulator[record.orbit] = (accumulator[record.orbit] || 0) + 1;
    return accumulator;
  }, {});
  Object.keys(ORBIT_STYLES).forEach((key) => {
    $(`#count-${key.toLowerCase()}`).textContent = formatNumber(counts[key] || 0);
  });
}

function updateLiveMetrics(record) {
  if (state.selected !== record || !record.position) return;
  $('#metric-altitude').textContent = formatNumber(record.position.altitude, 0);
  $('#metric-speed').textContent = formatNumber(record.position.speed, 2);
  $('#metric-lat').textContent = formatCoordinate(record.position.latitude, 'N', 'S');
  $('#metric-lon').textContent = formatCoordinate(record.position.longitude, 'E', 'O');
}

function showDetail(item) {
  state.selected = item;
  const panel = $('#detail-panel');
  const satelliteRecord = Boolean(item?.satrec);
  $('#detail-kicker').textContent = satelliteRecord ? 'OBJETO ORBITAL ACTIVO' : item.kind === 'deep-space' ? 'MISIÓN DE ESPACIO PROFUNDO' : item.kind === 'lunar' ? 'MISIÓN LUNAR' : 'CUERPO CELESTE';
  $('#detail-name').textContent = item.name || item.title || 'Objeto sin nombre';
  $('#detail-constellation').textContent = satelliteRecord ? item.groupLabel : item.agency || item.kind?.replace('-', ' ') || 'Sistema solar';
  $('#detail-id').textContent = satelliteRecord ? `NORAD ${item.id} · ${item.internationalId}` : item.id?.toUpperCase() || 'Contexto esquemático';
  $('#detail-dot').style.background = satelliteRecord ? ORBIT_STYLES[item.orbit].color : item.color || '#8fdcff';
  $('#metric-altitude').textContent = satelliteRecord ? formatNumber(item.position?.altitude ?? item.meanAltitude, 0) : item.altitude ? formatNumber(item.altitude) : '—';
  $('#metric-speed').textContent = satelliteRecord ? formatNumber(item.position?.speed, 2) : '—';
  $('#metric-inclination').textContent = satelliteRecord ? formatNumber(item.inclination, 2) : '—';
  $('#metric-period').textContent = satelliteRecord ? formatNumber(item.periodMinutes, 1) : item.period ? formatNumber(item.period, 1) : '—';
  $('#metric-lat').textContent = satelliteRecord ? formatCoordinate(item.position?.latitude, 'N', 'S') : 'No aplicable';
  $('#metric-lon').textContent = satelliteRecord ? formatCoordinate(item.position?.longitude, 'E', 'O') : 'No aplicable';
  $('#metric-orbit').textContent = satelliteRecord ? ORBIT_STYLES[item.orbit].label : 'Representación esquemática';
  $('#metric-epoch').textContent = satelliteRecord && item.epoch ? new Date(`${item.epoch}Z`).toLocaleString('es-ES', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' }) + ' UTC' : '—';
  $('#metric-perigee').textContent = satelliteRecord ? `${formatNumber(item.perigee, 0)} km` : '—';
  $('#metric-apogee').textContent = satelliteRecord ? `${formatNumber(item.apogee, 0)} km` : '—';
  $('#metric-eccentricity').textContent = satelliteRecord ? formatNumber(item.eccentricity, 6) : '—';
  $('#metric-raan').textContent = satelliteRecord ? `${formatNumber(Number(item.omm.RA_OF_ASC_NODE), 3)}°` : '—';
  $('#metric-arg-perigee').textContent = satelliteRecord ? `${formatNumber(Number(item.omm.ARG_OF_PERICENTER), 3)}°` : '—';
  $('#metric-mean-anomaly').textContent = satelliteRecord ? `${formatNumber(Number(item.omm.MEAN_ANOMALY), 3)}°` : '—';
  $('#metric-mean-motion').textContent = satelliteRecord ? `${formatNumber(item.meanMotion, 7)} rev/día` : '—';
  $('#metric-bstar').textContent = satelliteRecord ? Number(item.omm.BSTAR || 0).toExponential(3) : '—';
  $('.orbital-elements').hidden = !satelliteRecord;
  $('#detail-summary').textContent = satelliteRecord ? describeRecord(item) : item.summary || 'Objeto incluido en el contexto del sistema solar.';
  $('#focus-object').hidden = !satelliteRecord;
  const libraryEntry = findLibraryEntry(item);
  $('#open-library-entry').hidden = !libraryEntry;
  $('#selected-label').textContent = item.name || item.title || 'Objeto';
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
}

function closeDetail() {
  state.selected = null;
  $('#detail-panel').classList.remove('open');
  $('#detail-panel').setAttribute('aria-hidden', 'true');
  $('#selected-label').textContent = 'Ninguno';
  scene.following = false;
}

function findLibraryEntry(item) {
  if (!item) return null;
  if (item.id) {
    const byId = LIBRARY_ENTRIES.find((entry) => entry.id === item.id);
    if (byId) return byId;
  }
  const name = String(item.name || item.title || '').toUpperCase();
  return LIBRARY_ENTRIES.find((entry) => entry.keywords.some((keyword) => name.includes(keyword)));
}

function searchCatalog(query) {
  const resultsBox = $('#search-results');
  const normalized = query.trim().toUpperCase();
  if (!normalized || !state.records.length) {
    resultsBox.hidden = true;
    return;
  }
  const results = state.records
    .filter((record) => record.name.toUpperCase().includes(normalized) || record.id.includes(normalized) || record.internationalId.toUpperCase().includes(normalized))
    .slice(0, 9);
  resultsBox.replaceChildren();
  if (!results.length) {
    resultsBox.innerHTML = '<div class="no-results">No hay coincidencias en el catálogo activo.</div>';
  } else {
    results.forEach((record) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = `<span class="result-dot" style="--result-color:${ORBIT_STYLES[record.orbit].color}"></span><span><strong>${record.name}</strong><small>NORAD ${record.id} · ${record.orbit}</small></span>`;
      button.addEventListener('click', () => {
        setView('earth');
        scene.selectRecord(record, true);
        resultsBox.hidden = true;
        $('#catalog-search').value = record.name;
        closeMobilePanel();
      });
      resultsBox.appendChild(button);
    });
  }
  resultsBox.hidden = false;
}

function renderLibrary() {
  $('#library-tabs').replaceChildren(...LIBRARY_CATEGORIES.map((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = category.label;
    button.classList.toggle('active', state.libraryCategory === category.id);
    button.addEventListener('click', () => {
      state.libraryCategory = category.id;
      renderLibrary();
    });
    return button;
  }));

  const query = $('#library-search').value.trim().toLowerCase();
  const entries = LIBRARY_ENTRIES.filter((entry) => {
    const inCategory = state.libraryCategory === 'all' || entry.category === state.libraryCategory;
    const inSearch = !query || `${entry.title} ${entry.subtitle} ${entry.short}`.toLowerCase().includes(query);
    return inCategory && inSearch;
  });
  $('#library-grid').replaceChildren(...entries.map((entry) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'library-card';
    button.classList.toggle('active', state.librarySelected?.id === entry.id);
    button.style.setProperty('--entry-accent', entry.accent);
    button.innerHTML = `<span class="entry-symbol"><i></i><i></i></span><span><strong>${entry.title}</strong><small>${entry.subtitle}</small></span><svg><use href="#i-chevron"/></svg>`;
    button.addEventListener('click', () => showLibraryArticle(entry));
    return button;
  }));
  if (!entries.length) $('#library-grid').innerHTML = '<div class="library-empty">No hay fichas que coincidan con la búsqueda.</div>';
}

function showLibraryArticle(entry) {
  state.librarySelected = entry;
  renderLibrary();
  const article = $('#library-article');
  article.style.setProperty('--entry-accent', entry.accent);
  article.innerHTML = `
    <div class="article-visual"><span class="orbital-glyph"><i></i><i></i><b></b></span><span>${entry.category.replace('-', ' ').toUpperCase()}</span></div>
    <span class="dialog-kicker">FICHA DE BIBLIOTECA</span>
    <h3>${entry.title}</h3>
    <p class="article-subtitle">${entry.subtitle}</p>
    <p>${entry.body}</p>
    <dl>${entry.facts.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('')}</dl>
    ${entry.searchName ? `<button class="primary-button locate-entry">${icon('target')} Localizar en el mapa</button>` : '<span class="schematic-badge">Posición esquemática en esta versión</span>'}
  `;
  $('.locate-entry', article)?.addEventListener('click', () => {
    if (state.mode !== 'earth') setView('earth');
    const found = scene.selectByName(entry.searchName, true);
    if (found) {
      $('#library-dialog').close();
      setActiveViewButton('earth');
    } else toast('Este objeto no figura como activo en la instantánea actual.', 'warning');
  });
}

function setActiveViewButton(mode) {
  state.mode = mode;
  $$('.body-button').forEach((button) => button.classList.toggle('active', button.dataset.view === mode));
}

function openLibrary(entry = null) {
  const dialog = $('#library-dialog');
  if (!dialog.open) dialog.showModal();
  if (entry) showLibraryArticle(entry);
  else renderLibrary();
}

function closeMobilePanel() {
  $('#control-panel').classList.remove('mobile-open');
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
}

function themeForHour() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 20) return 'afternoon';
  return 'night';
}

function applyTheme(choice) {
  const resolved = choice === 'auto' ? themeForHour() : choice;
  document.documentElement.dataset.theme = resolved;
  localStorage.setItem('scansat-theme', choice);
  $$('#theme-menu button').forEach((button) => button.classList.toggle('active', button.dataset.themeChoice === choice));
  $('#theme-menu').hidden = true;
}

function bindInterface() {
  $$('.body-button').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  $('#menu-toggle').addEventListener('click', () => {
    const panel = $('#control-panel');
    const open = panel.classList.toggle('mobile-open');
    $('#menu-toggle').setAttribute('aria-expanded', String(open));
  });
  $$('.section-heading').forEach((button) => button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') !== 'false';
    button.setAttribute('aria-expanded', String(!expanded));
    button.closest('.panel-section').classList.toggle('collapsed', expanded);
  }));
  $$('.layer-card').forEach((button) => button.addEventListener('click', () => {
    $$('.layer-card').forEach((item) => item.classList.toggle('active', item === button));
    scene.setLayer(button.dataset.layer);
  }));
  $('#atmosphere-toggle').addEventListener('change', (event) => scene.setAtmosphere(event.target.checked));
  const updateSelectionLayers = () => scene.setSelectionLayers({ orbit: $('#orbit-toggle').checked, coverage: $('#coverage-toggle').checked });
  $('#orbit-toggle').addEventListener('change', updateSelectionLayers);
  $('#coverage-toggle').addEventListener('change', updateSelectionLayers);
  $$('#orbit-filters input').forEach((input) => input.addEventListener('change', () => {
    input.checked ? state.orbitFilters.add(input.value) : state.orbitFilters.delete(input.value);
    applyFilters();
  }));
  $('#reset-filters').addEventListener('click', () => {
    state.orbitFilters = new Set(['LEO', 'MEO', 'GEO', 'HEO']);
    state.groupFilters = new Set(Object.keys(GROUP_STYLES));
    $$('#orbit-filters input, #constellation-list input').forEach((input) => { input.checked = true; });
    applyFilters();
  });
  $('#catalog-search').addEventListener('input', (event) => searchCatalog(event.target.value));
  $('#catalog-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') $('#search-results button')?.click();
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-section')) $('#search-results').hidden = true;
    if (!event.target.closest('#theme-button') && !event.target.closest('#theme-menu')) $('#theme-menu').hidden = true;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      event.preventDefault(); $('#catalog-search').focus();
    }
    if (event.key === 'Escape') closeMobilePanel();
  });
  $('#detail-close').addEventListener('click', closeDetail);
  $('#focus-object').addEventListener('click', () => {
    scene.focusSelected();
    $('#focus-object').classList.toggle('tracking', scene.following);
    $('#focus-object').lastChild.textContent = scene.following ? ' Siguiendo objeto' : ' Seguir objeto';
  });
  $('#open-library-entry').addEventListener('click', () => openLibrary(findLibraryEntry(state.selected)));
  $('#home-view').addEventListener('click', () => scene.resetCamera());
  $('#toggle-rotation').addEventListener('click', (event) => {
    state.autoRotate = !state.autoRotate;
    scene.setAutoRotate(state.autoRotate);
    event.currentTarget.classList.toggle('active', state.autoRotate);
  });
  $('#time-toggle').addEventListener('click', (event) => {
    state.running = !state.running;
    scene.setRunning(state.running);
    event.currentTarget.innerHTML = icon(state.running ? 'pause' : 'play');
    event.currentTarget.setAttribute('aria-label', state.running ? 'Pausar simulación' : 'Reanudar simulación');
    $('#simulation-status').textContent = state.running ? 'SIMULACIÓN EN VIVO' : 'SIMULACIÓN EN PAUSA';
  });
  $('#library-button').addEventListener('click', () => openLibrary());
  $('#about-button').addEventListener('click', () => $('#about-dialog').showModal());
  $$('.dialog-close').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
  $$('.app-dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  }));
  $('#library-search').addEventListener('input', renderLibrary);
  $('#theme-button').addEventListener('click', (event) => {
    event.stopPropagation();
    $('#theme-menu').hidden = !$('#theme-menu').hidden;
  });
  $$('#theme-menu button').forEach((button) => button.addEventListener('click', () => applyTheme(button.dataset.themeChoice)));
}

async function initializeCatalog() {
  const progress = $('#load-progress span');
  const metadataPromise = loadCatalogMetadata();
  try {
    const records = await loadOrbitalCatalog((ratio, loaded) => {
      progress.style.width = `${ratio * 100}%`;
      $('#data-label').textContent = `Procesando ${formatNumber(loaded)} órbitas…`;
    });
    state.records = records;
    scene.setCatalog(records);
    renderConstellationFilters();
    renderOrbitCounts();
    $('#catalog-count').textContent = formatNumber(records.length);
    $('#visible-count').textContent = formatNumber(records.length);
    $('#data-dot').className = 'status-dot live';
    const metadata = await metadataPromise;
    const updated = metadata?.updatedAt ? new Date(metadata.updatedAt) : null;
    $('#data-label').textContent = updated && !Number.isNaN(updated.valueOf())
      ? `Elementos actualizados ${updated.toLocaleString('es-ES', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' })} UTC`
      : 'Catálogo orbital cargado';
    $('#load-progress').classList.add('complete');
  } catch (error) {
    $('#data-dot').className = 'status-dot error';
    $('#data-label').textContent = 'Catálogo temporalmente no disponible';
    $('#load-progress').classList.add('error');
    toast('No se ha podido abrir la instantánea orbital. La vista de misiones sigue disponible.', 'error');
    console.error(error);
  }
}

function updateClock() {
  const date = scene.simulationDate;
  $('#utc-clock').textContent = `${date.toLocaleTimeString('es-ES', { timeZone: 'UTC', hour12: false })} UTC`;
  setTimeout(updateClock, 250);
}

bindInterface();
renderLibrary();
applyTheme(localStorage.getItem('scansat-theme') || 'auto');
initializeCatalog();
updateClock();
