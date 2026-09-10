import { mediaFor,evidenceFor } from './encyclopedia-media.js';
import './styles.css';
import { LY_KM, SCALE_STOPS, COSMIC_OBJECTS } from './cosmic-data.js';
import { makeEncyclopedia, entryFor, ENCYCLOPEDIA_CATEGORIES } from './encyclopedia.js';
import { OrbitalScene } from './scene.js';
import {
  GROUP_STYLES,
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
  timeScale: 1,
  utilityPanel: null,
  catalogReliable: true,
  orbitFilters: new Set(['LEO', 'MEO', 'GEO', 'HEO']),
  groupFilters: new Set(Object.keys(GROUP_STYLES)),
  libraryCategory: 'all',
  librarySelected: null,
};
let lastStatusUpdate = 0;
let encyclopedia = makeEncyclopedia();
let explorationEntries = [];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const UTILITY_TITLES = { catalog: 'Base de datos', layers: 'Capas y objetos', filters: 'Filtros orbitales', time: 'Fecha y tiempo' };
const THEME_ICONS = { auto: 'auto', morning: 'morning', afternoon: 'afternoon', night: 'night' };
const MIN_SIMULATION_DATE = new Date('1957-10-04T00:00:00Z');
const MAX_SIMULATION_DATE = new Date('2050-12-31T23:59:59Z');

const scene = new OrbitalScene($('#scene-container'), {
  onSelect: (item) => item ? showDetail(item) : closeDetail(),
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
  if (distance >= LY_KM * 1e9) return `${formatNumber(distance / LY_KM / 1e9, 2)} mil millones a. l.`;
  if (distance >= LY_KM * 1e6) return `${formatNumber(distance / LY_KM / 1e6, 2)} M a. l.`;
  if (distance >= LY_KM * .1) return `${formatNumber(distance / LY_KM, 2)} a. l.`;
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
  if (item?.cosmic && item.kind !== 'star') return ({galaxy:'GALAXIA',cluster:'CÚMULO DE GALAXIAS',structure:'ESTRUCTURA CÓSMICA',universe:'UNIVERSO OBSERVABLE'})[item.kind] || 'COSMOS';
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

  if (item.cosmic) {
    setMetricLabels('DISTANCIA AL SOL', item.kind === 'star' ? 'TIPO ESPECTRAL' : 'EXTENSIÓN', 'DATOS', 'REFERENCIA');
    $('#metric-altitude').textContent = formatDistance(item.distanceLy * LY_KM);
    $('#metric-speed').textContent = item.spect || (item.radiusLy ? formatDistance(item.radiusLy*2*LY_KM) : '—');
    $('#metric-inclination').textContent = item.kind === 'star' ? 'HYG v4.1' : 'Aproximados';
    $('#metric-period').textContent = item.kind === 'star' ? 'J2000' : 'Cosmológica';
  } else if (satellite) {
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
  $('#detail-summary').textContent = satellite ? describeRecord(item) : entryFor(item).body;
  $('#focus-object').hidden = Boolean(item.noLocation);
  const libraryEntry = findLibraryEntry(item);
  $('#open-library-entry').hidden = !libraryEntry;
  $('#selected-label').textContent = item.name || item.title || 'Objeto';
  $('#detail-panel').classList.add('open');
  $('#detail-panel').setAttribute('aria-hidden', 'false');
}

function closeDetail() {
  scene.clearSelection(false);
  state.selected = null;
  $('#detail-panel').classList.remove('open');
  $('#detail-panel').setAttribute('aria-hidden', 'true');
  $('#selected-label').textContent = 'Ninguno';
}

function findLibraryEntry(item) {
  if (!item) return null;
  if (item.satrec) return { ...entryFor(item), body: describeRecord(item), facts: [['NORAD',item.id],['Designador',item.internationalId],['Órbita',item.orbit],['Época',item.epoch]],category:'navigation' };
  const byId = encyclopedia.find((entry) => entry.id === item.id);
  if (byId) return byId;
  const name = String(item.name || item.title || '').toUpperCase();
  return encyclopedia.find((entry) => entry.keywords.some((keyword) => name.includes(keyword))) || entryFor(item);
}

function makeResultButton(item, subtitle, onActivate) {
  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = `<span class="result-dot" style="--result-color:${item.color || (item.satrec ? ORBIT_STYLES[item.orbit].color : '#82dfff')}"></span><span><strong>${escapeHTML(item.name)}</strong><small>${subtitle}</small></span>`;
  button.addEventListener('click', onActivate);
  return button;
}

function searchCatalog(query) {
  const resultsBox = $('#search-results');
  const normalized = normalize(query.trim());
  if (!normalized) { resultsBox.hidden = true; return; }
  const special = [...scene.getFocusTargets().filter((item) => normalize(`${escapeHTML(item.name)} ${item.id}`).includes(normalized)), ...scene.cosmos.surveys.search(normalized,5)].slice(0, 5);
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
      if (!scene.selectRecord(record, true)) {
        toast('Selecciona “Volver a ahora” para localizar objetos del catálogo GP actual.', 'warning');
        return;
      }
      resultsBox.hidden = true; $('#catalog-search').value = record.name; closeMobilePanel();
    }));
  }
  if (!special.length && !records.length) resultsBox.innerHTML = '<div class="no-results">No hay coincidencias en el catálogo público.</div>';
  resultsBox.hidden = false;
}

