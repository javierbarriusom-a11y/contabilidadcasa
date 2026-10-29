# Backlog definitivo — Contabilidadcasa

**Creado el 3 de octubre de 2026 (sesión 296), a petición del hogar:** «genérame el backlog definitivo y el plan de desarrollo resultante de tu análisis y las nuevas propuestas, incluyéndolas todas, pero priorizadas. No quiero empezar el desarrollo aún».
**Es la única fuente viva de lo que falta por hacer.** Sustituye como backlog vigente a `BACKLOG_INICIO_OLEADA_OCTUBRE.md`, que queda como detalle histórico (sus §0-§15 siguen siendo válidos como razonamiento). Mapa de todos los backlogs: [`BACKLOG_INDICE.md`](BACKLOG_INDICE.md). Estado maestro de las entregas E1-E26: `BACKLOG_STATUS.md` §0.
**Plan de desarrollo** (paquetes, enfoque técnico, pruebas, calendario y riesgos): [`docs/PLAN_DESARROLLO_DEFINITIVO.md`](docs/PLAN_DESARROLLO_DEFINITIVO.md). **Porqué de cada propuesta:** `docs/PROPUESTA_QUINTA_AUDITORIA_2026-10-02.md` (IDs `ND`, `NPV`, `NIN`, `NDB`, `NXP`, `NHG`, `NTC`) y `docs/PROPUESTA_SEXTA_AUDITORIA_2026-10-03.md` (IDs `CAP`, `PRV`, `CAR`, `DAC`, `DNU`, `FIS`, `UXS`, `HOG`, `GOV`).
**El repositorio es público: ninguna cifra real del hogar aquí.** Los importes van en el chat o en artefactos privados.

Autocontenido a propósito: quien lo abra sin haber visto la conversación debe poder decidir qué hacer primero en 10 minutos.

---

## 0. Estado en una línea

**29/10/2026 · el cierre solo de Chromium ya no tumba el CI:** si el navegador se cae entre dos pruebas, la siguiente lo relanza una vez en vez de fallar sin haber empezado (trampa 16, §10). No se reintenta ninguna prueba.

**29/10/2026 · ensayo del cierre con historial (pedido por el hogar):** recorrido entero del 2/11 con datos inventados como los reales: historial de marzo a octubre sin clasificar, octubre importado hasta el 24, el mes entero importado otra vez, la bandeja y Cierre. Además del bloqueo por el historial (arreglado justo antes), salieron dos más, y los dos están arreglados:
- **Huecos de saldo falsos.** La continuidad ordenaba por la fila de cada fichero, así que con varios extractos de una cuenta mezclaba meses. Ahora ordena por fecha y, dentro de un día, por el orden que encadena los saldos.
- **Un real a mano sin banco detrás** (efectivo u otra cuenta) bloqueaba la firma, y solo se quitaba borrando el real. Decisión del hogar: la diferencia banco/real solo se compara en partidas con movimientos del extracto ese mes.

La tarjeta de la guía se ve ahora (lo pidió el hogar): fondo y borde del color principal, barra de avance y botón «Abrir la guía».

**29/10/2026 · firmar un mes solo depende de ese mes (decisión del hogar):** con los datos reales, Cierre pedía clasificar todo el historial antes de firmar octubre, cientos de movimientos de meses anteriores incluidos. Ahora los contadores, el paso «Resolver diferencias» y la firma son del mes que se cierra. Lo de otros meses se dice aparte, con su enlace a Movimientos, y no bloquea. El descuadre del capital de deuda no tiene mes y sigue bloqueando. Lo encontró Claude en una captura del hogar, a tres días del primer cierre real; el ensayo del 23/10 partía de cero movimientos y no lo podía ver.

**29/10/2026 · lo nuevo nace encendido (decisión del hogar):** las siete funciones en prueba que estaban apagadas pasan a encendidas, con su revisión el 12/11 y su interruptor para apagarlas. Las siguientes nacerán encendidas (§4). La guía del cierre, encendida desde el principio, fue la primera.

**29/10/2026 · guía del cierre de mes en Cierre (pedida por el hogar):** una tarjeta plegable con los nueve pasos del cierre, el mes que toca, enlaces a cada pantalla, qué bloquea la firma y qué hacer si algo no cuadra. Las casillas son por mes y por dispositivo. Del 1 al 3, con el mes sin firmar, sale abierta. No nace apagada porque la pidió el hogar para usarla; tiene revisión a las dos semanas en Funciones en prueba y no cambia la superficie por defecto.

**28/10/2026 · WP-17 · PR-1, siguiente paso de la cartera (en prueba y apagada; lo pidió el hogar como «siguiente paquete del plan»):** arriba de Inversión › Cartera, la cartera en una línea y una sola acción con su motivo y la regla que la origina. El orden es fijo: valorar lo que lleva más de 35 días sin valor, lo que choca con la política firmada, el reparto fuera de la banda (de la política o, sin ella, de Rebalanceo), compensar plusvalías antes del 31/12, la política (sin firmar, cambiada o por revisar) y la convicción sin confirmar. **Nunca opera.** Con «rebalancear primero con aportaciones» nunca propone vender. La fiscal dice la norma de recompra y que no es una recomendación. **Apagada en Funciones en prueba** (la séptima). Sin la política firmada (H-12), sus reglas no mandan todavía (`docs/WP17_DISENO.md`).

**28/10/2026 · decisiones del hogar sobre sus tareas:**
- **H-03 no se hace** («dejamos los datos de ejemplo»): WP-23 queda **aparcado**. La campaña fiscal está construida y contrastada, pero solo enseña el hogar de ejemplo, así que no habrá lista con euros reales antes del 15/11. Se reactiva si el hogar teclea sus datos.
- **H-22, hecha** (el extracto de octubre de cada cuenta).
- **H-05**, la primera transferencia de la asignación personal, sigue para el 1/11.
- **WP-18 se enciende ya**, en vez de esperar al cierre. El interruptor vive en el navegador del hogar: Ajustes › Funciones en prueba.
- **Pidió simular el cierre de octubre con datos estimados y reabrirlo.** La app lo permite: fuera de los días 1-3 se cierra el mes en curso, y «Reabrir» existe. Pero lo tiene que hacer el hogar, con su sesión, y queda en el historial como cierre y reapertura. Sirve de ensayo del recorrido, no desbloquea ninguna métrica, porque todas esperan datos reales. El cierre de verdad sigue siendo del 1 al 3/11.

**28/10/2026 · WP-18 · PR-1, aportado frente a valor y TWR (adelantado de la Ola 3, dependencia WP-15 cumplida; en prueba y apagada):** en Inversión › Cartera, «De cada 100 € de vuestra cartera, X los pusisteis vosotros e Y los ganó el mercado», y la TWR (lo que hizo el mercado) junto a la XIRR (lo que ganó vuestro dinero), con su explicación y, plegado, el detalle por posición. La TWR encadena las fechas con valor de la hoja de WP-15, con Modified Dietz dentro de cada tramo. Con menos de dos fechas no da ninguna cifra y ofrece un botón a valorar. Con menos de un año no se anualiza, y la tarjeta avisa de que entonces no se compara con la XIRR. **Apagada en Funciones en prueba.** Si las posiciones tienen fecha de alta, la valoración del cierre del 1-3/11 ya da su primera TWR. El gráfico de aportaciones frente al valor queda para el PR-2, solo si se usa (`docs/WP18_DISENO.md`).

**28/10/2026 · las dos pruebas intermitentes del CI dicen por qué fallan:** WP-40 (la CIRBE, Chromium: el botón «no está quieto» 120 s) y el ensayo del cierre de octubre (WebKit: el diálogo de confirmar no se abre) han fallado tres veces en el CI y nunca en local (WP-40: 16 de 16; con la CPU ×6, con y sin desplazamiento suave, sin una sola mutación ni movimiento del botón en 5 s; WebKit no se puede instalar aquí). Sin la traza, cualquier arreglo sería a ciegas: en su lugar, esos dos clics pasan por `tests/helpers/pulsar-o-explicar.cjs`, que si no puede pulsar escribe en el error qué se movía, qué se repintaba, el foco, los diálogos abiertos y los últimos clics y cambios. No reintenta ni alarga ningún tiempo. El arreglo de verdad, con el siguiente fallo delante.

**27/10/2026 · WP-23, el tramo autonómico de vivienda contrastado:** la comunidad del hogar (dada por el chat, fuera del repositorio) no tiene porcentaje propio para la deducción por vivienda del régimen transitorio, así que le corresponde el 7,5 % supletorio: 7,5 % + 7,5 % = 15 %, lo que ya usaba el motor. **Los cinco parámetros legales de la campaña quedan contrastados** (`docs/WP23_DISENO.md` §10) y ninguna cifra cambia. WP-23 sigue esperando H-03 (los datos fiscales en la app, vencida desde el 20/10) para enseñar euros reales antes del 15/11.

**27/10/2026 · el panel de seguimiento ve el §5.0 (sin cambios en la app):** las 24 filas del rediseño y la séptima auditoría entran en `docs/plan/plan-definitivo.json` (`plataforma`), con su prueba de sincronía, y el panel las enseña en su pestaña, **fuera de la línea base** (no suman a la curva). Una segunda fila de indicadores dice lo que la curva no veía: **15 de 24 entregas del §5.0 hechas** (33 PR), **5 funciones en prueba apagadas** (XPR-06, XDA-01, XUX-02, XPR-07, XDA-10: su revisión no empieza hasta encenderlas) y **las tareas del hogar vencidas** (H-03, desde el 20/10). Revisión de estado del mismo día: construido 64 % en el panel (87 de 136,75 sesiones) frente al 17 % de la línea base a hoy, comprobado 0 %. Recomendación de Claude: ninguna función nueva hasta el cierre de octubre (H-22 el 31/10, H-06 del 1 al 3/11) y las revisiones del 2/11, el 4/11 y el 7/11.

**27/10/2026 · XDA-10 · PR-1, antes de decidir (sin puerta; horizonte «Siguiente»; en prueba y apagada):** bajo el veredicto del guardarraíl de colchón (amortizar una deuda y garantía del Lombard), si los saldos tienen 4 días o más, dice si lo que han podido moverse (estimación de WP-45) le daría la vuelta, no la cambia o no se sabe, con enlace para actualizarlos. El Euribor, el guardarraíl de cancelar deuda (DEB-15) y los simuladores de inversión y escenarios, en el PR-2. **Apagada en Funciones en prueba.**

**27/10/2026 · XPR-07 · PR-1, el arreglo más barato para un descubierto (sin puerta; horizonte «Siguiente»; en prueba y apagada):** si la trayectoria «según el plan» de la banda de caja baja del suelo en 30 días, cuánto falta y hasta tres arreglos por coste: aplazar lo marcado como discrecional que caería antes del punto más bajo (0 €), aceptar bajar del suelo (0 €, diciendo en cuánto queda) y la línea de crédito (con sus intereses). Sin traspasos entre cuentas (falta XPR-05) ni aplazar tarjetas (falta la TAE de WP-41). **Apagada en Funciones en prueba.**

**27/10/2026 · XUX-02 · PR-1, ver cómo quedaría (sin puerta; en prueba y apagada):** el plan B y la política de inversión, vacíos, ofrecen «Ver cómo quedaría»: la tarjeta pintada por su propio código con un hogar inventado, banda «EJEMPLO» fija, nada pulsable dentro y, al pie, qué hace falta y cuánto se tarda (altas del registro de XDA-01). Ninguna cifra del hogar se cuela (las vistas aceptan ahora los datos desde fuera). «Empezar con lo vuestro» abre el alta de verdad. **Apagada en Funciones en prueba.** Con esto, del grupo «Ahora» de la séptima auditoría solo quedan propuestas con puerta del hogar (XDA-07, XDA-08, XDO-01, XDO-03, XUX-06).

**26/10/2026 · XDA-01 · PR-1, lo que la app te pide (sin puerta; en prueba y apagada):** cada función declara qué datos pide y cada cuánto; la app suma lo que cuesta darlos a la semana (cada dato una vez) frente a los 10 min de GOV-01 y dice qué funciones tienen hambre, con el enlace a dar el dato. Sobre WP-45, sin duplicarlo. Tarjeta en Ajustes › Uso de la app, **apagada en Funciones en prueba**. «Pausar», plegar las funciones con hambre y ordenar por valor por minuto, en el PR-2 si se usa (`docs/XDA01_DISENO.md`).

**26/10/2026 · XPR-06, qué mueve cada día de la banda de caja (sin puerta; en prueba y apagada):** en Plan › Previsión, «Qué mueve el …» desglosa el día elegido de la banda de caja: saldo al empezar según el plan, cada entrada y salida con su certeza (cierta, por regla, indicada por ti o estimada, con el tramo en que puede caer), el gasto repartido del mes y saldo al acabar, cuadrado al céntimo con la tabla. Las estimadas llevan «¿Sabes el día?» a Días de cargo. **Nace apagada en Funciones en prueba** (regla de XGO-03), con el primer interruptor propio: su revisión cuenta desde que el hogar la encienda. Corregir importes desde la hoja queda fuera hasta ver si se usa.

