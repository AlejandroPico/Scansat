import * as THREE from 'three';
import { EarthTiles } from './earth-tiles.js';
import { zoomDistance, interpolateZoom } from './navigation.js';
import { physicalShader } from './shader-support.js';
import { closestPointOnRay } from './picking.js';
import { CosmicScene } from './cosmic-scene.js';
import { LY_KM, COSMIC_OBJECTS, OBSERVABLE_RADIUS_KM, renderingUnit, scaleLevel, segmentOccluded } from './cosmic-data.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { degreesLat, degreesLong, eciToGeodetic, gstime, propagate } from './satellite-core.js';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import countriesTopology from 'world-atlas/countries-110m.json' with { type: 'json' };
import { EARTH_RADIUS_KM, GROUP_STYLES, ORBIT_STYLES, isCatalogDateReliable } from './catalog.js';
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

const BASE_URL = import.meta.env?.BASE_URL ?? "/";
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
  const canvas = document.createElement('canvas');canvas.width=64;canvas.height=64;
  const context=canvas.getContext('2d');context.strokeStyle=color;context.fillStyle=color;
  context.lineWidth=2.5;context.beginPath();
  if(kind==='lagrange') {context.moveTo(32,16);context.lineTo(48,32);context.lineTo(32,48);context.lineTo(16,32);context.closePath();context.stroke();}
  else {context.arc(32,32,kind==='body'?6:8,0,Math.PI*2);kind==='body'?context.fill():context.stroke();}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

