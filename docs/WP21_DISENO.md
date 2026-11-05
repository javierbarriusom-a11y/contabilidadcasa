# WP-21 · Paquete Renta: informe fiscal de inversión (NIN-10) y del local alquilado (FIS-03)

Diseño escrito el 5/11/2026 (sesión 405), a petición del hogar: «sigue con cosas que no dependan de mí». Es el único paquete
del plan **sin empezar** (`BACKLOG_DEFINITIVO.md` §5.3, P2, Ola 3) y tiene fecha externa: **los datos de 2026 han de estar
listos antes del 31/3/2027**, antes de la campaña de la Renta 2026. Se puede construir entero con datos de ejemplo; los
euros del hogar entran después, igual que en WP-23.

**Repositorio público: ninguna cifra del hogar aquí.** Las que aparecen son de ejemplo.

## 1. Qué es y qué no es

**Es** el entregable que se lleva al asesor o a la declaración: por ejercicio y **por declarante** (tributación individual,
D2 del 3/10/2026), lo que tributa en la **base del ahorro** por la cartera, con el porqué de cada cifra y lo que falta.

| Bloque | Qué sale | De dónde |
|---|---|---|
| Transmisiones | Cada venta del año: fecha, posición, valor de transmisión, valor de adquisición (FIFO), ganancia o pérdida | FC1 (`fifoLedger` en `canonical-portfolio.js`), el libro de operaciones de WP-48 |
| Traspasos entre fondos | Listado aparte: **no tributan** (diferimiento, art. 94 LIRPF); conservan coste y fecha | `applyFundTransfer` / `isFundToFundTransfer` (`canonical-portfolio.js`) |
| Rendimientos del capital mobiliario | Dividendos e intereses: íntegro, retención española, retención en origen | **No existe**: registro nuevo (PR-0) |
| Integración y compensación | Saldo de ganancias y pérdidas, saldo de rendimientos, compensación entre ellos (25 %), pérdidas pendientes de los 4 años anteriores | FC3 (`yearEndCompensation`) **ampliado**: hoy no hace el 25 % cruzado (lo dice su comentario) |
| Doble imposición internacional | Deducción por la retención en origen, con su tope | FC4 (`canonical-dividend-tax.js`) |
| Cuota estimada | Escala del ahorro sobre la base liquidable del ahorro | Escala versionada (A15-5, `canonical-tax-tables.js`) |
| Aviso de bienes en el extranjero | Si los valores depositados fuera de España superan el umbral del modelo 720 | **No existe**: país del depositario por posición (PR-0) |
| Lo que falta | Ventas sin lotes, posiciones sin titular, dividendos sin retención declarada… | Cada motor dice por qué no calcula |

**No es:**
- **Un borrador del modelo 100.** No se citan números de casilla: cambian cada año. Se dice el concepto y la cifra.
- **Una recomendación.** Es un informe: el «qué hacer» antes del 31/12 ya es de WP-23 (campaña de fin de año) y XIN-02
  (vigía de la recompra).
- **La declaración de la nómina.** Las retenciones del trabajo son de WP-31, que espera al hogar.

## 2. Reglas fiscales que aplica (contrastadas el 5/11/2026, a reconfirmar en la sede de la AEAT en el PR-1)

| Regla | Qué dice | Fuente consultada | Estado |
|---|---|---|---|
| Escala del ahorro (territorio común) | 19 % hasta 6.000 €; 21 % de 6.000 a 50.000; 23 % de 50.000 a 200.000; 27 % de 200.000 a 300.000; 30 % desde 300.000. Única, sin mitad autonómica | Varias guías; la AEAT (novedades de la Ley 7/2024): efectos desde el 1/1/2025 | ✅ Confirmado el 5/11/2026 (§9) |
| Compensación (art. 49 LIRPF) | Primero dentro de cada bloque sin límite. El saldo negativo de un bloque se compensa con el positivo del otro **hasta el 25 %** de este. El cupo del 25 % **se comparte** entre las pérdidas del año y las arrastradas. Lo que sobra se arrastra **4 años**, en el mismo orden | Manual de la AEAT (campaña 2025, ap. 8.1.4: «no podrá superar conjuntamente el límite del 25 %») y guías AEDAF | ✅ Confirmado para 2025 el 5/11/2026 (§9); releer en el manual de 2026 |
| Arrastre | Las pérdidas pendientes se aplican de la más antigua a la más nueva | FC3 ya lo hace así (`canonical-portfolio.js`) | ✅ Ya en código, con prueba |
| Traspasos entre fondos | No tributan: el fondo de destino hereda coste y fecha | Art. 94 LIRPF; FC1 ya lo modela | ✅ Ya en código |
| Doble imposición internacional | Deducible la retención en origen **hasta** lo que esa renta pagaría aquí (art. 80 LIRPF) | FC4 ya lo hace | ✅ Ya en código |
| Bienes en el extranjero (modelo 720) | Obligación de informar si un **bloque** (cuentas, valores, inmuebles) supera **50.000 €** a 31/12. Las criptomonedas, en el **721** | Guías y comentarios tras la sentencia del TJUE (anuló las sanciones, no la obligación) | ⚠️ El informe **avisa**, no calcula el modelo. Reconfirmar umbral y fecha en la sede de la AEAT |
| Regla de recompra (art. 33.5 f y g) | Pérdida diferida si se recompra en 2 meses (12 en fondos no cotizados) | XIN-02 ya la aplica | ✅ El informe marca las pérdidas diferidas y no las suma |