**26/10/2026 · RD-WK, las pantallas v2 también en Safari (P14, decidido el 19/10):** el proyecto `safari` de Playwright repite en WebKit (el motor del Safari del iPhone, iPhone 13 a 390×844) las pruebas de las pantallas v2 a 390 px, sin duplicar ninguna: llevan la etiqueta `@safari`. Se añade un barrido del menú principal en el móvil (título, sin errores, nada fuera por la derecha). En el CI bloquea como el resto. Aquí solo se pudo validar con Chromium emulando el iPhone, porque el proxy no deja descargar WebKit: la primera lectura en WebKit es la del CI del PR.

**26/10/2026 · XIN-02, vigía de la recompra (sin puerta; conviene antes del 31/12):** la norma de recompra del art. 33.5 f y g de la Ley del IRPF, completa. Ventana de dos meses antes o después en acciones y ETF de mercados regulados de la UE y de un año en fondos que no cotizan; las compras anteriores cuentan si siguen en cartera tras la venta (FIFO, el de siempre), con la excepción de una sola compra; parte diferida estimada en proporción a lo recomprado. Se avisa (Inversión › libro de operaciones, en la venta y en el «antes / después»), no se descuenta de la compensación. Las candidatas a aflorar pérdidas y la campaña fiscal dicen desde qué día se puede recomprar si se vende hoy. La app no sabe dónde cotiza una acción: aplica dos meses y dice que fuera de la UE es un año.

**26/10/2026 · XGO-01, «uno entra, uno sale» comprobado por el CI (regla de trabajo GOV-02, veto posible del hogar):** lo que se ve por defecto queda inventariado ruta a ruta en `docs/gobierno/superficie.json` (226 titulares en 31 rutas: el menú principal y sus pestañas, tema v2, sin datos, reloj fijo). Una entrega que añade algo a la vista sin plegar otra cosa no pasa el CI salvo con una excepción escrita (fecha, cuánto, qué y por qué); lo que sale baja el techo. Lectura: **Ajustes enseña 57 titulares e Inversión › Apalancamiento 29**, un tercio de todo; son las primeras candidatas a plegar, con el visto bueno del hogar.

**26/10/2026 · XDA-05 (clasificar por lotes), decisiones del hogar:** «1. sí 2. sí 3. sí»: **PR-1, medir, ahora**; **PR-2, aceptar en bloque los grupos de confianza alta, solo cuando haya 20 grupos de alta o más con el 95 % o más aceptados tal cual**; y **se descartan las tarjetas que se deslizan** (la hoja inferior ya cumple). **PR-1 hecho el 26/10:** cada grupo aceptado en Clasificar anota en el medidor su confianza, si se aceptó la propuesta tal cual y los segundos; deshacerlo cuenta como corrección. El informe de Uso de la app y «Funciones en prueba» dicen el % tal cual (en total y por confianza), los segundos por grupo, el gasto importado con partida en 90 días (objetivo 95 %) y cuánto falta para la puerta del PR-2. El contador de Clasificar dice cuántos grupos faltan y cuánto llevará.

**26/10/2026 · XDA-03 (extractos en PDF), decisiones del hogar:** hará hoy el paso 0 adelantado (qué formatos da cada app del banco); **acepta pdf.js alojado en el propio sitio** (≈ 1,7 MB, con su revisión de seguridad; la decisión aplazada en WP-31) si alguna cuenta solo da PDF; y **no se descarta el nivel 1** (pegar el texto). **Nivel 1 hecho el 26/10:** en Importar, «Texto de un PDF»: se pega el texto, un motor genérico (`canonical-statement-lines.js`, sin formato por banco) reconoce fecha, fecha valor, concepto, importe y saldo, y fija con el saldo el signo que el PDF no marca; lo que no se puede fijar no se adivina. Entra por la revisión de siempre (cuadre, duplicados, cuenta, periodo). **Nivel 2 (pdf.js) pendiente del paso 0.**

**26/10/2026 · XDA-04 (cobertura del libro) y fin del límite de paquetes, decisiones del hogar:** «ok al orden: PR-1 ahora (registro, motor, WP-27 y aviso en el cierre) y PR-2, la tira, cuando haya dos importaciones reales»; «al importar, deduces y preguntas antes de confirmar»; **«límite de paquetes: no hay límites»** (deja sin efecto el límite de 3 en curso del 19/10, §4). **PR-1 hecho el 26/10:** cada importación guarda qué periodo cubre su extracto y de qué cuenta (deducido de sus movimientos y preguntado en la revisión de Importar antes de confirmar), las preguntas de «¿ha llegado…?» ya no toman un hueco entre dos extractos por visto, y el cierre avisa de los días del mes sin extracto por cuenta (no bloquea). Lo importado antes cuenta como «estimado». Siguen en pie: un cambio de Hoy por semana y la revisión de cada función nueva a los 14 días.

**25/10/2026 · XDA-02 (buzón de extractos), decisión del hogar:** «adelante con el paso 0 y el PR-1, pero no aparcamos el buzón». Orden: **paso 0** (el hogar exporta octubre desde las apps del banco en el iPhone, lo importa y dice qué formatos da cada una; va dentro de H-22), **PR-1** «Importar en un toque» (hecho el 25/10, sin servidor: el botón abre ya el selector de archivos y el medidor guarda los segundos del toque al importado) y **PR-2**, el buzón en Supabase con Atajo, que se construye ya y cuyo **despliegue lo hace el hogar** (la función de servidor no se puede desplegar desde aquí). Aviso de Claude que el hogar conoce: con XDA-02 son **4 paquetes en curso** sobre un límite de 3 (rediseño, WP-23, Repaso y XDA-02); el hogar decide seguir.

