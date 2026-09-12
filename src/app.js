import {navigationRegion,nearestTargets} from './context-navigation.js';
import {craftSpec} from './craft-models.js';
import { ATLAS_LAYERS } from './atlas-data.js';
import atlasImages from '../public/data/atlas/image-manifest.json' with {type:'json'};
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
  if (item?.cosmic && item.kind !== 'star') return ({'stellar-cluster':'CÚMULO ESTELAR','stellar-stream':'CORRIENTE ESTELAR',nebula:'NEBULOSA',void:'VACÍO CÓSMICO','mass-map':'MASA POR LENTES','solar-region':'REGIÓN DEL SISTEMA SOLAR',galaxy:'GALAXIA',cluster:'CÚMULO DE GALAXIAS',structure:'ESTRUCTURA CÓSMICA',universe:'UNIVERSO OBSERVABLE'})[item.kind] || 'COSMOS';
  if (item?.satrec) return item.isDebris ? 'BASURA ESPACIAL RASTREADA' : 'OBJETO ORBITAL PÚBLICO';
  if (item?.kind === 'lagrange') return 'PUNTO DE LAGRANGE';
  if (item?.kind === 'spacecraft') return 'SONDA U OBSERVATORIO';
  if (item?.kind === 'rover' || item?.kind === 'landing') return 'MISIÓN DE SUPERFICIE';
  if (item?.kind === 'moon') return 'LUNA';
  if (item?.kind === 'dwarf') return 'PLANETA ENANO';
  if (['asteroid','minor'].includes(item?.kind)) return 'CUERPO MENOR';
  if (item?.kind === 'planet') return 'PLANETA';
  if (item?.kind === 'star') return 'ESTRELLA';
  return 'OBJETO DEL SISTEMA SOLAR';
}