function renderTargetMenu(query = '') {
  const normalized = normalize(query.trim());
  const targets = [...scene.getFocusTargets().filter((item) => !normalized || normalize(`${escapeHTML(item.name)} ${item.id} ${item.kind}`).includes(normalized)), ...scene.cosmos.surveys.search(normalized,18)];
  const records = normalized ? state.records.filter((record) => `${record.name} ${record.id}`.toUpperCase().includes(normalized)).slice(0, 12) : [];
  const container = $('#target-results');
  container.replaceChildren();
  const groups = [
    ['Sistema solar', targets.filter((item) => !item.cosmic && ['star', 'planet', 'moon'].includes(item.kind))],
    ['Galaxias y universo', targets.filter((item) => item.cosmic && item.kind !== 'star')],
    ['Estrellas HYG · busca por nombre o HIP', targets.filter((item) => item.cosmic && item.kind === 'star')],
    ['Misiones y puntos', targets.filter((item) => !item.cosmic && !['star', 'planet', 'moon'].includes(item.kind))],
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
      button.innerHTML = `<span class="target-glyph" style="--target-color:${item.color || '#80dfff'}"></span><span><strong>${escapeHTML(item.name)}</strong><small>${item.satrec ? `NORAD ${item.id}` : escapeHTML(item.aliases || item.agency || item.parent || item.kind)}</small></span>`;
      button.addEventListener('click', () => {
        if (item.satrec) {
          if (!scene.selectRecord(item, true)) {
            toast('El catálogo GP actual se oculta fuera de su periodo fiable.', 'warning');
            return;
          }
        } else {
          scene.focusItem(item);
          showDetail(item);
        }
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

  $('#view-eyebrow').textContent = `FOCO · ${name.toUpperCase()}`;
  renderTargetMenu($('#target-search').value);
}

function updateStatus(status) {
  if (!status) return;
  const now = performance.now();
  if (now - lastStatusUpdate < 200) return;
  const earth=scene.earthTiles;
  $('#earth-detail-status').textContent=earth.status||'Imágenes por teselas al acercarse. Resolución variable según cobertura; no son imágenes en directo.';
  const credit=$('#map-credit');credit.hidden=!earth.group.visible;
  if(!credit.hidden)credit.innerHTML=earth.weather?`<a href="https://www.earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA GIBS / MODIS</a> · ${earth.date} · observación diaria`:'<a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noreferrer">Esri World Imagery</a> · Esri, Vantor, Earthstar Geographics, GIS User Community';
  const photos=scene.cosmos.photos,photoCredit=$('#photo-credit');
  photoCredit.hidden=!(photos.sky.visible||photos.andromeda.visible||scene.cosmos.cmb.node.visible);
  photoCredit.innerHTML=[scene.cosmos.cmb.node.visible?'<a href="https://lambda.gsfc.nasa.gov/product/wmap/dr4/sos/5year/" target="_blank" rel="noreferrer">CMB: NASA / WMAP Science Team · falso color ±200 μK</a>':'',photos.sky.visible?'<a href="https://www.eso.org/public/images/eso0932a/" target="_blank" rel="noreferrer">Cielo: ESO/S. Brunier · CC BY 4.0</a>':'',photos.andromeda.visible?'<a href="https://esahubble.org/images/heic1502b/" target="_blank" rel="noreferrer">M31: NASA, ESA, Digitized Sky Survey 2 · Davide De Martin · CC BY 4.0</a>':''].filter(Boolean).join(' · ');
  $('#cmb-status').textContent=scene.cosmos.cmb.error?'No se pudo cargar WMAP; recarga para reintentar.':'WMAP · variaciones de temperatura ±200 μK · radio comóvil aproximado 45.500 millones de años luz';
  const surveys=scene.cosmos.surveys;
  const catalogCount=surveys.catalogs.reduce((sum,cat)=>sum+cat.count,0);
  const loading=Object.values(surveys.states).includes('loading');
  const failed=Object.entries(surveys.states).filter(([,state])=>state==='error').map(([name])=>name);
  $('#galaxy-status').textContent=failed.length ? `No se pudo cargar: ${failed.join(', ')}. Recarga para reintentar.` : loading ? 'Cargando cosmografía…' : catalogCount ? `${catalogCount.toLocaleString('es-ES')} registros de galaxias cargados · seleccionables y consultables` : '2MRS + SDSS se cargan al alejarte o al abrir sus catálogos.';
  lastStatusUpdate = now;
  state.catalogReliable = status.catalogReliable !== false;
  $('#visible-count').textContent = formatNumber(status.visible);
  $('#scale-note').textContent = `${formatDistance(status.distanceKm)} al foco · escala física`;
  $('#view-eyebrow').textContent = status.scale.name.toUpperCase();
  $('#evidence-note').textContent = status.scale.evidence;
  const archiveStatus = $('#time-archive-status');
  archiveStatus.classList.toggle('warning', !state.catalogReliable);
  $('.status-dot', archiveStatus).className = `status-dot ${state.catalogReliable ? 'live' : ''}`;
  $('p', archiveStatus).textContent = state.catalogReliable
    ? 'El catálogo GP actual es fiable para este instante.'
    : 'Los GP actuales no son válidos para esta fecha: se ocultan para no mostrar órbitas falsas.';
  updatePlaybackStatus();
}

function renderLibrary() {
  $('#library-tabs').replaceChildren(...ENCYCLOPEDIA_CATEGORIES.map((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = category.label;
    button.classList.toggle('active', state.libraryCategory === category.id);button.setAttribute('aria-pressed',String(state.libraryCategory===category.id));
    button.addEventListener('click', () => { state.libraryCategory = category.id; renderLibrary();if(state.libraryEntries.length)showLibraryArticle(state.libraryEntries[0]);else $('#library-article').innerHTML='<p>No hay artículos en esta selección.</p>'; });
    return button;
  }));
  const query = normalize($('#library-search').value.trim());
  const candidates = [...encyclopedia];
  if(query && ['all','galaxies'].includes(state.libraryCategory)) candidates.push(...scene.cosmos.surveys.search(query,60).map(entryFor));
  if (state.libraryCategory === 'stars' || (query && state.libraryCategory === 'all')) {
    const stars = scene.cosmos.stars.filter(item=>!query || normalize(`${item.name} ${item.id} ${item.aliases||''}`).includes(query));
    candidates.push(...stars.slice(0,120).map(entryFor));
  }
  if(query && ['all','constellation','navigation','science','weather','station'].includes(state.libraryCategory)) candidates.push(...state.records.filter(item=>normalize(`${item.name} ${item.id} ${item.aliases||''}`).includes(query)).slice(0,60).map(item=>findLibraryEntry(item)));
  const filter=$('#library-filter').value;
  const entries = [...new Map(candidates.map(e=>[e.id,e])).values()].filter(entry=>filter==='all'||(filter==='images'&&mediaFor(entry).length)||(filter==='located'&&!entry.noLocation)||(filter==='guides'&&entry.category==='methods')).filter((entry) => (state.libraryCategory === 'all' || entry.category === state.libraryCategory)
    && (!query || normalize(`${entry.id} ${escapeHTML(entry.title)} ${escapeHTML(entry.subtitle)} ${entry.short}`).includes(query)));
  state.libraryEntries=entries;
  $('#library-result-count').textContent = `${entries.length} artículos · HYG: hasta 120 coincidencias por búsqueda`;
  $('#library-grid').replaceChildren(...entries.map((entry) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'library-card';
    button.classList.toggle('active', state.librarySelected?.id === entry.id);
    button.style.setProperty('--entry-accent', entry.accent);
    button.innerHTML = `<span class="entry-index">${String(entries.indexOf(entry)+1).padStart(2,'0')}</span><span><small class="entry-kind">${evidenceFor(entry)}</small><strong>${escapeHTML(entry.title)}</strong><small>${escapeHTML(entry.subtitle)}</small></span>`;
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
  const media=mediaFor(entry),category=ENCYCLOPEDIA_CATEGORIES.find(c=>c.id===entry.category)?.label||entry.category;
  const figures=media.map((m,i)=>`<figure ${i?'hidden':''} data-figure="${i}"><img src="${import.meta.env.BASE_URL}${m.file}" alt="${escapeHTML(m.caption)}" loading="lazy"><figcaption>${escapeHTML(m.caption)}<small>${m.url?`<a href="${escapeHTML(m.url)}" target="_blank" rel="noreferrer">${escapeHTML(m.credit)} ↗</a>`:escapeHTML(m.credit)}</small></figcaption></figure>`).join('');
  article.innerHTML = `
    <div class="article-heading"><span class="dialog-kicker">${escapeHTML(category)} / ${evidenceFor(entry)}</span><h3>${escapeHTML(entry.title)}</h3><p class="article-subtitle">${escapeHTML(entry.subtitle)}</p></div>
    <div class="article-tabs" role="tablist" aria-label="Secciones del artículo"><button role="tab" aria-selected="true" data-article-tab="overview">Visión general</button><button role="tab" aria-selected="false" data-article-tab="data">Datos y escala</button><button role="tab" aria-selected="false" data-article-tab="sources">Fuentes</button></div>
    <section data-article-section="overview"><div class="article-gallery">${figures}${media.length>1?`<div class="gallery-selector">${media.map((m,i)=>`<button aria-label="Ver imagen ${i+1}" aria-pressed="${i===0}" data-image="${i}">${i+1}</button>`).join('')}</div>`:''}</div><h4>Qué es y cómo se representa</h4><p>${escapeHTML(entry.body)}</p></section>
    <section data-article-section="data" hidden><h4>Datos de referencia</h4><dl>${entry.facts.map(([term,value])=>`<div><dt>${escapeHTML(term)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl>${entry.facts.length?'':'<p>Esta ficha es descriptiva; no incluye medidas numéricas verificadas.</p>'}<p>Los marcadores ayudan a localizar objetos. Su tamaño en pantalla no es su diámetro físico.</p></section>
    <section data-article-section="sources" hidden><h4>Procedencia y lectura adicional</h4><p class="article-source"><a href="${escapeHTML(entry.sourceUrl)}" target="_blank" rel="noreferrer">Consultar la fuente de la ficha ↗</a></p>${media.map(m=>`<p>${escapeHTML(m.credit)}${m.url?` · <a href="${escapeHTML(m.url)}" target="_blank" rel="noreferrer">Ver recurso original ↗</a>`:''}</p>`).join('')}<p>Las imágenes de observación, los mapas en falso color y las reconstrucciones se describen por separado en sus pies de imagen.</p></section>
    <div class="article-actions"><button class="primary-button locate-entry" ${entry.noLocation?'hidden':''}>${icon('target')} Localizar en el universo</button><button class="secondary-button article-related">Más de este capítulo</button></div>`;
  $$('[data-article-tab]',article).forEach(button=>button.addEventListener('click',()=>{
    $$('[data-article-tab]',article).forEach(b=>b.setAttribute('aria-selected',String(b===button)));
    $$('[data-article-section]',article).forEach(section=>section.hidden=section.dataset.articleSection!==button.dataset.articleTab);
  }));
  $$('[data-image]',article).forEach(button=>button.addEventListener('click',()=>{
    $$('[data-figure]',article).forEach(figure=>figure.hidden=figure.dataset.figure!==button.dataset.image);
    $$('[data-image]',article).forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  }));
  $('.article-related',article).addEventListener('click',()=>{state.libraryCategory=entry.category;$('#library-search').value='';$('#library-filter').value='all';renderLibrary();});
  article.scrollTop=0;
  $('.locate-entry', article).addEventListener('click', () => {
    const target = entry.target;
    if(target?.id==='cmb'){scene.cosmos.layers.cmb=true;$('#cmb-toggle').checked=true;}
    const found = target ? (scene.focusItem(target) ? target : null) : scene.selectByName(entry.searchName || entry.id, true);
    if (found) { $('#library-dialog').close(); showDetail(found); }
    else toast('Este objeto no figura en la instantánea o efeméride actual.', 'warning');
  });
}

function openLibrary(entry = null) {
  const dialog = $('#library-dialog');
  if (!dialog.open) dialog.showModal();
  showLibraryArticle(entry||state.librarySelected||encyclopedia.find(e=>e.id==='atlas-guide')||encyclopedia[0]);
}

function closeOverlays() {
 closeDetail();closeUtilityPanel();closeTargetMenu();$('#theme-menu').hidden=true;
 $$('dialog[open]').forEach(dialog=>dialog.close());
}

function closeUtilityPanel() {
  $('#control-panel').classList.remove('open');
  $('#control-panel').setAttribute('aria-hidden', 'true');
  $$('.utility-trigger').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  state.utilityPanel = null;
}

function openUtilityPanel(name) {
  closeDetail();closeTargetMenu();$('#theme-menu').hidden=true;
  $$('dialog[open]').forEach(dialog=>dialog.close());
  const panel = $('#control-panel');
  if (panel.classList.contains('open') && state.utilityPanel === name) {
    closeUtilityPanel();
    return;
  }
  state.utilityPanel = name;
  $('#utility-panel-title').textContent = UTILITY_TITLES[name] || 'Herramientas';
  $$('[data-utility-section]').forEach((section) => section.classList.toggle('utility-active', section.dataset.utilitySection === name));
  $$('.utility-trigger').forEach((button) => button.setAttribute('aria-expanded', String(button.dataset.utility === name)));
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  if (name === 'catalog') setTimeout(() => $('#catalog-search').focus(), 220);
}

function closeMobilePanel() {
  closeUtilityPanel();
}

function themeForHour() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 20) return 'afternoon';
  return 'night';
}

function applyTheme(choice) {
  document.documentElement.dataset.theme = choice === 'auto' ? themeForHour() : choice;
  localStorage.setItem('universal-theme', choice);
  $$('#theme-menu button').forEach((button) => button.classList.toggle('active', button.dataset.themeChoice === choice));
  $('#theme-icon-use').setAttribute('href', `#i-${THEME_ICONS[choice] || 'auto'}`);
  $('#theme-button').setAttribute('title', `Tema: ${choice === 'auto' ? 'automático' : choice}`);
  $('#theme-menu').hidden = true;
}

function formatSimulationInstant(date) {
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function setRunning(running) {
  state.running = running;
  scene.setRunning(running);
  const button = $('#time-toggle');
  button.innerHTML = `${icon(running ? 'pause' : 'play')}<span>${running ? 'Pausar simulación' : 'Reanudar simulación'}</span>`;
  button.setAttribute('aria-label', running ? 'Pausar simulación' : 'Reanudar simulación');
  updatePlaybackStatus();
}

function updatePlaybackStatus() {
  if (!state.catalogReliable) {
    $('#simulation-status').textContent = 'MODO HISTÓRICO · SIN GP ARCHIVADO';
    return;
  }
  if (!state.running) {
    $('#simulation-status').textContent = 'SIMULACIÓN EN PAUSA';
    return;
  }
  const rate = state.timeScale.toLocaleString('es-ES');
  $('#simulation-status').textContent = `SIMULACIÓN ${rate}×`;
}

function setSimulationInstant(date, { pause = true } = {}) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    toast('La fecha indicada no es válida.', 'warning');
    return;
  }
  if (date < MIN_SIMULATION_DATE || date > MAX_SIMULATION_DATE) {
    toast('El intervalo disponible va del 4 de octubre de 1957 al 31 de diciembre de 2050.', 'warning');
    return;
  }
  scene.setSimulationDate(date);
  $('#simulation-date-input').value = date.toISOString().slice(0, 19);
  if (pause) setRunning(false);
}

function bindInterface() {
  for(const layer of ['stars','galaxies','structure','labels','sdss','twoMrs','flows','sky','population','cmb']) $(`#${layer}-toggle`).addEventListener('change',event=>{
    scene.cosmos.layers[layer]=event.target.checked;
    if(layer==='labels')scene.showLabels=event.target.checked;
  });
  $('#load-galaxy-catalogs').addEventListener('click',async()=>{
    await Promise.all([scene.cosmos.surveys.loadCatalog('twoMrs'),scene.cosmos.surveys.loadCatalog('sdss')]);renderLibrary();renderTargetMenu($('#target-search').value);
  });
  $('#earth-detail-toggle').addEventListener('change',e=>{scene.earthTiles.enabled=e.target.checked;});
  $('#earth-weather-toggle').addEventListener('change',e=>{scene.earthTiles.weather=e.target.checked;});
  $('#cmb-focus').addEventListener('click',()=>{scene.cosmos.layers.cmb=true;$('#cmb-toggle').checked=true;scene.focusItem(COSMIC_OBJECTS.find(x=>x.id==='cmb'));closeUtilityPanel();});
  $('#components-toggle').addEventListener('change',event=>{scene.showComponents=event.target.checked;});
  $('#star-magnitude').addEventListener('input',event=>{scene.cosmos.magnitudeLimit.value=Number(event.target.value);$('#star-magnitude-value').textContent=event.target.value;});
  $('#planet-orbits-toggle').addEventListener('change',event=>{scene.showPlanetOrbits=event.target.checked;});

  $('#focus-picker').addEventListener('click', (event) => {
    event.stopPropagation();
    const open=$('#target-menu').hidden;closeOverlays();$('#target-menu').hidden=!open;
    $('#focus-picker').setAttribute('aria-expanded', String(!$('#target-menu').hidden));
    if (!$('#target-menu').hidden) { renderTargetMenu($('#target-search').value); $('#target-search').focus(); }
  });
  $('#target-search').addEventListener('input', (event) => renderTargetMenu(event.target.value));
  $$('.utility-trigger').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    openUtilityPanel(button.dataset.utility);
  }));
  $('#control-panel-close').addEventListener('click', closeUtilityPanel);
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
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); openUtilityPanel('catalog'); }
    if (event.key === 'Escape') { closeMobilePanel(); closeTargetMenu(); }
  });
  $('#detail-close').addEventListener('click', closeDetail);
  $('#focus-object').addEventListener('click', () => {
    if (scene.focusSelected()) toast(`Foco centrado en ${state.selected?.name || 'el objeto'}.`);
  });
  $('#open-library-entry').addEventListener('click', () => openLibrary(findLibraryEntry(state.selected)));
  $('#home-view').addEventListener('click', () => scene.focusBody('earth'));
  $('#solar-overview').addEventListener('click', () => scene.navigateScale(SCALE_STOPS[2]));
  $('#time-toggle').addEventListener('click', () => setRunning(!state.running));
  $('#time-apply').addEventListener('click', () => setSimulationInstant(new Date(`${$('#simulation-date-input').value}Z`)));
  $('#time-live').addEventListener('click', () => {
    state.timeScale = 1;
    $('#time-rate-select').value = '1';
    scene.setTimeScale(1);
    setSimulationInstant(new Date(), { pause: false });
    scene.liveTime=true;
    setRunning(true);
  });
  $$('[data-time-step]').forEach((button) => button.addEventListener('click', () => {
    setSimulationInstant(new Date(scene.simulationDate.getTime() + Number(button.dataset.timeStep)));
  }));
  $('#time-rate-select').addEventListener('change', (event) => {
    state.timeScale = Number(event.target.value) || 1;
    scene.setTimeScale(state.timeScale);
    updatePlaybackStatus();
  });
  $('#library-button').addEventListener('click', () => { closeOverlays(); openLibrary(); });
  $('#about-button').addEventListener('click', () => { closeOverlays(); $('#about-dialog').showModal(); });
  $$('.dialog-close').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
  $$('.app-dialog').forEach((dialog) => dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }));
  $('#library-filter').addEventListener('change',renderLibrary);
  $('#library-search').addEventListener('input', renderLibrary);
  $('#theme-button').addEventListener('click', (event) => { event.stopPropagation(); const open=$('#theme-menu').hidden;closeOverlays();$('#theme-menu').hidden=!open; });
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
  encyclopedia=makeEncyclopedia([...scene.getFocusTargets().filter(x=>!x.cosmic || x.kind!=='star'),...explorationEntries]);
  renderLibrary();
  renderTargetMenu();
}

