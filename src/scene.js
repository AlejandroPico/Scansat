import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  degreesLat,
  degreesLong,
  eciToEcf,
  eciToGeodetic,
  gstime,
  propagate,
} from './satellite-core.js';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import countriesTopology from 'world-atlas/countries-110m.json';
import {
  DEEP_SPACE_MARKERS,
  EARTH_RADIUS_KM,
  LIBRARY_ENTRIES,
  LUNAR_OBJECTS,
  ORBIT_STYLES,
  SOLAR_BODIES,
} from './catalog.js';

const BASE_URL = import.meta.env.BASE_URL;
const DEG = 180 / Math.PI;

function seededRandom(seed) {
  const value = Math.sin(seed * 999.91) * 43758.5453;
  return value - Math.floor(value);
}

function compressedRadius(altitudeKm) {
  const altitude = Math.max(0, altitudeKm);
  if (altitude <= 2000) return 1.07 + (altitude / 2000) * 0.4;
  if (altitude <= 30000) return 1.47 + ((altitude - 2000) / 28000) * 0.63;
  if (altitude <= 50000) return 2.1 + ((altitude - 30000) / 20000) * 0.26;
  return Math.min(3.05, 2.36 + Math.log10(1 + (altitude - 50000) / 1000) * 0.23);
}

function toDisplayPosition(ecf) {
  const distance = Math.hypot(ecf.x, ecf.y, ecf.z);
  if (!Number.isFinite(distance) || distance === 0) return null;
  const radius = compressedRadius(distance - EARTH_RADIUS_KM);
  return new THREE.Vector3(ecf.x / distance, ecf.z / distance, -ecf.y / distance).multiplyScalar(radius);
}

function makePoliticalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  const countries = feature(countriesTopology, countriesTopology.objects.countries);
  const projection = geoEquirectangular().fitExtent([[0, 0], [canvas.width, canvas.height]], { type: 'Sphere' });
  const path = geoPath(projection, context);

  context.fillStyle = '#07151c';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.beginPath();
  path(countries);
  context.fillStyle = '#17333b';
  context.fill();
  context.strokeStyle = '#5ab8c7';
  context.lineWidth = 0.75;
  context.globalAlpha = 0.78;
  context.stroke();

  context.globalAlpha = 0.12;
  context.strokeStyle = '#b7eff7';
  context.lineWidth = 1;
  for (let lon = -150; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * canvas.width;
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * canvas.height;
    context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
  }
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeGlowMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { glowColor: { value: new THREE.Color('#39bcec') } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float intensity = pow(0.64 - dot(vNormal, viewDirection), 2.7);
        gl_FragColor = vec4(glowColor, intensity * 0.58);
      }
    `,
  });
}

function makeCircleLine(radius, color, opacity = 0.2, segments = 160) {
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
}

export class OrbitalScene {
  constructor(container, { onSelect, onFrame } = {}) {
    this.container = container;
    this.onSelect = onSelect;
    this.onFrame = onFrame;
    this.mode = 'earth';
    this.layer = 'satellite';
    this.running = true;
    this.autoRotate = true;
    this.records = [];
    this.visibleRecords = [];
    this.selected = null;
    this.following = false;
    this.showOrbit = true;
    this.showCoverage = false;
    this.lastPropagation = 0;
    this.interactiveMeshes = [];
    this.pointerStart = null;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#030609');
    this.scene.fog = new THREE.FogExp2('#030609', 0.018);

    this.camera = new THREE.PerspectiveCamera(44, 1, 0.01, 120);
    this.camera.position.set(0, 0.25, 5.65);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute('aria-label', 'Globo tridimensional interactivo');
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.minDistance = 1.65;
    this.controls.maxDistance = 30;
    this.controls.rotateSpeed = 0.45;
    this.controls.zoomSpeed = 0.8;
    this.controls.autoRotateSpeed = 0.22;

    this.clock = new THREE.Clock();
    this.simulationDate = new Date();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 0.045;
    this.pointer = new THREE.Vector2();

    this.createLights();
    this.createStars();
    this.createEarthView();
    this.createMoonView();
    this.createSolarView();
    this.bindEvents();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.animate();
  }

  createLights() {
    this.ambientLight = new THREE.AmbientLight('#6c88a0', 1.15);
    this.sunLight = new THREE.DirectionalLight('#fff0d0', 4.2);
    this.sunLight.position.set(5, 2.5, 4);
    this.scene.add(this.ambientLight, this.sunLight);
  }

  createStars() {
    const count = 2800;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const radius = 30 + seededRandom(index + 2) * 55;
      const theta = seededRandom(index + 10) * Math.PI * 2;
      const phi = Math.acos(2 * seededRandom(index + 22) - 1);
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.cos(phi);
      positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      const brightness = 0.45 + seededRandom(index + 100) * 0.55;
      colors.set([brightness * 0.8, brightness * 0.9, brightness], index * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.stars = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.8, sizeAttenuation: true, depthWrite: false }));
    this.scene.add(this.stars);
  }

  createEarthView() {
    this.earthView = new THREE.Group();
    this.scene.add(this.earthView);
    const loader = new THREE.TextureLoader();
    this.earthTextures = {
      satellite: loader.load(`${BASE_URL}textures/earth-day.jpg`),
      political: makePoliticalTexture(),
      night: loader.load(`${BASE_URL}textures/earth-night.png`),
    };
    Object.values(this.earthTextures).forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    });

    this.earthMaterial = new THREE.MeshStandardMaterial({
      map: this.earthTextures.satellite,
      roughness: 0.82,
      metalness: 0.03,
    });
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), this.earthMaterial);
    this.earth.rotation.y = -Math.PI / 2;
    this.earthView.add(this.earth);

    this.atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.075, 96, 64), makeGlowMaterial());
    this.earthView.add(this.atmosphere);

    this.equator = makeCircleLine(1.012, '#72bed0', 0.16, 220);
    this.earthView.add(this.equator);

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    pointGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(0), 3));
    this.satellitePoints = new THREE.Points(pointGeometry, new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.94,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.satellitePoints.renderOrder = 4;
    this.earthView.add(this.satellitePoints);
  }

  createMoonView() {
    this.moonView = new THREE.Group();
    this.moonView.visible = false;
    this.scene.add(this.moonView);

    const moonTexture = new THREE.TextureLoader().load(`${BASE_URL}textures/moon.jpg`);
    moonTexture.colorSpace = THREE.SRGBColorSpace;
    const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ map: moonTexture, roughness: 1 }));
    moon.rotation.y = -1.2;
    this.moonView.add(moon);

    const earthMini = new THREE.Mesh(new THREE.SphereGeometry(0.27, 48, 32), new THREE.MeshStandardMaterial({ map: this.earthTextures.satellite, roughness: 0.85 }));
    earthMini.position.set(2.65, 0.4, -1.2);
    earthMini.userData.item = { kind: 'body', name: 'Tierra', id: 'earth', summary: 'La Tierra vista desde el entorno lunar. La distancia se ha comprimido para mantener ambos cuerpos legibles.' };
    this.moonView.add(earthMini);
    this.interactiveMeshes.push(earthMini);

    this.lunarMarkers = LUNAR_OBJECTS.map((item, index) => {
      const orbitRadius = 1.22 + index * 0.17;
      const orbit = makeCircleLine(orbitRadius, item.color, 0.2, 120);
      orbit.rotation.x = (index - 1.5) * 0.17;
      orbit.rotation.z = index * 0.48;
      this.moonView.add(orbit);
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: item.color }));
      marker.userData = { item: { ...item, kind: 'lunar', summary: `${item.name}, misión lunar de ${item.agency}. Su trayectoria en esta vista es esquemática.` }, orbitRadius, phase: index * 1.7, speed: 0.08 + index * 0.015, tiltX: orbit.rotation.x, tiltZ: orbit.rotation.z };
      this.moonView.add(marker);
      this.interactiveMeshes.push(marker);
      return marker;
    });
  }

  createSolarView() {
    this.solarView = new THREE.Group();
    this.solarView.visible = false;
    this.scene.add(this.solarView);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.43, 64, 48), new THREE.MeshBasicMaterial({ color: '#ffcb63' }));
    sun.userData.item = { kind: 'body', id: 'sun', name: 'Sol', summary: 'Centro del sistema solar y referencia de las trayectorias heliocéntricas mostradas.' };
    this.solarView.add(sun);
    this.interactiveMeshes.push(sun);
    const sunGlow = new THREE.PointLight('#ff9d45', 34, 16, 1.7);
    this.solarView.add(sunGlow);

    this.planetMeshes = SOLAR_BODIES.map((body, index) => {
      const orbit = makeCircleLine(body.distance, '#446072', 0.24, 200);
      this.solarView.add(orbit);
      const material = body.id === 'earth'
        ? new THREE.MeshStandardMaterial({ map: this.earthTextures.satellite, roughness: 0.85 })
        : new THREE.MeshStandardMaterial({ color: body.color, roughness: 0.86 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(body.radius, 32, 20), material);
      mesh.userData.item = { ...body, kind: 'planet', summary: `${body.name}, cuerpo del sistema solar. Radios y distancias se muestran con escalas visuales independientes.` };
      mesh.userData.phase = index * 0.67 + 0.4;
      this.solarView.add(mesh);
      this.interactiveMeshes.push(mesh);
      if (body.id === 'saturn') {
        const ring = new THREE.Mesh(new THREE.RingGeometry(body.radius * 1.35, body.radius * 2.05, 48), new THREE.MeshBasicMaterial({ color: '#ad9c74', side: THREE.DoubleSide, transparent: true, opacity: 0.65 }));
        ring.rotation.x = Math.PI / 2.4;
        mesh.add(ring);
      }
      return mesh;
    });

    this.deepMarkers = DEEP_SPACE_MARKERS.map((item) => {
      const group = new THREE.Group();
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), new THREE.MeshBasicMaterial({ color: item.color }));
      marker.userData.item = {
        ...item,
        kind: 'deep-space',
        summary: LIBRARY_ENTRIES.find((entry) => entry.id === item.id)?.short || 'Misión de espacio profundo.',
      };
      group.add(marker);
      const tailGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.25, 0, 0)]);
      group.add(new THREE.Line(tailGeometry, new THREE.LineBasicMaterial({ color: item.color, transparent: true, opacity: 0.45 })));
      group.position.set(Math.cos(item.angle) * item.distance, 0.05 * Math.sin(item.angle * 2), Math.sin(item.angle) * item.distance);
      group.rotation.y = -item.angle;
      this.solarView.add(group);
      this.interactiveMeshes.push(marker);
      return group;
    });
  }

  bindEvents() {
    this.renderer.domElement.addEventListener('pointerdown', (event) => {
      this.pointerStart = { x: event.clientX, y: event.clientY };
    });
    this.renderer.domElement.addEventListener('pointerup', (event) => {
      if (!this.pointerStart || Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 6) return;
      this.pick(event);
    });
    this.renderer.domElement.addEventListener('pointermove', (event) => this.updateCursor(event));
  }

  updatePointer(event) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  pick(event) {
    this.updatePointer(event);
    if (this.mode === 'earth') {
      const hits = this.raycaster.intersectObject(this.satellitePoints);
      if (hits.length) {
        const record = this.visibleRecords[hits[0].index];
        if (record) this.selectRecord(record);
      }
      return;
    }
    const root = this.mode === 'moon' ? this.moonView : this.solarView;
    const candidates = this.interactiveMeshes.filter((mesh) => root.getObjectById(mesh.id));
    const hit = this.raycaster.intersectObjects(candidates, false)[0];
    if (hit?.object.userData.item) this.onSelect?.(hit.object.userData.item);
  }

  updateCursor(event) {
    this.updatePointer(event);
    let interactive = false;
    if (this.mode === 'earth') interactive = this.raycaster.intersectObject(this.satellitePoints).length > 0;
    else {
      const root = this.mode === 'moon' ? this.moonView : this.solarView;
      const candidates = this.interactiveMeshes.filter((mesh) => root.getObjectById(mesh.id));
      interactive = this.raycaster.intersectObjects(candidates, false).length > 0;
    }
    this.renderer.domElement.style.cursor = interactive ? 'pointer' : 'grab';
  }

  setCatalog(records) {
    this.records = records;
    this.setFilters({ orbits: new Set(['LEO', 'MEO', 'GEO', 'HEO']), groups: null });
  }

  setFilters({ orbits, groups }) {
    if (!this.records.length) return;
    this.visibleRecords = this.records.filter((record) => orbits.has(record.orbit) && (!groups || groups.has(record.group)));
    const positions = new Float32Array(this.visibleRecords.length * 3);
    const colors = new Float32Array(this.visibleRecords.length * 3);
    this.visibleRecords.forEach((record, index) => {
      const color = new THREE.Color(ORBIT_STYLES[record.orbit].color);
      colors.set([color.r, color.g, color.b], index * 3);
    });
    this.satellitePoints.geometry.dispose();
    this.satellitePoints.geometry = new THREE.BufferGeometry();
    this.satellitePoints.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.satellitePoints.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.updateSatellitePositions(true);
  }

  updateSatellitePositions(force = false) {
    if (!this.visibleRecords.length || (!force && performance.now() - this.lastPropagation < 2500)) return;
    const date = this.simulationDate;
    const gmst = gstime(date);
    const positions = this.satellitePoints.geometry.attributes.position;
    this.visibleRecords.forEach((record, index) => {
      try {
        const result = propagate(record.satrec, date);
        if (!result?.position || typeof result.position === 'boolean') throw new Error('Sin posición');
        const ecf = eciToEcf(result.position, gmst);
        const display = toDisplayPosition(ecf);
        if (!display) throw new Error('Coordenadas no válidas');
        positions.setXYZ(index, display.x, display.y, display.z);
        const geodetic = eciToGeodetic(result.position, gmst);
        record.position = {
          display,
          latitude: degreesLat(geodetic.latitude),
          longitude: degreesLong(geodetic.longitude),
          altitude: geodetic.height,
          speed: result.velocity && typeof result.velocity !== 'boolean' ? Math.hypot(result.velocity.x, result.velocity.y, result.velocity.z) : null,
        };
      } catch {
        positions.setXYZ(index, 0, 0, 0);
      }
    });
    positions.needsUpdate = true;
    this.satellitePoints.geometry.computeBoundingSphere();
    this.lastPropagation = performance.now();
    if (this.selected?.satrec) {
      this.drawSelectionGeometry();
      this.onFrame?.(this.selected);
    }
  }

  selectRecord(record, focus = false) {
    this.selected = record;
    this.drawSelectionGeometry();
    this.onSelect?.(record);
    if (focus) this.focusSelected();
  }

  selectByName(query, focus = true) {
    const normalized = query.trim().toUpperCase();
    const record = this.records.find((item) => item.name.toUpperCase() === normalized)
      || this.records.find((item) => item.name.toUpperCase().includes(normalized));
    if (!record) return false;
    this.setMode('earth');
    this.selectRecord(record, focus);
    return true;
  }

  drawSelectionGeometry() {
    if (!this.selected?.satrec || !this.selected.position) return;
    this.orbitLine?.removeFromParent();
    this.orbitLine?.geometry.dispose();
    this.coverageLine?.removeFromParent();
    this.coverageLine?.geometry.dispose();

    const points = [];
    const period = Math.min(1440, Math.max(75, this.selected.periodMinutes));
    const start = this.simulationDate.getTime() - period * 30000;
    for (let index = 0; index <= 220; index += 1) {
      const date = new Date(start + (index / 220) * period * 60000);
      const result = propagate(this.selected.satrec, date);
      if (!result?.position || typeof result.position === 'boolean') continue;
      const display = toDisplayPosition(eciToEcf(result.position, gstime(date)));
      if (display) points.push(display);
    }
    this.orbitLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: ORBIT_STYLES[this.selected.orbit].color, transparent: true, opacity: 0.72, depthWrite: false }),
    );
    this.orbitLine.visible = this.showOrbit;
    this.earthView.add(this.orbitLine);

    const center = this.selected.position.display.clone().normalize();
    const tangentA = new THREE.Vector3(0, 1, 0).cross(center).normalize();
    if (tangentA.lengthSq() < 0.1) tangentA.set(1, 0, 0);
    const tangentB = center.clone().cross(tangentA).normalize();
    const earthCentralAngle = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + Math.max(1, this.selected.position.altitude)));
    const footprint = [];
    for (let index = 0; index <= 120; index += 1) {
      const angle = (index / 120) * Math.PI * 2;
      footprint.push(center.clone().multiplyScalar(Math.cos(earthCentralAngle))
        .add(tangentA.clone().multiplyScalar(Math.sin(earthCentralAngle) * Math.cos(angle)))
        .add(tangentB.clone().multiplyScalar(Math.sin(earthCentralAngle) * Math.sin(angle)))
        .normalize().multiplyScalar(1.009));
    }
    this.coverageLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(footprint),
      new THREE.LineBasicMaterial({ color: '#f3e5ab', transparent: true, opacity: 0.8, depthWrite: false }),
    );
    this.coverageLine.visible = this.showCoverage;
    this.earthView.add(this.coverageLine);
  }

  setSelectionLayers({ orbit, coverage }) {
    this.showOrbit = orbit;
    this.showCoverage = coverage;
    if (this.orbitLine) this.orbitLine.visible = orbit;
    if (this.coverageLine) this.coverageLine.visible = coverage;
  }

  setAtmosphere(visible) {
    this.atmosphere.visible = visible;
  }

  setLayer(layer) {
    this.layer = layer;
    this.earthMaterial.map = this.earthTextures[layer] || this.earthTextures.satellite;
    this.earthMaterial.color.set(layer === 'night' ? '#8da7b7' : '#ffffff');
    this.earthMaterial.emissive.set(layer === 'night' ? '#273d50' : '#000000');
    this.earthMaterial.emissiveMap = layer === 'night' ? this.earthTextures.night : null;
    this.earthMaterial.emissiveIntensity = layer === 'night' ? 0.65 : 0;
    this.earthMaterial.needsUpdate = true;
  }

  setMode(mode) {
    this.mode = mode;
    this.earthView.visible = mode === 'earth';
    this.moonView.visible = mode === 'moon';
    this.solarView.visible = mode === 'solar';
    this.selected = null;
    this.following = false;
    this.orbitLine?.removeFromParent();
    this.coverageLine?.removeFromParent();
    this.resetCamera();
  }

  setRunning(running) {
    this.running = running;
  }

  setAutoRotate(enabled) {
    this.autoRotate = enabled;
  }

  focusSelected() {
    if (!this.selected?.position) return;
    const direction = this.selected.position.display.clone().normalize();
    const targetPosition = direction.multiplyScalar(Math.max(1.8, this.selected.position.display.length() + 0.72));
    this.cameraTween = {
      from: this.camera.position.clone(),
      to: targetPosition,
      start: performance.now(),
      duration: 850,
    };
    this.following = true;
  }

  resetCamera() {
    const target = this.mode === 'solar' ? new THREE.Vector3(0, 10, 17) : new THREE.Vector3(0, 0.25, 5.65);
    this.cameraTween = { from: this.camera.position.clone(), to: target, start: performance.now(), duration: 700 };
    this.controls.target.set(0, 0, 0);
    this.following = false;
  }

  updateSolarBodies(time) {
    const days = time / 86400000;
    this.planetMeshes.forEach((mesh) => {
      const { distance, period } = mesh.userData.item;
      const angle = mesh.userData.phase + (days / period) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
      mesh.rotation.y += 0.002;
    });
  }

  updateLunarBodies(elapsed) {
    this.lunarMarkers.forEach((marker) => {
      const { orbitRadius, phase, speed, tiltX, tiltZ } = marker.userData;
      const angle = phase + elapsed * speed;
      marker.position.set(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius);
      marker.position.applyEuler(new THREE.Euler(tiltX, 0, tiltZ));
    });
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    const delta = Math.min(0.05, this.clock.getDelta());
    if (this.running) this.simulationDate = new Date(this.simulationDate.getTime() + delta * 1000);
    if (this.mode === 'earth' && this.running) this.updateSatellitePositions();
    if (this.mode === 'solar' && this.running) this.updateSolarBodies(this.simulationDate.getTime());
    if (this.mode === 'moon' && this.running) this.updateLunarBodies(this.clock.elapsedTime);

    if (this.cameraTween) {
      const progress = Math.min(1, (performance.now() - this.cameraTween.start) / this.cameraTween.duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.camera.position.lerpVectors(this.cameraTween.from, this.cameraTween.to, eased);
      if (progress >= 1) this.cameraTween = null;
    }

    this.controls.autoRotate = this.autoRotate && !this.following && this.mode !== 'solar';
    this.controls.update();
    this.stars.rotation.y += delta * 0.0015;
    this.renderer.render(this.scene, this.camera);
  };
}
