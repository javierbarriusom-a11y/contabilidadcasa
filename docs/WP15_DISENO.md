# WP-15 · Hoja de valoración de la cartera — diseño

**Estado:** diseño cerrado el 6/10/2026 con las respuestas del hogar. Implementación en dos PR (§8); **este PR-0 es solo documentación**. El PR-1 construye la hoja manual; el PR-2 («pegar desde el bróker») queda **aparcado** hasta tener una muestra real del formato (§2, decisión 1).
**Fuente:** `NIN-02` (`docs/PROPUESTA_QUINTA_AUDITORIA_2026-10-02.md`), ficha de WP-15 en `docs/PLAN_IMPLEMENTACION_2026-10-03.md`, orden del hogar del 5/10/2026 (WP-12, WP-30, WP-15).
**El repositorio es público: ningún dato real del hogar aquí.** Las posiciones, sus valores y las entidades viven en el almacén privado de la app; los ejemplos de este documento y las pruebas usan fondos ficticios.

## 1. Qué se pide y cómo se mide

Poder **actualizar el valor de cada posición de la cartera** sin borrarla y recrearla, dejando un **historial de valoraciones fuera del cierre de mes**. Es el hueco funcional más grave de Inversión: hoy todo lo que depende del valor (ganancia, XIRR, concentración, glide path, apalancamiento, patrimonio) calcula con el valor tecleado al dar de alta la posición.

Medidas (sin cifras inventadas: mientras no haya datos, la pantalla no afirma ninguna):
- **M-VAL1:** % de posiciones valoradas hace ≤ 35 días. Objetivo: 100 % tras cada cierre mensual.
- **M-VAL2:** segundos hasta guardar la hoja, con el mismo mecanismo de tiempos que la hoja de WP-30. Objetivo provisional ≤ 60 s para toda la cartera; **se fija con el número real de posiciones** (el hogar no lo ha dado todavía).
- **Puntos de serie por posición:** con ≥ 3 puntos pueden arrancar WP-44 (caída desde máximos), WP-18 (aportado frente a valor) y WP-46 (patrimonio).

**Criterio de «Hecho» corregido** (el original decía «acelera I3»): *todas las posiciones valoradas hace ≤ 35 días y la serie permite «caída desde máximos» con ≥ 3 puntos.* Con valoraciones mensuales, 6 puntos son 5 rentabilidades por posición: ruido, no correlación. **`I3` sigue aparcada** hasta unas 24 valoraciones.

## 2. Decisiones del hogar (6/10/2026)

El hogar respondió «todas con tu recomendación» a las seis preguntas del diseño:
1. **«Pegar desde el bróker» aparcado (PR-2)** hasta que haya una muestra real del formato (dos líneas con los nombres tapados, por el chat). Sin ella no se diseña un lector a ciegas. *Pendiente:* cuántas posiciones tiene el hogar y cómo lee hoy su valor (no se dijo).
2. **Solo «valor» en el PR-1.** La entrada «precio por unidad» no se ofrece hasta saber si el hogar registra unidades. *Pendiente de confirmar:* si sí las registra y su bróker solo enseña el valor liquidativo por unidad, se añade.
3. **Ritmo: una vez al mes, junto con los saldos del cierre (1-3)**, con un **aviso no bloqueante** en el cierre. La hoja se puede abrir cuando se quiera.
4. **Umbral de confirmación de la variación de mercado: ±20 %** (±40 % en cripto).
5. **Orden de la hoja: las más antiguas primero** y, a igualdad, por tamaño (no solo por tamaño, como decía NIN-02: el objetivo es la frescura).
6. **Se admiten valoraciones con fecha pasada**, tecleadas a mano por el hogar, para empezar la serie antes. No se reconstruye ningún punto: la app no fabrica historial.

## 3. Lo que dice el código (verificado leyendo `app.js` el 6/10/2026)

