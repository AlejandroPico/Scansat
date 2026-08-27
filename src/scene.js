import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { degreesLat, degreesLong, eciToGeodetic, gstime, propagate } from './satellite-core.js';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import countriesTopology from 'world-atlas/countries-110m.json';
import { EARTH_RADIUS_KM, GROUP_STYLES, ORBIT_STYLES } from './catalog.js';
import {
  AU_KM,
  CELESTIAL_BODIES,
  FALLBACK_SPACECRAFT,
  LAGRANGE_OBJECTS,
  LOCAL_ORBITERS,
  SURFACE_SITES,
  circularOrbitPosition,
  julianDate,
  lagrangePosition,
  planetOrbitAu,
  planetPositionAu,
} from './solar-data.js';

const BASE_URL = import.meta.env.BASE_URL;
const OBLIQUITY = THREE.MathUtils.degToRad(23.43928);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const PLANET_IDS = new Set(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);

function seededRandom(seed) {
  const value = Math.sin(seed * 999.91) * 43_758.5453;
  return value - Math.floor(value);
}

function eclipticToScene(vector, scale = 1) {
  return new THREE.Vector3(vector.x * scale, vector.z * scale, -vector.y * scale);
}

function equatorialToScene(vector) {
  return new THREE.Vector3(vector.x, vector.z, -vector.y).applyAxisAngle(X_AXIS, -OBLIQUITY);
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
  context.fillStyle = '#193a43';
  context.fill();
  context.strokeStyle = '#7bd5df';
  context.lineWidth = 0.72;
  context.globalAlpha = 0.75;
  context.stroke();
  context.globalAlpha = 0.16;
  for (let lon = -150; lon <= 180; lon += 30) {
    const x = (lon + 180) / 360 * canvas.width;
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = (90 - lat) / 180 * canvas.height;
    context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
  }
  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeDotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.32, 'rgba(255,255,255,.98)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,.28)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function makeIconTexture(kind, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  context.translate(48, 48);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 4;
  context.shadowColor = color;
  context.shadowBlur = 10;
  if (kind === 'lagrange') {
    context.beginPath(); context.arc(0, 0, 24, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.moveTo(-32, 0); context.lineTo(32, 0); context.moveTo(0, -32); context.lineTo(0, 32); context.stroke();
  } else if (kind === 'rover') {
    context.strokeRect(-22, -11, 44, 20);
    context.beginPath(); context.moveTo(0, -11); context.lineTo(9, -26); context.lineTo(17, -26); context.stroke();
    for (const x of [-16, 0, 16]) { context.beginPath(); context.arc(x, 14, 6, 0, Math.PI * 2); context.fill(); }
  } else if (kind === 'landing') {
    context.beginPath(); context.moveTo(0, -26); context.lineTo(22, 18); context.lineTo(-22, 18); context.closePath(); context.stroke();
    context.beginPath(); context.moveTo(-30, 27); context.lineTo(30, 27); context.stroke();
  } else if (kind === 'body') {
    context.beginPath(); context.arc(0, 0, 15, 0, Math.PI * 2); context.fill();
    context.globalAlpha = 0.58; context.beginPath(); context.arc(0, 0, 31, 0, Math.PI * 2); context.stroke();
  } else {
    context.rotate(Math.PI / 4);
    context.strokeRect(-14, -14, 28, 28);
    context.fillRect(-8, -8, 16, 16);
    context.beginPath(); context.moveTo(-38, -12); context.lineTo(-18, -12); context.lineTo(-18, 12); context.lineTo(-38, 12); context.closePath(); context.stroke();
    context.beginPath(); context.moveTo(18, -12); context.lineTo(38, -12); context.lineTo(38, 12); context.lineTo(18, 12); context.closePath(); context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSprite(item, kind = 'spacecraft') {
  const material = new THREE.SpriteMaterial({
    map: makeIconTexture(kind, item.color || '#8fdcff'),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    sizeAttenuation: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(kind === 'body' ? 0.024 : 0.03);
  sprite.renderOrder = 20;
  sprite.userData.item = item;
  return sprite;
}

function makeAtmosphereMaterial(color = '#50c8ff') {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: { glowColor: { value: new THREE.Color(color) } },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vWorld;
      void main() {
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      void main() {
        vec3 viewDirection = normalize(cameraPosition - vWorld);
        float rim = pow(max(0.0, 0.72 - dot(vNormalW, viewDirection)), 3.2);
        gl_FragColor = vec4(glowColor, rim * 0.66);
      }
    `,
  });
}

function makeEarthMaterial(dayMap, nightMap) {
  return new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: dayMap },
      nightMap: { value: nightMap },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      allNight: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUvMap;
      varying vec3 vNormalW;
      void main() {
        vUvMap = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform vec3 sunDirection;
      uniform float allNight;
      varying vec2 vUvMap;
      varying vec3 vNormalW;
      void main() {
        vec3 dayColor = texture2D(dayMap, vUvMap).rgb;
        vec3 nightColor = texture2D(nightMap, vUvMap).rgb * 1.55;
        float directLight = dot(normalize(vNormalW), normalize(sunDirection));
        float terminator = smoothstep(-0.13, 0.17, directLight);
        vec3 litDay = dayColor * (0.25 + max(0.0, directLight) * 0.95);
        vec3 color = mix(nightColor, litDay, max(terminator, allNight));
        if (allNight > 0.5) color = nightColor * 1.3;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

function makeSunMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUvMap; void main(){vUvMap=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      uniform float time; varying vec2 vUvMap;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 p=vUvMap*vec2(18.0,9.0); float n=hash(floor(p))+hash(floor(p*2.3))*.35;
        float bands=.08*sin(vUvMap.y*120.0+time*.08);
        vec3 color=mix(vec3(1.0,.34,.045),vec3(1.0,.88,.35),clamp(n*.65+.4+bands,0.0,1.0));
        gl_FragColor=vec4(color,1.0);
      }`,
  });
}

function makeOrbitLine(points, color = '#6f8896', opacity = 0.22) {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false }),
  );
}

function surfacePosition(site, radiusKm) {
  const lat = THREE.MathUtils.degToRad(site.lat);
  const lon = THREE.MathUtils.degToRad(site.lon);
  const r = radiusKm * 1.008;
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon) * r,
    Math.sin(lat) * r,
    -Math.cos(lat) * Math.sin(lon) * r,
  );
}