**24/10/2026 · el hogar levanta la regla de parada para funciones nuevas.** La primera es el **Repaso semanal** (B5 · XUX-03, §5.0): cinco pasos con cronómetro que convierten las tareas H-22 y H-23 en un hábito guiado y miden M-COSTE solos. Sigue el límite de 3 en curso: rediseño, WP-23 y el Repaso. Ese mismo día salieron el barrido móvil, las fechas legibles y los plurales y decimales unificados (#540), y el primer cambio de Hoy, que se activa el 25/10. El segundo (la entrada al Repaso en Hoy, solo con el de la semana por hacer) se publicó también el 24/10 y se activa el 1/11.

**23/10/2026 · revisión de salida de la Ola 1: parar y revisar** (detalle en [`docs/REVISION_SALIDA_OLA1_2026-10-23.md`](docs/REVISION_SALIDA_OLA1_2026-10-23.md)). Construido 63,2 %, comprobado 0 %, ninguna lectura de M-HOY ni M-ADOP. El cuello de botella ya no es construir, sino que la app reciba datos. **Decisiones del hogar del día:**
- **M-HOY se mide sola** con el medidor de utilidad (sustituye a H-02), y la congelación de Hoy se levanta el 25/10 con un cambio por semana.
- **Comunidad autónoma dada por el chat**, fuera del repositorio.
- **No se poda ningún paquete:** el hogar alimentará WP-40, WP-48, WP-50 y WP-52.

El panel recibe **12 tareas nuevas del hogar** (H-22 a H-33), así que todo paquete «esperando al hogar» tiene ya la suya con fecha. La de más palanca es **H-22, importar el extracto de octubre antes del 31/10**.

**Ensayo del cierre de octubre:** el recorrido importar → clasificar → firmar funciona a 390 px, y la tabla de cuentas del móvil queda corregida. Para firmar hacen falta tres cosas: movimientos de octubre importados (H-22), ninguno sin partida y la sesión iniciada.

**WP-23:** cuatro de los cinco parámetros legales quedan contrastados con su fuente (`docs/WP23_DISENO.md` §10). Vivienda sigue pendiente del tramo autonómico.

**21/10/2026 · límite de 3 en curso aplicado y regla de parada de la Ola 1 activada, por decisión del hogar:** de los 25 paquetes abiertos, 1 sigue en curso (WP-23), 21 pasan a **«esperando al hogar»** con su tarea, 3 se **aparcan** (WP-28, WP-37, WP-42) y WP-33 queda hecho; con el rediseño, **2 de 3 en marcha**. El panel distingue **construido (63,2 %)** de **comprobado (0 %)**. La Ola 1 se cierra sin lecturas de M-HOY ni M-ADOP: **no se abre ningún paquete nuevo** hasta tenerlas (§4). WP-41 publica su cuarta entrega (cargos mensuales sin marcar).

**20/10/2026 · `O-6` cerrado por el hogar, sin verificación práctica:** no se conecta ningún banco (los saldos siguen con WP-26), WP-05 queda hecho y el PR-2 de WP-13 (fuente oficial de índices) se archiva. **`O-6` queda marcado para recuperar** con disparador (§6). Avance del plan: **61,9 %** (`docs/ESTADO_TAREAS_Y_FASES.md`). Desalojo de `app.js` (XGO-01): PR-0 y PR-1 hechos (#525, #526).

**19/10/2026 · el rediseño entra en este backlog (§5.0), por decisión del hogar (P13 del cuestionario):** diseño nuevo por defecto en la URL base (#519), CI con trazas de Playwright (#520) y cobro manual caducado (#521) hechos; siguen el desalojo de `app.js`, «Funciones en prueba», Movimientos e Importar y Clasificar. Detalle vivo del rediseño: `docs/rediseno/ESTADO.md`. Límite de 3 paquetes en curso (§4).

**Desarrollo iniciado el 3/10/2026 (sesión 299): el hogar dijo «empecemos». **Ola 1 construida el 4/10 salvo WP-23** (programado para la semana del 12/10); además, de la Ola 2, WP-08 y WP-26. Hecho: WP-01 (sello de versión y «Novedades») WP-02 (prueba cronometrada de Hoy; falta la línea base: 3 intentos del hogar con saldos del día) WP-03 (panel de uso, local; «% del gasto registrado en < 48 h» queda **sin medir** hasta que la captura guarde la fecha de registro, WP-25/WP-30) y WP-04 (lectura en Ajustes de si el día de cargo se puede aprender; WP-08 sugerirá solo en las partidas «fiables», `docs/ND03_VIABILIDAD.md`). **WP-05 entregado en documentos** (`docs/ND13_SPIKE_CONEXION.md` y `docs/NTC06_AMENAZAS.md`, con la prueba `ntc6-conexiones-externas`, que bloquea cualquier servidor nuevo sin revisar). GoCardless no admite altas desde julio de 2025. Enable Banking, en modo restringido gratuito, lista CaixaBank y Banco Mediolanum. **Decisión de `O-6` el 16/10**, con la verificación práctica del hogar (≈ 20 min) y la frescura del panel de uso. Si no hay verificación, `O-6` se cierra. Corregido de paso: el motor de tickets se cargaba sin huella SRI. **WP-07 hecho (4/10):** el motor de fechas vive en `canonical-timing.js`, sin cambio de comportamiento: 60.276 casos con 0 diferencias, oro de 493 casos en las pruebas y previsión idéntica en el navegador. `app.js` baja 100 líneas (37.340 de 37.495). Es la costura de WP-08. **WP-09 hecho (4/10):** el cierre guarda el saldo de cada cuenta con su fecha (almacén `month-close-balances`, que va en la copia y en la nube; el RPC firmado no se toca). Del 1 al 3 se cierra el mes que acaba, y ese mes **sigue abierto para anotar sus reales** hasta que se firma. El cuadre con el cierre anterior avisa, no bloquea. El primer cierre real será el de octubre, del 1 al 3 de noviembre. **WP-10 hecho (4/10):** medidor de calidad de la previsión en Plan › Previsión, plegado. Tiene tres barras ponderadas por importe: fechas del gasto con día conocido (objetivo ≥ 70 %), gasto del mes con real e ingresos del mes confirmados. Cada una dice cómo subirla. Con la demo marca un **0 % de días conocidos**: es el «100 % estimado» que verá bajar WP-08.** **WP-08 hecho (4/10, adelantado de la Ola 2):** día de cargo por partida en Plan › Partidas (día 1-31, fin de mes o automático), de mayor a menor gasto, con la propuesta que ya se ve en los extractos. Precedencia: movimiento real del mes > día indicado > regla > estimado (día 8). Sin días indicados, la previsión es idéntica a la anterior. Con la demo, indicar dos partidas sube el medidor de 0 % a 66 %. **Falta la sesión del hogar (≈ 10-30 min)** para llegar al objetivo ≥ 70 %. **WP-11 hecho (4/10):** los importes de Registrar (saldos, reales y dato manual) son texto con teclado decimal. Se escriben y pegan como en España («1.234,56 €»; «1.234» son mil doscientos treinta y cuatro, antes 1,23 €), llevan botón ± para el signo, y un texto que no es importe avisa y no se guarda. Vacío sigue siendo «sin real» y 0 sigue siendo cero. De paso, Registrar se puede usar en el móvil: saldos y reales apilados (antes el campo medía ~55 px y los reales pedían desplazarse en horizontal) y el pie de impacto pasa de 454 a 102 px. **WP-25 hecho (4/10):** `#registrar?importe=&concepto=&fecha=&cuenta=&origen=` (alias del Atajo: `comercio`, `tarjeta`) abre «Registrar gasto» relleno y **nunca guarda solo**. Rechaza HTML, cita lo que no entiende, elige el mes por la fecha si está abierto y borra el enlace de la barra de direcciones. Guía del Atajo de Apple Pay en el manual. **Hallazgo que condiciona CAP-01:** la ventana crea una partida nueva, así que un pago ya previsto (súper, gasolina) contaría dos veces. Anotar «a cuenta de una partida» no existe en el modelo y lo tiene que decidir **WP-30** antes de usar el Atajo a diario. El Atajo abre Safari, no la app de la pantalla de inicio (datos aparte: hay que iniciar sesión también allí). `app.js` queda en 37.494 de 37.495. **WP-24 hecho (4/10):** asignación personal en Plan › Partidas, una ficha por persona (importe, primer y último mes). Decisiones del hogar: transferencia a una cuenta propia que no se importa, **sale del gasto variable** (el total previsto no cambia) y para los dos. Una partida por persona con id estable en Gastos variables (vale para el día de cargo, la regla del extracto y los reales). El descuento va sobre el valor final del «Gasto variable estimado», porque la migración de junio lo fija a mano en toda la previsión. La tarjeta de WP-08 pasa con ella a `partidas-ui.js`: `app.js` baja a 37.466. **Falta el alta del hogar** antes del 1/11; revisión a finales de enero. **WP-26 · ND-01 hecho (4/10):** «Pulso de saldos» en Registrar: lo último que se sabe de cada cuenta (declarado o saldo final del extracto, el más reciente) con «Coincide» / «Corregir»; con las dos respondidas, fecha de hoy y deshacer 8 s; la previsión solo avisa si esperaba movimientos. El panel de uso mide los segundos (objetivo ≤ 20 s) y el % de «Coincide». **Falta la línea base del método anterior** (WP-02). **ND-02 hecho (4/10):** el paso 4 de la importación ofrece (marcado) usar el saldo final del extracto como saldo de su cuenta, comprueba la continuidad del fichero y lo aplica dentro del lote (deshacer lo devuelve); la cuenta elegida al importar llega por fin al libro (antes todo era CaixaBank en C-2, M-8c y la continuidad). **WP-26 hecho.** **WP-12 hecho (5/10, adelantado de la Ola 2 por el reloj de datos):** backtest de liquidez a fin de mes en Plan › Previsión (tarjeta plegada «Acierto de la caja a fin de mes»). Los días 1-3 y 15-17 congela la liquidez prevista (CaixaBank + Mediolanum) día a día hasta fin de mes y 10 días más; la foto es **de solo añadir** (la primera de cada ventana gana). Al firmar el cierre la compara con los saldos reales **en la fecha de esos saldos**. Error = previsto − real (positivo: optimista). **Con menos de 3 cierres comparables, «datos insuficientes»: ninguna cifra**; la tendencia, con 6. **Solo cuentan los saldos del banco:** con «Auto por fecha» la foto se guarda pero no cuenta (hay que declarar «Real manual»). Solo mide: la banda P10-P90 es de WP-16. **Falta del hogar:** saldos en «Real manual» y abrir la app del 15 al 17/10; con foto de octubre, el tercer cierre comparable llega en enero de 2027 (febrero si la primera foto es la del 1/11). **WP-23 (campaña fiscal) aparcado el 3/10 por decisión del hogar: no tiene los datos fiscales a mano.** Riesgo: para tener la lista antes del 15/11 hay que retomarlo como tarde el **1/11** (≈ 4 sesiones); el motor puede construirse sin datos, solo los euros los necesitan. Decisiones de esa sesión: (a) **un solo móvil** → `NTC-03` (contador multi-dispositivo) se reduce al contador local, sin sincronización; (b) **WP-23 (campaña fiscal) se adelanta** a la siguiente sesión y los datos fiscales se piden ya, sin esperar al 20/10; (c) en WP-02 el interruptor A/B del titular se construye pero **no alterna** hasta tener la línea base con el texto A (con n = 1 es preferencia, no resultado medido). Las 104 propuestas de la quinta y la sexta auditoría están todas aquí, priorizadas en cinco niveles (§5): **68 entran en el plan** (P0-P2, en **3 olas de octubre de 2026 a enero de 2027**, ≈ 138 sesiones), **27 quedan en catálogo con disparador** (P3), **5 bloqueadas** por un tercero o un evento (P4) y **4 se archivan**. **Respuestas del hogar del 3/10 (sesión 297):** tributación **individual**; **sin plan de pensiones de empresa**; **hipoteca variable** (entra la revisión de tipo, `NDB-02`); **nadie más usará la app** (lo que solo servía a una segunda persona se archiva); **sin límite de entregas visibles** (el plan se comprime de 13 tramos a 3 olas). El primer paquete con fecha es la **campaña fiscal de fin de año con el tope de la deducción por vivienda** (lista antes del 15/11/2026). Orden tras la sesión 299 (4/10): la Ola 1 queda construida salvo **WP-23, que el hogar programa para la semana del 12/10** (límite: 1/11) y WP-06, que son tareas con fecha (16/10 y 23/10). La Ola 2 empezó por **WP-26** (saldos por excepción, **hecho el 4/10**), adelantado a WP-15 por decisión del hogar del 4/10. **Orden del hogar del 5/10: WP-12 (hecho), WP-30 y WP-15**; después, por el orden de la Ola 2, WP-27, WP-14, WP-13, WP-20 y WP-28. **WP-30: decisión del hogar del 5/10 sobre el pago «a cuenta de una partida» (lo dejó al descubierto WP-25): se acumula dentro de la partida**, sin crear una partida por ticket (§4). **Diseño cerrado el 5/10 (`docs/WP30_DISENO.md`):** compras con tarjeta de crédito, cada una con su concepto, acumuladas en la fila de liquidación de la tarjeta del mes de cargo (cada tarjeta con su ciclo de corte y cargo, que el hogar introduce en la app); el cargo del extracto manda al llegar. **PR-0 hecho** (`app.js` en 37.396 de 37.495) y **PR-1 hecho** (Plan › Partidas › «Tarjetas de crédito»: ciclo de corte y cargo por tarjeta; compras acumuladas con `max(previsto, acumulado)` hasta que llega el cargo; sin compras, previsión idéntica; `app.js` 37.409); **PR-2 hecho (5/10): la hoja de captura** (importe primero, concepto con sugerencias, tarjeta, hoy/ayer/otra fecha, «Hecho» del teclado guarda, deshacer 8 s), la abre «+ Registrar gasto» y el enlace de WP-25 cuando hay tarjetas (sin ellas, la ventana de siempre). **Cambio respecto al diseño:** las compras viven en su **propio almacén** (`card-purchases`), no entre los movimientos del banco: un lote reversible guarda una foto entera del estado por cada captura y el libro contaría la compra y su liquidación a la vez. Mide los segundos hasta guardar (y los de la ventana anterior, para comparar) y el «% anotado el mismo día o el siguiente»; informe de compras por concepto y ciclo. `app.js` 37.418 de 37.495. **WP-30 hecho.** **Falta del hogar:** dar de alta sus tarjetas en esa ficha y usar la hoja unos días (la mediana de ≤ 8 s sale de su uso real). ≈ 4-5 sesiones. **WP-15 (siguiente): diseño cerrado el 6/10 (`docs/WP15_DISENO.md`).** Hoja manual de valoración de la cartera con almacén propio de valoraciones con fecha (las instantáneas de cierre actuales repiten el valor del alta: no son serie), «Sin cambios» por fila, variación de mercado que descuenta aportaciones y ventas, más antiguas primero, deshacer 8 s y aviso no bloqueante en el cierre. «Pegar desde el bróker» aparcado hasta tener una muestra del formato; `I3` no se acelera (6 puntos no son correlación). ≈ 2-3 sesiones. **PR-1 hecho (6/10): la hoja de valoración** (Inversión › Cartera › «Actualizar valoración»): una fila por posición, las más antiguas primero; vacío no cambia y 0 vale cero; «Sin cambios» renueva la fecha; variación de mercado que descuenta aportaciones y ventas; confirmar un 0, un salto (±20 %, ±40 % en cripto) o una coma de más; fecha pasada = punto histórico sin mover el presente; deshacer 8 s; serie `portfolio-valuations` con fecha; frescura («valorada hace N días») y aviso no bloqueante en el cierre; mide los segundos de la hoja. `app.js` 37.421 de 37.495. **WP-15 hecho salvo el PR-2 («pegar desde el bróker»), aparcado.** Hallazgo aparte (corregido el 7/10, sesión 302): el XIRR no contaba las ventas parciales como dinero devuelto. **Falta del hogar:** valorar la cartera en el cierre del 1-3/11 y mandar por el chat el número y tipo de posiciones y una muestra del formato de su bróker. **Cierre del 6/10: 15 de 53 paquetes hechos (22 % del plan ponderado por esfuerzo; ninguna métrica leída aún con datos reales del hogar). Tabla completa de tareas y fases, con estatus, dependencias y siguientes pasos: [`docs/ESTADO_TAREAS_Y_FASES.md`](docs/ESTADO_TAREAS_Y_FASES.md).** **WP-23 adelantado el 6/10 (decisión del hogar): motor y tarjeta de la campaña fiscal construidos con un hogar de ejemplo marcado como tal** (Herramientas avanzadas › Fiscal; diseño en `docs/WP23_DISENO.md`). Los euros reales llegan con los datos fiscales del hogar (H-03, 20/10); `app.js` queda en 37.422 de 37.495. Desviación de FIS-02: ajustar la retención ahora rinde en 2027, no evita el pago de junio de 2027. **WP-33 empezado el 6/10 (en curso):** generador de hogar ficticio con verdad conocida (`tools/build-synthetic-household.mjs`) y banco de calibración de bandas P10-P90; ya mide la inferencia del día de cargo de WP-04/WP-08 (fijos y reglas, 100 %; cargos a ±1 día con solo 3 meses, ≈ 77 %; con 12 meses, 99,3 %). Lo usarán WP-16 y WP-51. **WP-28 empezado el 6/10 (en curso):** kit de gráficos (`chart-kit.js`) con frase automática, recorrido con dedo, ratón y flechas, lectura fija y «Ver como tabla»; el cono de previsión (Escenarios › Bandas de confianza) ya lo usa (diseño en `docs/WP28_DISENO.md`). Faltan cartera y deuda; `app.js` queda en 37.418 de 37.495. **WP-16 hecho (7/10, adelantado de la Ola 3 · sin medir):** «Banda de caja a 30 días» en Plan › Previsión: banda P10-P90 de la liquidez, **probabilidad de cruzar el suelo** y día más probable del mínimo, con 500 trayectorias (fechas estimadas en ventana 1-28; el gasto variable, repartido por los días del mes; prudente dentro del día). Calibrada con el hogar sintético de WP-33: cobertura 87-94 % (nominal 80 %) y probabilidad media 0,225 frente a 0,247 real; la previsión actual (todo el día 8) afirma cruce el 100 % de los meses cuando ocurre el 25 %. **Solo recoge la incertidumbre de las fechas, no la de los importes.** Falta: ventana aprendida por partida, dispersión de importes y una línea en Hoy (solo tras H1). `app.js` 37.419 de 37.495. `docs/WP16_DISENO.md`. **WP-32 hecho (7/10 · sin medir):** Ajustes › «Recordatorios en el calendario del móvil»: un `.ics` con avisos dos días antes de cobrar, el día después de un cargo grande (≥ 500 €), el día 1 (cerrar el mes) y la campaña fiscal (1/12 y 20/12). **Desviación:** no es un calendario suscribible (sitio público y estático: una dirección con la previsión del hogar sería publicarla); se genera en el dispositivo y la tarjeta avisa de regenerarlo. Solo avisa de fechas seguras; los títulos no llevan importes. `docs/WP32_DISENO.md`. **WP-14 + WP-27 hechos · sin medir (7/10):** «¿Ha llegado…?» en la bandeja de Hoy. Cobro a los 2 días (sí / otro importe / aún no) y cargo tras ventana + 3 días (baja / cambio de cuenta / llegará tarde / pagado de otra forma), con historial y deshacer. **Solo pregunta por fechas seguras, y por cargos solo si el extracto importado llega hasta ese día** (sin extracto, «no aparece» no es «no ha llegado»). **Lo aplazado («aún no», «llegará tarde») cuenta en la previsión diaria y en la banda de WP-16 el día en que se vuelve a preguntar** (PR-2); de paso se corrigió que la ejecución diaria guardada no se enteraba de que un gasto cambiaba de día y que la banda ignoraba los días de cargo declarados. Falta medir «ningún recibo sin estado > 3 días» con uso real. `docs/WP14_WP27_DISENO.md`. **WP-13 PR-1 hecho (7/10, sesión 302):** Deuda › Contratos › «Índices de referencia»: Euribor 12 meses, €STR e IPC tecleados con la fecha del dato y su caducidad (35/10/75 días), sin ninguna fuente externa (`docs/WP13_DISENO.md`). **PR-2 (fuente oficial) espera a O-6 el 16/10.** Hasta entonces WP-20 se construye sobre el valor tecleado. **Regla nueva (§4): Hoy congelado hasta leer H-02.** **WP-20 hecho (7/10, sesión 302 · sin medir):** Deuda › Contratos › «Revisión del tipo variable de la hipoteca»: próxima revisión, qué Euribor se leerá según la regla del contrato y cuota estimada de A a B (± 1 punto), con avisos a 60 y 30 días (en Hoy solo dentro de los 60 días); `docs/WP20_DISENO.md`. Faltan los datos del contrato (H-07, 13/11) y su evento de calendario (PR-2).

## 1. Cómo empezar la próxima sesión (10 minutos)

1. Leer este documento (§0, §2, §4 y §5) y la última entrada de `PROJECT_STATE.md`.
2. `git status`, `git log --oneline -5`; la rama de trabajo parte de `origin/main` (receta en §10).
3. **El desarrollo está en marcha desde el 3/10/2026** (el hogar dijo «empecemos»). La regla de parada para funciones nuevas se levantó el 24/10 y el límite de 3 en curso, el 26/10 (§4). Siguen en pie: un cambio de Hoy por semana, la revisión de cada función nueva a los 14 días y «uno entra, uno sale». Lo siguiente lo marcan WP-23 (14/11), el camino del rediseño (§5.0, orden en `docs/rediseno/ESTADO.md` §8) y las tareas del hogar; un paquete «esperando al hogar» se retoma cuando llega su dato. **Recomendación de Claude del 27/10:** ninguna función nueva hasta el cierre de octubre y las revisiones del 2/11, el 4/11 y el 7/11. Cada cambio visible añade su línea a `novedades.js`.
4. Antes de cerrar: validar, actualizar `PROJECT_STATE.md` con cifras reales, **este documento** y **el panel de seguimiento** (§12), commit/push, PR en borrador, esperar CI, fusionar en verde.

---

## 2. Cambio de premisa: la app tiene **un solo usuario**, y no habrá otro

Datos del hogar del 3/10/2026: «la persona que responde es la misma porque de momento es solo un usuario» y, después, «nadie más» se va a incorporar. La Ola 2 y la quinta auditoría estaban construidas sobre **dos personas** (quien opera y quien consulta). Consecuencias, ya aplicadas a la priorización:

| Lo que dependía de dos personas | Qué pasa ahora |
|---|---|
| **Métrica de la regla de parada v2** («mediana de **quien consulta** ≤ 15 s con la misma cifra») | Se redefine: **mediana del usuario ≤ 15 s, con la misma cifra que la app, con saldos actualizados ese día y abriendo desde el icono** (WP-02). Se añade una métrica de adopción: **≥ 4 días activos por semana** (WP-03) |
| La medición de 30/28/20 s «sin encontrar la cifra» | Si la hizo la misma persona que usa la app a diario, el resultado es **más grave**, no menos. Se repite con saldos del día (S8) antes de tocar Hoy |
| Modo consulta (`NXP-07`), D4/D5 (H3), captura desde el segundo móvil (`CAP-08`), reunión mensual (`NHG-02`), recorrido de bienvenida (`NAV-3`) | **Archivados** (§5.6): solo servían a una segunda persona usuaria. Se reactivan si eso cambia |
| Contador de uso de «los dos móviles» (`NTC-03`) | Se reduce a **multi-dispositivo** (móvil y ordenador del mismo usuario) dentro de WP-03 |
| Cuentas en pareja (`NHG-01`), acuerdos vigilados (`HOG-01`) | Siguen teniendo sentido para el dinero del hogar, pero sin segunda persona usuaria su valor baja: **P3** |
| Asignación personal (`HOG-02`) | **Sigue en P0**: es una regla del dinero del hogar, no de usuarios; además reduce la captura |
| Modo relevo (`HOG-03`) | Sin otra persona usuaria solo cubre una ausencia del propio usuario (la app queda en pausa y se pone al día al volver); lo grave (fallecimiento o incapacidad) ya lo cubre `LPX3`: **P3** |

**Si algún día se incorpora otra persona:** se reactivan los archivados de este grupo y `NAV-3`.

---

## 3. Cómo se ha priorizado

**Orden de criterios** (decidido en el triaje, R5): **1) fecha límite externa → 2) euros que ahorra o protege → 3) dependencias (lo que desbloquea otras) → 4) minutos por semana que quita al usuario → 5) evidencia** ([M] medido > [C] código > [H] hipótesis).