1. **El hueco es real.** Una posición solo se crea o se quita (`saveIv1Position`, `removeIv1Position`). El único camino que cambia su valor es el traspaso fondo→fondo (`saveIv1Transfer`). El comentario de `i12ConvictionReviewHtml` reconoce que la cartera «nunca» se edita.
2. **Las instantáneas de cierre actuales no son una serie.** `recordIv1ValuationSnapshot` (I2) guarda `currentValue` en cada cierre, pero ese valor es el del alta (salvo traspasos): una línea plana. **Mezclarlas con valoraciones nuevas dibujaría un historial falso.** Se dejan como están (sus pruebas fijan su forma) y la serie sale solo del almacén nuevo.
3. **El XIRR depende de `currentValue` y `asOf`** (`positionCashFlows` en `canonical-portfolio.js`): al actualizarlos, el XIRR, la ganancia, la concentración, el glide path y el apalancamiento se refrescan solos.
4. **No hay aviso de valoración antigua** para posiciones. Sí lo hay para saldos (`FinanceCanonicalDataAge`), reutilizable como patrón.
5. **Un valor ausente es 0** (`normalizePosition`: `knownNumber` o 0). En la hoja, igual que en R-12 y WP-11: **vacío = «no cambia»; 0 = «vale cero»**.
6. **Cada manejador de inversión repite a mano unas 20 llamadas de repintado** (`renderIv1PositionList`, `renderIv1PositionChart`, `renderInv16…`, `renderLev…`, `renderIvx6GlidePath`…). La hoja necesita el mismo refresco; va en el script de pantalla, no en `app.js`.
7. **Las posiciones viven en `scenarioSettings.portfolioPositions`** (`iv1PositionsList`/`saveIv1PositionsList`), que ya viaja en la copia y la nube.
8. **Presupuesto de `app.js`:** 37.418 líneas, techo 37.495 (77 de margen). La lógica va en un módulo puro nuevo y la pantalla en un script nuevo; en `app.js` solo cabe el cableado (≤ 12 líneas).
9. **Lección de WP-30:** `createImportBatch` guarda una foto entera del estado por lote. **No se usa** para deshacer una valoración.

## 4. Modelo

### 4.1 Almacén `portfolio-valuations`
Almacén local en `BACKUP_LOCAL_STORES` (copia y nube), `canonical-portfolio-valuation.js` (puro, módulo 83 de `canonical-*`). Un **punto** = una fecha de valoración con una fila por posición:

```
{ date: "AAAA-MM-DD", savedAt: ISO, points: [{ id, value, cost }] }
```

- `value` es el valor de mercado declarado; `cost` es el coste de la posición en ese momento (`costBasis` normalizado), guardado porque reconstruirlo después con el FIFO de ventas es frágil.
- **Una valoración por fecha:** guardar de nuevo la misma fecha sustituye las filas de esa fecha (no duplica) y conserva `savedAt` como auditoría.
- **Lectura tolerante:** una copia dañada no rompe la pantalla (filas inválidas, ids que ya no existen, duplicados: se descartan).
- **Retención:** hasta 500 puntos; los de más de 24 meses se reducen al último de cada mes en lugar de borrarse.

### 4.2 Qué cambia en la posición
Al guardar, para cada fila con valor nuevo: `currentValue = value`, `asOf = fecha`, `provenance = "declared"`.
- **Una fecha anterior no pisa el presente:** solo se actualizan `currentValue` y `asOf` si la fecha es ≥ el `asOf` actual de la posición. Una fecha pasada añade un punto histórico sin mover el valor actual.
- **«Sin cambios»** (por fila) conserva el valor y **renueva la fecha**: es el gesto más frecuente.
- Una fila vacía no se toca y no genera punto.

### 4.3 Variación de mercado (no variación de valor)
Mostrar «+500 €» cuando el hogar ha aportado 500 € es leer una aportación como ganancia: el mismo vicio que el real parcial de «Gasto variable». La hoja enseña:

**variación de mercado = valor nuevo − valor anterior − aportaciones netas registradas desde la valoración anterior**

(aportaciones menos ventas, ya fechadas en la posición: `contributions` y `disposals`). Sin valoración anterior, no hay variación: se dice «primera valoración», no se inventa. Cuando la posición no tiene fecha de valoración anterior fiable, el chip no se calcula. El modo «% de variación» como entrada no se ofrece en el PR-1 (lo pedía NIN-02): compone el error si el valor anterior está desactualizado; se estudia en el PR-2.

### 4.4 Frescura
Días desde `asOf`; **> 35 días = antigua**. Se ve en la lista de posiciones («valorada hace 12 días»), en la hoja y, si alguna pasa de 35 días, en un aviso de la cabecera de Cartera y en el cierre de mes (no bloqueante, decisión 3).