Un parámetro sin confirmar **no se esconde**: el informe dice «estimado con la escala de X, sin confirmar» igual que hace
WP-23 con su hogar de ejemplo.

## 3. Huecos de datos (lo que hoy la app no guarda)

| Hueco | Por qué hace falta | Propuesta (PR-0) | ¿Necesita al hogar? |
|---|---|---|---|
| **Titular de cada posición** | Tributación individual: cada declarante tiene su informe y su escala | Campo `titular` en la posición: `javi`, `tere` o `conjunta` (50 % cada uno, la regla de bienes gananciales por defecto, editable) | Al teclear datos, no para construir |
| **Dividendos e intereses** | Son el otro bloque de la base del ahorro y la mitad de la compensación del 25 % | Registro por posición y fecha: íntegro, retención España, retención en origen y país | Igual |
| **País del depositario** | El aviso del 720 se hace por valores depositados fuera de España | Campo `depositario` (país) en la posición; vacío = «sin saber», nunca «España» por defecto | Igual |
| **Pérdidas pendientes de años anteriores** | FC3 ya las acepta (`priorLosses`), pero hoy por bloque no se distingue si vienen de ganancias o de rendimientos | Registro por año y bloque, tecleado una vez desde la Renta anterior | Igual |
| **Gastos de custodia y comisiones de venta** | Las comisiones de compra y venta forman parte del valor de adquisición o de transmisión; la custodia, no | Las comisiones, en la operación del libro de WP-48 (si no están ya); la custodia (INV15) se excluye a propósito | No |

Todos son **almacenes o campos nuevos en el navegador**: van en la copia (`BACKUP_LOCAL_STORES`, trampa 6) y, si tocan
el estado, con migración (trampa 7). Ninguno guarda nada fuera del dispositivo.

## 4. Piezas y PR

| PR | Qué | Dónde | Tamaño |
|---|---|---|---|
| **PR-0** · datos | Titular y depositario por posición; registro de dividendos e intereses; pérdidas pendientes por bloque. Formularios en Inversión › Cartera (titular y depositario en la ficha de la posición; dividendos en el libro de operaciones de WP-48) | `canonical-portfolio.js` (normalizar campos nuevos), `operaciones-ui.js`, migración del estado | ≈ 1,5 sesiones |
| **PR-1** · motor | `canonical-tax-report.js`, puro, sin DOM: por ejercicio y titular, transmisiones, traspasos, rendimientos, integración y compensación con el 25 % y el arrastre de 4 años **por bloque**, deducción por doble imposición (FC4), cuota estimada (escala versionada), aviso del 720 y «lo que falta». FC3 no se toca: el motor nuevo lo envuelve y añade el bloque de rendimientos | Módulo nuevo (trampa 4: `index.html`, `service-worker.js`, `build-public-site.mjs` y un consumidor real) | ≈ 2 sesiones |
| **PR-2** · pantalla y exportación | Herramientas avanzadas › Fiscal › «Informe para la Renta»: ejercicio y titular arriba, los bloques de §1 con su porqué plegado, «lo que falta» con el camino a cada dato, **Exportar CSV** y **Imprimir** (hoja de estilo de impresión, sin librería de PDF) | Vista nueva en su propio módulo (trampa 5); «uno entra, uno sale» (XGO-01): va dentro de Fiscal, sin titular nuevo en el menú | ≈ 1,5 sesiones |
| **PR-3** · FIS-03, local alquilado | Rendimientos del capital inmobiliario del local: ingresos, gastos deducibles, amortización y la actualización de la renta. Base general, no del ahorro | Depende de los datos del contrato del local (H-? por crear) | Fuera de este diseño: se diseña aparte |