function makeSprite(item, kind = 'spacecraft') {
  const material = new THREE.SpriteMaterial({
    map: makeIconTexture(kind, item.color || '#8fdcff'),
    transparent: true,
    depthWrite: false,
    depthTest: true,
    sizeAttenuation: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(kind === 'body' ? 0.024 : kind === 'spacecraft' ? 0.022 : 0.027);
  sprite.renderOrder = 20;
  sprite.userData.pixelSize = sprite.scale.x;
  sprite.userData.item = item;
  return sprite;
}

function makeAtmosphereMaterial(color = '#50c8ff') {
  return physicalShader({
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
  return physicalShader({
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
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
        // NASA visible-colour composite, without a relief colour ramp.
        vec3 nightColor = texture2D(nightMap, vUvMap).rgb * 1.55;
        float directLight = dot(normalize(vNormalW), normalize(sunDirection));
        float terminator = smoothstep(-0.13, 0.17, directLight);
        vec3 litDay = dayColor * (0.10 + max(0.0, directLight) * 1.05);
        vec3 color = mix(nightColor, litDay, max(terminator, allNight));
        if (allNight > 0.5) color = nightColor * 1.3;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

function makeSunMaterial(surfaceMap) {
  return physicalShader({
    uniforms: { time: { value: 0 }, surfaceMap: { value: surfaceMap } },
    vertexShader: `varying vec2 vUvMap; void main(){vUvMap=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      uniform float time; uniform sampler2D surfaceMap; varying vec2 vUvMap;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float v=0.0,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+17.13;a*=.5;}return v;}
      void main(){
        vec2 uv=vec2(fract(vUvMap.x+time*.000025),vUvMap.y);
        vec3 observed=texture2D(surfaceMap,uv).rgb;
        float detail=fbm(uv*vec2(48.0,24.0)+vec2(time*.018,-time*.009));
        float cells=fbm(uv*vec2(150.0,75.0)-vec2(time*.01,0.0));
        float signal=clamp(dot(observed,vec3(.333))*1.3+detail*.5+cells*.17,.0,1.35);
        vec3 deep=vec3(.58,.035,.002), mid=vec3(1.0,.25,.018), hot=vec3(1.0,.92,.46);
        vec3 color=mix(deep,mid,smoothstep(.08,.7,signal));
        color=mix(color,hot,smoothstep(.62,1.18,signal));
        gl_FragColor=vec4(color,1.0);
      }`,
  });
}

function makeSunGlowMaterial() {
  return physicalShader({
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: { glowColor: { value: new THREE.Color('#ff7b24') } },
    vertexShader: `varying vec3 vNormalW;varying vec3 vWorld;void main(){vNormalW=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `uniform vec3 glowColor;varying vec3 vNormalW;varying vec3 vWorld;void main(){vec3 viewDir=normalize(cameraPosition-vWorld);float rim=pow(max(0.0,.88-dot(vNormalW,viewDir)),2.35);gl_FragColor=vec4(glowColor,rim*.92);}`,
  });
}

function makeCoronaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(256, 256, 90, 256, 256, 255);
  gradient.addColorStop(0, 'rgba(255,225,144,.9)');
  gradient.addColorStop(0.28, 'rgba(255,137,47,.34)');
  gradient.addColorStop(0.62, 'rgba(255,78,18,.1)');
  gradient.addColorStop(1, 'rgba(255,45,5,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);
  return new THREE.CanvasTexture(canvas);
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
    this.liveTime = true;
    this.timeScale = 1;
    this.catalogReferenceDate = null;
    this.catalogReliable = true;
    this.activePointRecords = [];
    this.debrisPointRecords = [];
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
    this.camera.position.set(0, 8_000, 25_000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.setAttribute('aria-label', 'Universo tridimensional interactivo, desde satélites hasta la red cósmica');
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.minDistance = EARTH_RADIUS_KM + .08;
    this.controls.maxDistance = OBSERVABLE_RADIUS_KM * 4;
    this.controls.enableZoom = false;
    this.zoomTarget = null;
    this.navigationKeys = new Set();
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
    this.renderCamera = this.camera.clone();
    this.renderUnit = 1;
    this.showLabels = true;
    this.showPlanetOrbits = true;
    this.createBodies();
    this.createPlanetOrbits();
    this.createCatalogPoints();
    this.createLagrangeObjects();
    this.createLocalOrbiters();
    this.createSurfaceSites();
    this.setSpacecraft([]);
    this.cosmos = new CosmicScene(this);
    this.earthTiles = new EarthTiles(this);
    this.bindEvents();
    this.updateWorld(this.simulationDate, true);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    requestAnimationFrame(() => this.animate());
  }

  createLights() {
    this.ambientLight = new THREE.AmbientLight('#283744', 0.42);
    this.sunLight = new THREE.DirectionalLight('#fff1d2', 3.3);
    this.sunLight.position.set(1e8, 0, 0);
    this.sunLight.target.position.set(0, 0, 0);
    this.scene.add(this.ambientLight, this.sunLight, this.sunLight.target);
  }

  loadTexture(name, useSrgb = true) {
    if (!name) return null;
    const texture = this.textureLoader.load(`${BASE_URL}textures/${name}`);
    if (useSrgb) texture.colorSpace = THREE.SRGBColorSpace;
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
      if (definition.id === 'sun') material = makeSunMaterial(this.loadTexture('sun-surface.jpg'));
      else if (definition.id === 'earth') {
        this.earthTextures = {
          satellite: this.loadTexture('earth-natural.png'),
          political: this.politicalTexture,
          night: this.loadTexture('earth-night.png'),
        };
        material = makeEarthMaterial(this.earthTextures.satellite, this.earthTextures.night);
        this.earthMaterial = material;
      } else {
        const textureName = definition.id === 'moon' ? 'moon-color.jpg' : ['mercury', 'uranus'].includes(definition.id) ? null : definition.texture;
        const bumpMap = definition.id === 'moon' ? this.loadTexture('moon-height.jpg', false) : null;
        material = new THREE.MeshStandardMaterial({
          map: this.loadTexture(textureName), color: textureName ? '#ffffff' : definition.color,
          bumpMap, bumpScale: bumpMap ? 7.5 : 0,
          roughness: definition.id === 'venus' ? 0.88 : 0.94, metalness: 0, depthWrite: true, depthTest: true,
        });
      }

      const widthSegments = definition.radiusKm > 3_000 ? 160 : 64;
      const surface = new THREE.Mesh(new THREE.SphereGeometry(definition.radiusKm, widthSegments, Math.round(widthSegments * 0.66)), material);
      surface.userData.item = {
        ...definition,
        kind: definition.type,
        summary: `${definition.name} se representa con su radio físico. Su posición y su órbita comparten la misma escala espacial del resto del sistema.`,
      };
      spin.add(surface);
      this.interactive.push(surface);

      if (definition.id === 'sun') {
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(definition.radiusKm * 1.075, 96, 64),
          makeSunGlowMaterial(),
        );
        spin.add(glow);
        const corona = new THREE.Sprite(new THREE.SpriteMaterial({
          map: makeCoronaTexture(), transparent: true, depthWrite: false, depthTest: true,
          blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.86,
        }));
        corona.scale.setScalar(definition.radiusKm * 3.5);
        corona.renderOrder = -1;
        spin.add(corona);
        this.sunGlow = glow;
        this.sunCorona = corona;
      }

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
          new THREE.MeshStandardMaterial({ color: '#ffffff', alphaMap: cloudMap, transparent: true, opacity: 0.52, depthWrite: false, roughness: 1 }),
        );
        spin.add(this.clouds);
      }

      if (definition.rings) {
        const ringCanvas = document.createElement('canvas');
        ringCanvas.width = 1024; ringCanvas.height = 1024;
        const context = ringCanvas.getContext('2d');
        const gradient = context.createRadialGradient(512, 512, 0, 512, 512, 512);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.505, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.515, 'rgba(151,135,105,.14)');
        gradient.addColorStop(0.585, 'rgba(198,183,151,.36)');
        gradient.addColorStop(0.61, 'rgba(48,42,35,.11)');
        gradient.addColorStop(0.64, 'rgba(225,213,184,.82)');
        gradient.addColorStop(0.76, 'rgba(177,159,126,.7)');
        gradient.addColorStop(0.815, 'rgba(87,75,59,.18)');
        gradient.addColorStop(0.845, 'rgba(29,26,24,.045)');
        gradient.addColorStop(0.87, 'rgba(197,181,146,.62)');
        gradient.addColorStop(0.965, 'rgba(132,116,91,.23)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient; context.fillRect(0, 0, 1024, 1024);
        const ringTexture = new THREE.CanvasTexture(ringCanvas);
        ringTexture.colorSpace = THREE.SRGBColorSpace;
        ringTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(definition.radiusKm * 1.18, definition.radiusKm * 2.32, 256),
          new THREE.MeshBasicMaterial({ map: ringTexture, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.015, opacity: 0.96, toneMapped: false }),
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
    this.activePoints = new THREE.Points(new THREE.BufferGeometry(), material(2.25, 1));
    this.debrisPoints = new THREE.Points(new THREE.BufferGeometry(), material(1.15, 0.58));
    this.activePoints.renderOrder = 8;
    this.activePoints.userData.catalog = true;
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

  createSurfaceSites(sites = SURFACE_SITES) {
    this.surfaceNodes = [];
    for (const site of sites) {
      const body = this.bodyNodes.get(site.body);
      if (!body || !Number.isFinite(site.lat) || !Number.isFinite(site.lon)) continue;
      const item = {
        ...site,
        summary: site.summary || `${site.name}, emplazamiento de superficie en ${body.definition.name}. Estado: ${site.status}.`,
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
    const small=document.createElement('span');small.textContent=kicker;
    const strong=document.createElement('strong');strong.textContent=title;
    element.append(small,strong);
    this.container.appendChild(element);
    this.labels.push({ object, element, id });
  }

  setCatalog(records) {
    this.records = records;
    const epochs = records
      .map((record) => Date.parse(String(record.epoch || '').endsWith('Z') ? record.epoch : `${record.epoch}Z`))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    this.catalogReferenceDate = epochs.length ? new Date(epochs[Math.floor(epochs.length / 2)]) : null;
    this.setFilters({ orbits: new Set(Object.keys(ORBIT_STYLES)), groups: new Set(Object.keys(GROUP_STYLES)), debris: this.showDebris });
    this.updateCatalogPositions(this.simulationDate);
  }

  setSpacecraft(objects) {
    for (const node of this.spacecraftNodes) {
      this.scene.remove(node.sprite);
      this.interactive = this.interactive.filter(x => x !== node.sprite);
      this.labels = this.labels.filter(x => x !== node.label);
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
      ...this.surfaceNodes.map((node) => node.item),
      ...(this.cosmos?.targets || []),
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
    if (!running) this.liveTime = false;
  }

  setTimeScale(scale) {
    if (Number.isFinite(scale) && scale !== 0) {this.timeScale = scale;this.liveTime=false;}
  }

  catalogSupports(date) {
    return isCatalogDateReliable(this.catalogReferenceDate, date);
  }

  setSimulationDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return false;
    this.liveTime=false;
    this.simulationDate = new Date(date);
    this.catalogReliable = this.catalogSupports(this.simulationDate);
    if (!this.catalogReliable && this.focus.type === 'object' && this.focus.item?.satrec) {
      this.focus = { type: 'body', id: 'earth' };
      this.selected = this.bodyNodes.get('earth').surface.userData.item;
      this.onFocus?.(this.selected);
    }
    this.updateWorld(this.simulationDate, true);
    return true;
  }

  setAutoRotate() {
    // La cámara nunca rota automáticamente: el tiempo físico gobierna los cuerpos.
    this.controls.autoRotate = false;
  }

  focusBody(id, notify = true) {
    const body = this.bodyNodes.get(id);
    if (!body) return false;
    this.drawSelectedOrbit(null);
    this.cosmos.selectedItem=null;
    this.zoomTarget=null;
    this.focus = { type: 'body', id };
    this.selected = body.surface.userData.item;
    this.updateWorld(this.simulationDate, true);
    this.resetCamera();
    if (notify) this.onFocus?.(this.selected);
    return true;
  }

  focusItem(item, notify = true) {
    if (!item) return false;
    if (!item.satrec) this.drawSelectedOrbit(null);
    if (item.satrec && !this.catalogReliable) return false;
    if (this.bodyNodes.has(item.id)) return this.focusBody(item.id, notify);
    if (item.cosmic || item.satrec || item.kind === 'spacecraft' || item.kind === 'lagrange') {
      this.zoomTarget=null;
      this.focus = { type: 'object', item };
      this.selected = item;
      this.updateWorld(this.simulationDate, true);
      this.resetCamera();
      if(item.cosmic && (item.kind === 'star'||item.catalogGalaxy)) this.cosmos.selectStar(item);
      if (notify) this.onFocus?.(item);
      return true;
    }
    if (item.body) {
      if(!this.focusBody(item.body,notify))return false;
      const body=this.bodyNodes.get(item.body);
      const normal=surfacePosition(item,1).applyQuaternion(body.spin.quaternion).applyQuaternion(body.axialTilt.quaternion).normalize();
      this.camera.position.copy(normal.multiplyScalar(body.definition.radiusKm*2.7));this.controls.update();
      this.selected=item;return true;
    }
    return false;
  }

  focusSelected() {
    return this.focusItem(this.selected);
  }

  resetCamera() {
    let distance = 90_000;
    if (this.focus.type === 'body') {
      const radius = this.bodyNodes.get(this.focus.id)?.definition.radiusKm || EARTH_RADIUS_KM;
      distance = this.focus.id === 'earth' ? 26_000 : Math.max(radius * 5.5, radius + 850);
      this.controls.minDistance = radius + .08;
    } else {
      const record = this.focus.item;
      distance = record.viewDistanceKm || (record.satrec ? 2_500 : record.kind === 'lagrange' ? 180_000 : 80_000);
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
    if (!record || !this.catalogReliable) return false;
    this.selected = record;
    this.onSelect?.(record);
    this.drawSelectedOrbit(record);
    if (focus) this.focusItem(record);
    return true;
  }

  selectByName(query, focus = false) {
    const upper = String(query || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    const canonical = item => `${item.name} ${item.id} ${item.aliases||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    const body = CELESTIAL_BODIES.find((item) => item.name.toUpperCase().includes(upper) || item.id.toUpperCase() === upper);
    if (body) {
      const item = this.bodyNodes.get(body.id).surface.userData.item;
      this.onSelect?.(item);
      if (focus) this.focusBody(body.id);
      return item;
    }
    const special = this.getFocusTargets().find((item) => canonical(item).includes(upper));
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
    if (item.cosmic) return new THREE.Vector3(...item.position);
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
        const amplitude = node.item.deploymentTarget ? 0 : point === 'L2' ? 420_000 : 180_000;
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
      if (id === 'earth') {
        const angle=gstime(date),previous=body.spin.rotation.y;
        if(this.focus.id==='earth'&&this.camera.position.length()<body.definition.radiusKm+500&&!force){
          const axis=new THREE.Vector3(0,1,0).applyQuaternion(body.axialTilt.quaternion);
          this.camera.position.applyAxisAngle(axis,angle-previous);
        }
        body.spin.rotation.y=angle;
      }
      else if (body.definition.type === 'moon' && body.definition.parent) {
        const towardParent = this.rawPositions.get(body.definition.parent).clone().sub(this.rawPositions.get(id)).normalize();
        body.spin.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), towardParent);
      }
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
    if (!force && (this.camera.position.length() > 8e6 || this.focus.item?.cosmic)) return;
    if (!this.activePoints || (!force && performance.now() - this.lastPropagation < 1_250)) return;
    this.lastPropagation = performance.now();
    this.catalogReliable = this.catalogSupports(date);
    if (!this.catalogReliable) {
      this.activePointRecords = [];
      this.debrisPointRecords = [];
      for (const record of [...this.activeVisible, ...this.debrisVisible]) record.position = null;
      for (const points of [this.activePoints, this.debrisPoints]) {
        points.geometry.dispose();
        points.geometry = new THREE.BufferGeometry();
      }
      if (this.selectedOrbit) {
        this.scene.remove(this.selectedOrbit);
        this.selectedOrbit.geometry.dispose();
        this.selectedOrbit.material.dispose();
        this.selectedOrbit = null;
      }
      this.updateVisibility();
      return;
    }
    const earth = this.rawPositions.get('earth');
    const origin = this.focusOrigin || earth || new THREE.Vector3();
    const gmst = gstime(date);
    const update = (records, points, debris = false) => {
      const positions = new Float32Array(records.length * 3);
      const colors = new Float32Array(records.length * 3);
      const pointRecords = [];
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
        pointRecords.push(record);
        valid += 1;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, valid * 3), 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, valid * 3), 3));
      points.geometry.dispose();
      points.geometry = geometry;
      return pointRecords;
    };
    this.activePointRecords = update(this.activeVisible, this.activePoints, false);
    this.debrisPointRecords = update(this.debrisVisible, this.debrisPoints, true);
    if (force && this.selected?.satrec) this.drawSelectedOrbit(this.selected);
    if (this.selected?.satrec) this.onFrame?.(this.selected, this.getStatus());
  }

  updateVisibility() {
    const cameraDistance = this.camera.position.length();
    const focusBody = this.focus.type === 'body' ? this.focus.id : null;
    const solarVisible = !this.focus.item?.cosmic && cameraDistance < LY_KM * .1;
    this.planetOrbitRoot.visible = this.showPlanetOrbits && solarVisible;
    if(this.selectedOrbit)this.selectedOrbit.visible = solarVisible && this.showOrbit && this.catalogReliable;
    for (const body of this.bodyNodes.values()) body.root.visible = solarVisible;
    this.activePoints.visible = solarVisible && this.catalogReliable && cameraDistance < 8e6;
    this.debrisPoints.visible = solarVisible && this.catalogReliable && this.showDebris && cameraDistance < 8e6;
    for (const node of this.surfaceNodes) {
      const body = this.bodyNodes.get(node.bodyId);
      const threshold = body.definition.radiusKm * 18;
      node.sprite.visible = this.showSurface && (!node.item.component || this.showComponents) && (!node.item.landDate || this.simulationDate >= new Date(node.item.landDate)) && focusBody === node.bodyId && cameraDistance < threshold;
    }
    for (const node of this.specialNodes) node.sprite.visible = solarVisible && this.showMissions;
    for (const node of [...this.spacecraftNodes, ...this.localOrbiterNodes]) {
      const epoch = node.item.snapshotAt ? Date.parse(node.item.snapshotAt) : null;
      const reliable = !epoch || Math.abs(this.simulationDate - epoch) < 2 * 86400000;
      const launched = !node.item.launchDate || this.simulationDate >= new Date(node.item.launchDate);
      node.sprite.visible = solarVisible && this.showMissions && reliable && launched;
    }
    for (const line of this.moonOrbitNodes) {
      const parent = line.userData.parent;
      line.visible = solarVisible && this.showPlanetOrbits && (focusBody === parent || cameraDistance > 80_000);
    }
  }

  clearSelection(notify = true) {
    this.selected = null;
    this.drawSelectedOrbit(null);
    if (this.cosmos.selectedMarker) this.cosmos.selectedMarker.visible = false;
    this.cosmos.selectedItem = null;
    if (notify) this.onSelect?.(null);
  }

  drawSelectedOrbit(record) {
    if (this.selectedOrbit) {
      this.scene.remove(this.selectedOrbit);
      this.selectedOrbit.geometry.dispose();
      this.selectedOrbit.material.dispose();
      this.selectedOrbit = null;
    }
    if (!record?.satrec || !this.catalogReliable) return;
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
      visible: this.catalogReliable ? this.activePointRecords.length + this.debrisPointRecords.length : 0,
      catalogReliable: this.catalogReliable,
      catalogReferenceDate: this.catalogReferenceDate,
      scale: scaleLevel(this.camera.position.length()),
      stars: this.cosmos?.stars.length || 0,
      starState: this.cosmos?.starState,
    };
  }

  pick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    this.pointer.y = -(event.clientY - rect.top) / rect.height * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.renderCamera);
    this.raycaster.params.Points.threshold = Math.max(25, this.camera.position.length() * 0.0025) / this.renderUnit;
    const intersections = this.raycaster.intersectObjects([
      ...this.interactive.filter((object) => this.isVisible(object)),
    ], false);
    const camera = this.camera.position.clone().add(this.focusOrigin).toArray();
    const direction = this.raycaster.ray.direction.toArray();
    const angle = Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*12/this.container.clientHeight;
    const records = [...(this.activePoints.visible?this.activePointRecords:[]),...(this.debrisPoints.visible?this.debrisPointRecords:[])];
    const satelliteHit = closestPointOnRay(records, x=>x.position?.absolute.toArray(),camera,direction,angle);
    const cosmicHit = this.cosmos.pickPhysical(camera,direction,angle);
    const starHit = [satelliteHit,cosmicHit].filter(Boolean).sort((a,b)=>a.distance-b.distance)[0];
    if(starHit)starHit.distance/=this.renderUnit;
    if (starHit && (!intersections.length || starHit.distance < intersections[0].distance)) return starHit.item;
    for (const hit of intersections) {
      if (hit.object === this.activePoints) return this.activePointRecords[hit.index];
      if (hit.object === this.debrisPoints) return this.debrisPointRecords[hit.index];
      if (hit.object.userData.item) return hit.object.userData.item;
    }
    return null;
  }

  focusRadius() {return this.focus.type==='body' ? (this.bodyNodes.get(this.focus.id)?.definition.radiusKm||0) : 0;}

  bindEvents() {
    const canvas = this.renderer.domElement;
    canvas.tabIndex=0;
    canvas.addEventListener('wheel',event=>{
      event.preventDefault();
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?this.container.clientHeight:1);
      this.zoomTarget=zoomDistance(this.zoomTarget??this.camera.position.length(),this.focusRadius(),delta,this.controls.minDistance,this.controls.maxDistance);
    },{passive:false});
    const pointers=new Map();let pinch=null;let multiGesture=false;
    canvas.addEventListener('pointerdown',event=>{canvas.focus({preventScroll:true});pointers.set(event.pointerId,[event.clientX,event.clientY]);if(pointers.size>1)multiGesture=true;else multiGesture=false;});
    canvas.addEventListener('pointermove',event=>{
      if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,[event.clientX,event.clientY]);
      if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch&&d>0)this.zoomTarget=zoomDistance(this.zoomTarget??this.camera.position.length(),this.focusRadius(),Math.log(pinch/d)*500,this.controls.minDistance,this.controls.maxDistance);pinch=d;}
    });
    for(const name of ['pointerup','pointercancel'])canvas.addEventListener(name,event=>{pointers.delete(event.pointerId);pinch=null;});
    canvas.addEventListener('keydown',event=>{if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight'].includes(event.code)){event.preventDefault();this.navigationKeys.add(event.code);}});
    canvas.addEventListener('keyup',event=>this.navigationKeys.delete(event.code));
    canvas.addEventListener('blur',()=>this.navigationKeys.clear());
    canvas.addEventListener('pointerdown', (event) => { this.pointerStart = { x: event.clientX, y: event.clientY }; });
    canvas.addEventListener('pointerup', (event) => {
      if (multiGesture || event.button!==0 || !this.pointerStart || Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 5) return;
      const item = this.pick(event);
      if (!item) { this.clearSelection(); return; }
      this.drawSelectedOrbit(null);
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
    const occupied = [];
    for (const label of this.labels) {
      const body = this.bodyNodes.get(label.id);
      if(body){
        body.root.getWorldPosition(position);
        const d=position.distanceTo(this.renderCamera.position)*this.renderUnit;
        const pixels=body.definition.radiusKm/Math.max(1,d)*height/Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
        body.marker.visible=this.showLabels&&pixels<11&&label.id!==this.focus.id;
      }
      if (!this.showLabels || !this.isVisible(label.object) || !label.object.parent) { label.element.hidden = true; continue; }
      label.object.getWorldPosition(position);
      const projected = position.clone().project(this.renderCamera);
      const onScreen = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < .95 && Math.abs(projected.y) < .93;
      const distance = position.distanceTo(this.renderCamera.position) * this.renderUnit;
      const radius = body?.definition.radiusKm || 0;
      const pixels = radius / Math.max(1, distance) * height / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      if (body) body.marker.visible = pixels < 11 && label.id !== this.focus.id;
      const closeToFocusedBody = body && label.id === this.focus.id && cameraDistance < radius * 35;
      const occluded = this.isOccluded(position, label.id);
      const px = (projected.x*.5+.5)*width, py = (-projected.y*.5+.5)*height;
      const overlap = occupied.some(([x,y]) => Math.abs(px-x)<155 && Math.abs(py-y)<35);
      label.element.hidden = !onScreen || occluded || overlap || closeToFocusedBody || (!body && !label.object.userData.item?.cosmic && !this.showMissions);
      if (!label.element.hidden) occupied.push([px,py]);
      if (!label.element.hidden) {
        label.element.style.transform = `translate3d(${(projected.x * 0.5 + 0.5) * width}px, ${(-projected.y * 0.5 + 0.5) * height}px, 0)`;
      }
    }
  }

  setExplorationData(data) {
    for(const node of this.surfaceNodes) {
      node.sprite.parent?.remove(node.sprite);node.sprite.material.map?.dispose();node.sprite.material.dispose();
      this.interactive=this.interactive.filter(x=>x!==node.sprite);
    }
    this.createSurfaceSites(data.sites.filter(x=>!x.noLocation));
    this.exploration=data;
  }

  makeCosmicMarker(item) {
    const marker = makeSprite(item, 'body');
    this.scene.add(marker); this.interactive.push(marker);
    this.addLabel(marker, item.name, item.kind === 'galaxy' ? 'GALAXIA' : 'ESTRUCTURA CÓSMICA', item.id);
    return marker;
  }

  isVisible(object) {
    for (let node=object; node; node=node.parent) if (!node.visible) return false;
    return true;
  }

  isOccluded(position, ownId) {
    const camera = this.renderCamera.position.toArray();
    for (const [id, body] of this.bodyNodes) {
      if (id === ownId || !body.root.visible) continue;
      const center = new THREE.Vector3(); body.root.getWorldPosition(center);
      if (segmentOccluded(camera, position.toArray(), center.toArray(), body.definition.radiusKm / this.renderUnit)) return true;
    }
    return false;
  }

  prepareRender() {
    this.renderUnit = renderingUnit(this.camera.position.length());
    this.scene.scale.setScalar(1 / this.renderUnit);
    if(this.cosmos?.unitPc)this.cosmos.unitPc.value=this.renderUnit/3.0856775814913673e13;
    for (const object of this.interactive) {
      if (object.userData.pixelSize) object.scale.setScalar(object.userData.pixelSize * this.renderUnit);
    }
    this.renderCamera.copy(this.camera);
    this.renderCamera.position.copy(this.camera.position).divideScalar(this.renderUnit);
    this.renderCamera.near = Math.max(1e-8, Math.max(.00001,(this.camera.position.length()-this.focusRadius())*.001) / this.renderUnit);
    this.renderCamera.far = Math.max(this.camera.position.length()*100, LY_KM*100000) / this.renderUnit;
    this.renderCamera.updateProjectionMatrix();
    this.renderCamera.updateMatrixWorld();
    this.scene.updateMatrixWorld(true);
  }

  navigateScale(stop) {
    const target = this.getFocusTargets().find(x=>x.id===stop.id);
    if (!target || !this.focusItem(target)) return;
    this.camera.position.normalize().multiplyScalar(stop.km);
    this.controls.update();
  }

  setZoomDistance(km) {
    this.camera.position.normalize().multiplyScalar(THREE.MathUtils.clamp(km,this.controls.minDistance,this.controls.maxDistance));
    this.controls.update();
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  updateNavigation(dt) {
    if(!this.controls.enablePan)return;
    const shift=this.controls.target.clone();
    if(this.navigationKeys.size){
      const forward=this.camera.getWorldDirection(new THREE.Vector3()),right=new THREE.Vector3().crossVectors(forward,this.camera.up).normalize(),up=this.camera.up.clone();
      const speed=this.camera.position.length()*dt*(this.navigationKeys.has('ShiftLeft')||this.navigationKeys.has('ShiftRight')?2:.3);
      for(const [key,vector,sign] of [['KeyW',forward,1],['KeyS',forward,-1],['KeyD',right,1],['KeyA',right,-1],['KeyE',up,1],['KeyQ',up,-1]])if(this.navigationKeys.has(key))shift.addScaledVector(vector,speed*sign);
    }
    if(shift.lengthSq()===0)return;
    const pan=this.controls.target.clone();this.camera.position.sub(pan);this.controls.target.set(0,0,0);
    const position=this.focusOrigin.clone().add(shift).toArray();
    const entering=this.focus.item?.id!=='free-flight';
    this.controls.minDistance=50;
    this.focus={type:'object',item:{id:'free-flight',name:'Exploración libre',kind:'region',cosmic:true,position,viewDistanceKm:this.camera.position.length()}};
    this.updateWorld(this.simulationDate);if(entering)this.onFocus?.(this.focus.item);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.1);
    if (this.running) {
      const time=this.liveTime?Date.now():this.simulationDate.getTime()+delta*1000*this.timeScale;
      const bounded=THREE.MathUtils.clamp(time,Date.parse('1957-10-04T00:00:00Z'),Date.parse('2050-12-31T23:59:59Z'));
      this.simulationDate=new Date(bounded);if(time!==bounded)this.running=false;
    }
    const now = performance.now();
    if (now - this.lastPositionUpdate > 250) {
      this.updateWorld(this.simulationDate);
      this.lastPositionUpdate = now;
    }
    if(this.zoomTarget!==null){const distance=interpolateZoom(this.camera.position.length(),this.zoomTarget,this.focusRadius(),delta);this.camera.position.setLength(distance);if(Math.abs(distance-this.zoomTarget)<Math.max(.000001,this.zoomTarget*1e-8))this.zoomTarget=null;}
    const radius=this.focusRadius(),altitude=Math.max(.08,this.camera.position.length()-radius);
    this.controls.rotateSpeed=radius?Math.min(.42,.42*altitude/radius):.42;
    this.controls.enablePan=this.camera.position.length()>LY_KM*.1 || !!this.focus.item?.cosmic;
    this.controls.update();
    this.updateNavigation(delta);
    this.updateCatalogPositions(this.simulationDate);
    this.updateVisibility();
    this.cosmos.update(this.focusOrigin, this.camera.position.length());
    this.prepareRender();
    this.earthTiles.update();
    this.updateLabels();
    const sun = this.bodyNodes.get('sun')?.surface;
    if (sun?.material.uniforms?.time) sun.material.uniforms.time.value += delta;
    this.onFrame?.(this.selected?.satrec ? this.selected : null, this.getStatus());
    this.renderer.render(this.scene, this.renderCamera);
  }
}
