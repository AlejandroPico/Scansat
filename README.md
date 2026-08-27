# ScanSat

**Versión 0.1.0 · Alfa**

ScanSat es un atlas orbital tridimensional para explorar satélites activos, constelaciones, estaciones espaciales y misiones más allá de la Tierra desde una única interfaz. El foco inicial está en el tráfico alrededor de la Tierra: la aplicación incluye una instantánea completa del conjunto público **Active Satellites** de CelesTrak y propaga cada órbita al instante visualizado mediante **SGP4**.

**Web:** [alejandropico.github.io/Scansat](https://alejandropico.github.io/Scansat/)

## Qué incluye la alfa 0.1.0

- Globo 3D interactivo con navegación por ratón, táctil y zoom.
- **16.472 objetos activos** en la instantánea inicial OMM del 27 de agosto de 2026.
- Posiciones propagadas en tiempo real con `satellite.js` y el modelo SGP4.
- Compatibilidad con identificadores NORAD de seis o más cifras mediante **CCSDS OMM JSON**, evitando la limitación histórica del formato TLE.
- Capas de Tierra: satélite, político plano y noche.
- Filtros por régimen orbital: LEO, MEO, GEO y HEO/otros.
- Filtros automáticos para Starlink, OneWeb, Amazon Leo/Kuiper, Qianfan, Guowang, GPS, Galileo, GLONASS, BeiDou, meteorología, ciencia, observación terrestre, estaciones y comunicaciones.
- Búsqueda por nombre, número NORAD o designador internacional.
- Selección directa de puntos con ficha orbital, posición actual, altitud, velocidad, inclinación, periodo, órbita y epoch.
- Trazado de la órbita seleccionada y huella máxima de visibilidad estimada.
- Vista Tierra, entorno lunar y sistema solar esquemático con misiones de espacio profundo.
- Biblioteca inicial de constelaciones, navegación, estaciones, observación y sondas.
- Temas Mañana, Tarde, Noche y Automático según la hora local.
- Diseño adaptable a escritorio, móvil y móvil horizontal.
- Favicon propio, manifiesto instalable y panel Acerca de.

## Precisión y escalas

La posición de los objetos terrestres se calcula desde los elementos OMM de CelesTrak con SGP4. Es una visualización científica y educativa, no una herramienta de navegación u operación espacial.

Para que LEO, MEO, GEO y las órbitas elípticas puedan entenderse simultáneamente, las **altitudes se comprimen de forma no lineal**. La Tierra mantiene su forma, pero la distancia visual de cada punto no constituye una escala lineal.

Las vistas lunar y del sistema solar son **esquemáticas en esta primera alfa**. Muestran cuerpos, tipos de órbita y contexto de misión, pero todavía no consumen efemérides SPICE/Horizons. Esta distinción también se indica dentro de la interfaz.

## Datos orbitales

El archivo `public/data/active.json` procede de:

```text
https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=JSON
```

La aplicación no solicita miles de elementos desde cada navegador. GitHub Actions obtiene una sola instantánea cada ocho horas como máximo, la valida y solo la incorpora cuando es correcta y diferente. Si CelesTrak limita temporalmente una descarga, se conserva el último catálogo válido.

## Arquitectura

```text
Scansat/
├── .github/workflows/       # despliegue y actualización orbital
├── public/
│   ├── data/                # instantánea OMM y metadatos
│   └── textures/            # Tierra y Luna optimizadas
├── scripts/                 # actualización y validación
├── src/
│   ├── app.js               # estado e interfaz
│   ├── catalog.js           # clasificación y biblioteca
│   ├── data-service.js      # carga progresiva del catálogo
│   ├── scene.js             # motor 3D y propagación
│   └── styles.css           # sistema visual adaptable
├── tests/                   # pruebas de clasificación orbital
├── favicon.svg
└── index.html
```

## Desarrollo local

Requiere Node.js 24 o superior.

```bash
npm install
npm run dev
```

El paso previo descarga una vez las texturas cartográficas públicas necesarias; no se almacenan binarios redundantes en el repositorio.

Comprobación completa:

```bash
npm test
npm run validate
npm run build
```

## Fuentes y atribuciones

- Elementos orbitales: [CelesTrak](https://celestrak.org/) a partir de datos públicos de 18 SDS/USSF.
- Propagación: [satellite.js](https://github.com/shashwatak/satellite-js).
- Fronteras: [Natural Earth](https://www.naturalearthdata.com/) mediante `world-atlas`.
- Textura nocturna: NASA Earth Observatory, Black Marble 2016.
- Texturas diurna y lunar: recursos de ejemplo de Three.js basados en cartografía pública de NASA.
- Renderizado 3D: [Three.js](https://threejs.org/).

## Próximas fases

1. Efemérides reales NASA JPL Horizons/SPICE para sondas, Lagrange y órbitas planetarias.
2. Catálogos lunares, marcianos y de otros cuerpos con fuentes específicas.
3. Lanzamientos en curso, etapas y trayectorias de ascenso cuando exista telemetría pública.
4. Planos y generaciones detalladas de megaconstelaciones.
5. Huellas de cobertura por carga útil, elevación mínima y banda de frecuencia.
6. Estaciones terrestres, pasos visibles y observación desde una ubicación elegida.
7. Línea temporal, reentradas, lanzamientos recientes y evolución histórica.

## Autor

Proyecto de [Alejandro Pico](https://alejandropico.github.io/). Código y seguimiento en [GitHub](https://github.com/AlejandroPico/Scansat).