function showDetail(item) {
  if (!item) return;
  state.selected = item;
  scene.selected = item;
  const spec=craftSpec(item);
  $('#craft-inspect').hidden=!spec;
  $('#craft-inspect').onclick=()=>scene.craftModels.inspect(item);
  $('#craft-description').hidden=!spec;
  $('#craft-description').textContent=spec?spec.note:'';
  const satellite = Boolean(item.satrec);
  const body = Number.isFinite(item.radiusKm);
  const surface = item.kind === 'rover' || item.kind === 'landing';
  const vector = item.positionKm;
  const velocity = item.velocityKmS ? Math.hypot(item.velocityKmS.x, item.velocityKmS.y, item.velocityKmS.z) : NaN;

  updateAtlasCredit(item);
  $('#detail-kicker').textContent = itemType(item);
  $('#detail-name').textContent = item.name || item.title || 'Objeto sin nombre';
  $('#detail-constellation').textContent = satellite ? item.groupLabel : item.agency || item.source || item.type || 'Sistema solar';
  $('#detail-id').textContent = satellite ? `NORAD ${item.id} · ${item.internationalId}` : [item.id?.toUpperCase(), item.status].filter(Boolean).join(' · ');
  $('#detail-dot').style.background = satellite ? (item.isDebris ? '#9b8178' : ORBIT_STYLES[item.orbit].color) : item.color || '#8fdcff';

  if (item.cosmic) {
    setMetricLabels('DISTANCIA AL SOL', item.kind === 'star' ? 'TIPO ESPECTRAL' : 'EXTENSIÓN', 'DATOS', 'REFERENCIA');
    $('#metric-altitude').textContent = item.noLocation ? 'Sin distancia fiable' : formatDistance(item.distanceLy * LY_KM);
    $('#metric-speed').textContent = item.spect || (item.radiusLy ? formatDistance(item.radiusLy*2*LY_KM) : '—');
    $('#metric-inclination').textContent = item.evidence || (item.kind === 'star' ? 'HYG v4.1' : 'Aproximados');
    $('#metric-period').textContent = item.atlasLayer ? (item.solarRegion?'Heliocéntrica':'ICRS / galáctica') : item.kind === 'star' ? 'J2000' : 'Cosmológica';
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
    $('#metric-period').textContent = item.kind === 'moon' ? 'Luna' : item.kind === 'star' ? 'Estrella' : item.kind === 'dwarf' ? 'Planeta enano' : ['asteroid','minor'].includes(item.kind) ? 'Cuerpo menor' : 'Planeta';
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
  $('#detail-summary').textContent = (satellite ? describeRecord(item) : entryFor(item).body)+(item.positionKm&&item.velocityKmS?' La línea de esta instantánea es un tramo extrapolado de ±12 horas; no una órbita completa.':'');
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
  const special = [...new Map([...scene.getFocusTargets().filter((item) => normalize(`${item.name} ${item.aliases||''} ${item.id}`).includes(normalized)), ...scene.cosmos.surveys.search(normalized,5),...scene.cosmos.atlas.search(normalized,5)].map(x=>[x.id,x])).values()].slice(0, 5);
  const records = state.records.filter((record) => normalize(`${record.name} ${record.aliases||''}`).includes(normalized)
    || record.id.includes(normalized) || record.internationalId.toUpperCase().includes(normalized)).slice(0, 9 - special.length);
  resultsBox.replaceChildren();
  for (const item of special) {
    resultsBox.appendChild(makeResultButton(item, `${item.kind || item.type} · ${item.noLocation?'solo ficha celeste':'cambiar foco'}`, () => {
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

let targetRegion='earth';
const treeOpen=new Map();
function renderTargetMenu(query = '') {
  const normalized=normalize(query.trim()),container=$('#target-results');
  const all=scene.getFocusTargets(),byId=new Map(all.map(x=>[x.id,x]));
  const activate=item=>{if(item.satrec){if(!scene.selectRecord(item,true)){toast('Vuelve a ahora para usar el catálogo orbital actual.','warning');return;}}else{scene.focusItem(item);showDetail(item);}closeTargetMenu();};
  const leaf=(item,description='')=>{const button=document.createElement('button');button.type='button';button.className='tree-target';
    button.innerHTML=`<span class="target-glyph" style="--target-color:${item.color||'#80dfff'}"></span><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(description|| (item.noLocation?'Ficha sin distancia 3D':item.satrec?'NORAD '+item.id:item.kind||item.type))}</small></span>`;
    button.addEventListener('click',()=>activate(item));return button;};
  const branch=(id,label,items,open=false)=>{const d=document.createElement('details');d.className='target-branch';d.open=treeOpen.get(id)??open;const summary=document.createElement('summary');summary.textContent=label;d.append(summary);const content=document.createElement('div');content.className='target-children';d.append(content);let built=false;
    const build=()=>{if(built)return;built=true;content.append(...items());};if(d.open)build();d.addEventListener('toggle',()=>{treeOpen.set(id,d.open);if(d.open)build();});return d;};
  container.replaceChildren();
  if(normalized){
    const matches=[...new Map([...all.filter(x=>normalize(`${x.name} ${x.aliases||''} ${x.id}`).includes(normalized)).slice(0,50),...scene.cosmos.surveys.search(normalized,20),...scene.cosmos.atlas.search(normalized,20),...state.records.filter(x=>normalize(`${x.name} ${x.aliases||''} ${x.id}`).includes(normalized)).sort((a,b)=>(b.id==='25544')-(a.id==='25544')).slice(0,30)].map(x=>[x.id,x])).values()];
    container.append(...matches.slice(0,70).map(x=>leaf(x)));if(!matches.length)container.textContent='Sin coincidencias. Prueba un nombre o identificador.';return;
  }
  const bodyItems=all.filter(x=>!x.cosmic&&x.radiusKm),focused=scene.focus.id||scene.focus.item?.id;
  const rank=x=>x.orbitKm||x.elements?.a*149597870.7||scene.rawPositions.get(x.id)?.distanceTo(scene.rawPositions.get(x.parent||'sun'))||0;
  const satellites=()=>{
    const groups=new Map();for(const r of state.records.filter(x=>!x.isDebris)){if(!groups.has(r.group))groups.set(r.group,[]);groups.get(r.group).push(r);}
    return [...groups].sort((a,b)=>(a[0]==='station'?-1:b[0]==='station'?1:a[0].localeCompare(b[0]))).map(([id,records])=>branch('sat-'+id,`${GROUP_STYLES[id]?.label||id} · ${records.length.toLocaleString('es-ES')}`,()=>{
      const list=records.sort((a,b)=>(b.id==='25544')-(a.id==='25544')||a.meanAltitude-b.meanAltitude).slice(0,8).map(x=>leaf(x,`${formatDistance(x.meanAltitude)} de altitud`));
      if(records.length>8){const more=document.createElement('button');more.type='button';more.textContent='Buscar en este grupo…';more.onclick=()=>{$('#target-search').value=id==='starlink'?'STARLINK':records[0].name.split(' ')[0];renderTargetMenu($('#target-search').value);$('#target-search').focus();};list.push(more);}return list;
    }));
  };
  const bodyTree=item=>{
    const children=bodyItems.filter(x=>x.parent===item.id).sort((a,b)=>rank(a)-rank(b));
    const missions=all.filter(x=>!x.radiusKm&&!x.cosmic&&!x.component&&!x.noLocation&&(x.parent===item.id||x.body===item.id)).slice(0,30);
    if(!children.length&&!missions.length&&item.id!=='earth')return leaf(item);
    return branch('body-'+item.id,item.name,()=>[leaf(item,'Centrar vista'),...children.map(bodyTree),...(item.id==='earth'?[branch('earth-satellites','Satélites artificiales',satellites,focused==='earth')]:[]),...(missions.length?[branch('missions-'+item.id,'Misiones y superficie · '+missions.length,()=>missions.map(x=>leaf(x)))]:[])],item.id==='sun'&&['earth','solar'].includes(targetRegion)||item.id===focused);
  };
  const sol=byId.get('sun');
  if(['earth','solar'].includes(targetRegion)){
    const iss=state.records.find(x=>x.id==='25544');if(iss)container.append(leaf(iss,'Estación espacial · seguimiento y cámaras'));
    if(sol)container.append(bodyTree(sol));
    const others=all.filter(x=>!x.radiusKm&&!x.cosmic&&!x.body&&!x.parent);
    container.append(branch('deep-missions','Sondas y puntos de Lagrange',()=>others.map(x=>leaf(x))));
    container.append(branch('solar-regions','Regiones del sistema solar',()=>all.filter(x=>x.solarRegion).map(x=>leaf(x))));
  }else if(targetRegion==='nearby'){
    const center=scene.focus.item?.position||[0,0,0];
    const stars=nearestTargets([...scene.cosmos.stars,...(sol?[{...sol,position:[0,0,0]}]:[])],center,40);
    const title=document.createElement('p');title.className='catalog-note';title.textContent='Distancias desde '+(scene.focus.item?.cosmic?scene.focus.item.name:'el Sol');container.append(title);
    for(const {item,d} of stars)container.append(item.id==='sun'?bodyTree(sol):leaf(item,formatDistance(d)));
    container.append(branch('nearby-nebulae','Nebulosas y cúmulos cercanos al foco',()=>nearestTargets([...scene.cosmos.atlas.targets.filter(x=>['nebula','stellar-cluster'].includes(x.kind)),...scene.cosmos.atlas.nebulaLocated||[]],center,24).map(({item,d})=>leaf(item,formatDistance(d)))));
  }else{
    if(sol)container.append(branch('return-solar','Sistema solar',()=>[bodyTree(sol)]));
    const center=scene.focus.item?.position||[0,0,0];
    for(const [id,label,accept] of [['galaxies','Galaxias',x=>x.kind==='galaxy'],['structures','Grandes estructuras',x=>['cluster','structure','universe','cmb'].includes(x.kind)]])container.append(branch('cosmic-'+id,label,()=>nearestTargets(all.filter(accept),center,35).map(({item,d})=>leaf(item,formatDistance(d))),id==='galaxies'&&targetRegion!=='horizon'||id==='structures'&&targetRegion==='horizon'));
  }
}
function syncNavigationContext(status){
 const region=navigationRegion(status.distanceKm,status.focus);
 if(region===targetRegion)return;
 targetRegion=region;treeOpen.clear();
 for(const d of $$('.layer-group'))d.open=d.id==='layer-group-'+region;
 if(!$('#target-menu').hidden)renderTargetMenu($('#target-search').value);
}

function closeTargetMenu() {
  $('#target-menu').hidden = true;
  $('#focus-picker').setAttribute('aria-expanded', 'false');
}

function updateFocusUI(item) {
  updateAtlasCredit(item);
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
  photoCredit.hidden=!$('#atlas-credit').hidden || !(photos.sky.visible||photos.andromeda.visible||scene.cosmos.cmb.node.visible);
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
  syncNavigationContext(status);
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
  if(['all','stars'].includes(state.libraryCategory))candidates.push(...(query?scene.cosmos.atlas.search(query,120):scene.cosmos.atlas.nebulaItems.slice(0,80)).map(entryFor));
  if(query && ['all','galaxies'].includes(state.libraryCategory)) candidates.push(...scene.cosmos.surveys.search(query,60).map(entryFor),...scene.cosmos.atlas.search(query,60).map(entryFor));
  if (state.libraryCategory === 'stars' || (query && state.libraryCategory === 'all')) {
    const stars = scene.cosmos.stars.filter(item=>!query || normalize(`${item.name} ${item.id} ${item.aliases||''}`).includes(query));
    candidates.push(...stars.slice(0,120).map(entryFor));
  }
  if(query && ['all','constellation','navigation','science','weather','station'].includes(state.libraryCategory)) candidates.push(...state.records.filter(item=>normalize(`${item.name} ${item.id} ${item.aliases||''}`).includes(query)).slice(0,60).map(item=>findLibraryEntry(item)));
  const filter=$('#library-filter').value;
  const entries = [...new Map(candidates.map(e=>[e.id,e])).values()].filter(entry=>filter==='all'||(filter==='images'&&mediaFor(entry).length)||(filter==='located'&&!entry.noLocation)||(filter==='guides'&&entry.category==='methods')).filter((entry) => (state.libraryCategory === 'all' || entry.category === state.libraryCategory)
    && (!query || normalize(`${entry.id} ${escapeHTML(entry.title)} ${escapeHTML(entry.subtitle)} ${entry.short}`).includes(query)));
  state.libraryEntries=entries;
  $('#library-result-count').textContent = `${entries.length} coincidencias · se muestran hasta 120. Nebulosas: ${scene.cosmos.atlas.nebulaItems.length.toLocaleString('es-ES')} registros consultables; busca por nombre o catálogo.`;
  $('#library-grid').replaceChildren(...entries.slice(0,120).map((entry,index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'library-card';
    button.classList.toggle('active', state.librarySelected?.id === entry.id);
    button.style.setProperty('--entry-accent', entry.accent);
    button.innerHTML = `<span class="entry-index">${String(index+1).padStart(2,'0')}</span><span><small class="entry-kind">${evidenceFor(entry)}</small><strong>${escapeHTML(entry.title)}</strong><small>${escapeHTML(entry.subtitle)}</small></span>`;
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
  const figures=media.map((m,i)=>`<figure ${i?'hidden':''} data-figure="${i}"><img src="${escapeHTML(m.file.startsWith('https://')?m.file:import.meta.env.BASE_URL+m.file)}" alt="${escapeHTML(m.caption)}" loading="lazy"><figcaption>${escapeHTML(m.caption)}<small>${m.url?`<a href="${escapeHTML(m.url)}" target="_blank" rel="noreferrer">${escapeHTML(m.credit)} ↗</a>`:escapeHTML(m.credit)}</small></figcaption></figure>`).join('');
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

mountAtlasControls();
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

function updateAtlasCredit(item=scene.focus.item){
 const e=$('#atlas-credit');if(!e)return;
 const atlas=scene.cosmos.atlas,sky=atlas.wavelength==='microwave'?{title:'WMAP · microondas',credit:'NASA / WMAP Science Team'}:atlasImages.maps.find(x=>x.id===atlas.wavelength),neb=atlasImages.nebulae.find(x=>x.id===item?.id);
 const near=scene.camera.position.clone().add(scene.focusOrigin).length()<LY_KM;
 const message=sky&&near?`${sky.title} · ${sky.credit}. Mapa angular observado desde el entorno solar; colores de visualización.`:neb?`${neb.credit} · CC BY 4.0 · Fotografía plana observada.`:item?.id==='abell2744-mass'?'Masa total proyectada: CATS / Jauzac et al. / HFF. Imágenes: NASA/ESA Hubble; STScI; DSS2; Chandra/CXC; CDS HiPS2FITS. Emisión X incluye plasma, fuentes puntuales y fondo.':item?.atlasLayer?`${item.source} · ${item.evidence||'Referencia'} · ${item.name}`:'';
 const detail=item?.catalogNebula?` · Imagen DSS2 / STScI / Caltech / UK Schmidt / CDS: ${atlas.nebulaImagePending.has(item.id)?'cargando…':atlas.nebulaImageErrors.has(item.id)?'no disponible; vuelve a localizar para reintentar':'campo óptico plano, perspectiva terrestre'}`:item?.id==='carina'?' · Imagen DSS2 / STScI / Caltech / UK Schmidt / CDS. Fotografía plana.':'';
 e.textContent=message+detail;e.hidden=!(message+detail);
}
function syncAtlasControls(){
 const atlas=scene.cosmos.atlas;
 for(const spec of ATLAS_LAYERS){
  const input=$(`#atlas-${spec.id}`);if(input)input.checked=atlas.enabled[spec.id];
  const status=$(`#atlas-status-${spec.id}`);if(status)status.textContent=({pending:'Se carga a su escala',loading:'Cargando…',ready:spec.id==='desi'?`${atlas.countDesi||0} galaxias`:'Disponible',error:'No disponible · pulsa Ir para reintentar'})[atlas.states[spec.id]];
  if(status&&spec.id==='nebulae'&&atlas.nebulaItems.length&&atlas.states.nebulae!=='error')status.textContent=`${atlas.nebulaItems.length.toLocaleString('es-ES')} fichas · ${atlas.nebulaLocated.length.toLocaleString('es-ES')} confirmadas en 3D · imágenes al localizar`;
 }
 const band=atlasImages.maps.find(x=>x.id===atlas.wavelength);
 $('#atlas-sky-status').textContent=atlas.wavelength==='optical'?'Fotografía ESO en la vecindad solar.':atlas.skyState==='loading'?'Cargando mapa observado…':atlas.skyState==='error'?'No se pudo cargar el mapa. Selecciona la banda para reintentar.':`${band?.title||'WMAP'} · mapa angular galáctico. Se oculta al abandonar la vecindad solar.`;
 updateAtlasCredit();
}
function mountAtlasControls(){
 const groups={solar:['minor','belts','heliosphere','oort'],nearby:['clusters','bubble','dust','nebulae'],galactic:['fermi','streams'],galaxies:['voids','desi'],lensing:['mass']};
 for(const [group,ids] of Object.entries(groups)){
  const section=document.querySelector(`[data-atlas-group="${group}"]`);
  for(const id of ids){
   const spec=ATLAS_LAYERS.find(x=>x.id===id);
   const row=document.createElement('div');row.className='atlas-layer-row';
   row.innerHTML=`<label><input type="checkbox" id="atlas-${spec.id}" ${scene.cosmos.atlas.enabled[spec.id]?'checked':''}><span>${spec.name}<small id="atlas-status-${spec.id}"></small></span></label><button type="button" class="atlas-go" aria-label="Ir a ${spec.name}">Ir</button>`;
   $('input',row).addEventListener('change',e=>{scene.cosmos.atlas.enabled[spec.id]=e.target.checked;if(e.target.checked)scene.cosmos.atlas.load(spec.id);syncAtlasControls();});
   $('button',row).addEventListener('click',async e=>{
    const button=e.currentTarget;button.disabled=true;
    try{
     scene.cosmos.atlas.enabled[spec.id]=true;await scene.cosmos.atlas.load(spec.id);
     const item=scene.getFocusTargets().find(x=>x.id===spec.focus);
     if(item){scene.focusItem(item);showDetail(item);closeUtilityPanel();}
     if(scene.cosmos.atlas.states[spec.id]==='error')toast('No se ha podido cargar esta capa; puedes reintentar con Ir.','warning');
     if(spec.id==='voids'){scene.cosmos.layers.sdss=true;$('#sdss-toggle').checked=true;scene.cosmos.surveys.loadCatalog('sdss');}
    }finally{button.disabled=false;syncAtlasControls();}
   });section.appendChild(row);
  }

 }
 $('#orbit-intensity').addEventListener('input',e=>{scene.orbitIntensity=Number(e.target.value);$('#orbit-intensity-value').textContent=Math.round(scene.orbitIntensity*100)+'%';scene.updateVisibility();});
 $('#atlas-opacity').addEventListener('input',e=>{scene.cosmos.atlas.opacity=Number(e.target.value);$('#atlas-opacity-value').textContent=Math.round(Number(e.target.value)*100)+'%';});
 $('#atlas-wave').addEventListener('change',e=>{
  if(e.target.value!=='optical')scene.focusBody('earth');
  else{scene.cosmos.layers.sky=true;$('#sky-toggle').checked=true;}
  scene.cosmos.atlas.setWavelength(e.target.value);syncAtlasControls();
 });
 $('#atlas-mass-mode').addEventListener('change',e=>{scene.cosmos.atlas.massMode=e.target.value;scene.cosmos.atlas.enable('mass');});
 $('#atlas-mass-background').addEventListener('change',e=>{scene.cosmos.atlas.massBackground=e.target.value;scene.cosmos.atlas.enable('mass');});
 $('#atlas-mass-mix').addEventListener('input',e=>{scene.cosmos.atlas.massMix=Number(e.target.value);});
 window.addEventListener('atlas-change',()=>{
  encyclopedia=makeEncyclopedia([...scene.getFocusTargets().filter(x=>!x.cosmic||x.kind!=='star'),...explorationEntries]);renderLibrary();syncAtlasControls();
 });
 syncAtlasControls();setInterval(()=>updateAtlasCredit(),1500);
}