**Niveles:**
| Nivel | Significado | Cuántas |
|---|---|---|
| **P0** | Con fecha o habilitadora inmediata: **Ola 1** (5/10 - 23/10/2026) | 17 |
| **P1** | Siguiente: **Ola 2** (26/10 - 20/11/2026) y primeras de la Ola 3 | 25 |
| **P2** | Planificada: **Ola 3** (23/11/2026 - 22/1/2027); algunas solo dan resultado cuando hay datos (febrero-mayo 2027) | 26 |
| **P3** | Catálogo con disparador: se activa cuando se cumple su condición (uso real, petición, dato) | 27 |
| **P4** | Bloqueada por un tercero o un evento (préstamo, coche, viaje) | 5 |
| **Archivo** | Descartada (reactivable si cambia su condición) | 4 |
| | **Total** | **104** |

Las respuestas «Más tarde» del triaje (3/10/2026) van a P3 salvo que el plan necesite una parte mínima (se indica). Las respuestas «Sí» están en P0-P2 salvo las que dependen de un evento (P4) o solo servían a una segunda persona usuaria (archivo).

---

## 4. Reglas vigentes

**Ritmo de entregas (decisión del hogar del 3/10/2026: «quitar el límite»):** desaparece el máximo de entregas visibles por tramo. El plan se ordena en **3 olas** por dependencias y fechas, no por cupo: **Ola 1** (5/10 - 23/10/2026), **Ola 2** (26/10 - 20/11/2026) y **Ola 3** (23/11/2026 - 22/1/2027). Algunos paquetes se construyen en la Ola 3 pero solo dan resultado cuando hay datos (cierres de mes y valoraciones): de febrero a mayo de 2027.
**Lo que se mantiene, por recomendación de Claude:** (1) **la regla de parada** —al cerrar cada ola se mira el panel de uso (WP-03) y la métrica de Hoy; si una ola entera no mueve ninguna, se para y se revisa con el hogar antes de seguir—; (2) **«Novedades»**: cada cambio visible se anuncia en la app con una línea (dentro de WP-01), porque con cambios frecuentes un solo usuario necesita saber qué ha cambiado; (3) **uno entra, uno sale** (GOV-02) para que la app no siga creciendo en pantallas.
**Lo que se pierde:** la protección contra cambiar demasiadas cosas a la vez, que es lo que la regla v2 evitaba. Si el panel de uso muestra que el uso baja tras una ola cargada, Claude lo dirá y propondrá frenar.

**Reglas de gobierno adoptadas** (sexta auditoría, §6):
- **GOV-01 · Presupuesto de ≤ 10 min/semana** para mantener la app (S1, Sí). Cada paquete declara su Δ. Medición mínima: autodeclaración semanal dentro del panel de uso (R3 por defecto).
- **GOV-04 · Decisiones a ciegas** en los formularios de decisión (S7, Sí).
- **GOV-05 · Medir Hoy solo con saldos del día** (S8, Sí).
- **GOV-02 · Uno entra, uno sale** y **GOV-03 · puntuación por euros**: adoptadas por defecto como reglas de trabajo de Claude (no se votaron; veto posible). **GOV-02 la comprueba el CI desde el 26/10/2026** (XGO-01, `docs/gobierno/superficie.json`).
- **GOV-06 · Prueba con 5 personas ajenas** con datos de demostración, trimestral: con un solo usuario, es la única forma de separar problemas de diseño de hábitos propios (WP-54).

**Hoy congelado hasta leer la prueba del 9/10 (H-02) — regla adoptada el 7/10/2026 por recomendación de Claude, con veto posible del hogar.** La línea base de M-HOY (≤ 15 s, WP-02) se fija sobre lo que Hoy sea el 9/10: si después se cambia lo que Hoy enseña, el antes y el después dejan de ser comparables, y con un solo usuario no hay otro grupo con que contrastar. Hasta que haya ≥ 3 intentos válidos con el texto A **no se cambia lo que Hoy muestra por defecto** (titular, orden de los bloques, contenido de la bandeja). **Quedan fuera de la regla:** (a) correcciones de errores, contraste y accesibilidad que no cambian el contenido; (b) elementos que solo aparecen en una fecha futura y no existen el 9/10 (p. ej. el aviso a 60 días de la revisión del tipo variable, que no sale antes de enero). **Lo ya publicado antes de la regla cuenta como parte de la línea base**: el 7/10 se añadieron a la bandeja las preguntas de WP-14/WP-27 (no salen con la demo ni, probablemente, antes de declarar días de cargo). Con la demo y sin la guía de primeros pasos, «Disponible para gastar» queda a ≈ 60 % de la altura de un iPhone (comprobado a 390×844 y 393×852). Se levanta al leer H-02 (previsto entre el 9 y el 16/10) y se anota en `PROJECT_STATE.md`.

**Límite de 3 paquetes en curso (adoptado el 19/10/2026, P13 del cuestionario del rediseño; séptima auditoría §3) — levantado el 26/10/2026 por el hogar: «no hay límites».** Era: ningún paquete nuevo se abre hasta cerrar o aparcar formalmente uno de los abiertos; el rediseño contaba como uno de los tres.

**Aplicación del límite (21/10/2026, decisión del hogar):** dos estados nuevos en el panel para cumplirlo. **«Esperando al hogar»**: construido, y lo siguiente necesita un dato o una decisión del hogar (la tarea concreta va en la nota del paquete). **«Aparcado»**: le falta desarrollo, pero no cabe en el límite. Los dos cuentan como construido al 50 %, igual que «en curso», y **nunca como comprobado**. Ese día quedaron: en curso WP-23 y el rediseño; 21 esperando al hogar; aparcados WP-28 (los gráficos de cartera y deuda se migran con el rediseño de esas pantallas), WP-37 (los estados se aplican pantalla a pantalla dentro del rediseño) y WP-42.

**Regla de parada de la Ola 1, aplicada el 21/10/2026 (decisión del hogar):** la Ola 1 termina el 23/10 sin una sola lectura de sus métricas (M-HOY y M-ADOP), así que se para: no se abre ningún paquete nuevo hasta que haya lecturas reales. Sigue el camino del rediseño (desalojo de `app.js`, Laboratorio, Movimientos e Importar) y lo que tiene fecha (WP-23).

**Lo nuevo nace encendido (29/10/2026, decisión del hogar, deja sin efecto «nace apagado» de XGO-03):** «vamos a cambiar esta regla de "todo lo nuevo nace apagado", y reactiva lo que esté pendiente». Desde entonces:
- Toda función nueva con interruptor propio sale **encendida**, con el día en que empezó a verse (`encendidaDesde` en `funciones-en-prueba.js`).
- **Su revisión de dos semanas cuenta desde ese día**, y se apaga desde Ajustes › Funciones en prueba. Lo que el hogar apague queda apagado en ese navegador.
- **Las siete que estaban apagadas pasan a encendidas el 29/10:** XPR-06, XDA-01, XUX-02, XPR-07, XDA-10, WP-18 y WP-17. Sus revisiones caen el 12/11.
- **Sigue en pie «uno entra, uno sale»** (GOV-02): de las siete, solo «Lo que la app te pide» añade un titular a lo que se ve sin datos, y entra con una excepción escrita en `docs/gobierno/superficie.json`.

**Regla de parada levantada para funciones nuevas (24/10/2026, decisión del hogar):** «levanto la regla de parada para funciones nuevas». Lo que sigue en pie: el límite de 3 paquetes en curso, un cambio de Hoy por semana y la revisión de cada función nueva a los 14 días en «Funciones en prueba». Recomendación de Claude, que el hogar puede cambiar: priorizar las funciones que reducen el trabajo de meter datos (Repaso semanal, después XDA-02 y XDA-04), porque el 0 % comprobado no se debe a que falten funciones.

**Revisión de salida de la Ola 1 (23/10/2026): parar y revisar.** Se confirma lo aplicado el 21/10. No se abre ningún paquete nuevo hasta tener lecturas de M-HOY y M-ADOP. Tampoco se abre ninguna pantalla nueva del rediseño antes de las revisiones de «Funciones en prueba» del 2/11 y el 4/11, que dirán con el medidor si Hoy, Movimientos, Importar y Clasificar se usan.

**M-HOY se mide sola desde el 23/10/2026 (decisión del hogar):** la línea base es la mediana de los segundos hasta la primera acción en Hoy que registra el medidor de utilidad (XGO-02, desde el 22/10), y la prueba cronometrada H-02 deja de esperarse.
- **Qué se pierde:** mide «actuar», no «encontrar la cifra con saldos del día» (GOV-05).
- **Congelación de Hoy:** se levanta el **25/10**, como estaba decidido. Desde entonces, **los cambios de Hoy entran de uno en uno, uno por semana**, cada uno con su línea en «Novedades».
- **Orden de los cambios:** primero, mover la bandeja de decisiones a Movimientos; después, los avisos de WP-35, WP-36, WP-38 y WP-47.
- **La línea base es la mediana anterior al primer cambio.**

