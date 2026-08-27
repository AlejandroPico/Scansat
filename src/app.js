import './styles.css';
import { OrbitalScene } from './scene.js';
import {
  GROUP_STYLES,
  LIBRARY_CATEGORIES,
  LIBRARY_ENTRIES,
  ORBIT_STYLES,
  describeRecord,
} from './catalog.js';
import { loadCatalogMetadata, loadOrbitalCatalog, loadSpacecraftEphemerides } from './data-service.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;

const state = {
  records: [],
  selected: null,
  running: true,
  orbitFilters: new Set(['LEO', 'MEO', 'GEO', 'HEO']),
  groupFilters: new Set(Object.keys(GROUP_STYLES)),
  libraryCategory: 'all',
  librarySelected: null,
};
let lastStatusUpdate = 0;

const scene = new OrbitalScene($('#scene-container'), {
  onSelect: (item) => showDetail(item),
  onFocus: (item) => updateFocusUI(item),
  onFrame: (record, status) => {
    if (record) updateLiveMetrics(record);
    updateStatus(status);
  },
});

function formatNumber(value, decimals = 0) {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('es-ES', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function formatDistance(value) {
  if (!Number.isFinite(Number(value))) return '—';
  const distance = Number(value);
  if (distance >= 149_597_870.7) return `${formatNumber(distance / 149_597_870.7, 3)} UA`;
  if (distance >= 1_000_000) return `${formatNumber(distance / 1_000_000, 2)} M km`;
  return `${formatNumber(distance, 0)} km`;
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

function currentFilters() {
  return {
    orbits: state.orbitFilters,
    groups: state.groupFilters,
    debris: $('#debris-toggle').checked,
  };
}

function applyFilters() {
  scene.setFilters(currentFilters());
  scene.setObjectLayers({
    debris: $('#debris-toggle').checked,
    missions: $('#missions-toggle').checked,
    surface: $('#surface-toggle').checked,
  });
  $('#visible-count').textContent = formatNumber(scene.visibleRecords.length);
}

function renderConstellationFilters() {
  const counts = state.records.filter((record) => !record.isDebris).reduce((accumulator, record) => {
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
  const counts = state.records.filter((record) => !record.isDebris).reduce((accumulator, record) => {
    accumulator[record.orbit] = (accumulator[record.orbit] || 0) + 1;
    return accumulator;
  }, {});
  for (const key of Object.keys(ORBIT_STYLES)) $(`#count-${key.toLowerCase()}`).textContent = formatNumber(counts[key] || 0);
}

function setMetricLabels(a, b, c, d, units = []) {
  $('#metric-a-label').textContent = a;
  $('#metric-b-label').textContent = b;
  $('#metric-c-label').textContent = c;
  $('#metric-d-label').textContent = d;
  $('#metric-a-unit').textContent = units[0] || '';
  $('#metric-b-unit').textContent = units[1] || '';
  $('#metric-c-unit').textContent = units[2] || '';
  $('#metric-d-unit').textContent = units[3] || '';
}

function updateLiveMetrics(record) {
  if (state.selected !== record || !record.position) return;
  $('#metric-altitude').textContent = formatNumber(record.position.altitude, 0);
  $('#metric-speed').textContent = formatNumber(record.position.speed, 2);
  $('#metric-lat').textContent = formatCoordinate(record.position.latitude, 'N', 'S');
  $('#metric-lon').textContent = formatCoordinate(record.position.longitude, 'E', 'O');
}

function itemType(item) {
  if (item?.satrec) return item.isDebris ? 'BASURA ESPACIAL RASTREADA' : 'OBJETO ORBITAL PÚBLICO';
  if (item?.kind === 'lagrange') return 'PUNTO DE LAGRANGE';
  if (item?.kind === 'spacecraft') return 'SONDA U OBSERVATORIO';
  if (item?.kind === 'rover' || item?.kind === 'landing') return 'MISIÓN DE SUPERFICIE';
  if (item?.kind === 'moon') return 'LUNA';
  if (item?.kind === 'planet') return 'PLANETA';
  if (item?.kind === 'star') return 'ESTRELLA';
  return 'OBJETO DEL SISTEMA SOLAR';
}

function showDetail(item) {
  if (!item) return;
  state.selected = item;
  scene.selected = item;
  const satellite = Boolean(item.satrec);
  const body = Number.isFinite(item.radiusKm);
  const surface = item.kind === 'rover' || item.kind === 'landing';
  const vector = item.positionKm;
  const velocity = item.velocityKmS ? Math.hypot(item.velocityKmS.x, item.velocityKmS.y, item.velocityKmS.z) : NaN;

  $('#detail-kicker').textContent = itemType(item);
  $('#detail-name').textContent = item.name || item.title || 'Objeto sin nombre';
  $('#detail-constellation').textContent = satellite ? item.groupLabel : item.agency || item.source || item.type || 'Sistema solar';
  $('#detail-id').textContent = satellite ? `NORAD ${item.id} · ${item.internationalId}` : [item.id?.toUpperCase(), item.status].filter(Boolean).join(' · ');
  $('#detail-dot').style.background = satellite ? (item.isDebris ? '#9b8178' : ORBIT_STYLES[item.orbit].color) : item.color || '#8fdcff';

  if (satellite) {
    setMetricLabels('ALTITUD', 'VELOCIDAD', 'INCLINACIÓN', 'PERIODO', ['kilómetros', 'km/s', 'grados', 'minutos']);
    $('#metric-altitude').textContent = formatNumber(item.position?.altitude ?? item.meanAltitude, 0);
    $('#metric-speed').textContent = formatNumber(item.position?.speed, 2);
    $('#metric-inclination').textContent = formatNumber(item.inclination, 2);
    $('#metric-period').textContent = formatNumber(item.periodMinutes, 1);
  } else if (body) {
    setMetricLabels('RADIO', 'ROTACIÓN', 'CENTRO ORBITAL', 'TIPO', ['kilómetros', 'horas', '', '']);
    $('#metric-altitude').textContent = formatNumber(item.radiusKm, item.radiusKm < 100 ? 1 : 0);
    $('#metric-speed').textContent = item.rotationHours ? formatNumber(Math.abs(item.rotationHours), 2) : '—';
    $('#metric-inclination').textContent = item.parent ? item.parent.toUpperCase() : '—';
    $('#metric-period').textContent = item.kind === 'moon' ? 'Luna' : item.kind === 'star' ? 'Estrella' : 'Planeta';
  } else if (item.kind === 'spacecraft') {
    setMetricLabels('DISTANCIA SOL', 'VELOCIDAD', 'FUENTE', 'PERIODO', ['', 'km/s', '', 'horas']);
    $('#metric-altitude').textContent = vector ? formatDistance(Math.hypot(vector.x, vector.y, vector.z)) : item.parent?.toUpperCase() || 'L1/L2';
    $('#metric-speed').textContent = formatNumber(velocity, 2);
    $('#metric-inclination').textContent = item.source || item.agency || 'Modelo orbital';
    $('#metric-period').textContent = item.periodHours ? formatNumber(item.periodHours, 2) : '—';
  } else if (surface) {
    setMetricLabels('LATITUD', 'LONGITUD', 'ESTADO', 'CUERPO', ['', '', '', '']);
    $('#metric-altitude').textContent = formatCoordinate(item.lat, 'N', 'S');
    $('#metric-speed').textContent = formatCoordinate(item.lon, 'E', 'O');
    $('#metric-inclination').textContent = item.status || 'Histórico';
    $('#metric-period').textContent = item.body?.toUpperCase() || '—';
  } else {
    setMetricLabels('SISTEMA', 'PUNTO', 'MODELO', 'ESCALA', ['', '', '', '']);
    $('#metric-altitude').textContent = item.system || 'Sol–Tierra';
    $('#metric-speed').textContent = item.point || '—';
    $('#metric-inclination').textContent = 'Gravitatorio';
    $('#metric-period').textContent = 'Física';
  }

  $('#metric-lat').textContent = satellite ? formatCoordinate(item.position?.latitude, 'N', 'S') : surface ? formatCoordinate(item.lat, 'N', 'S') : 'No aplicable';
  $('#metric-lon').textContent = satellite ? formatCoordinate(item.position?.longitude, 'E', 'O') : surface ? formatCoordinate(item.lon, 'E', 'O') : 'No aplicable';
  $('#metric-orbit').textContent = satellite ? ORBIT_STYLES[item.orbit].label : item.parent ? `Alrededor de ${item.parent}` : item.kind === 'lagrange' ? item.name : 'Heliocéntrica / física';
  $('#metric-epoch').textContent = satellite && item.epoch
    ? `${new Date(`${item.epoch}Z`).toLocaleString('es-ES', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' })} UTC`
    : item.epoch || item.source || '—';
  $('#metric-perigee').textContent = satellite ? `${formatNumber(item.perigee, 0)} km` : '—';
  $('#metric-apogee').textContent = satellite ? `${formatNumber(item.apogee, 0)} km` : '—';
  $('#metric-eccentricity').textContent = satellite ? formatNumber(item.eccentricity, 6) : '—';
  $('#metric-raan').textContent = satellite ? `${formatNumber(Number(item.omm.RA_OF_ASC_NODE), 3)}°` : '—';
  $('#metric-arg-perigee').textContent = satellite ? `${formatNumber(Number(item.omm.ARG_OF_PERICENTER), 3)}°` : '—';
  $('#metric-mean-anomaly').textContent = satellite ? `${formatNumber(Number(item.omm.MEAN_ANOMALY), 3)}°` : '—';
  $('#metric-mean-motion').textContent = satellite ? `${formatNumber(item.meanMotion, 7)} rev/día` : '—';
  $('#metric-bstar').textContent = satellite ? Number(item.omm.BSTAR || 0).toExponential(3) : '—';
  $('.orbital-elements').hidden = !satellite;
  $('#detail-summary').textContent = satellite ? describeRecord(item) : item.summary || 'Objeto incluido en el sistema solar continuo de ScanSat.';
  $('#focus-object').hidden = false;
  const libraryEntry = findLibraryEntry(item);
  $('#open-library-entry').hidden = !libraryEntry;
  $('#selected-label').textContent = item.name || item.title || 'Objeto';
  $('#detail-panel').classList.add('open');
  $('#detail-panel').setAttribute('aria-hidden', 'false');
}

function closeDetail() {
  state.selected = null;
  $('#detail-panel').classList.remove('open');
  $('#detail-panel').setAttribute('aria-hidden', 'true');
  $('#selected-label').textContent = 'Ninguno';
}

function findLibraryEntry(item) {
  if (!item) return null;
  const byId = LIBRARY_ENTRIES.find((entry) => entry.id === item.id);
  if (byId) return byId;
  const name = String(item.name || item.title || '').toUpperCase();
  return LIBRARY_ENTRIES.find((entry) => entry.keywords.some((keyword) => name.includes(keyword)));
}

function makeResultButton(item, subtitle, onActivate) {
  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = `<span class="result-dot" style="--result-color:${item.color || (item.satrec ? ORBIT_STYLES[item.orbit].color : '#82dfff')}"></span><span><strong>${item.name}</strong><small>${subtitle}</small></span>`;
  button.addEventListener('click', onActivate);
  return button;
}

function searchCatalog(query) {
  const resultsBox = $('#search-results');
  const normalized = query.trim().toUpperCase();
  if (!normalized) { resultsBox.hidden = true; return; }
  const special = scene.getFocusTargets().filter((item) => `${item.name} ${item.id}`.toUpperCase().includes(normalized)).slice(0, 5);
  const records = state.records.filter((record) => record.name.toUpperCase().includes(normalized)
    || record.id.includes(normalized) || record.internationalId.toUpperCase().includes(normalized)).slice(0, 9 - special.length);
  resultsBox.replaceChildren();
  for (const item of special) {
    resultsBox.appendChild(makeResultButton(item, `${item.kind || item.type} · cambiar foco`, () => {
      scene.focusItem(item); showDetail(item); resultsBox.hidden = true; $('#catalog-search').value = item.name; closeMobilePanel();
    }));
  }
  for (const record of records) {
    resultsBox.appendChild(makeResultButton(record, `NORAD ${record.id} · ${record.isDebris ? 'basura' : record.orbit}`, () => {
      scene.selectRecord(record, true); resultsBox.hidden = true; $('#catalog-search').value = record.name; closeMobilePanel();
    }));
  }
  if (!special.length && !records.length) resultsBox.innerHTML = '<div class="no-results">No hay coincidencias en el catálogo público.</div>';
  resultsBox.hidden = false;
}

function renderTargetMenu(query = '') {
  const normalized = query.trim().toUpperCase();
  const targets = scene.getFocusTargets().filter((item) => !normalized || `${item.name} ${item.id} ${item.kind}`.toUpperCase().includes(normalized));
  const records = normalized ? state.records.filter((record) => `${record.name} ${record.id}`.toUpperCase().includes(normalized)).slice(0, 12) : [];
  const container = $('#target-results');
  container.replaceChildren();
  const groups = [
    ['Cuerpos celestes', targets.filter((item) => ['star', 'planet', 'moon'].includes(item.kind))],
    ['Misiones y puntos', targets.filter((item) => !['star', 'planet', 'moon'].includes(item.kind))],
    ['Catálogo terrestre', records],
  ];
  for (const [title, items] of groups) {
    if (!items.length) continue;
    const heading = document.createElement('div');
    heading.className = 'target-heading';
    heading.textContent = title;
    container.appendChild(heading);
    for (const item of items.slice(0, normalized ? 18 : 30)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = `<span class="target-glyph" style="--target-color:${item.color || '#80dfff'}"></span><span><strong>${item.name}</strong><small>${item.satrec ? `NORAD ${item.id}` : item.agency || item.parent || item.kind}</small></span>`;
      button.addEventListener('click', () => {
        if (item.satrec) scene.selectRecord(item, true);
        else { scene.focusItem(item); showDetail(item); }
        closeTargetMenu();
      });
      container.appendChild(button);
    }
  }
}

function closeTargetMenu() {
  $('#target-menu').hidden = true;
  $('#focus-picker').setAttribute('aria-expanded', 'false');
}

function updateFocusUI(item) {
  const name = item?.name || 'Tierra';
  $('#focus-label').textContent = name;
  const kind = itemType(item).replace('OBJETO ORBITAL PÚBLICO', 'SATÉLITE').replace('BASURA ESPACIAL RASTREADA', 'FRAGMENTO');
  $('#view-eyebrow').textContent = `SISTEMA SOLAR · FOCO ${name.toUpperCase()}`;
  $('#view-title').textContent = item?.id === 'earth' ? 'La Tierra, sin escalas comprimidas' : `Observando ${name}`;
  $('#view-description').textContent = `${kind}. Doble clic en otro objeto o usa el selector de foco para navegar sin cambiar de escena.`;
  renderTargetMenu($('#target-search').value);
}

function updateStatus(status) {
  if (!status) return;
  const now = performance.now();
  if (now - lastStatusUpdate < 200) return;
  lastStatusUpdate = now;
  $('#visible-count').textContent = formatNumber(status.visible);
  $('#scale-note').textContent = `Distancia al foco: ${formatDistance(status.distanceKm)} · radios y órbitas en kilómetros físicos`;
}

function renderLibrary() {
  $('#library-tabs').replaceChildren(...LIBRARY_CATEGORIES.map((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = category.label;
    button.classList.toggle('active', state.libraryCategory === category.id);
    button.addEventListener('click', () => { state.libraryCategory = category.id; renderLibrary(); });
    return button;
  }));
  const query = $('#library-search').value.trim().toLowerCase();
  const entries = LIBRARY_ENTRIES.filter((entry) => (state.libraryCategory === 'all' || entry.category === state.libraryCategory)
    && (!query || `${entry.title} ${entry.subtitle} ${entry.short}`.toLowerCase().includes(query)));
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
    <span class="dialog-kicker">FICHA DE BIBLIOTECA</span><h3>${entry.title}</h3>
    <p class="article-subtitle">${entry.subtitle}</p><p>${entry.body}</p>
    <dl>${entry.facts.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('')}</dl>
    <button class="primary-button locate-entry">${icon('target')} Localizar en la escena</button>`;
  $('.locate-entry', article).addEventListener('click', () => {
    const found = scene.selectByName(entry.searchName || entry.id, true);
    if (found) { $('#library-dialog').close(); showDetail(found); }
    else toast('Este objeto no figura en la instantánea o efeméride actual.', 'warning');
  });
}

function openLibrary(entry = null) {
  const dialog = $('#library-dialog');
  if (!dialog.open) dialog.showModal();
  if (entry) showLibraryArticle(entry); else renderLibrary();
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
  document.documentElement.dataset.theme = choice === 'auto' ? themeForHour() : choice;
  localStorage.setItem('scansat-theme', choice);
  $$('#theme-menu button').forEach((button) => button.classList.toggle('active', button.dataset.themeChoice === choice));
  $('#theme-menu').hidden = true;
}

function bindInterface() {
  $('#focus-picker').addEventListener('click', (event) => {
    event.stopPropagation();
    $('#target-menu').hidden = !$('#target-menu').hidden;
    $('#focus-picker').setAttribute('aria-expanded', String(!$('#target-menu').hidden));
    if (!$('#target-menu').hidden) { renderTargetMenu($('#target-search').value); $('#target-search').focus(); }
  });
  $('#target-search').addEventListener('input', (event) => renderTargetMenu(event.target.value));
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
  for (const id of ['debris-toggle', 'missions-toggle', 'surface-toggle']) $(`#${id}`).addEventListener('change', applyFilters);
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
  $('#catalog-search').addEventListener('keydown', (event) => { if (event.key === 'Enter') $('#search-results button')?.click(); });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-section')) $('#search-results').hidden = true;
    if (!event.target.closest('#theme-button') && !event.target.closest('#theme-menu')) $('#theme-menu').hidden = true;
    if (!event.target.closest('#focus-picker') && !event.target.closest('#target-menu')) closeTargetMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#catalog-search').focus(); }
    if (event.key === 'Escape') { closeMobilePanel(); closeTargetMenu(); }
  });
  $('#detail-close').addEventListener('click', closeDetail);
  $('#focus-object').addEventListener('click', () => {
    if (scene.focusSelected()) toast(`Foco centrado en ${state.selected?.name || 'el objeto'}.`);
  });
  $('#open-library-entry').addEventListener('click', () => openLibrary(findLibraryEntry(state.selected)));
  $('#home-view').addEventListener('click', () => scene.resetCamera());
  $('#solar-overview').addEventListener('click', () => scene.focusBody('sun'));
  $('#time-toggle').addEventListener('click', (event) => {
    state.running = !state.running;
    scene.setRunning(state.running);
    event.currentTarget.innerHTML = icon(state.running ? 'pause' : 'play');
    event.currentTarget.setAttribute('aria-label', state.running ? 'Pausar simulación' : 'Reanudar simulación');
    $('#simulation-status').textContent = state.running ? 'SIMULACIÓN 1× EN VIVO' : 'SIMULACIÓN EN PAUSA';
  });
  $('#library-button').addEventListener('click', () => openLibrary());
  $('#about-button').addEventListener('click', () => $('#about-dialog').showModal());
  $$('.dialog-close').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
  $$('.app-dialog').forEach((dialog) => dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }));
  $('#library-search').addEventListener('input', renderLibrary);
  $('#theme-button').addEventListener('click', (event) => { event.stopPropagation(); $('#theme-menu').hidden = !$('#theme-menu').hidden; });
  $$('#theme-menu button').forEach((button) => button.addEventListener('click', () => applyTheme(button.dataset.themeChoice)));
}

async function initializeCatalog() {
  const progress = $('#load-progress span');
  const metadataPromise = loadCatalogMetadata();
  const spacecraftPromise = loadSpacecraftEphemerides();
  try {
    const records = await loadOrbitalCatalog((ratio, loaded) => {
      progress.style.width = `${ratio * 100}%`;
      $('#data-label').textContent = `Procesando ${formatNumber(loaded)} trayectorias…`;
    });
    state.records = records;
    scene.setCatalog(records);
    renderConstellationFilters();
    renderOrbitCounts();
    const activeCount = records.filter((record) => !record.isDebris).length;
    const debrisCount = records.length - activeCount;
    $('#catalog-count').textContent = formatNumber(activeCount);
    $('#debris-count').textContent = formatNumber(debrisCount);
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
    $('#data-label').textContent = 'Catálogo terrestre no disponible';
    $('#load-progress').classList.add('error');
    toast('No se ha podido abrir la instantánea orbital. El sistema solar sigue disponible.', 'error');
    console.error(error);
  }
  const spacecraft = await spacecraftPromise;
  scene.setSpacecraft(spacecraft);
  renderTargetMenu();
}

function updateClock() {
  $('#utc-clock').textContent = `${scene.simulationDate.toLocaleTimeString('es-ES', { timeZone: 'UTC', hour12: false })} UTC`;
  setTimeout(updateClock, 250);
}

bindInterface();
renderLibrary();
renderTargetMenu();
applyTheme(localStorage.getItem('scansat-theme') || 'auto');
initializeCatalog();
updateClock();
