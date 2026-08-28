# ScanSat

Atlas tridimensional del tráfico orbital público y de la exploración del sistema solar.

**Versión actual: `0.3.0-alpha`**

- Aplicación: <https://alejandropico.github.io/Scansat/>
- Portfolio: <https://alejandropico.github.io/Portfolio/>
- Repositorio: <https://github.com/AlejandroPico/Scansat>

## Qué incluye la versión 0.3.0

ScanSat ya no separa Tierra, Luna y sistema solar en escenas diferentes. Todo comparte una escena continua con coordenadas en kilómetros y foco inicial en la Tierra:

- barra superior compacta y estática, con botones independientes para base de datos, capas, filtros, tiempo, tema, biblioteca y acerca de;
- panel de herramientas desplegable desde la derecha, sin ocupar permanentemente espacio de la escena;
- doble clic sobre un cuerpo, punto de Lagrange, sonda o satélite para centrarlo;
- selector de foco para navegar directamente a planetas, lunas, misiones o un NORAD;
- radios planetarios y distancias orbitales físicas, sin comprimir GEO, la Luna o los planetas;
- posiciones planetarias calculadas con los elementos aproximados publicados por NASA/JPL;
- selector UTC, saltos de hora/día y velocidades entre −86.400× y 86.400× para recorrer el sistema solar entre Sputnik 1 y 2050;
- Sol con radio físico: su tamaño angular cambia correctamente al observarlo desde otros planetas;
- Sol renderizado con mapa de observación STEREO/SDO, granulación animada, resplandor y corona;
- Tierra opaca con rotación sideral 1×, NASA Blue Marble, iluminación solar, terminador día/noche, luces urbanas y nubes con transparencia real;
- Luna con mapa global de color LROC, relieve LOLA y rotación síncrona orientada hacia la Tierra;
- Saturno con anillos radiales diferenciados, incluida la división de Cassini;
- catálogo terrestre OMM propagado con SGP4 y marcadores circulares más nítidos;
- capa de basura espacial con las nubes públicas FENGYUN 1C, IRIDIUM 33 y COSMOS 2251;
- puntos Sol–Tierra L1–L5 y observatorios de L1/L2, incluido James Webb;
- efemérides heliocéntricas de sondas destacadas obtenidas de NASA/JPL Horizons;
- orbitadores lunares y marcianos con periodos 1× aproximados, no animaciones aceleradas;
- lugares de alunizaje, rovers de la Luna y Marte, y aterrizadores históricos de Venus;
- iconos discretos y específicos para sondas, rovers, aterrizadores y puntos de Lagrange;
- temas automático, mañana, tarde y noche con iconografía propia;
- texturas planetarias auténticas de NASA/JPL/USGS y modelos oficiales de NASA 3D Resources;
- biblioteca de constelaciones, navegación, meteorología, ciencia, estaciones y espacio profundo.

Los iconos de planetas y misiones lejanas mantienen un tamaño legible en pantalla. Son ayudas de interfaz: las mallas de los cuerpos y sus posiciones no se agrandan artificialmente.

## Datos y precisión