**Paquetes que dependen de una aportación periódica del hogar (23/10/2026):** WP-40, WP-48, WP-50 y WP-52 se mantienen porque el hogar se compromete a alimentarlos (H-31, H-28, H-27 y H-26). Si una de esas tareas pasa 30 días vencida, el paquete se propone para archivo con disparador.

**Hoy congelado: plazo hasta el 25/10/2026 (decisión del hogar del 21/10):** si para entonces no se ha hecho H-02 (3 pruebas cronometradas con saldos del día, sobre la Hoy v2), **la congelación se levanta** y la línea base de M-HOY se toma después (la séptima auditoría propone medirla de forma pasiva, UXS-03). Mantenerla sin la prueba que la justifica solo frena los avisos de WP-35, WP-36, WP-38 y WP-47 en la bandeja de Hoy.

**Hoy y la regla de congelación (nota del 19/10/2026):** el hogar decidió rediseñar Hoy (A3, #517) y hacer el diseño nuevo el de por defecto (#519). Si se toma la línea base de M-HOY (WP-02), se toma sobre la Hoy v2; el Laboratorio («Funciones en prueba», §5.0) permitirá comparar antes y después.

**Frenos de `CLAUDE.md` (sin cambios):** nunca fusionar en rojo ni forzar; nunca push directo a `main`; nunca `finanzas-casa-def`; consultar antes de ir más allá de lo pedido, borrar datos del usuario o retirar una pantalla en uso; nunca cambiar umbrales de CI ni relajar una prueba para dar verde.

---

## 5. Backlog priorizado (las 104 propuestas)

Columnas: **#** orden dentro del nivel · **ID** · **Qué** · **Origen** (5ª/6ª auditoría) · **Valor** · **Esf.** (S ≤ 1 sesión, M 2-3, L 4+) · **Puerta** (E exenta, V visible, T tercero, X fuera de la app, H toca Hoy) · **Δ min/sem** del usuario · **WP** paquete del plan · **Tramo**.

### 5.0 Rediseño y plataforma (séptima auditoría, adoptado el 19/10/2026 · P13)

Origen: `docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md` (IDs `XGO`, `XDA`, `XUX`). Estado, decisiones y orden vivos: `docs/rediseno/ESTADO.md` (§2, §3b y §8); pantallas de referencia: `docs/rediseno/referencias/`. Cuenta como **1** de los 3 paquetes en curso (§4).

| # | ID | Qué | Origen | Decisión del hogar | Estado |
|---|---|---|---|---|---|
| 1 | RD-A1…A3 | Tema visual v2, formato de cifras, acciones frente a conclusiones y Hoy v2 | 7ª | — | **Hecho** (#514-#517) |
| 2 | RD-V2 | Diseño nuevo por defecto en la URL base, mismas funciones que el clásico; `?tema=clasico` como salida | 7ª | 19/10 | **Hecho 19/10** (#519) |
| 3 | RD-CI | El CI guarda trazas y capturas de Playwright cuando algo falla | 7ª §3 | P5 | **Hecho 19/10** (#520) |
| 4 | RD-COB | Cobro manual caducado y gasto diario de 0 € sin silencio | datos reales 19/10 | P3, P4 | **Hecho 19/10** (#521) |
| 5 | XGO-01 | Desalojo de `app.js` en dos PR; techo por trinquete | 7ª | P6, P7 | **Desalojo hecho 21/10**: PR-0 (las pruebas leen el código de la app con `tests/helpers/codigo-app.cjs`, #525), PR-1 (Registrar + Datos a `registrar-ui.js` y `datos-ui.js`, #526) y PR-2 (Partidas a `partidas-ui.js` y motor de escenarios a `escenarios-ui.js`); `app.js` 37.448 → 33.129, techo 33.259. **PR-3 hecho 27/10:** el asistente «Importar extracto» a `importar-extracto-ui.js`; `app.js` 32.296, techo 32.426. **«Uno entra, uno sale» comprobado por el CI, hecho 26/10**: una e2e cuenta los titulares visibles por defecto en cada destino del menú y sus pestañas (31 rutas, 226 titulares) y exige que coincidan con `docs/gobierno/superficie.json`; una prueba unitaria exige que el total no pase del techo (base + excepciones escritas) y que la base baje cuando algo sale |
| 6 | XGO-03 | «Funciones en prueba» (Ajustes › Simuladores y Laboratorio), el tema como primer interruptor, aviso de graduación a las dos semanas con confirmación manual | 7ª | P8, P9 | **Hecho 22/10**: tarjeta en los dos temas, interruptor «Diseño nuevo», las cuatro pantallas del rediseño con su revisión; primeras revisiones el 2/11 y el 4/11. Las métricas se miden con XGO-02 |
| 7 | XGO-02 | Medidor de utilidad por función, PR aparte tras XGO-03 | 7ª | P10 | **Hecho 22/10**: vista, acción, descarte y deshecho por función y mes (y segundos hasta la primera acción en Hoy), informe en Uso de la app y «Medido» junto a cada métrica de Funciones en prueba. Instrumentadas las cinco funciones en prueba; el resto, al revisarlas |
| 8 | RD-A4 | Movimientos e Importar (B3, E1) en dos PR; cuadre que solo bloquea si el extracto trae saldos | 7ª | P11, P12 | **Hecho 21/10** (adelantado por el hogar delante de XGO-03): PR-1 Movimientos v2 (#533) y PR-2 Importar v2 con cuadre; duplicados seguros solos (P17) y sin partida a la bandeja (P18) |
| 9 | RD-A5 | Clasificar por lotes (B4, XDA-05) | 7ª | — | **Hecho 21/10** (adelantado por el hogar): hoja inferior en móvil y panel derecho en escritorio desde la bandeja de Movimientos, 5 grupos por tanda, regla con «Deshacer»; la confianza por grupo queda en tarea aparte |
| 10 | RD-WK | Pruebas de las pantallas v2 en WebKit (390×844) | 7ª | P14 | **Hecho 26/10**: proyecto `safari` (WebKit, iPhone 13, 390×844) sobre las 14 pruebas v2 a 390 px con la etiqueta `@safari` y un barrido del menú principal; paso bloqueante en el CI |
| 11 | RD-COB2 | Estimar el siguiente cobro con el mismo mes del año anterior (cambia el motor de cobertura) | nota de P1 | por decidir | Propuesta |
| 12 | RD-B5 | Repaso semanal (B5 · XUX-03): saldos, extracto, lo que vino, bandeja y listo, con cronómetro; M-COSTE medido solo | 7ª | 24/10 (regla de parada levantada) | **Hecho 24/10**; revisión en «Funciones en prueba» el 7/11. Se retira si se abandona a medias más de la mitad de las veces |
| 13 | RD-HOY1 | Hoy, cambio 1: las preguntas de cobros y cargos esperados, a la bandeja de Movimientos (v2) | 7ª, §4 | 23/10 | **Hecho 24/10, activo desde el 25/10** (puerta de fecha) |
| 14 | RD-HOY2 | Hoy, cambio 2: la entrada al Repaso semanal, solo mientras el de esa semana está por hacer (v2) | 7ª, §4 | 24/10 | **Hecho 24/10, activo desde el 1/11** (puerta de fecha). El cambio de la semana del 8/11, por decidir con lo medido |
| 15 | XDA-02 | Buzón de extractos: paso 0 (formatos reales, H-22), PR-1 importar en un toque, PR-2 buzón en Supabase con Atajo | 7ª | 25/10 | **PR-1 hecho 25/10**; **PR-2 construido y probado el 25/10, sin desplegar**: lo despliega el hogar (H-34, `docs/XDA02_DISENO.md` §6); paso 0 pendiente del hogar antes del 31/10 |
| 16 | XDA-04 | Cobertura del libro: PR-1 (periodo de cada extracto deducido y preguntado al importar, motor, «¿ha llegado…?» sin huecos, aviso en el cierre) y PR-2 (tira de 90 días por cuenta, y WP-36/WP-41 dicen qué días no han podido mirar) | 7ª | 26/10 | **PR-1 hecho 26/10**; PR-2 cuando haya dos importaciones reales |
| 17 | XDA-03 | Extractos en PDF: nivel 1 (texto pegado, motor de líneas con signo por saldo) y nivel 2 (pdf.js en el propio sitio, mismo motor) | 7ª | 26/10 | **Nivel 1 hecho 26/10**; nivel 2 si el paso 0 confirma una cuenta que solo da PDF (pdf.js aceptado por el hogar) |
| 19 | XIN-02 | Vigía de la recompra (art. 33.5 f y g LIRPF): aviso con la parte diferida y la fecha en el libro de operaciones; fecha de recompra en las candidatas a aflorar pérdidas y en la campaña fiscal | 7ª | 26/10 | **Hecho 26/10** (sin puerta). El reparto proporcional solo está contrastado con fuentes secundarias: se dice como estimación |
| 24 | XDA-10 | Antes de decidir: qué dato antiguo podría darle la vuelta al veredicto | 7ª (Siguiente) | sin puerta | **PR-1 hecho 27/10, en prueba y apagado** (saldos en el guardarraíl de colchón). PR-2: Euribor, cancelar deuda (DEB-15) y simuladores de inversión y escenarios |
| 23 | XPR-07 | El arreglo más barato para un descubierto: cuánto falta y las palancas por coste | 7ª (Siguiente) | sin puerta | **PR-1 hecho 27/10, en prueba y apagado** (discrecional, colchón, línea de crédito). PR-2: traspasos (con XPR-05) y tarjetas (con WP-41) |
| 22 | XUX-02 | Ver cada pantalla con datos de ejemplo: «Ver cómo quedaría» en las tarjetas vacías que piden un alta | 7ª | sin puerta | **PR-1 hecho 27/10, en prueba y apagado** (plan B y política de inversión). Más tarjetas, si el medidor dice que se usa |
| 21 | XDA-01 | Lo que la app te pide: contrato de datos por función, coste semanal frente a 10 min, funciones con hambre | 7ª | sin puerta | **PR-1 hecho 26/10, en prueba y apagado** (interruptor propio). PR-2 («Pausar», plegar con hambre, valor por minuto) si se usa |
| 20 | XPR-06 | Toca un día de la banda de caja y mira qué lo mueve: desglose con certeza, tramo de lo estimado y «¿Sabes el día?» a Días de cargo | 7ª | sin puerta | **Hecho 26/10, en prueba y apagado** (interruptor propio en Funciones en prueba; revisión a las dos semanas de encenderlo). Corregir importes desde la hoja, si se usa |
| 18 | XDA-05 | Clasificar por lotes: PR-1 medir la calibración (confianza, tal cual, segundos; contador con tiempo; gasto importado con partida) y PR-2 aceptar en bloque los de confianza alta. Sin tarjetas que se deslizan | 7ª | 26/10 | **PR-1 hecho 26/10**; PR-2 cuando haya ≥ 20 grupos de alta con ≥ 95 % tal cual (lo dice el medidor). Se retira la propuesta si se corrige más del 30 % |

### 5.1 P0 — con fecha o habilitadora inmediata (Ola 1, 5/10 - 23/10/2026; la campaña fiscal se cierra antes del 15/11)

| # | ID | Qué | Origen | Valor | Esf. | Puerta | Δ | WP | Ola |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **FIS-01** | Campaña fiscal de fin de año: acciones ordenadas por euros y fecha límite — **aparcado 3/10 (sin datos fiscales); retomar como tarde el 1/11** | 6ª | Alto · **31/12** | M | V | +10/año | WP-23 | Ola 1 |
| 2 | **DAC-02** | Tope de la deducción por vivienda (régimen transitorio, **confirmado que aplica**, S4) | 6ª | **Alto** · 31/12 | S | E | 0 | WP-23 | Ola 1 |
| 3 | FIS-02 | Ajustar la retención voluntaria para no pagar en junio | 6ª | Medio | S | V | 0 | WP-23 | Ola 1 |
| 4 | HOG-02 | Asignación personal sin detalle, prueba de 3 meses desde el 1/11 | 6ª | Medio-Alto | S | V (configuración) | −10 | WP-24 | **Hecho 4/10** (falta el alta del hogar; revisión a finales de enero) |
| 5 | NXP-02 | Sello de versión y aviso de «versión nueva» — **✅ hecho 3/10/2026 (WP-01, sesión 299)** | 5ª | Alto | S | E | 0 | WP-01 | Ola 1 |
| 6 | NXP-01 | Prueba cronometrada dentro de la app (un usuario, saldos del día) — **✅ construida 3/10/2026 (WP-02, sesión 299); línea base pendiente del hogar** | 5ª | Crítico | S-M | E | 0 | WP-02 | Ola 1 |
| 7 | PRV-06 | «X € al día hasta cobrar», **como variante B de la medición** (no como entrega; no alterna hasta tener la línea base con A, 3/10) — **construido en WP-02, elegible en Ajustes** | 6ª | Alto | S | H → medición | 0 | WP-02 | Ola 1 |
| 8 | UXS-05 | Dos textos para la cifra de Hoy, dentro de la medición — **construido en WP-02** | 6ª | Medio (n = 1) | S | H → medición | 0 | WP-02 | Ola 1 |
| 9 | UXS-04 | Panel de uso real (+ minutos autodeclarados, R3) — **✅ hecho 3/10/2026 (WP-03, sesión 299); «gasto en < 48 h» y «decisiones» sin medir aún** | 6ª | Alto | S | E | 0 | WP-03 | Ola 1 |
| 10 | NTC-03 | Contador de uso **multi-dispositivo** (reducido: un usuario; **y un solo móvil, 3/10: sin sincronización**) — **✅ hecho como contador local (WP-03)** | 5ª | Medio | S | E | 0 | WP-03 | Ola 1 |
| 11 | ND-13 | Spike PSD2 de 2 semanas, comparado con Apple Pay y avisos del banco | 5ª | Alto | S | T (documental) | — | WP-05 | Ola 1 |
| 12 | NTC-06 | Revisión de seguridad previa a cualquier conexión externa | 5ª | Alto | S | E | 0 | WP-05 | Ola 1 |
| 13 | NTC-01 | Extraer el motor de fechas a `canonical-timing.js` | 5ª | Alto (habilita) | M | E | 0 | WP-07 | Ola 1 |
| 14 | NPV-03 | Cierre de mes con saldo y firma; cerrar el mes anterior (C2) | 5ª | Crítico | M | E | +2/mes | WP-09 | Ola 1 |
| 15 | NPV-08 | Medidor de calidad de datos de la previsión | 5ª | Alto | S | V | 0 | WP-10 | Ola 1 |
| 16 | NXP-05 | Campo de importe unificado (es-ES) | 5ª | Alto | S-M | E | −1 | WP-11 | **Fase 1 (Registrar) hecha 4/10** |
| 17 | CAP-02 | Enlaces de registro prellenado (+ plantilla del Atajo de Apple Pay, R1) | 6ª | Alto | S | E | −5 | WP-25 | **Hecho 4/10** (el Atajo a diario espera a WP-30: cuenta doble) |

*ND-03 paso 0 (script de viabilidad del día de cargo, WP-04) y el gobierno de octubre (WP-06: Nielsen 16/10, 23/10 sin retirar nada, plazo 30/11 de `A5-1`/`A5-4`) también son de la Ola 1; no son propuestas, son tareas.*

### 5.2 P1 — siguiente (Ola 2, 26/10 - 20/11/2026, y primeras de la Ola 3)

| # | ID | Qué | Origen | Valor | Esf. | Puerta | Δ | WP | Ola |
|---|---|---|---|---|---|---|---|---|---|
| 1 | NIN-02 | Hoja de valoración rápida con snapshots (hoy no se puede actualizar el valor de una posición) | 5ª | **Crítico** | M | V | +3/mes | WP-15 | Ola 2 |
| 2 | ND-01 | Actualizar saldos por excepción («Coincide» / «Corregir») | 5ª | Crítico | M | V | −10 | WP-26 | **Hecho 4/10** («Pulso de saldos»; el esperado es el último dato real, la previsión solo avisa) |
| 3 | ND-02 | Un extracto actualiza saldo y movimientos a la vez | 5ª | Alto | S-M | V | −3 | WP-26 | **Hecho 4/10** (oferta marcada en el paso 4, continuidad por fichero, dentro del lote; la cuenta del extracto llega al libro) |
| 4 | ND-03 | Día de cargo por partida (declarado; sugerido si WP-04 lo justifica) | 5ª | Crítico | M | E | +30 una vez | WP-08 | **Hecho 4/10** |
| 5 | CAP-06 | Cargos esperados que no llegaron | 6ª | Alto | S-M | E | 0 | WP-27 | Ola 2 |
| 6 | ND-08 | Cobros esperados: confirmar o informar de un retraso | 5ª | Alto | S-M | E | 0 | WP-14 | Ola 2 |
| 7 | ND-11 | Euribor, €STR e IPC oficiales con caducidad | 5ª | Alto | S-M | E | −2 | WP-13 | Ola 2 |
| 7b | **NDB-02** | Revisión del tipo variable con el Euribor oficial: cuota estimada en la próxima revisión, avisos a 60 y 30 días (**hipoteca variable, confirmado**) | 5ª | Alto | S-M | V | 0 | WP-20 | Ola 2 |
| 8 | NPV-07 | Kit de gráficos táctil y accesible | 5ª | Alto (habilita) | M-L | E | 0 | WP-28 | Ola 2 |
| 9 | NHG-05 | Carta del mes determinista (lo único que se pidió explícitamente en la Ola 2) | 5ª | Medio-Alto | M | V | 0 | WP-29 | Ola 3 |
| 10 | ND-14 | Hoja de captura de un gasto en ≤ 8 s | 5ª | Alto | M | V | −10 | WP-30 | Ola 2 |
| 11 | NPV-02 | Backtest de liquidez a fin de mes (dice «datos insuficientes» hasta 3 cierres) | 5ª | Alto | M | E | 0 | WP-12 | Ola 2 |
| 12 | CAP-05 | Lector de la nómina en PDF | 6ª | Alto | M | E | −5/mes | WP-31 | Ola 2 |
| 13 | NPV-11 | Retenciones acumuladas automáticas para el estimador de Renta | 5ª | Medio-Alto | S-M | E | −1 | WP-31 | Ola 2 |
| 14 | CAP-09 | Recordatorios en el momento de máximo valor (absorbe ND-10) | 6ª | Alto | S | X | −3 | WP-32 | Ola 2 |
| 15 | ND-10 | Recordatorios suscribibles (absorbido por CAP-09) | 5ª | — | — | X | — | WP-32 | Ola 2 |
| 16 | NTC-02 | Historiales sintéticos con verdad conocida (calibrar ND-03 y NPV-01) | 5ª | Alto (habilita) | M | E | 0 | WP-33 | Ola 2 |
| 17 | PRV-08 | Revisión base cero del plan (enero) | 6ª | Medio | S-M | V | +15/año | WP-34 | Ola 3 (enero) |
| 18 | PRV-02 | Previsión en tres capas: comprometido, probable y discrecional | 6ª | Alto | M | V | 0 | WP-35 | Ola 3 |
| 19 | PRV-04 | Ingresos inciertos con probabilidad (paga extra, variable, Renta, local) | 6ª | Alto | M | V | 0 | WP-35 | Ola 3 |
| 20 | ND-07 | Detector de anomalías en el extracto (a la bandeja) | 5ª | Alto | M | E | 0 | WP-36 | Ola 3 |
| 21 | NXP-04 | Estados completos y «deshacer» en lugar de confirmar | 5ª | Alto | M | E | 0 | WP-37 | Ola 3 |
| 22 | NTC-04 | WebKit en la medición de carga | 5ª | Medio | S-M | E | 0 | WP-52 | Ola 3 |
| 23 | PRV-05 | Plan B acordado en frío, con disparador | 6ª | Alto | M | V | 0 | WP-38 | Ola 3 |
| 24 | NPV-09 | Palanca de recorte («¿cuánto aguanta el colchón?»), dentro del plan B | 5ª | Medio | M | V | 0 | WP-38 | Ola 3 |

*Dentro de la Ola 3, primero lo de P1 y después lo de P2, en el orden de las tablas.*

### 5.3 P2 — planificada (Ola 3, 23/11/2026 - 22/1/2027)

| # | ID | Qué | Origen | Valor | Esf. | Puerta | Δ | WP | Ola |
|---|---|---|---|---|---|---|---|---|---|
| 1 | CAR-01 | Política de inversión del hogar (una página, firmada) | 6ª | Alto | M | V | 0 | WP-39 | Ola 3 |
| 2 | DAC-01 | Conciliar la deuda con la CIRBE, operación a operación | 6ª | Medio-Alto | S-M | E | +10/año | WP-40 | Ola 3 |
| 3 | DAC-04 | Deuda en la sombra (permanencias, aplazamientos, financiación en factura) | 6ª | Medio | M | E | 0 | WP-41 | Ola 3 |
| 4 | DNU-03 | TAE real del «0 %» y de los aplazamientos de tarjeta | 6ª | Medio | S | E | 0 | WP-41 | Ola 3 |
| 5 | CAP-10 | Sin duplicados entre canales de captura | 6ª | Crítico con ≥ 2 canales | M | E | −2 | WP-53 | Ola 3 |
| 6 | NIN-10 | Informe fiscal anual de inversión para la Renta (antes del 31/3) | 5ª | Alto en temporada | M | V | 0 | WP-21 | Ola 3 |
| 7 | FIS-03 | Impuestos del local alquilado y actualización de la renta | 6ª | Medio-Alto | M | V | +5/año | WP-21 | Ola 3 |
| 8 | NIN-01 | Cartera como tablero con «siguiente mejor acción» (reglas de CAR-01) | 5ª | Alto | M-L | V | 0 | WP-17 | Ola 3 |
| 9 | ND-04 | Perfiles de extracto con autodetección | 5ª | Alto | M | E | −2 | WP-51 | Ola 3 |
| 10 | NDB-01 | Camino a deuda cero: una narrativa, un control | 5ª | Alto | M-L | V | 0 | WP-19 | Ola 3 |
| 11 | CAR-03 | Dónde va el próximo euro (escalera) | 6ª | Alto | M | V | 0 | WP-42 | Ola 3 |
| 12 | NIN-05 | Rebalanceo por aportaciones (sin vender), dentro de la escalera | 5ª | Alto | M | V | 0 | WP-42 | Ola 3 |
| 13 | NIN-08 | Dónde poner la liquidez ociosa, peldaño de la escalera | 5ª | Medio-Alto | M | V | 0 | WP-42 | Ola 3 |
| 14 | NPV-01 | Banda de caja diaria con ventanas de fecha | 5ª | Alto | L | V | 0 | WP-16 | Ola 3 |
| 15 | PRV-01 | Puente de previsión: por qué cambió el fin de año | 6ª | Alto | M | V | 0 | WP-43 | Ola 3 |
| 16 | NIN-03 | Aportado frente a valor y rentabilidad ponderada por tiempo | 5ª | Alto | M | V | 0 | WP-18 | Ola 3 |
| 17 | CAR-02 | Panel de calma en caídas | 6ª | Medio-Alto | S-M | V | 0 | WP-44 | Ola 3 |
| 18 | CAR-05 | Qué parte de los gastos pagan ya los activos | 6ª | Medio | S | V | 0 | WP-44 | Ola 3 |
| 19 | CAR-06 | Exposición por entidad y garantía | 6ª | Medio | S | V | 0 | WP-44 | Ola 3 |
| 20 | ND-09 | Frescura por fuente en el centro de datos | 5ª | Alto | S | V | 0 | WP-45 | Ola 3 |
| 21 | CAP-07 | Tareas de datos ordenadas por lo que mueven la cifra | 6ª | Alto | M | V | −5 | WP-45 | Ola 3 |
| 22 | NPV-10 | Patrimonio neto: serie histórica y proyección con hitos | 5ª | Alto | L | V | 0 | WP-46 | Ola 3 |
| 23 | NPV-05 | Reparto de la nómina en un paso (sobre la escalera) | 5ª | Alto | M | V | −5 | WP-47 | Ola 3 |
| 24 | NIN-06 | Operaciones de cartera editables e importador del bróker | 5ª | Alto | L | V | −3 | WP-48 | Ola 3 |
| 25 | NPV-04 | Mapa anual de pagos grandes con su sobre | 5ª | Medio-Alto | M | V | 0 | WP-49 | Ola 3 |
| 26 | CAR-04 | Vivienda y local revalorizados por índice oficial | 6ª | Medio | S-M | V/T | −2/trim. | WP-50 | Ola 3 |

### 5.4 P3 — catálogo con disparador (27)

| ID | Qué | Origen | Triaje | Se activa cuando |
|---|---|---|---|---|
| CAP-01 (nivel 2) | Pagos de Apple Pay a la bandeja sin abrir la app (servidor) | 6ª | Más tarde | La plantilla de WP-25 se usa ≥ 3 semanas seguidas y pasa NTC-06 |
| CAP-03 | Avisos del banco por SMS o correo | 6ª | Más tarde | El spike WP-05 lo recomienda frente a PSD2 |
| CAP-04 | Saldo desde una captura de pantalla | 6ª | Más tarde | Tras WP-26, actualizar saldos sigue costando > 20 s |
| PRV-03 | Inflación propia del hogar | 6ª | Más tarde | ≥ 13 meses de reales por partida |
| PRV-07 | Hasta dónde acierta la previsión | 6ª | Sí | ≥ 6 cierres con previsión congelada (WP-12) |
| DAC-03 | ¿Compensan las vinculaciones? | 6ª | Más tarde | Renovación de un seguro vinculado o revisión del préstamo |
| DAC-05 | ¿Cobra el banco la cuota pactada? | 6ª | Más tarde | Una cuota distinta de la esperada (recomendación de Claude: **subirla en cuanto haya extractos mensuales regulares**; protege dinero cada mes) |
| UXS-01 | Siri dice la cifra sin abrir la app | 6ª | Más tarde (S6 Sí en principio) | Revisión de privacidad del enlace hecha |
| UXS-02 | Resumen semanal por correo | 6ª | Más tarde | Decisión del 30/11 sobre `A5-4` (push): si se archiva, esta es la alternativa |
| UXS-03 | Medición automática de cuánto tarda cada tarea | 6ª | Más tarde | La autodeclaración de WP-03 no basta para controlar GOV-01 |
| UXS-06 | Respuestas sin IA en el buscador | 6ª | Sí | El panel de uso muestra búsquedas frecuentes sin resultado |
| HOG-01 | Acuerdos del hogar vigilados | 6ª | Sí | El hogar escribe acuerdos de gasto que quiere vigilar |
| HOG-03 | Modo relevo (pausa y puesta al día tras una ausencia) | 6ª | Sí | El usuario lo pide antes de una ausencia larga |
| ND-05 | Bandeja por gesto desde el móvil (Atajo + función privada) | 5ª | — | Igual que CAP-01 nivel 2 (se fusionan) |
| ND-06 | Gestor de reglas de clasificación | 5ª | — | Una partida mal clasificada se repite ≥ 2 meses |
| NPV-06 | «¿Y si…?» desde Previsión | 5ª | — | El panel de uso muestra visitas al Laboratorio desde Previsión |
| NPV-12 | Control global de prudencia de la previsión | 5ª | — | Si ND-03 no reduce el error de caja en 3 meses |
| NIN-04 | Cumplimiento del plan de aportación | 5ª | — | Tras NIN-02, aportaciones registradas ≥ 3 meses |
| NIN-07 | Patrimonio neto de impuestos latentes | 5ª | — | Tras NPV-10 |
| NIN-09 | Prueba de estrés en una pulsación | 5ª | — | Tras CAR-01 (la política define los escenarios) |
| NDB-03 | «¿Me puedo permitir X?» con tres vías de pago | 5ª | — | Tras NDB-01 y con la métrica de Hoy cumplida |
| NDB-04 | Cambiar de banco o subrogar: coste y punto de equilibrio | 5ª | — | Oferta de otro banco o LTV favorable (CAR-04) |
| NXP-03 | Procedencia bajo demanda (P12) | 5ª | — | Medición de WP-02: si la cabecera molesta (en un Pro Max no es la causa) |
| NXP-06 | Modo discreto (y passkey, más tarde) | 5ª | — | Petición del usuario |
| NHG-01 | Cuentas claras en pareja (titular explícito, liquidación mensual) | 5ª | — | La asignación personal (HOG-02) se mantiene tras la prueba de 3 meses |
| NHG-04 | Objetivos visuales | 5ª | — | Tras la carta del mes (WP-29): si se piden objetivos en ella |
| NTC-05 | Fecha de retirada del doble motor de deuda | 5ª | — | Tras NDB-01 con paridad en verde 3 versiones |

### 5.5 P4 — bloqueadas por un tercero o un evento (5)

| ID | Qué | Bloqueo | Se desbloquea |
|---|---|---|---|
| ND-12 | Precios de mercado por ISIN | Decisión del hogar (Q6: manual primero) | Petición explícita |
| NDB-05 | Evaluador de una oferta de deuda nueva | Evento | Llega una oferta real |
| DNU-01 | Cuánto os prestaría un banco | Evento | Se plantea un préstamo o hipoteca |
| DNU-02 | Coche: contado, préstamo, cuota final o renting | Evento | Se plantea cambiar de coche |
| HOG-04 | Modo viaje | Evento | Un viaje largo previsto |

### 5.6 Archivo (4)

| ID | Qué | Por qué | Se reactiva si |
|---|---|---|---|
| NXP-07 | Modo consulta nivel 1 (D4/D5) | Solo servía a una segunda persona usuaria; «nadie más» (3/10/2026) | Se incorpora otra persona |
| NHG-02 | Reunión mensual del hogar | Ídem | Ídem |
| CAP-08 | Captura desde el móvil de quien consulta | Ídem | Ídem |
| NHG-03 | Lista de deseos con enfriamiento | La de menos evidencia de la quinta auditoría; sin petición | Petición explícita |

---

## 6. Pendientes que no son propuestas

| ID | Qué | Disposición |
|---|---|---|
| H1 | Diagnóstico de «no la encontró» | WP-02, con un usuario y saldos del día. **Desde el 23/10, M-HOY se lee con el medidor de utilidad** (§4) |
| H2 | Actualizar saldos y repetir la medición | WP-02 (S8). **Sustituida el 23/10** por la medición pasiva (§4) |
| H3 | D4/D5 (modo consulta) | Archivado (nadie más usará la app) |
| H4 | Tiempo de registrar un gasto | WP-02 + autodeclaración de WP-03; mejora con WP-30 |
| H5 / C2 | Cierre con saldo y mes anterior | WP-09 |
| H6 | Retiradas y Cola B | 23/10: no se retira nada; se decide con el panel de uso (WP-03) en la revisión de enero |
| H7 | ¿Hipoteca variable, mixta o fija? | **Resuelta el 3/10: variable** → `NDB-02` en P1 (WP-20, Ola 2) |
| H8 | `A5-1`/`A5-4`: activar o archivar antes del 30/11/2026 | Abierta; si se archivan, `UXS-02` es la alternativa a `P4`/`GOB5` |
| `RGX3`, `DEX6`, `GOB5`, `P4`, `P10`, UI del Copiloto | Condicionadas a `A5-1`/`A5-4` | Se archivan el 30/11 si no se activan (H8) |
| `O-6` | PSD2 (conexión con CaixaBank y Banco Mediolanum) | **Cerrado el 20/10/2026 · 🔁 MARCADO PARA RECUPERAR.** Se cerró sin la verificación práctica (WP-05 hecho; WP-13 PR-2 archivado). **Se recupera si** (a) el hogar lo pide, o (b) la frescura de los saldos del panel de uso (Ajustes › Uso de la app: días con saldos de ≤ 3 días) queda **por debajo del 90 % dos semanas seguidas** con ≥ 7 días de uso, es decir, si el «Pulso de saldos» (WP-26) no basta. **Se mira** en la revisión de enero de 2027 (§7) y en cada revisión mensual. **Primer paso al recuperarlo:** la verificación práctica en Enable Banking (≈ 20 min, pasos en `docs/ND13_SPIKE_CONEXION.md`) y su tabla de decisión. Ninguna conexión sin la revisión de `docs/NTC06_AMENAZAS.md` |
| `OPT-10`–`OPT-13`, entrega 5 de la Ola 1 | Retirar pantallas sin uso | Revisión en enero con 3 meses de panel de uso; mecanismo: redirigir sin borrar código (GOV-02) |
| `NAV-3` | Recorrido de bienvenida | Archivado (nadie más usará la app) |
| `ARQ-4` | Visual Detail sin extraer de `app.js` | Aparcado (sin cambios) |
| `I3` | Mapa de correlación | P3: se activa con ≥ 6 valoraciones de NIN-02 |
| `I6` | Fiscalidad de cripto/derivados | P4: sin posiciones de ese tipo |
| Cola B | 42 mejoras de la cuarta auditoría (artefacto externo) | P3: criterio `PROC-1`, se activa con uso real |
| UX-P4 | Margen de 82 líneas en `app.js` | Se resuelve extrayendo (WP-07 y cada paquete nuevo en su módulo) |
| UX-P2 | Lighthouse con `optimistic` | Decisión del hogar (cambia lo que promete el CI); sin fecha |
| UX-P1, P3, P5, P6, P7, UX-N1…N4 | Rendimiento y estética menores | Sin cambios (P3 de hecho); UX-P3 lo cubre WP-52 |

---

## 7. Calendario con fecha (hitos)

| Fecha | Qué |
|---|---|
| 3/10/2026 | **Arranca la Ola 1** (el hogar dijo «empecemos»); el 4/10 queda construida salvo WP-23 |
| Antes del 16/10 | El hogar: cronometrar una vez cómo actualiza hoy los saldos (línea base de WP-26) y los 3 intentos de la prueba de Hoy (WP-02) |
| Semana del 12/10/2026 | **Campaña fiscal (WP-23)**, con los datos fiscales en el chat (decisión del hogar del 4/10; **desde el 16/10 se teclean en la app**, «Tus datos fiscales») |
| 16/10/2026 | Revisión mensual de Nielsen (`OPT-21`) · **decisión de `O-6`** (conexión bancaria): **cerrado el 20/10, sin verificación** |
| 23/10/2026 | Fin de la Ola 1 · `OPT-10`–`OPT-13`: no se retira nada · **revisión de salida: parar y revisar** |
| 25/10/2026 | Se levanta la congelación de Hoy; sus cambios entran de uno en uno, uno por semana (§4) |
| Antes del 31/10 | El hogar: **importar el extracto de octubre de cada cuenta** y clasificar (H-22) |
| Antes del 1/11 | El hogar: dar de alta las dos fichas de la asignación personal y programar las transferencias con concepto fijo |
| 2/11 y 4/11/2026 | Revisiones de «Funciones en prueba» con el medidor: diseño nuevo y Hoy (2/11); Movimientos, Importar y Clasificar (4/11) |
| 1/11/2026 | Arranque de la asignación personal (WP-24) |
| 1-3/11/2026 | **Primer cierre de mes con saldo** (octubre, WP-09): saldos del día y firma |
| **14/11/2026** | **Campaña fiscal lista** (WP-23) |
| 20/11/2026 | Fin de la Ola 2 |
| 30/11/2026 | Plazo de `A5-1`/`A5-4` (H8) |
| 1-3/12/2026 | Segundo cierre con saldo (noviembre) → **primera carta del mes** (WP-29, si ya está construida) |
| 31/12/2026 | Fecha límite de las acciones fiscales (plan de pensiones, amortización dentro del tope, minusvalías, donativos) |
| Enero 2027 | Revisión base cero del plan (WP-34) · revisión de la asignación personal · revisión de retiradas con el panel de uso · **mirar el disparador de `O-6`** (frescura de saldos < 90 % dos semanas seguidas → recuperarlo, §6) |
| 22/1/2027 | Fin de la Ola 3: todo P0-P2 construido |
| Febrero 2027 | Con 3 cierres con saldo: primer backtest de caja (WP-12) y serie de patrimonio (WP-46) con contenido |
| 31/3/2027 | Informe fiscal de inversión y del local con los datos de 2026 (WP-21) |
| Abril-junio 2027 | Campaña de la Renta (*verificar fechas oficiales*) |
| ≈ Mayo 2027 | Con 6 cierres: se puede activar `PRV-07` (P3) |

---

## 8. Decisiones y datos

**Contestado el 3/10/2026:** D1 hipoteca **variable** · D2 tributación **individual** y **sin plan de pensiones de empresa** · D3 **quitar el límite** de entregas visibles · D4 **nadie más** usará la app · D5 y D6 por defecto (minutos autodeclarados; archivar `NHG-03`).

**Falta (nunca en el repositorio). Los datos fiscales se teclean en la app, en Herramientas avanzadas › Fiscal › «Tus datos fiscales» (WP-23 PR-2, 16/10); los de la hipoteca, en Deuda › Contratos:**
| Dato | Para | Si no llega |
|---|---|---|
| Lo pagado por la vivienda en 2026 (cuotas y amortizaciones) y lo previsto hasta diciembre, **por titular** | WP-23 (tope de 9.040 € por declarante: con tributación individual, cada titular que deducía tiene su propio tope sobre lo que paga) | La campaña sale con la acción pero sin euros |
| Titulares de la vivienda y si deducían los dos | WP-23 | Se calcula para un solo declarante |
| Tipo marginal aproximado | WP-23 (valor de la aportación al plan de pensiones: hasta 1.500 € individuales sin plan de empresa) | Se usa la retención declarada como aproximación, rotulado |
| Plusvalías y minusvalías realizadas en 2026 | WP-23 (compensación) | Solo se usan las ventas registradas en la app |
| Hipoteca: índice (¿Euribor a 12 meses?), diferencial, periodicidad de revisión, fecha de la próxima revisión y bonificaciones | WP-20 | Sin próxima revisión no hay aviso; el resto se puede rellenar en Deuda › Contratos |

---

## 9. Métricas

| Métrica | Objetivo | Se mide con |
|---|---|---|
| Tiempo hasta la primera acción en Hoy | Mediana ≤ 15 s | Medidor de utilidad (XGO-02), desde el 23/10; antes, WP-02 con saldos del día |
| Adopción | ≥ 4 días activos por semana | WP-03 |
| Coste de mantener la app | ≤ 10 min/semana | Repaso semanal (B5), medido solo desde el 24/10; antes, WP-03 autodeclarado |
| Frescura | Saldos de ≤ 3 días en ≥ 90 % de los días | WP-03 |
| Resolución de la previsión | ≥ 70 % del gasto con fecha declarada u observada | WP-10 |
| Calibración | Error de caja a fin de mes decreciente; cobertura P10-P90 ≈ 80 % tras 6 meses | WP-12 |
| Captura | Un gasto en ≤ 8 s | WP-30 |
| Dinero | Campaña fiscal ejecutada antes del 31/12, con su ahorro estimado anotado | WP-23 |
| Inversión | Valoraciones de la cartera al día cada mes | WP-15 |

**Regla de parada:** si una ola entera no mueve ninguna métrica de sus paquetes, no se empieza la siguiente y se revisa el plan con el hogar.

---

## 10. Recetas y trampas del repositorio (verificadas)

**Flujo (`CLAUDE.md`):** validar (`npm run verify`, ~4-6 min) → `PROJECT_STATE.md` con cifras reales → commit/push a la rama de trabajo → PR **en borrador** → esperar CI → fusionar en verde (squash), sin preguntar.

**Reiniciar la rama tras una fusión por squash:** el `push --force-with-lease` está denegado. Patrón: `git fetch origin main <rama>` → `git checkout -B <rama> origin/<rama>` → `git merge --no-edit origin/main` → (cherry-pick si hay commits locales) → comprobar `git diff --stat origin/main HEAD` → `git push -u origin <rama>`.

**Trampas:**
1. `index.html` no puede contener el literal `app.js` fuera del `<script src>`; el sello `app.js?v=` y `design-tokens.css?v=` está fijado en `index.html` y en ~27 pruebas (subir con una expresión regular sobre `tests/*.cjs`).
2. Toda `view-section` nueva lleva `hidden` salvo `#home`; las hermanas de familia llevan `data-nav-family`.
3. Muchas pruebas leen ventanas fijas de caracteres de funciones de `app.js` o fijan la etiqueta `<section …>` exacta; una dependencia nueva dentro de una función extraída a un `vm` exige su stub.
4. **Módulo `canonical-*.js` nuevo:** registrarlo en `index.html` (antes de `app.js`), `service-worker.js` (`SHELL_URLS`) y `tools/build-public-site.mjs`; subir el recuento de `arq3-canonical-sin-consumidor-ui` (hoy 70) y darle un consumidor real en `app.js`.
5. **`app.js` no puede crecer** (techo 37.495 con trinquete; margen 82): cada paquete nuevo vive en su módulo y deja en `app.js` solo el enganche.
6. **Almacén nuevo en el navegador:** clasificarlo en `BACKUP_LOCAL_STORES` o excluirlo con motivo en `tests/arq6-copia-completa.test.cjs`.
7. **Campo nuevo en el estado (`appStatePayload`):** migración y *fixtures* con la herramienta (`state-contract.js`, A13-4), nunca a mano.
8. **Un `BACKLOG*.md` nuevo** debe enlazar a `BACKLOG_INDICE.md`; el índice solo puede tener **una** fila «🟢 Vigente» y la skill `finanzas-casa-workflow` (Modo Inicio, paso 2) debe nombrarla.
9. Service worker «primero caché»: la primera apertura tras un despliegue muestra la versión anterior (lo resuelve WP-01).
10. Tras crear un PR: `subscribe_pr_activity`; al fusionar, `unsubscribe_pr_activity`.
11. Los datos de demostración son anonimizados: decir siempre si una cifra es de la demo o del hogar.
12. **Algo nuevo a la vista** (un titular h2/h3 en un destino del menú o su pestaña) rompe la e2e «XGO-01 · Uno entra, uno sale», que dice qué ha entrado. Regenerar el inventario con `ACTUALIZAR_SUPERFICIE=1 npx playwright test --project=e2e -g "XGO-01"` (con `dist` recién construido) y, si el total sube, plegar otra cosa o escribir la excepción en `docs/gobierno/superficie.json`; si baja, bajar `base`. Lo que solo sale con datos, dentro de un `<details>` cerrado o en un diálogo no cuenta.
13. **WebKit no se descarga en el contenedor de Claude** (el proxy bloquea el CDN de Playwright). Para probar el proyecto `safari` aquí, una configuración temporal fuera del repositorio que lo cambia a Chromium con la misma emulación del iPhone; la lectura en WebKit es la del CI. Una prueba nueva de una pantalla v2 a 390 px lleva `{ tag: "@safari" }` (o `enSafari(viewport)` si recorre dos anchos).
14. **«12 de 12 en rojo» en local puede ser el navegador, no la prueba.** Si el Playwright del proyecto espera otra versión de Chromium que la instalada en el contenedor, cada prueba falla al arrancar («Executable doesn't exist … chromium_headless_shell-NNNN»), y con `--reporter=line` y un `grep` del resumen parece un fallo de la app. Se lanza con `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium_headless_shell-<versión instalada>/chrome-headless-shell-linux64/chrome-headless-shell`. Mirar siempre el primer error antes de concluir nada.
15. **Safari reintenta una vez en el CI, y solo Safari (decisión del hogar del 28/10/2026).** En un día fallaron de vez en cuando tres pruebas distintas que solo corren en WebKit: el ensayo del cierre de octubre, el interruptor del diseño nuevo y el foco al terminar el Repaso semanal. Ninguna se pudo reproducir: aquí no se instala WebKit. Desde entonces, una prueba de `safari` que falla y pasa al repetirla queda como «flaky» y no bloquea. Su primer intento queda en el registro del paso de Safari, con un aviso «Safari intermitente» en el PR. **Ese aviso es trabajo:** se busca su causa, no se ignora. Dos fallos seguidos siguen bloqueando, y Chromium no reintenta.
16. **Chromium se cae solo entre pruebas, y la siguiente lo relanza (29/10/2026).** Es «SEGV_MAPERR 0x1b0» tras «InitializeSandbox() called with multiple threads in process gpu-process», en el CI y en local; `--disable-gpu` no lo evita. La prueba de detrás fallaba al crear su contexto («Target page, context or browser has been closed») sin haber empezado. Tumbó #567 y #568. `tests/helpers/navegador-resiliente.cjs` (lo cargan las cuatro *specs* de Playwright) relanza el navegador **una vez**, solo si al crear el contexto ya está desconectado. Deja un `::warning` en el registro con la prueba. Un fallo dentro de una prueba sigue fallando, y nada se salta ni se repite. La E2E «Navegador que se cae entre pruebas» lo comprueba cerrándolo a propósito.

---

## 11. Dónde está el detalle

| Tema | Documento |
|---|---|
| Plan de desarrollo: 3 olas, paquetes WP-01…WP-54, enfoque técnico, pruebas, calendario, riesgos | `docs/PLAN_DESARROLLO_DEFINITIVO.md` |
| Porqué de las propuestas `ND`/`NPV`/`NIN`/`NDB`/`NXP`/`NHG`/`NTC` | `docs/PROPUESTA_QUINTA_AUDITORIA_2026-10-02.md` |
| Porqué de las propuestas `CAP`/`PRV`/`CAR`/`DAC`/`DNU`/`FIS`/`UXS`/`HOG`/`GOV` | `docs/PROPUESTA_SEXTA_AUDITORIA_2026-10-03.md` |
| Enfoque técnico de WP-01…WP-21 | `docs/PLAN_IMPLEMENTACION_2026-10-03.md` (sigue valiendo; WP-22 queda retirado y repartido) |
| Respuestas del triaje y contradicciones R1-R5 | `BACKLOG_INICIO_OLEADA_OCTUBRE.md` §15.4 |
| Historia de la Ola 2 y sus mediciones | `docs/OLA2_RECALIBRACION.md` |
| Registro sesión a sesión | `PROJECT_STATE.md` |
| Plan en datos (paquetes, propuestas, hitos, tareas del hogar, métricas) | `docs/plan/plan-definitivo.json` |
| Avance real (estado de cada paquete, lecturas de métricas, tareas del hogar hechas) | Panel de seguimiento (artefacto privado, §12) |

---

## 12. Seguimiento del avance

**Petición del hogar (3/10/2026, sesión 298):** «genera un backlog y artefacto para poder ver el plan y controlar el grado de avance».

**Tres piezas, cada una con un solo trabajo:**
| Pieza | Qué guarda | Quién la cambia |
|---|---|---|
| Este documento | Qué se hace y por qué en ese orden (prioridades, niveles, decisiones) | Claude, cuando cambia el plan |
| `docs/plan/plan-definitivo.json` | El mismo plan en datos: 3 olas, 53 paquetes con sesiones estimadas, dependencias y «hecho cuando», las 104 propuestas, 20 hitos, 33 tareas del hogar, 10 métricas y, desde el 27/10/2026, las 24 filas del §5.0 (`plataforma`) | Se regenera cuando cambia este documento; `tests/plan-seguimiento-sincronizado.test.cjs` falla si los dos se separan |
| **Panel de seguimiento** (https://claude.ai/artifact/7k86qmrcqn8hdhAzx9xcrg, privado) | El **estado**: paquete a paquete (estado, PR, fechas, sesiones reales, resultado de su métrica), cada fila del §5.0 (estado, PR, fin y si su función en prueba está apagada, encendida, graduada o retirada), tareas del hogar hechas, lecturas de métricas, revisión de salida de cada ola y registro de cambios | Claude al cerrar cada sesión; el hogar marca sus tareas y añade lecturas |

**Cómo mide el avance** (para que «vamos bien» signifique algo):
- **Avance ponderado por esfuerzo**, no por número de paquetes: hecho 100 %, en revisión 90 %, en curso, esperando al hogar y aparcado 50 % (desde el 21/10/2026), el resto 0 %. Es el avance **construido**; el **comprobado** solo cuenta los paquetes con su métrica leída con datos reales y en objetivo, y el panel lo da aparte. Un paquete de 7 sesiones (WP-42) pesa siete veces uno de 1 sesión.
- **Línea base fija** (fijada el 3/10/2026): lo previsto a una fecha reparte las sesiones de cada ola de forma lineal entre su inicio y su fin. El desvío se da en sesiones, como índice real/previsto y en **días de retraso** (la fecha en la que la línea base esperaba el avance que hay hoy). Si el arranque se retrasa, el panel lo muestra como retraso; no se mueve la línea base sin decisión del hogar.
- **Construido no es lo mismo que comprobado:** cada paquete con métrica lleva su resultado («sin medir», «cumple», «no cumple»). El panel cuenta aparte los paquetes con valor comprobado. Es la defensa contra el riesgo alto del plan (§6 del plan: construir para nadie).
- **Lo que la curva no ve, aparte (desde el 27/10/2026):** el §5.0 (rediseño y séptima auditoría) entró el 19/10, después de fijar la línea base, así que **no suma al avance construido ni a la curva**: moverla exigiría una decisión del hogar. Tiene su pestaña («Rediseño y plataforma») y una segunda fila de indicadores con tres cifras: entregas del §5.0 hechas (y PR fusionados), **funciones en prueba apagadas** (su revisión de dos semanas no empieza hasta encenderlas) y **tareas del hogar vencidas**. Desde el 28/10/2026 la cifra de apagadas cuenta también los paquetes del plan con interruptor propio (`"enPrueba": "propio"` en su entrada de `paquetes`, hoy WP-18). Cuando el hogar encienda uno, su estado lleva `prueba: "encendida"` (en `wp/<WP-ID>` o en `plataforma/<ID>`). La prueba de sincronía exige tantas marcas como interruptores propios haya en `funciones-en-prueba.js`.
- **Regla de parada visible:** cada ola tiene su «revisión de salida» (pendiente · seguir · parar y revisar) junto a las métricas que hay que mirar.

**Protocolo de Claude al cerrar cada sesión de desarrollo** (después de fusionar):
1. `ArtifactData` → `get` de `wp/<WP-ID>` (o de `plataforma/<ID>` si la sesión tocó una fila del §5.0; en el id, lo que no sea letra, número, `-` o `_` pasa a `-`: `RD-A1…A3` es `RD-A1-A3`) y `set` con su `version` como `if_version`: `estado`, `pr`, `inicio`, `fin`, `sesionesReales`, `resultado` (si se midió), `nota`, y una línea más en `historial` (`{fecha, texto, por: "Claude"}`, se guardan las 20 últimas).
2. Una entrada en `registro` (`{fecha, ts, texto, por: "Claude"}`).
3. Al pasar el primer paquete a «en curso», `meta/plan.arranque` con la fecha.
4. Si cambia el plan (no el estado): regenerar el JSON, `node tools/build-plan-panel.mjs <scratchpad>/plan-contabilidadcasa.html` y volver a publicar el panel **en la misma URL** (`Artifact` con `url`). El estado no se pierde: vive en la base del panel, no en la página.

**Privacidad:** el panel no guarda importes. Las cifras fiscales se teclean en la app («Tus datos fiscales») y las de la hipoteca, en Deuda › Contratos; nunca en el panel ni en el repositorio.

---

## 13. Hallazgos de las pruebas con personas ajenas (WP-54 · GOV-06)

Aquí entran los problemas de usabilidad que salgan de la prueba trimestral con 5 personas ajenas (protocolo, guion y hoja de observación en [`docs/WP54_PRUEBA_USABILIDAD.md`](docs/WP54_PRUEBA_USABILIDAD.md)). **Todavía no se ha hecho ninguna ronda: esta sección está vacía a propósito.** Reglas (detalle en §8 del protocolo): un hallazgo es un problema visto en **≥ 2 personas** y **lleva su evidencia** (resultado A/B/C, segundos, cita literal sin identificar a nadie); visto en 1 es una **observación**; una respuesta equivocada con seguridad es siempre **gravedad alta**. No son paquetes del plan ni cuentan en su avance.

| ID | Tarea | Gravedad | Visto en | Estado |
|---|---|---|---|---|
| — | — | — | — | Sin rondas todavía |