## 5. La hoja (`valoracion-ui.js`, Inversión › Cartera)

Acción principal arriba: **«Actualizar valoración»**. Diálogo con:
- **Una fecha para toda la hoja** (hoy por defecto; ayer y otra fecha, nunca futura).
- **Una fila por posición:** nombre y tipo, valor anterior con «hace N días», **campo de importe es-ES** de WP-11 (vacío = no cambia), **botón «Sin cambios»**, chip de variación de mercado en color neutro (la app no empuja a actuar).
- **Orden:** más antiguas primero, luego por tamaño (decisión 5).
- **Salvaguardas que avisan y no bloquean:** variación de mercado > ±20 % (±40 % en cripto) pide confirmar la fila; un **0 explícito** pide confirmar; un valor que parece tecleado en miles (la fila se multiplica o divide por 1.000) avisa.
- **Guardar** (único botón de envío: «Hecho» del teclado guarda): actualiza posiciones, añade el punto, repinta y da **deshacer 8 s**. Deshacer devuelve valor, fecha y procedencia a cada fila y quita sus puntos; no usa ningún lote del libro.
- Mide los segundos hasta guardar (M-VAL2).

## 6. Fuera de alcance

- **Edición general de posiciones** (nombre, tipo, convicción, etc.): otra tarea; el código ya la deja anotada.
- **Vivienda y local:** tienen su propio almacén de activos (A14), con su flujo «valor anterior / valor nuevo»; WP-46 los combinará con la cartera.
- **Precios de mercado automáticos** (licencias de datos).
- **Sparkline y gráfico de aportado frente a valor:** WP-17 y WP-18.
- **`I3`** (correlación calculada): aparcada hasta unas 24 valoraciones.
- **«Pegar desde el bróker»:** PR-2, aparcado (decisión 1).

## 7. Riesgos y verificaciones pendientes

- **Repintado completo tras guardar:** hay que llamar a toda la cadena de renders de Inversión; una prueba debe comprobar que la lista de posiciones, el resumen, la concentración y el glide path cambian tras una valoración.
- **Paridad:** sin valoraciones guardadas, la pantalla de Cartera y todos sus cálculos son idénticos a `main` (prueba de paridad como en WP-26 y WP-30).
- **Una valoración con fecha pasada no debe mover el XIRR ni el valor actual** (§4.2): prueba específica.
- **Variación de mercado:** casos con aportación y venta entre valoraciones, sin valoración anterior, y con una aportación fechada el mismo día.
- **Vacío frente a cero:** prueba directa, como R-12.
- **Almacén:** clasificación ARQ-6 en `BACKUP_LOCAL_STORES`, lectura tolerante, retención.
- **Rendimiento:** el diálogo no debe añadir trabajo a las pantallas que ya miden `p4-presupuesto-pantallas`.
- **`app.js`:** ≤ 12 líneas de cableado; techo 37.495.

## 8. Plan de PR

| PR | Contenido | Cambia comportamiento |
|---|---|---|
| **PR-0** (este) | Diseño cerrado con las respuestas del hogar; solo documentación | No |
| **PR-1** | `canonical-portfolio-valuation.js` (variación neta, series, frescura, salvaguardas), almacén, hoja manual con deshacer, frescura visible, aviso en el cierre, cableado en `app.js`, pruebas y paridad | Sí (pantalla nueva; las posiciones pasan a ser actualizables) |
| **PR-2** (aparcado) | «Pegar desde el bróker»: casa por ISIN, ticker o nombre; lo no casado se asigna a mano y **nunca crea posiciones**; nota de serie y M-VAL en el panel de uso | Solo cuando el hogar dé una muestra del formato |

Estimación: ≈ 2-3 sesiones (PR-0 y PR-1; el PR-2 depende de la muestra).

## 9. Preguntas abiertas al hogar (por el chat: son datos privados)

- **Cuántas posiciones tiene y de qué tipo (sin nombres)**, para fijar el objetivo de M-VAL2.
- **Cómo lee hoy su valor** (app del bróker, PDF, web de la gestora) y una **muestra de dos líneas con los nombres tapados**: desbloquea el PR-2.
- **Si registra unidades (participaciones)** y su bróker solo enseña el valor liquidativo por unidad: añadiría «precio por unidad» como entrada alternativa.