function updateClock() {
  const instant = formatSimulationInstant(scene.simulationDate);
  $('#time-panel-clock').textContent = instant;
  if (document.activeElement !== $('#simulation-date-input')) $('#simulation-date-input').value = scene.simulationDate.toISOString().slice(0, 19);
  setTimeout(updateClock, 250);
}

bindInterface();
renderLibrary();
renderTargetMenu();
applyTheme(localStorage.getItem('universal-theme') || 'auto');
initializeCatalog();
fetch(`${import.meta.env.BASE_URL}data/exploration.json`).then(r=>{if(!r.ok)throw new Error('GCAT no disponible');return r.json();}).then(data=>{
  scene.setExplorationData(data);
  explorationEntries=[...data.missions,...data.sites];
  encyclopedia=makeEncyclopedia([...scene.getFocusTargets().filter(x=>!x.cosmic||x.kind!=='star'),...explorationEntries]);
  $('#exploration-status').textContent=`${data.missions.length} registros históricos de cargas útiles · ${data.sites.length} registros de aterrizajes e impactos (GCAT)`;
  renderLibrary();renderTargetMenu();
}).catch(error=>{$('#exploration-status').textContent='Archivo GCAT no disponible; se conservan los emplazamientos básicos.';console.error(error);});
scene.cosmos.loadStars().then(count=>{
  $('#stellar-status').textContent=count ? `${formatNumber(count)} estrellas HYG · posiciones J2000` : 'Catálogo estelar no disponible; vuelve a cargar para reintentar.';
  renderTargetMenu(); renderLibrary();
});
updateClock();