export class OrbitalScene {
  constructor(container, { onSelect, onFrame, onFocus } = {}) {
    this.container = container;
    this.onSelect = onSelect;
    this.onFrame = onFrame;
    this.onFocus = onFocus;
    this.simulationDate = new Date();
    this.running = true;
    this.records = [];
    this.visibleRecords = [];
    this.activeVisible = [];
    this.debrisVisible = [];
    this.spacecraft = [];
    this.selected = null;
    this.focus = { type: 'body', id: 'earth' };
    this.layer = 'satellite';
    this.showAtmosphere = true;
    this.showOrbit = true;
    this.showCoverage = false;
    this.showDebris = true;
    this.showSurface = true;
    this.showMissions = true;
    this.lastPropagation = 0;
    this.lastPositionUpdate = 0;
    this.pointerStart = null;
    this.rawPositions = new Map();
    this.bodyNodes = new Map();
    this.interactive = [];
    this.labels = [];

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#020406');
    this.camera = new THREE.PerspectiveCamera(44, 1, 1, 1e12);
    this.camera.position.set(0, 22_000, 88_000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.setAttribute('aria-label', 'Sistema solar tridimensional interactivo a escala física');
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.minDistance = EARTH_RADIUS_KM * 1.012;
    this.controls.maxDistance = 5e10;
    this.controls.zoomSpeed = 2.2;
    this.controls.rotateSpeed = 0.42;
    this.controls.panSpeed = 0.5;
    this.controls.enablePan = false;
    this.controls.autoRotate = false;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.clock = new THREE.Clock();
    this.textureLoader = new THREE.TextureLoader();
    this.dotTexture = makeDotTexture();
    this.politicalTexture = makePoliticalTexture();
    this.planetOrbitRoot = new THREE.Group();
    this.scene.add(this.planetOrbitRoot);
    this.moonOrbitNodes = [];
    this.specialNodes = [];
    this.spacecraftNodes = [];
    this.localOrbiterNodes = [];

    this.createLights();
    this.createStars();
    this.createBodies();
    this.createPlanetOrbits();
    this.createCatalogPoints();
    this.createLagrangeObjects();
    this.createLocalOrbiters();
    this.createSurfaceSites();
    this.setSpacecraft([]);
    this.bindEvents();
    this.updateWorld(this.simulationDate, true);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.animate();
  }

  createLights() {
    this.ambientLight = new THREE.AmbientLight('#283744', 0.42);
    this.sunLight = new THREE.DirectionalLight('#fff1d2', 3.3);
    this.sunLight.position.set(1e8, 0, 0);
    this.sunLight.target.position.set(0, 0, 0);
    this.scene.add(this.ambientLight, this.sunLight, this.sunLight.target);
  }

  createStars() {
    const count = 4_500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const radius = 4e10;
      const theta = seededRandom(index + 10) * Math.PI * 2;
      const phi = Math.acos(2 * seededRandom(index + 22) - 1);
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.cos(phi);
      positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      const brightness = 0.45 + seededRandom(index + 100) * 0.55;
      colors.set([brightness * 0.82, brightness * 0.9, brightness], index * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.stars = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: 1.25, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false,
    }));
    this.scene.add(this.stars);
  }

  loadTexture(name) {
    if (!name) return null;
    const texture = this.textureLoader.load(`${BASE_URL}textures/${name}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  createBodies() {
    const loader = new GLTFLoader();
    for (const definition of CELESTIAL_BODIES) {
      const root = new THREE.Group();
      const axialTilt = new THREE.Group();
      const spin = new THREE.Group();
      root.add(axialTilt);
      axialTilt.add(spin);
      if (definition.id === 'earth') axialTilt.rotation.x = -OBLIQUITY;

      let material;
      if (definition.id === 'sun') material = makeSunMaterial();
      else if (definition.id === 'earth') {
        this.earthTextures = {
          satellite: this.loadTexture('earth-day.jpg'),
          political: this.politicalTexture,
          night: this.loadTexture('earth-night.png'),
        };
        material = makeEarthMaterial(this.earthTextures.satellite, this.earthTextures.night);
        this.earthMaterial = material;
      } else {
        const textureName = ['mercury', 'uranus'].includes(definition.id) ? null : definition.texture;
        material = new THREE.MeshStandardMaterial({
          map: this.loadTexture(textureName), color: textureName ? '#ffffff' : definition.color,
          roughness: definition.id === 'venus' ? 0.88 : 0.94, metalness: 0,
        });
      }

      const widthSegments = definition.radiusKm > 3_000 ? 96 : 48;
      const surface = new THREE.Mesh(new THREE.SphereGeometry(definition.radiusKm, widthSegments, Math.round(widthSegments * 0.66)), material);
      surface.userData.item = {
        ...definition,
        kind: definition.type,
        summary: `${definition.name} se representa con su radio físico. Su posición y su órbita comparten la misma escala espacial del resto del sistema.`,
      };
      spin.add(surface);
      this.interactive.push(surface);

      if (definition.id === 'earth') {
        this.earth = surface;
        this.earthSpin = spin;
        const atmosphere = new THREE.Mesh(
          new THREE.SphereGeometry(definition.radiusKm * 1.035, 96, 64),
          makeAtmosphereMaterial(),
        );
        axialTilt.add(atmosphere);
        this.atmosphere = atmosphere;
        const cloudMap = this.loadTexture('earth-clouds.png');
        this.clouds = new THREE.Mesh(
          new THREE.SphereGeometry(definition.radiusKm * 1.006, 96, 64),
          new THREE.MeshStandardMaterial({ map: cloudMap, transparent: true, opacity: 0.28, depthWrite: false, roughness: 1 }),
        );
        spin.add(this.clouds);
      }

      if (definition.rings) {
        const ringCanvas = document.createElement('canvas');
        ringCanvas.width = 1024; ringCanvas.height = 64;
        const context = ringCanvas.getContext('2d');
        const gradient = context.createLinearGradient(0, 0, 1024, 0);
        gradient.addColorStop(0, 'rgba(164,143,103,0)');
        gradient.addColorStop(0.12, 'rgba(198,181,145,.52)');
        gradient.addColorStop(0.38, 'rgba(120,105,80,.82)');
        gradient.addColorStop(0.48, 'rgba(10,10,10,.12)');
        gradient.addColorStop(0.56, 'rgba(215,200,165,.78)');
        gradient.addColorStop(0.93, 'rgba(164,143,103,.18)');
        gradient.addColorStop(1, 'rgba(164,143,103,0)');
        context.fillStyle = gradient; context.fillRect(0, 0, 1024, 64);
        const ringTexture = new THREE.CanvasTexture(ringCanvas);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(definition.radiusKm * 1.18, definition.radiusKm * 2.32, 180),
          new THREE.MeshBasicMaterial({ map: ringTexture, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.9 }),
        );
        ring.rotation.x = Math.PI / 2;
        axialTilt.rotation.z = THREE.MathUtils.degToRad(26.73);
        axialTilt.add(ring);
      }

      const marker = makeSprite(surface.userData.item, 'body');
      root.add(marker);
      this.interactive.push(marker);
      this.scene.add(root);
      this.bodyNodes.set(definition.id, { definition, root, axialTilt, spin, surface, marker });
      this.addLabel(root, definition.name, definition.type === 'moon' ? 'LUNA' : definition.type === 'star' ? 'ESTRELLA' : 'PLANETA', definition.id);

      if (['mercury', 'uranus'].includes(definition.id)) {
        loader.load(`${BASE_URL}models/${definition.id}.glb`, (gltf) => {
          let sourceMaterial;
          gltf.scene.traverse((child) => { if (!sourceMaterial && child.isMesh && child.material?.map) sourceMaterial = child.material; });
          if (sourceMaterial?.map) {
            sourceMaterial.map.colorSpace = THREE.SRGBColorSpace;
            surface.material.map = sourceMaterial.map;
            surface.material.color.set('#ffffff');
            surface.material.needsUpdate = true;
          }
        });
      }
    }
  }

  createPlanetOrbits() {
    const date = this.simulationDate;
    for (const id of PLANET_IDS) {
      const points = planetOrbitAu(id, date).map((position) => eclipticToScene(position, AU_KM));
      const line = makeOrbitLine(points, id === 'earth' ? '#4b8998' : '#526571', id === 'earth' ? 0.3 : 0.18);
      line.userData.planetId = id;
      this.planetOrbitRoot.add(line);
    }
    for (const definition of CELESTIAL_BODIES.filter((body) => body.type === 'moon')) {
      const points = [];
      for (let index = 0; index <= 128; index += 1) {
        const angle = index / 128 * Math.PI * 2;
        const relative = { x: Math.cos(angle) * definition.orbitKm, y: Math.sin(angle) * definition.orbitKm, z: 0 };
        points.push(eclipticToScene(relative));
      }
      const line = makeOrbitLine(points, '#768893', 0.2);
      line.userData.parent = definition.parent;
      this.scene.add(line);
      this.moonOrbitNodes.push(line);
    }
  }

  createCatalogPoints() {
    const material = (size, opacity) => new THREE.PointsMaterial({
      size, sizeAttenuation: false, map: this.dotTexture, alphaTest: 0.04, transparent: true,
      opacity, vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.activePoints = new THREE.Points(new THREE.BufferGeometry(), material(2.05, 0.96));
    this.debrisPoints = new THREE.Points(new THREE.BufferGeometry(), material(1.25, 0.62));
    this.activePoints.renderOrder = 8;
    this.debrisPoints.renderOrder = 7;
    this.scene.add(this.activePoints, this.debrisPoints);
  }

  createLagrangeObjects() {
    for (const item of LAGRANGE_OBJECTS) {
      const sprite = makeSprite({ ...item, summary: `${item.name} es un punto de equilibrio gravitatorio del sistema Sol–Tierra.` }, 'lagrange');
      this.scene.add(sprite);
      this.interactive.push(sprite);
      this.specialNodes.push({ item: sprite.userData.item, sprite, type: 'lagrange' });
      this.addLabel(sprite, item.name, 'PUNTO DE LAGRANGE', item.id);
    }
  }

  createLocalOrbiters() {
    for (const item of LOCAL_ORBITERS) {
      const enriched = {
        ...item, kind: 'spacecraft',
        summary: `${item.name} se mueve con su periodo orbital real aproximado de ${item.periodHours} horas; la simulación transcurre a velocidad 1×.`,
      };
      const sprite = makeSprite(enriched, 'spacecraft');
      this.scene.add(sprite);
      this.interactive.push(sprite);
      this.localOrbiterNodes.push({ item: enriched, sprite });
      this.addLabel(sprite, item.name, 'ORBITADOR', item.id);
    }
  }

  createSurfaceSites() {
    this.surfaceNodes = [];
    for (const site of SURFACE_SITES) {
      const body = this.bodyNodes.get(site.body);
      if (!body) continue;
      const item = {
        ...site,
        summary: `${site.name}, emplazamiento de superficie en ${body.definition.name}. Estado: ${site.status}.`,
      };
      const sprite = makeSprite(item, site.kind);
      sprite.position.copy(surfacePosition(site, body.definition.radiusKm));
      body.spin.add(sprite);
      this.interactive.push(sprite);
      this.surfaceNodes.push({ item, sprite, bodyId: site.body });
    }
  }

  addLabel(object, title, kicker, id) {
    const element = document.createElement('div');
    element.className = 'space-label';
    element.innerHTML = `<span>${kicker}</span><strong>${title}</strong>`;
    this.container.appendChild(element);
    this.labels.push({ object, element, id });
  }

  setCatalog(records) {
    this.records = records;
    this.setFilters({ orbits: new Set(Object.keys(ORBIT_STYLES)), groups: new Set(Object.keys(GROUP_STYLES)), debris: this.showDebris });
    this.updateCatalogPositions(this.simulationDate);
  }

  setSpacecraft(objects) {
    for (const node of this.spacecraftNodes) {
      this.scene.remove(node.sprite);
      node.sprite.material.dispose();
      node.sprite.material.map?.dispose();
      node.label?.element.remove();
    }
    this.spacecraftNodes = [];
    const byId = new Map(objects.map((item) => [item.id, item]));
    for (const fallback of FALLBACK_SPACECRAFT) if (!byId.has(fallback.id)) byId.set(fallback.id, fallback);
    this.spacecraft = [...byId.values()];
    for (const source of this.spacecraft) {
      const item = {
        ...source,
        kind: 'spacecraft',
        summary: source.summary || `${source.name}, efeméride heliocéntrica pública de NASA/JPL Horizons en el marco eclíptico J2000.`,
      };
      const sprite = makeSprite(item, 'spacecraft');
      this.scene.add(sprite);
      this.interactive.push(sprite);
      const labelBefore = this.labels.length;
      this.addLabel(sprite, item.name, item.source ? 'EFEMÉRIDE JPL' : 'MISIÓN', item.id);
      this.spacecraftNodes.push({ item, sprite, label: this.labels[labelBefore] });
    }
    this.updateWorld(this.simulationDate, true);
  }

  getFocusTargets() {
    return [
      ...CELESTIAL_BODIES.map((body) => ({ ...body, kind: body.type })),
      ...this.specialNodes.map((node) => node.item),
      ...this.spacecraftNodes.map((node) => node.item),
      ...this.localOrbiterNodes.map((node) => node.item),
    ];
  }

  setFilters({ orbits, groups, debris = this.showDebris }) {
    this.showDebris = debris;
    const isVisible = (record) => orbits.has(record.orbit) && groups.has(record.group);
    this.activeVisible = this.records.filter((record) => !record.isDebris && isVisible(record));
    this.debrisVisible = debris ? this.records.filter((record) => record.isDebris && isVisible(record)) : [];
    this.visibleRecords = [...this.activeVisible, ...this.debrisVisible];
    this.updateCatalogPositions(this.simulationDate, true);
  }

  setObjectLayers({ debris, missions, surface }) {
    this.showDebris = debris;
    this.showMissions = missions;
    this.showSurface = surface;
    this.debrisPoints.visible = debris;
    for (const node of [...this.specialNodes, ...this.spacecraftNodes, ...this.localOrbiterNodes]) node.sprite.visible = missions;
    this.updateVisibility();
  }

  setLayer(layer) {
    this.layer = layer;
    if (!this.earthMaterial) return;
    this.earthMaterial.uniforms.dayMap.value = layer === 'political' ? this.earthTextures.political : this.earthTextures.satellite;
    this.earthMaterial.uniforms.allNight.value = layer === 'night' ? 1 : 0;
  }

  setAtmosphere(visible) {
    this.showAtmosphere = visible;
    if (this.atmosphere) this.atmosphere.visible = visible;
    if (this.clouds) this.clouds.visible = visible;
  }

  setSelectionLayers({ orbit, coverage }) {
    this.showOrbit = orbit;
    this.showCoverage = coverage;
    if (this.selectedOrbit) this.selectedOrbit.visible = orbit;
    if (this.coverageMesh) this.coverageMesh.visible = coverage;
  }

  setRunning(running) {
    this.running = running;
  }

  setAutoRotate() {
    // La cámara nunca rota automáticamente: el tiempo físico gobierna los cuerpos.
    this.controls.autoRotate = false;
  }

  focusBody(id, notify = true) {
    const body = this.bodyNodes.get(id);
    if (!body) return false;
    this.focus = { type: 'body', id };
    this.selected = body.surface.userData.item;
    this.updateWorld(this.simulationDate, true);
    this.resetCamera();
    if (notify) this.onFocus?.(this.selected);
    return true;
  }

  focusItem(item, notify = true) {
    if (!item) return false;
    if (this.bodyNodes.has(item.id)) return this.focusBody(item.id, notify);
    if (item.satrec || item.kind === 'spacecraft' || item.kind === 'lagrange') {
      this.focus = { type: 'object', item };
      this.selected = item;
      this.updateWorld(this.simulationDate, true);
      this.resetCamera();
      if (notify) this.onFocus?.(item);
      return true;
    }
    if (item.body) return this.focusBody(item.body, notify);
    return false;
  }

  focusSelected() {
    return this.focusItem(this.selected);
  }

  resetCamera() {
    let distance = 90_000;
    if (this.focus.type === 'body') {
      const radius = this.bodyNodes.get(this.focus.id)?.definition.radiusKm || EARTH_RADIUS_KM;
      distance = this.focus.id === 'earth' ? 90_000 : Math.max(radius * 5.5, radius + 850);
      this.controls.minDistance = Math.max(1, radius * 1.012);
    } else {
      const record = this.focus.item;
      distance = record.satrec ? 2_500 : record.kind === 'lagrange' ? 180_000 : 80_000;
      this.controls.minDistance = record.satrec ? 5 : 50;
    }
    const direction = this.camera.position.lengthSq() > 0
      ? this.camera.position.clone().normalize()
      : new THREE.Vector3(0.2, 0.18, 1).normalize();
    this.camera.position.copy(direction.multiplyScalar(distance));
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  selectRecord(record, focus = false) {
    if (!record) return false;
    this.selected = record;
    this.onSelect?.(record);
    this.drawSelectedOrbit(record);
    if (focus) this.focusItem(record);
    return true;
  }

  selectByName(query, focus = false) {
    const upper = String(query || '').toUpperCase();
    const body = CELESTIAL_BODIES.find((item) => item.name.toUpperCase().includes(upper) || item.id.toUpperCase() === upper);
    if (body) {
      const item = this.bodyNodes.get(body.id).surface.userData.item;
      this.onSelect?.(item);
      if (focus) this.focusBody(body.id);
      return item;
    }
    const special = this.getFocusTargets().find((item) => item.name?.toUpperCase().includes(upper) || item.id?.toUpperCase() === upper);
    if (special && !special.satrec) {
      this.onSelect?.(special);
      if (focus) this.focusItem(special);
      return special;
    }
    const record = this.records.find((item) => item.name.toUpperCase().includes(upper));
    if (record) this.selectRecord(record, focus);
    return record || null;
  }

  currentAbsolutePosition(item, date) {
    if (!item) return null;
    if (this.rawPositions.has(item.id)) return this.rawPositions.get(item.id).clone();
    if (item.satrec) {
      const earth = this.rawPositions.get('earth');
      const state = propagate(item.satrec, date);
      if (!state?.position || typeof state.position === 'boolean') return earth?.clone();
      return earth.clone().add(equatorialToScene(state.position));
    }
    const lagrange = this.specialNodes.find((node) => node.item.id === item.id);
    if (lagrange) return lagrange.sprite.userData.absolute?.clone();
    const spacecraft = this.spacecraftNodes.find((node) => node.item.id === item.id);
    if (spacecraft) return spacecraft.sprite.userData.absolute?.clone();
    const local = this.localOrbiterNodes.find((node) => node.item.id === item.id);
    if (local) return local.sprite.userData.absolute?.clone();
    return null;
  }

  resolveFocusOrigin(date) {
    if (this.focus.type === 'body') return this.rawPositions.get(this.focus.id)?.clone() || new THREE.Vector3();
    return this.currentAbsolutePosition(this.focus.item, date) || new THREE.Vector3();
  }

  updateBodyPositions(date) {
    for (const definition of CELESTIAL_BODIES) {
      let position;
      if (definition.id === 'sun') position = new THREE.Vector3();
      else if (PLANET_IDS.has(definition.id)) position = eclipticToScene(planetPositionAu(definition.id, date), AU_KM);
      else {
        const parent = this.rawPositions.get(definition.parent) || new THREE.Vector3();
        const phase = seededRandom(definition.id.length * 17) * Math.PI * 2;
        const relative = circularOrbitPosition(definition.orbitKm, definition.periodDays, date, definition.inclination, phase);
        position = parent.clone().add(eclipticToScene(relative));
      }
      this.rawPositions.set(definition.id, position);
    }
  }

  updateSpecialPositions(date) {
    const earthRaw = this.rawPositions.get('earth');
    const earthEcliptic = { x: earthRaw.x, y: -earthRaw.z, z: earthRaw.y };
    for (const node of this.specialNodes) {
      const raw = lagrangePosition(node.item.point, earthEcliptic);
      node.sprite.userData.absolute = eclipticToScene(raw);
    }

    for (const node of this.spacecraftNodes) {
      let absolute;
      if (node.item.positionKm) {
        absolute = eclipticToScene(node.item.positionKm);
        const epoch = node.item.snapshotAt ? new Date(node.item.snapshotAt) : null;
        if (epoch && !Number.isNaN(epoch.valueOf()) && node.item.velocityKmS) {
          const seconds = (date - epoch) / 1000;
          absolute.add(eclipticToScene(node.item.velocityKmS, seconds));
        }
      } else {
        const point = node.item.anchor === 'L1' ? 'L1' : 'L2';
        const base = lagrangePosition(point, earthEcliptic);
        const days = julianDate(date) - 2_451_545;
        const angle = days / 180 * Math.PI * 2 + seededRandom(node.item.id.length) * Math.PI * 2;
        const amplitude = point === 'L2' ? 420_000 : 180_000;
        absolute = eclipticToScene({ x: base.x, y: base.y + Math.cos(angle) * amplitude, z: base.z + Math.sin(angle) * amplitude * 0.55 });
      }
      node.sprite.userData.absolute = absolute;
    }

    for (const node of this.localOrbiterNodes) {
      const parent = this.rawPositions.get(node.item.parent);
      const bodyRadius = this.bodyNodes.get(node.item.parent)?.definition.radiusKm || 0;
      const periapsis = bodyRadius + (node.item.periapsisKm ?? node.item.altitudeKm ?? 200);
      const apoapsis = bodyRadius + (node.item.apoapsisKm ?? node.item.altitudeKm ?? 200);
      const semiMajor = (periapsis + apoapsis) / 2;
      const eccentricity = Math.max(0, (apoapsis - periapsis) / (apoapsis + periapsis));
      const angle = (date.getTime() / 3_600_000 / node.item.periodHours + seededRandom(node.item.id.length * 31)) * Math.PI * 2;
      const radius = semiMajor * (1 - eccentricity * eccentricity) / (1 + eccentricity * Math.cos(angle));
      const inclination = THREE.MathUtils.degToRad(node.item.inclination || 0);
      const relative = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * Math.sin(inclination), -Math.sin(angle) * radius * Math.cos(inclination));
      node.sprite.userData.absolute = parent.clone().add(relative);
    }
  }

  updateWorld(date, force = false) {
    this.updateBodyPositions(date);
    this.updateSpecialPositions(date);
    const origin = this.resolveFocusOrigin(date);
    this.focusOrigin = origin;

    for (const [id, body] of this.bodyNodes) {
      body.root.position.copy(this.rawPositions.get(id)).sub(origin);
      if (id === 'earth') body.spin.rotation.y = gstime(date);
      else if (body.definition.rotationHours) {
        const elapsedHours = (julianDate(date) - 2_451_545) * 24;
        body.spin.rotation.y = elapsedHours / body.definition.rotationHours * Math.PI * 2;
      }
    }
    this.planetOrbitRoot.position.copy(origin).multiplyScalar(-1);
    for (const line of this.moonOrbitNodes) line.position.copy(this.rawPositions.get(line.userData.parent)).sub(origin);
    for (const node of [...this.specialNodes, ...this.spacecraftNodes, ...this.localOrbiterNodes]) {
      node.sprite.position.copy(node.sprite.userData.absolute).sub(origin);
    }

    const sunDirection = this.rawPositions.get('sun').clone().sub(this.rawPositions.get('earth')).normalize();
    this.earthMaterial?.uniforms.sunDirection.value.copy(sunDirection);
    const focusBody = this.focus.type === 'body' ? this.focus.id : 'earth';
    const focusPosition = this.rawPositions.get(focusBody) || origin;
    const lightDirection = this.rawPositions.get('sun').clone().sub(focusPosition).normalize();
    this.sunLight.position.copy(lightDirection.multiplyScalar(1e8));
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.target.updateMatrixWorld();
    this.updateVisibility();
    if (force) this.updateCatalogPositions(date, true);
  }

  updateCatalogPositions(date, force = false) {
    if (!this.activePoints || (!force && performance.now() - this.lastPropagation < 1_250)) return;
    this.lastPropagation = performance.now();
    const earth = this.rawPositions.get('earth');
    const origin = this.focusOrigin || earth || new THREE.Vector3();
    const gmst = gstime(date);
    const update = (records, points, debris = false) => {
      const positions = new Float32Array(records.length * 3);
      const colors = new Float32Array(records.length * 3);
      let valid = 0;
      for (const record of records) {
        const state = propagate(record.satrec, date);
        if (!state?.position || typeof state.position === 'boolean') continue;
        const absolute = earth.clone().add(equatorialToScene(state.position));
        const display = absolute.sub(origin);
        positions.set([display.x, display.y, display.z], valid * 3);
        const color = new THREE.Color(debris ? '#9b8178' : ORBIT_STYLES[record.orbit].color);
        colors.set([color.r, color.g, color.b], valid * 3);
        const geodetic = eciToGeodetic(state.position, gmst);
        const velocity = state.velocity && typeof state.velocity !== 'boolean' ? Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z) : NaN;
        record.position = {
          vector: display.clone(),
          absolute: earth.clone().add(equatorialToScene(state.position)),
          altitude: geodetic.height,
          latitude: degreesLat(geodetic.latitude),
          longitude: degreesLong(geodetic.longitude),
          speed: velocity,
        };
        records[valid] = record;
        valid += 1;
      }
      records.length = valid;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, valid * 3), 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, valid * 3), 3));
      points.geometry.dispose();
      points.geometry = geometry;
    };
    update(this.activeVisible, this.activePoints, false);
    update(this.debrisVisible, this.debrisPoints, true);
    if (this.selected?.satrec) this.onFrame?.(this.selected, this.getStatus());
  }

  updateVisibility() {
    const cameraDistance = this.camera.position.length();
    const focusBody = this.focus.type === 'body' ? this.focus.id : null;
    this.activePoints.visible = cameraDistance < 8e6;
    this.debrisPoints.visible = this.showDebris && cameraDistance < 8e6;
    for (const node of this.surfaceNodes) {
      const body = this.bodyNodes.get(node.bodyId);
      const threshold = body.definition.radiusKm * 18;
      node.sprite.visible = this.showSurface && focusBody === node.bodyId && cameraDistance < threshold;
    }
    for (const node of [...this.specialNodes, ...this.spacecraftNodes, ...this.localOrbiterNodes]) {
      node.sprite.visible = this.showMissions;
    }
    for (const line of this.moonOrbitNodes) {
      const parent = line.userData.parent;
      line.visible = focusBody === parent || cameraDistance > 80_000;
    }
  }

  drawSelectedOrbit(record) {
    if (this.selectedOrbit) {
      this.scene.remove(this.selectedOrbit);
      this.selectedOrbit.geometry.dispose();
      this.selectedOrbit.material.dispose();
    }
    if (!record?.satrec) return;
    const points = [];
    const earth = this.rawPositions.get('earth');
    const origin = this.focusOrigin || earth;
    const periodMs = record.periodMinutes * 60_000;
    for (let index = 0; index <= 220; index += 1) {
      const date = new Date(this.simulationDate.getTime() + index / 220 * periodMs);
      const state = propagate(record.satrec, date);
      if (state?.position && typeof state.position !== 'boolean') points.push(earth.clone().add(equatorialToScene(state.position)).sub(origin));
    }
    this.selectedOrbit = makeOrbitLine(points, ORBIT_STYLES[record.orbit].color, 0.82);
    this.selectedOrbit.visible = this.showOrbit;
    this.scene.add(this.selectedOrbit);
  }

  getStatus() {
    return {
      focus: this.focus,
      distanceKm: this.camera.position.length(),
      visible: this.visibleRecords.length,
    };
  }

  pick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    this.pointer.y = -(event.clientY - rect.top) / rect.height * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.params.Points.threshold = Math.max(25, this.camera.position.length() * 0.004);
    const intersections = this.raycaster.intersectObjects([
      this.activePoints, this.debrisPoints, ...this.interactive.filter((object) => object.visible),
    ], false);
    for (const hit of intersections) {
      if (hit.object === this.activePoints) return this.activeVisible[hit.index];
      if (hit.object === this.debrisPoints) return this.debrisVisible[hit.index];
      if (hit.object.userData.item) return hit.object.userData.item;
    }
    return null;
  }

  bindEvents() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (event) => { this.pointerStart = { x: event.clientX, y: event.clientY }; });
    canvas.addEventListener('pointerup', (event) => {
      if (!this.pointerStart || Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 5) return;
      const item = this.pick(event);
      if (!item) return;
      this.selected = item;
      this.onSelect?.(item);
      if (item.satrec) this.drawSelectedOrbit(item);
    });
    canvas.addEventListener('dblclick', (event) => {
      event.preventDefault();
      const item = this.pick(event);
      if (item) {
        this.selected = item;
        this.onSelect?.(item);
        this.focusItem(item);
      }
    });
  }

  updateLabels() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const cameraDistance = this.camera.position.length();
    const position = new THREE.Vector3();
    for (const label of this.labels) {
      if (!label.object.visible || !label.object.parent) { label.element.hidden = true; continue; }
      label.object.getWorldPosition(position);
      const projected = position.clone().project(this.camera);
      const onScreen = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15;
      const body = this.bodyNodes.get(label.id);
      const distance = position.distanceTo(this.camera.position);
      const radius = body?.definition.radiusKm || 0;
      const pixels = radius / Math.max(1, distance) * height / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      if (body) body.marker.visible = pixels < 11 && label.id !== this.focus.id;
      const closeToFocusedBody = body && label.id === this.focus.id && cameraDistance < radius * 35;
      label.element.hidden = !onScreen || closeToFocusedBody || (!body && !this.showMissions);
      if (!label.element.hidden) {
        label.element.style.transform = `translate3d(${(projected.x * 0.5 + 0.5) * width}px, ${(-projected.y * 0.5 + 0.5) * height}px, 0)`;
      }
    }
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.1);
    if (this.running) this.simulationDate = new Date(this.simulationDate.getTime() + delta * 1000);
    const now = performance.now();
    if (now - this.lastPositionUpdate > 250) {
      this.updateWorld(this.simulationDate);
      this.lastPositionUpdate = now;
    }
    this.updateCatalogPositions(this.simulationDate);
    this.controls.update();
    this.updateVisibility();
    this.updateLabels();
    if (this.stars) this.stars.position.copy(this.camera.position);
    const sun = this.bodyNodes.get('sun')?.surface;
    if (sun?.material.uniforms?.time) sun.material.uniforms.time.value += delta;
    this.onFrame?.(this.selected?.satrec ? this.selected : null, this.getStatus());
    this.renderer.render(this.scene, this.camera);
  }
}