| Capa | Fuente | Modelo |
|---|---|---|
| Objetos terrestres activos | CelesTrak / 18 SDS, CCSDS OMM JSON | SGP4 mediante `satellite.js` |
| Residuos destacados | CelesTrak, tres grandes nubes públicas | SGP4 mediante `satellite.js` |
| Planetas | NASA/JPL Solar System Dynamics | Elementos keplerianos aproximados, limitados en la interfaz a 1957–2050 |
| Sondas y observatorios | NASA/JPL Horizons API | Vectores heliocéntricos J2000, refrescados por GitHub Actions |
| Lunas y orbitadores locales | Parámetros orbitales publicados | Aproximación kepleriana/circular a velocidad temporal 1× |
| Tierra | NASA Blue Marble / Black Marble | Superficie diurna, luces nocturnas, terminador físico y nubes |
| Luna | [NASA CGI Moon Kit — LROC/LOLA](https://svs.gsfc.nasa.gov/4720) | Color global y elevación derivados de Lunar Reconnaissance Orbiter |
| Sol | [NASA Full Map of the Sun — STEREO/SDO](https://svs.gsfc.nasa.gov/30362) | Mapa EUVI/AIA 304 Å combinado con sombreado procedural |
| Otros cuerpos | NASA 3D Resources, NASA/JPL, USGS | Mapas equirectangulares y modelos GLB oficiales |

La instantánea OMM descargada representa el entorno terrestre **actual**. La versión 0.3.0 calcula una época central del catálogo y solo muestra esos objetos dentro de una ventana de ±14 días; al elegir una fecha lejana los oculta en vez de extrapolar durante décadas y generar órbitas falsas.

Una reconstrucción histórica completa sí es viable, pero requiere otro almacén de datos. `GP_History` de [Space-Track](https://www.space-track.org/documentation) conserva elementos generales históricos, y [CelesTrak mantiene archivos NORAD](https://celestrak.org/NORAD/archives/). La siguiente fase deberá descargar, indexar y servir el elemento más próximo a cada fecha; entonces podrán reproducirse Sputnik, misiones Shuttle y satélites ya reentrados con rigor.

El catálogo puede mostrar objetos militares **públicamente catalogados** —por ejemplo, designaciones `USA` o `COSMOS`—, pero ScanSat no incorpora información secreta, restringida ni fuera de fuentes abiertas.

Las posiciones son educativas y no deben utilizarse para navegación, predicción de conjunciones ni operaciones espaciales. Para cálculos científicos de alta precisión debe consultarse directamente JPL Horizons u otra efeméride operacional.

## Controles

- Arrastrar: orbitar la cámara alrededor del foco.
- Rueda o gesto: viajar desde escala orbital hasta escala planetaria/solar.
- Clic: abrir la ficha de un objeto.
- Doble clic: convertirlo en el nuevo foco.
- Selector superior: buscar un planeta, una luna, una misión o un identificador NORAD.
- Botones superiores derechos: abrir base de datos, capas, filtros, control temporal, tema, biblioteca y acerca de.
- Reloj: elegir una fecha UTC, saltar ±1 hora o ±1 día, pausar y variar la velocidad o el sentido del tiempo.
- Botón de diana: restablecer la cámara alrededor del foco actual.
- Botón de órbita: saltar al Sol para obtener una visión general.
- Volver a ahora: restaura el instante presente y la velocidad 1×.

## Desarrollo local

Requiere Node.js 24 o compatible.

```bash
npm ci
npm run dev
```

Comprobación de producción:

```bash
npm test
npm run validate
npm run build
```

Actualización manual de datos:

```bash
npm run data:update
```

`assets:prepare` descarga durante el desarrollo o el build las texturas y modelos oficiales. Se excluyen del repositorio para evitar duplicar binarios de terceros; GitHub Actions los vuelve a preparar antes de desplegar.

## Automatización y despliegue

- `.github/workflows/deploy-pages.yml` prueba, compila y publica `dist/` en GitHub Pages con cada cambio en `main`.
- `.github/workflows/update-orbital-data.yml` refresca el catálogo CelesTrak y las efemérides JPL tres veces al día.
- Las instantáneas solo se escriben cuando superan validaciones mínimas, de modo que un fallo remoto no sustituye datos válidos.
- La instantánea de residuos se divide en cuatro partes validadas para que ningún límite de transporte pueda truncar el catálogo durante el despliegue.

## Arquitectura

- Vite y JavaScript ES modules.
- Three.js con `logarithmicDepthBuffer` y origen flotante alrededor del foco actual.
- `satellite.js` para OMM/SGP4.
- D3 Geo, TopoJSON y Natural Earth para la capa política.
- GitHub Pages y GitHub Actions para despliegue y refresco de datos.

## Hoja de ruta

- teselas cartográficas progresivas para llegar a escala de calle sin inflar el paquete inicial;
- trayectorias de lanzamientos y eventos de vuelo en vivo cuando exista una fuente pública fiable;
- archivo histórico indexado a partir de Space-Track `GP_History`, con selección del elemento orbital más próximo a cada instante;
- línea temporal de lanzamientos, reentradas y misiones tripuladas históricas;
- más nubes de residuos y catálogos adicionales con licencias compatibles;
- efemérides de más misiones planetarias y asteroides;
- modelos 3D detallados para estaciones, sondas, rovers y telescopios;
- comparación simultánea entre fechas y marcadores de eventos.

## Historial

- **0.3.0-alpha** — nueva barra superior y paneles derechos, navegación temporal reversible, validación de época GP, Luna LROC/LOLA, Sol STEREO/SDO, Tierra opaca, nubes corregidas, anillos de Saturno y nueva iconografía.
- **0.2.1-alpha** — corrige el despliegue del catálogo de residuos mediante instantáneas particionadas y verificadas en CI.
- **0.2.0-alpha** — escena solar continua, escalas físicas, navegación por foco, JPL Horizons, Lagrange/JWST, terminador terrestre, basura espacial y misiones de superficie.
- **0.1.0-alpha** — primera versión con globo terrestre, catálogo activo CelesTrak, filtros, fichas y vistas esquemáticas separadas.

## Licencia y atribución

Código del proyecto bajo licencia MIT. Las fuentes de datos y recursos visuales conservan sus respectivas condiciones y atribuciones. NASA 3D Resources indica que sus activos son de libre descarga y uso; deben respetarse las directrices de uso de imágenes y marca de NASA.
