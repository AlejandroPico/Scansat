# ScanSat · Atlas del universo

**Versión 0.6.0-alpha** · [Abrir ScanSat](https://alejandropico.github.io/Scansat/) · [Portfolio](https://alejandropico.github.io/Portfolio/)

Exploración continua desde la Tierra y el tráfico orbital hasta las estrellas, las galaxias y el volumen del universo observable. La rueda recorre todas las escalas sin cambiar de aplicación. Los radios de los cuerpos y las distancias comparten una unidad física; los marcadores son ayudas de localización, no diámetros agrandados.

## Novedades de 0.6.0

- **Densidad volumétrica continua**, integrada a través de campos 3D de 128³ y 192³ celdas, con horizonte suavizado y transición entre escalas. Sustituye los puntos de densidad que producían una esfera delimitada y un centro sobreexpuesto. Paleta violeta/dorada de falso color. Es una representación pedagógica: el campo exterior es una realización gruesa independiente, no un mapa observado de todo el universo ni filamentos individuales resueltos a esa escala.
- **Flujos de Laniakea conservados**. Los sondeos de galaxias tienen algo más de luminosidad; las capas cercanas desaparecen gradualmente al dejar de resolverse, evitando apilar brillo en el centro.
- **Galaxias con colas de densidad y emisión difusa**, sin cortar el disco en un radio fijo. Andrómeda incorpora una fotografía óptica DSS2, con contorno atenuado y transición a la reconstrucción tridimensional cuando se observa desde otro ángulo o desde dentro. La fotografía es una proyección desde la Tierra, no una tomografía 3D.
- **Cielo fotográfico ESO de 6000 × 3000**, visible desde el sistema solar y su vecindad. La proyección sobre la esfera celeste se interpreta de forma aproximada: no se utiliza para astrometría. Se atenúa al abandonar la vecindad solar y da paso al modelo galáctico.
- **Exploración libre de la galaxia** con traslación, zoom y estrellas locales por sectores deterministas de 60 años luz. Solo se mantienen los sectores próximos a la cámara. Estas estrellas están identificadas como modeladas y son seleccionables; no sustituyen HYG ni afirman catalogar cientos de miles de millones de estrellas observadas. Inspiración funcional: navegación y búsqueda del mapa galáctico del manual oficial de Elite Dangerous; no se reutilizan sus recursos.
- **Tierra por teselas** Esri World Imagery, hasta nivel 19 y 80 metros de altura de cámara. La cobertura puede resolver calles y edificios donde el proveedor dispone de imágenes suficientes. Es una superficie esférica con imágenes: no hay edificios 3D, relieve de terreno ni Street View. El mosaico tiene fechas y resoluciones variables; la descarga necesita conexión.
- Capa opcional **NASA GIBS/MODIS del día anterior**, con superficie y nubes en una misma observación, resolución máxima aproximada de 250–300 m. Puede tener huecos o retrasos. No es meteorología en directo ni sigue el reloj histórico del simulador. Al fallar una tesela se mantiene la imagen disponible de menor detalle.
- **Zoom suave proporcional a la altura**, con pasos pequeños cerca de la Tierra y grandes a distancia cósmica. Cerca del suelo, la cámara acompaña la rotación terrestre.
- Herramientas compactas arriba a la derecha; reloj reducido a un icono, fecha y velocidad dentro del panel, inicio en hora del sistema a 1×. Foco pequeño arriba a la izquierda. Eliminada la barra inferior; estadísticas en Base de datos. Etiquetas ancladas al escenario, con ocultación efectiva y filtro en Capas.

Las siguientes secciones históricas describen versiones anteriores; los puntos de densidad y el mapa terrestre sin teselas de esas versiones quedan reemplazados por lo anterior.

## Novedades de 0.5.0

- **431.263 registros SDSS**, usando el mismo catálogo tridimensional público servido por WorldWide Telescope, y **43.380 registros 2MRS** con corrimiento al rojo utilizable. Se conserva la cobertura del sondeo: los conos vacíos no se rellenan con supuestas observaciones. Ambos catálogos pueden incluir la misma galaxia; 474.643 es el número de registros, no de galaxias únicas.
- Galaxias seleccionables, navegación hasta cada punto y fichas con procedencia y límites de distancia. Búsqueda por nombre NGC/2MASX o identificador SDSS completo. Carga automática al aproximarse a la escala correspondiente, o manual desde Capas para buscar antes de viajar.
- **Laniakea con datos Cosmicflows-4**: 204.381 segmentos integrados en el campo de velocidades publicado y 22.000 muestras de la envolvente de la cuenca. Dorado: semillas dentro de Laniakea; azul: fuera. No son enlaces entre galaxias, filamentos luminosos ni trayectorias históricas. Rejilla de velocidades 64³, cuencas 128³; h = 0,75. La resolución limita el detalle científico de las curvas.
- **Vía Láctea con 320.000 trazadores**: disco exponencial continuo, disco grueso, bulbo/barra, población joven de brazos irregulares, polvo y halo. Los espacios entre brazos siguen poblados. Andrómeda usa 80.000 trazadores; M87 tiene morfología elíptica.
- Eliminada la malla geométrica del horizonte y los enlaces rectos aleatorios. La densidad no observada usa **299.263 muestras** de un modelo pedagógico de Zel’dovich y **479.474 muestras** de agrupaciones exteriores estadísticamente homogéneas. Son muestras de densidad, no galaxias catalogadas. No son datos de Millennium ni una simulación de N cuerpos. Los colores indican densidad, no aspecto óptico.
- Capas independientes para 2MRS, SDSS, flujos CF4 y densidad. La densidad aparece después del volumen de galaxias y no suplanta los sondeos cercanos. A escala del horizonte, la estructura pequeña deja de resolverse, sin agrandar artificialmente los filamentos.
- Órbitas de planetas y lunas activadas inicialmente, magnitud estelar **8,5** (mitad de 3–14), cierre/desselección que elimina la órbita seleccionada y eliminación de la barra inferior de navegación. Se mantienen rueda, pellizco, búsquedas y selector de foco.

## Base incorporada en 0.4.0

- Zoom continuo hasta cuatro radios del universo observable, con origen relativo al foco y unidades de dibujo adaptativas. El cambio de unidad conserva las proporciones y evita enviar distancias cósmicas sin normalizar a la cámara gráfica.
- Accesos a Tierra, Luna, sistema solar, vecindad estelar, Vía Láctea, Grupo Local, Laniakea y universo observable; control de distancia logarítmico y regreso directo a la Tierra.
- **109.400 estrellas HYG v4.1 con distancia utilizable**: búsqueda por nombre, HIP, HD o HYG, selección en la escena, foco y ficha individual. Se excluyen el Sol duplicado y los registros con distancias ausentes/dudosas (`dist >= 100000 pc`). Las estrellas son puntos de localización: no se inventan radios estelares que el catálogo no proporciona.
- Brillo estelar dependiente de la magnitud absoluta y la distancia de la cámara, colores orientativos B−V, límite de magnitud ajustable y posición J2000 fija.
- Referencias para galaxias cercanas, cúmulos, Gran Atractor, Laniakea y Shapley, ampliadas con los sondeos y campos de la versión 0.5.0.
- **466 registros GCAT de cargas útiles de espacio profundo y 469 registros de aterrizajes, impactos y componentes**. De estos últimos, **349 tienen coordenadas y un cuerpo representado**, por lo que se sitúan en la escena. Son registros de objetos/eventos, no 935 misiones independientes.
- Enciclopedia ampliada con planetas y lunas, estrellas, galaxias, cosmología, misiones, superficie, historia, fuentes y explicaciones del modelo. Permite consultar también cualquier satélite orbital cargado. La lista estelar muestra hasta 120 coincidencias para mantener la interfaz ágil.
- Roman incorporado en **L2 como destino previsto de despliegue**, no como posición de tránsito o confirmación de llegada. Incluye fuente NASA y fecha de lanzamiento del 30 de agosto de 2026. Añadido Aditya-L1 como modelo aproximado de L1.
- Corrección del efecto de transparencia: todos los materiales personalizados comparten la profundidad logarítmica de Three.js; los marcadores respetan la profundidad y las etiquetas comprueban la ocultación planetaria.
- Tierra con mosaico global NASA Blue Marble en color natural de 2048 × 1024, superficie opaca, terminador y luces nocturnas. Sigue siendo un mosaico global, sin teselas de detalle urbano ni meteorología en directo.
- Mapas NASA para Fobos, Deimos, Ío, Europa, Ganímedes, Calisto, Encélado, Titán y Tritón. Fobos y Deimos mantienen una geometría esférica de radio equivalente, no un modelo exacto de su forma.
- Venus muestra una cubierta nubosa uniforme en lugar de presentar un mapa radar como aspecto óptico exterior.
- Marcadores discretos, etiquetas con separación, órbitas planetarias configurables y control independiente de estrellas, galaxias, red cósmica, etiquetas y componentes de superficie.
- Límites de validez separados: las sondas con vectores JPL se ocultan fuera de ±2 días de su época, en vez de extrapolarlas durante décadas; los GP terrestres conservan su ventana de ±14 días. Roman se identifica explícitamente como destino.

## Controles

| Acción | Resultado |
|---|---|
| Arrastrar / gesto táctil | Girar alrededor del foco |
| Rueda / pellizco | Zoom suave, proporcional a la altura sobre el cuerpo o a la distancia en el espacio |
| W/A/S/D, Q/E | Traslación libre y vertical en escalas estelares; clic previo en el visor |
| Shift / arrastre derecho | Acelerar traslación / desplazar el foco en el espacio |
| Clic en objeto / vacío | Abrir ficha / quitar selección y su órbita |
| Cerrar ficha | Quitar selección y su órbita, conservando las órbitas generales |
| Doble clic | Centrar un cuerpo, estrella, misión o estructura |
| Selector FOCO | Buscar planetas, estrellas, HIP/HD/HYG, galaxias y misiones |
| Base de datos o `/` | Buscar también satélites por nombre o NORAD |
| Botón de diana | Volver a la Tierra |
| Capas | Regular objetos, etiquetas, órbitas y magnitud estelar |
| Enciclopedia | Buscar, filtrar, consultar fuentes y localizar objetos disponibles |
| Reloj | Pausar, cambiar fecha UTC y velocidad; intervalo solar 1957–2050 |

## Qué es observado y qué es reconstruido

| Contenido | Fuente / representación | Límite práctico |
|---|---|---|
| Satélites y residuos terrestres | CelesTrak, OMM + SGP4 | Catálogo público activo y tres nubes de residuos, no todos los objetos existentes |
| Planetas | Elementos aproximados NASA/JPL | No es una integración numérica de alta precisión |
| Lunas y orbitadores locales | Parámetros orbitales aproximados | Fases y trayectorias simplificadas |
| Sondas destacadas | Vectores heliocéntricos J2000 NASA/JPL Horizons | Instantánea con extrapolación lineal local de hasta dos días |
| L1/L2 y destinos | Modelo Sol–Tierra | Los modelos de halo y el destino Roman no son efemérides operacionales |
| Estrellas | HYG v4.1, época J2000 | Distancias con incertidumbre; no incluye todas las estrellas ni el catálogo Gaia completo |
| Vía Láctea y formas galácticas | Modelo de disco, bulbo y brazos | Partículas ilustrativas; no estrellas/galaxias individuales observadas |
| Galaxias y cúmulos nombrados | Referencias de dirección y distancia aproximadas | La muestra no es un sondeo exhaustivo; Laniakea es una región, sin centro físico único |
| Galaxias 2MRS | Huchra et al. 2012 / CDS VizieR | cz > 600 km/s; distancia comóvil ΛCDM H₀=73, Ωm=0,3, ΩΛ=0,7; sin corregir velocidades peculiares |
| Galaxias SDSS | Catálogo binario WWT, distancias Mpc/h convertidas con h=0,73 | Huella incompleta; glifos de localización, no tamaños ni orientaciones medidos |
| Laniakea / flujos | Campo no agrupado CF4 (Courtois 2023), cuenca 1 (Dupuy y Courtois 2023) | Reconstrucción suavizada; diferencias entre soluciones; no evolución orbital |
| Red cósmica | Aproximación de Zel’dovich pedagógica y agrupaciones estadísticas exteriores | No medida, sin espectro ajustado, N cuerpos, gas o cono de luz cosmológico |
| Universo observable | Radio comóvil actual aproximado de 46.500 millones de años luz | Vista conceptual externa, no una fotografía ni el borde de todo el universo |
| Historia y superficie | GCAT de Jonathan McDowell | Los registros históricos no aportan por sí solos trayectorias continuas actuales |

La escala espacial común no convierte posiciones aproximadas en exactas. El reloj no reconstruye la evolución cosmológica ni mueve las estrellas de J2000; tampoco reproduce todos los vuelos históricos. Los lugares de superficie con fecha conocida aparecen a partir de su evento. El archivo histórico completo de elementos terrestres y las trayectorias históricas de cada sonda siguen requiriendo datos adicionales.

## Fotografías y mapas de detalle

- [Panorama ESO eso0932a](https://www.eso.org/public/images/eso0932a/): **ESO/S. Brunier**, CC BY 4.0. Fotografía de larga exposición, no brillo percibido a simple vista. [Condiciones ESO](https://www.eso.org/public/outreach/copyright/).
- [Andrómeda DSS2 / heic1502b](https://esahubble.org/images/heic1502b/): **NASA, ESA, Digitized Sky Survey 2 (Acknowledgement: Davide De Martin)**, CC BY 4.0. Proyección y máscara suave realizadas en el visor; se conserva el JPEG original. [Condiciones ESA/Hubble](https://esahubble.org/copyright/).
- [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9): Esri, Vantor, Earthstar Geographics y GIS User Community. Servicio externo con sus propias condiciones y disponibilidad. No se redistribuyen sus teselas en el repositorio.
- [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/access-basics/): MODIS Terra Corrected Reflectance True Color, WMTS EPSG:3857. Los casquetes fuera de ±85,051° conservan el mapa global de respaldo.
- [Manual oficial de Elite Dangerous](https://hosting.zaonce.net/elite/website/assets/ELITE-DANGEROUS-GAME-MANUAL.pdf), páginas del mapa galáctico: referencia de controles y navegación, no fuente científica o licencia de sus imágenes.

## Fuentes y licencias de datos

Los datos científicos conservan la atribución y las condiciones de sus proveedores; la licencia MIT del código no los relicencia. Los archivos de `public/data/cosmography/metadata.json` incluyen formato, parámetros, exclusiones, enlaces originales y SHA-256 de las entradas. `density-metadata.json` distingue el modelo generado de los catálogos.

- [SDSS / DR7](https://classic.sdss.org/dr7/), catálogo público de [WorldWide Telescope](https://worldwidetelescope.org/wwtweb/catalog.aspx?Q=cosmosnewbin). Decodificación contrastada con [`Galaxy` y `Grids` del motor WWT](https://github.com/WorldWideTelescope/wwt-webgl-engine/tree/master/engine/esm). Se retienen los IDs de 64 bits sin redondearlos como `Number` y el factor h=0,73 del motor. No se reutilizan imágenes de galaxias WWT.
- [2MRS / Huchra et al. 2012](https://heasarc.gsfc.nasa.gov/w3browse/all/twomassrsc.html), distribuido por [CDS VizieR, J/ApJS/199/26](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/199/26). Se conservan identificadores y magnitud Ks; se excluyen distancias no utilizables. [Condiciones de VizieR](https://cds.unistra.fr/vizier-org/licences_vizier.html).
- [Cosmicflows, rejillas públicas](https://projets.ip2i.in2p3.fr/cosmicflows/): [Courtois et al. 2023](https://arxiv.org/abs/2211.16390) y [Dupuy y Courtois 2023](https://arxiv.org/abs/2305.02339). Arrays ZYX y componentes XYZ, velocidades multiplicadas por 52 según el proveedor; RK2 con paso de 2 Mpc/h. Envolvente muestreada de la cuenca publicada, no una frontera exacta. Las rejillas de velocidad y cuenca tienen distinta resolución.
- [ESA, anatomía de la Vía Láctea](https://sci.esa.int/web/gaia/-/58206-anatomy-of-the-milky-way), para las poblaciones del disco, bulbo, barra y halo.
- [Hidding et al., aproximación de Zel’dovich](https://academic.oup.com/mnras/article/437/4/3442/1005676), base conceptual del modelo pedagógico; [Millennium / MPA](https://wwwmpa.mpa-garching.mpg.de/galform/virgo/millennium/) permite distinguir las visualizaciones de densidad de un catálogo observado. ScanSat no importa sus partículas ni sus imágenes.

- [CelesTrak](https://celestrak.org/) y [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/).
- [HYG v4.1 / David Nash](https://github.com/astronexus/HYG-Database): **CC BY-SA 4.0**. `public/data/stars.json` es un subconjunto transformado, conserva esa licencia y la atribución. El código de ScanSat mantiene su licencia MIT.
- [GCAT / Jonathan C. McDowell](https://planet4589.org/space/gcat/): **CC BY 4.0**. `public/data/exploration.json` es una extracción normalizada de `deepcat.tsv` y `landercat.tsv`, con campos de origen, fechas y notas; instantánea del 8 de septiembre de 2026.
- [NASA Blue Marble](https://svs.gsfc.nasa.gov/2915/), [LROC/LOLA](https://svs.gsfc.nasa.gov/4720/) y [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources). NASA/GSFC y autores originales. Los mapas no son fotografías actuales; pueden incluir mosaicos, realces y zonas incompletas. El Sol conserva una visualización en falso color STEREO/SDO, no una fotografía de su fotosfera en luz visible.
- [Laniakea — Tully et al., 2014](https://arxiv.org/abs/1409.0880) y [NASA, descripción del universo](https://science.nasa.gov/universe/overview/), para el contexto de las grandes escalas.

## Reproducir la cosmografía

Las instantáneas comprimidas están versionadas: el build y el visor no consultan a WWT, CDS o Cosmicflows en directo. Solo se descargan del propio sitio las capas necesarias, y se descomprimen con `DecompressionStream` del navegador. Se requiere un navegador moderno con WebGL2 y soporte gzip en esa API. Los perfiles de galaxias son ayudas visuales con tamaño mínimo en pantalla.

Con Python 3, NumPy y SciPy, desde la raíz:

```bash
python scripts/import-cosmography.py --cache /ruta/a/cache
python scripts/build-density-model.py  # archivos de la versión anterior
python scripts/build-volume-fields.py  # campos usados desde 0.6.0
```

La importación conserva las rejillas originales y verifica formato, rangos y pertenencia del origen a Laniakea. El modelo de densidad tiene semilla fija y una caja de 2000 Mpc. Su realización no está constreñida por galaxias observadas. El universo exterior se homogeneiza estadísticamente; no se extiende una misma arista hasta decenas de miles de millones de años luz.

## Desarrollo y comprobación

Node.js 24 o compatible:

```bash
npm ci
npm run dev
npm test
npm run validate
npm run build
```

Los recursos se descargan antes del build. Se valida su firma para evitar guardar una respuesta HTML como textura. Las imágenes y modelos descargados están excluidos de Git; los catálogos derivados sí están versionados. El build no depende de que HYG o GCAT respondan en ese momento.

Actualizar los catálogos orbitales:

```bash
npm run data:update
```

Reproducir las importaciones astronómicas, tras descargar los originales citados:

```bash
python scripts/import-stars.py /ruta/hygdata_v41.csv
python scripts/import-exploration.py /ruta/deepcat.tsv /ruta/landercat.tsv
```

Las pruebas cubren conservación de escala, transformaciones de coordenadas, ocultación geométrica, selección a distintas distancias, soporte de profundidad logarítmica, integridad de catálogos y geometría cósmica finita, además de los cálculos orbitales anteriores. No sustituyen una prueba visual de cada dispositivo.

## Publicación y arquitectura

- GitHub Pages, con publicación desde `main` mediante `.github/workflows/deploy-pages.yml`.
- El flujo existente de datos refresca CelesTrak y Horizons tres veces al día.
- Vite, Three.js, `satellite.js`, D3 Geo y Natural Earth.
- `src/cosmic-data.js`: unidades, coordenadas, referencias y escalas.
- `src/cosmic-scene.js`: estrellas HYG y modelos de grandes estructuras.
- `src/scene.js`: sistema solar, objetos orbitales, foco y cámara normalizada.
- `src/picking.js` y `src/shader-support.js`: selección física y profundidad compartida.
- `src/encyclopedia.js`: fichas y categorías; importadores reproducibles en `scripts/`.

## Historial

- **0.6.0-alpha** — volúmenes difusos, fotografías ESO/DSS2, vuelo galáctico por sectores, teselas terrestres y herramientas flotantes.

- **0.5.0-alpha** — sondeos SDSS/2MRS, Laniakea CF4, nuevas poblaciones galácticas, densidad multiescala y correcciones de controles.
- **0.4.0-alpha** — atlas multiescala, HYG, GCAT, enciclopedia ampliada, Laniakea/red cósmica, Roman, ocultación corregida y mapas lunares.
- **0.3.0-alpha** — barra superior, paneles derechos, tiempo reversible, Luna LROC/LOLA, Sol STEREO/SDO y anillos de Saturno.
- **0.2.1-alpha** — instantáneas de residuos particionadas y verificadas.
- **0.2.0-alpha** — escena solar continua, JPL Horizons, Lagrange, residuos y misiones de superficie.
- **0.1.0-alpha** — primera versión orbital con CelesTrak.