**Orden y fechas:** PR-0 y PR-1 en noviembre o diciembre, con el hogar de ejemplo; PR-2 antes del 31/12, para que el
hogar vea el informe de 2026 provisional en enero; con los datos del año cerrados (dividendos de diciembre incluidos), el
informe definitivo **antes del 31/3/2027**.

## 5. Pruebas

- **Motor (PR-1), con cifras a mano:**
  - una venta con ganancia y un dividendo con retención: la cuota por tramos;
  - pérdidas de transmisiones que superan las ganancias: el 25 % del saldo de rendimientos, y el resto, arrastrado;
  - pérdidas de dos años anteriores que comparten el mismo cupo del 25 %;
  - un traspaso entre fondos: fuera de las transmisiones, y la venta posterior con el coste heredado;
  - una pérdida diferida por recompra (XIN-02): ni suma ni se arrastra;
  - una venta sin lotes: el ejercicio entero dice «no calculable» y por qué (como FC3 hoy);
  - una posición conjunta: 50 % en cada titular;
  - el 720: un depositario extranjero con valores por encima del umbral avisa; uno vacío dice «sin saber», no «no aplica».
- **Pantalla (PR-2):** e2e a 390 (`@safari`) y 1280 px con el hogar de ejemplo; axe en claro y oscuro; el CSV exportado se
  vuelve a leer y cuadra con lo que enseña la pantalla.
- **Privacidad:** el CSV sale del navegador solo cuando el hogar lo pide; nada viaja a ningún servidor.

## 6. Riesgos

- **Precisión legal.** Una cifra fiscal equivocada con aspecto de definitiva es peor que ninguna. Mitigación: cada regla con
  su fuente y su estado (§2), «estimado» en todas las cifras que dependan de una sin confirmar, y el aviso permanente de que
  no sustituye al asesor.
- **Construir sin datos.** Es el riesgo que la revisión de la Ola 1 señaló. Aquí se acepta porque hay fecha externa (31/3) y
  porque PR-0 añade justo los datos que faltan; si el hogar no los teclea, el informe sale incompleto y lo dice.
- **Superficie.** Va dentro de Fiscal, sin titular nuevo en el menú: XGO-01 no cambia.

## 7. Decisiones del hogar (ninguna bloquea construir)

1. ¿Las posiciones conjuntas son al 50 %? Por defecto sí (bienes gananciales); editable por posición.
2. ¿Hay valores depositados fuera de España (bróker extranjero)? Solo cambia si el aviso del 720 puede saltar.
3. ¿Hay pérdidas pendientes de la Renta 2022-2025? Se teclean una vez desde la declaración anterior.

---

Fuentes consultadas el 5/11/2026 (a reconfirmar en el PR-1 en la sede de la AEAT y el BOE):
[guiafiscal.es · tramos IRPF 2026](https://guiafiscal.es/irpf/tramos-irpf-2026/) ·
[vademecumlegal.es · gravamen de la base liquidable del ahorro](https://www.vademecumlegal.es/irpf/marginales/-cual-es-gravamen-base-liquidable-ahorro-irpf-10858) ·
[AEAT · manual Renta 2025, base imponible](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-ayuda-presentacion/irpf-2025/8-cumplimentacion-irpf/8_1-base-imponible-general-base-ahorro/8_1_1-base-imponible-general.html) ·
[AEDAF · guía práctica 2025, integración y compensación](https://aedaf.es/es/documentos/descarga/71868/guia-practica-de-los-impuestos-2025-09-integracion-y-compensacion-de-rentas-bases-minimos-y-cuotas) ·
[guiafiscal.es · compensar pérdidas y ganancias](https://guiafiscal.es/inversiones/compensar-perdidas-y-ganancias-irpf/) ·
[taxdown.es · modelo 720](https://taxdown.es/inversion-acciones-bolsa/modelo-720) ·
[legalfournier.com · umbral por bloques del 720](https://legalfournier.com/?p=2847).

## 8. PR-0a hecho (5/11/2026, sesión 406): titular y depositario de cada posición

- **Motor** (`canonical-portfolio.js`, `normalizePosition`): tres campos nuevos.
  - `titular`: `javi`, `tere` o `household`, que es conjunta y por defecto al 50 % (decisión 1 del §7, aún sin confirmar).
  - `depositario`: `espana` o `extranjero`.
  - `depositarioPais`: solo si está fuera de España.
  - Lo desconocido se queda vacío: nunca se asume un titular ni «España». Viajan en la posición, así que van en la copia y en la nube con el resto de la cartera, sin almacén nuevo.
- **Pantalla** (`renta-datos-ui.js`): «Datos para la Renta» en Inversión › Cartera, **plegado**: un `<details>` cerrado no suma titulares (XGO-01).
  - Se pinta al abrirlo, con una fila por posición: titular, dónde está depositada y el país (solo fuera de España).
  - Se guarda al elegir, con `saveIv1PositionsList`, la lista de siempre. Sin líneas en `app.js`.
  - Arriba dice cuántas posiciones tienen titular y a cuántas les falta el depositario.
- **Por qué una lista y no el formulario de alta:** las posiciones del hogar ya existen; marcarlas una vez cuesta menos que editarlas una a una.
- **Pruebas:** `tests/wp21-renta-datos.test.cjs` (4) y la e2e «WP-21 · Datos para la Renta» a 390 (`@safari`) y 1280 px: elegir, guardar y recargar.
- **Siguiente, PR-0b:** el registro de dividendos e intereses, y las pérdidas pendientes por bloque.

## 9. PR-0b hecho (5/11/2026, sesión 407): dividendos e intereses, y el bloque de cada pérdida arrastrada

- **Dividendos e intereses** (`renta-datos-ui.js`, dentro del mismo «Datos para la Renta», plegado):
  - Cada cobro guarda la fecha, el tipo (dividendo o interés), la posición o, si no la hay, de dónde viene (la cuenta remunerada) y su titular, el íntegro, la retención en España, la retención en origen y el país.
  - **Una retención en blanco es `null`, «sin declarar», nunca 0.** El informe la pedirá en «lo que falta»; no la inventa.
  - **El titular de un cobro es el de su posición**, leído al calcular: si el hogar cambia el titular de la posición, sus cobros lo siguen. Sin posición, el titular se declara con el cobro.
  - Por año: lo cobrado, lo retenido declarado y lo que falta (sin retención española, sin titular, retención en origen sin país).
  - Se quita con «Deshacer» (DEX4).
  - Vive en `scenarioSettings.wp21Rendimientos`, junto a `fc3PriorLosses`: misma copia y misma nube, sin almacén nuevo ni migración.
- **Por qué aquí y no en el libro de operaciones de WP-48, como decía el §4:** un interés de una cuenta no es una operación de ninguna posición, y el libro es por posición. Así, todo lo que el hogar teclea para la Renta queda en un solo sitio.
- **Pérdidas arrastradas por bloque** (Inversión › Fiscal, el formulario de siempre):
  - Dos campos nuevos: **bloque** (transmisiones o rendimientos) y **de quién es** (Javi o Tere). No hay «conjunta»: cada pérdida es de un declarante, que la arrastra en su Renta.
  - Las ya guardadas, sin bloque, se leen como **transmisiones**. No es un supuesto nuevo: el formulario solo admitía pérdidas patrimoniales.
  - FC3 (`yearEndCompensation`) **deja fuera las de rendimientos**: no pueden compensar plusvalías sin pasar por el cupo del 25 %, y eso es del motor del PR-1. Lo mismo en FC5 (otra venta este año) y en el aviso del coste de la deuda.
- **Arreglo de paso (PR-0a):** el campo «País» se veía también en las posiciones depositadas en España, porque el `display: grid` de la hoja ganaba al atributo `hidden`. Corregido con `.renta-datos label[hidden]`; la e2e lo comprueba ahora.
- **Pruebas:** `tests/wp21-renta-datos.test.cjs` pasa de 4 a 11, y una e2e nueva a 390 (`@safari`) y 1280 px: un dividendo y un interés, la recarga y «Quitar» con «Deshacer».
- **Las dos reglas pendientes del §2, reconfirmadas el 5/11/2026:**
  - **El tramo del 30 % rige desde el 1/1/2025.** Lo dice la página de novedades de la AEAT sobre la Ley 7/2024: «Con efectos desde el 1 de enero de 2025, la disposición final séptima de la Ley 7/2024, modifica la escala que se aplica a la parte de la base liquidable del ahorro». La escala, 19/21/23/27/30 % con cortes en 6.000, 50.000, 200.000 y 300.000 €, es la misma para 2025 y 2026. La discrepancia del §2 queda resuelta: las guías que decían 2026 se equivocaban.
  - **El cupo del 25 % es compartido.** El manual de la Renta 2025 de la AEAT (apartado 8.1.4) dice que la compensación de los saldos negativos de años anteriores, «junto con la de los saldos negativos de rendimientos de capital mobiliario de 2025, no podrá superar conjuntamente el límite del 25 %» del saldo positivo del otro bloque. Lo mismo en sentido inverso.
  - **Cómo se leyó:** a través de los extractos que el buscador da de esas dos páginas oficiales. La red de esta sesión no deja abrir `sede.agenciatributaria.gob.es` directamente. Antes del informe definitivo (marzo de 2027) hay que leer el manual de la campaña 2026 en la propia sede.
- **Siguiente, PR-1:** el motor `canonical-tax-report.js`, con estas dos reglas ya como «confirmadas».

## 10. PR-1 y PR-2 hechos (5/11/2026, sesión 407): el motor y la pantalla del informe

- **Motor** (`canonical-tax-report.js`, puro): `taxReport({ year, holder, positions, deferredBySale, rendimientos, priorLosses, savingsScale })`, por ejercicio y declarante (`javi` o `tere`).
  - **Transmisiones** del año con su parte (1, o 0,5 si es conjunta): valor de transmisión, de adquisición (FIFO) y resultado; la pérdida diferida por recompra (XIN-02) se resta y no se arrastra.
  - **Rendimientos** del año (PR-0b), con las dos retenciones.
  - **Compensación** (`compensate`): primero cada bloque dentro de sí; luego el cruce del año hasta el 25 %; luego las pendientes, de la más antigua a la más nueva, primero en su bloque y lo que quede en el otro con **el cupo que reste** del 25 %. Lo que no cabe se arrastra; lo de hace 4 años que no cabe, **caduca** y se dice.
  - **Cuota** con la escala del ahorro del hogar (Ajustes › Fiscal, tipo «ahorro», si es válida y del mismo año) o, si no, con la de la ley desde 2025 (siempre dice cuál). Antes de 2025 sin escala del hogar: sin cuota.
  - **Doble imposición:** lo retenido fuera, como mucho tipo medio × renta extranjera. Lo que excede se dice como «no se recupera aquí». El tope de cada convenio no se comprueba, y se avisa.
  - **720:** «pasa», «no pasa» o «sin saber» (alguna posición sin depositario). La conjunta cuenta **entera** para el umbral (criterio prudente: un cotitular declara el bien).
  - **Lo que falta:** cada motivo con su código. Los que **bloquean** la cuota (venta sin lotes o sin importe, posición o cobro sin titular, pérdida pendiente aún aplicable sin titular, sin escala) y los que **no** (sin retención española, retención en origen sin país).
- **Traspasos:** la app no guarda un historial de traspasos (`applyFundTransfer` cambia la posición sin dejar evento), así que no salen como ventas. Es lo correcto fiscalmente; el listado aparte del §1 queda para cuando exista ese historial.
- **Pantalla** (`informe-renta-ui.js`): «Informe de inversión para la Renta», **plegado dentro de la tarjeta «Borrador de apoyo para la Renta» (GOB8)** de Herramientas avanzadas › Fiscal. Es la parte de inversión que a ese borrador le faltaba; así no hay titular nuevo (XGO-01) ni se retira nada.
  - Ejercicio (el actual, «provisional», y los dos anteriores) y declarante.
  - Arriba, la frase con la base y la cuota, o «todavía no se puede dar la cuota» y lo que falta, cada cosa con **dónde se arregla**.
  - Tablas desplazables con el teclado (transmisiones, dividendos e intereses), la compensación paso a paso, la cuota y el aviso del 720.
  - **Exportar CSV** (punto y coma, coma decimal, con BOM para que la hoja de cálculo lea las tildes).
  - Notas fijas: no es el modelo 100; las ventas de fondos llevan retención que la app no guarda; la custodia de valores es deducible y no se resta.
  - **Imprimir** (añadido el mismo día): solo el informe, a todo el ancho de la hoja. Mientras imprime, el `<body>` lleva una clase y la hoja de impresión quita con `:has()` todo lo que ni contiene el informe ni está dentro de él; sus antepasados quedan como bloques sin márgenes. La clase se quita en `afterprint`.
  - **El texto del «Borrador de apoyo» (GOB8)** suma un punto 4 con una línea por declarante: base y cuota, o «todavía sin cuota» y cuántos datos faltan.
- **Pruebas:** `tests/wp21-informe-renta.test.cjs` (18, con las cifras del §5 hechas a mano), e2e «PR-2» a 390 (`@safari`) y 1280 px (lo que falta, la cuota al completarlo y el CSV descargado y releído), y axe en claro y oscuro con el informe abierto.
- **Lo que queda de WP-21:** que el hogar teclee sus datos (titulares, cobros, pérdidas con bloque); el listado de traspasos cuando haya historial; y el PR-3 (el local), que se diseña aparte.
