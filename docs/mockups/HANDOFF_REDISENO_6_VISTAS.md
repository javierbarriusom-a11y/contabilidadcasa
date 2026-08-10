# Handoff: Finanzas Casa · rediseño completo (6 vistas)

## Overview
Rediseño de la app doméstica de finanzas. Las 22 pantallas actuales se reducen a **seis vistas** con navegación lateral fija: Hoy, Plan, Deuda, Datos, Cierre y Ajustes. El objetivo del rediseño es que cada vista responda a una sola pregunta y que ningún dato entre en el plan sin una decisión explícita del usuario.

Fusiones respecto a la app actual:
- **Asesor** desaparece como sección: el comparador de estrategias vive dentro de **Deuda**.
- **Entrada de datos + importación** se funden en **Datos** (bandeja previa de cuatro pasos).
- **Simulación + resultados de simulación** se funden en el comparador de **Deuda** y en el pie de impacto de **Plan**.
- **Conciliación** pasa a **Cierre**, expresada como tareas resolubles y no como tablas de diferencias.

## About the Design Files
Los ficheros de este paquete son **referencias de diseño escritas en HTML**: prototipos que muestran el aspecto y el comportamiento previstos, no código de producción para copiar. La tarea es **recrear estos diseños en el entorno del codebase destino** (React, Vue, SwiftUI, nativo…) con sus patrones y librerías establecidos. Si todavía no hay entorno, elige el framework más apropiado e implementa allí los diseños.

## Fidelity
**Alta fidelidad.** Colores, tipografía, espaciado, estados e interacciones son definitivos. Recrear la UI con precisión usando las librerías del codebase. Ancho de diseño fijo 1280 px (escritorio); no hay diseño responsive definido todavía.

---

## Screens / Views

Todas las vistas comparten el mismo armazón:

- **Contenedor raíz**: `width 1280px`, `display:flex`, fondo `#FBFCF7`, alto mínimo 860 px.
- **Barra lateral**: `width 212px`, fondo `#0B1220`, texto `#fff`, padding vertical 22 px.
  - Cabecera: «Finanzas Casa» 15/700 + «Julio 2026 · abierto» 11.5 px en `#8FA0BA`, separador `1px rgba(255,255,255,.1)`.
  - Ítems de navegación: fila `space-between`, padding `9px 12px`, radio 9 px, 13.5/600. Activo: color `#fff`, fondo `rgba(255,255,255,.12)`. Inactivo: color `#8FA0BA`, fondo transparente. Insignia a la derecha 11/700, `#E5C9A8` si activo, `#6E809C` si no.
  - Pie: colchón vigente (11 px mayúsculas `#8FA0BA` + 19/700 blanco + subtítulo 11.5 px), separado por línea superior.
- **Área de contenido**: `flex:1`, padding `28px 30px 34px` salvo Plan y Datos, que usan `28px 30px 0` / `28px 30px 26px` porque anclan una barra inferior.

### 1. Hoy
**Propósito**: lectura de caja en cinco segundos y tres decisiones abiertas.

- Cabecera: título 23/700 `#293E5E`, subtítulo 13 px `#5B6578`, botón primario «Importar extracto» a la derecha (padding `10px 17px`, radio 10, fondo `#293E5E`, hover `#1B2C48`).
- **Fila de tres KPI** (`grid` 3 columnas, gap 16): Colchón disponible, Deuda pendiente, Libre de deuda. Tarjetas blancas `1px #E8ECF1`, radio 14, padding 20. Etiqueta 11.5 px mayúsculas `#8A93A3`, cifra 29/700 tabular, nota 12.5 px. La tercera tarjeta es navy (`#293E5E`, texto blanco, notas `#A9B8CE`) y muestra la estrategia seleccionada en Deuda.
- **Decisiones abiertas** (columna 1.5fr): lista de tres filas separadas por `1px #EEF1F5`, con título 13.5/600, detalle 12.5 px, y botón secundario que navega a la vista correspondiente (Datos / Plan / Deuda).
- **El mes en una línea** (columna 1fr, tarjeta crema `#F7F4EF` borde `#E9DECF`): ingresos, gasto previsto, gasto real y desviación (color según signo), más botón «Ajustar el plan» → Plan.

### 2. Plan
**Propósito**: editar los reales del mes viendo la consecuencia antes de guardar.

- Tabla de partidas: cabecera `#F7F8FA`, columnas `1.7fr 1fr 1fr 1fr` (Partida / Previsto / Real / Desviación). Fila: nombre 13.5/600 + categoría 11.5 px `#8A93A3`; previsto texto plano tabular; **real es un input** de 98 px (borde `#D8DEE6`, radio 8, foco `#293E5E`); desviación 13.5/600 en `#B2452F` (positiva), `#1F9D55` (negativa) o `#8A93A3` (cero).
- Fila tocada en la sesión: fondo `#FFF8F0`.
- **Banda de doce meses**: barras `flex`, alto máximo 96 px, radio superior 5 px. Navy `#293E5E` a 0.82 de opacidad; los meses por debajo del objetivo en terracota `#C98B6B`. Etiqueta de mes 10.5 px.
- **Pie de impacto** (ver Interacciones).

### 3. Deuda
**Propósito**: elegir estrategia y ver el orden de ataque resultante.

- Tres tarjetas de estrategia en grid: Avalancha, Bola de nieve, Consolidar. Cada una con nombre 15/700, descripción 12.5 px, y dos métricas (Libre en / Intereses) en 19/700. Seleccionada: fondo `#293E5E`, texto blanco, sombra `0 6px 18px rgba(11,18,32,.14)`; no seleccionada: blanca, borde `#E8ECF1`.
- **Orden de ataque**: lista de deudas ordenada según la estrategia. Columnas `26px 1.4fr 1fr 1fr 2fr`: número de orden en cuadro `#EEF1F5` radio 7, nombre, saldo tabular, tipo en `#8E5A43`, y barra proporcional al saldo (pista `#EEF1F5`, alto 9 px, radio 5; primera posición `#8E5A43`, resto `#9AA7BC`).
- Nota de orden a la derecha del título, cambia con la estrategia.
- **Oferta en curso** (banda crema): subrogación de hipoteca con ahorro estimado y caducidad + botón «Comparar contra el plan».

### 4. Datos
**Propósito**: importar el extracto tomando una decisión por movimiento dudoso.

- Cabecera con título y **cuatro píldoras de paso** a la derecha: activa navy con texto blanco, completada `#E4EAF2` con texto navy, futura transparente con borde `#E2E6EC` y texto `#8A93A3`.
- Paso 1 · Cargar: ficha del archivo (nombre 15/700, metadatos 12.5 px, «Formato reconocido» en `#1F9D55`) y tres contadores: con regla previa (44), piden decisión (3), posibles duplicados (2).
- Paso 2 · Clasificar: filas `70px 1.5fr 90px 1fr 300px` con fecha, concepto, importe, sugerencia y tres botones de decisión (Aceptar sugerencia / Otra partida / Ignorar). Botón elegido: fondo `#293E5E`, texto blanco; el resto blanco con borde `#D8DEE6`.
- Paso 3 · Duplicados: filas `1.2fr 1.5fr 250px` con el candidato, la nota del movimiento ya registrado y dos botones (Es duplicado / Son distintos).
- Paso 4 · Incorporar: tabla de impacto en el plan (Partida / Actual / Tras importar / Desviación) y, tras confirmar, banda verde `#EAF6EE` borde `#C6E4D1` con el resultado y un botón para repetir.
- Barra inferior fija: nota de bloqueo a la izquierda en `#8E5A43`, botones Atrás y Continuar a la derecha.

### 5. Cierre
**Propósito**: resolver las diferencias como tareas y cerrar el mes.

- Cabecera con botón de cierre a la derecha, cuyo estado depende de las tareas pendientes.
- **Pendiente de resolver** (columna 1.6fr): cuatro tareas con título, detalle y botón «Resolver». Resuelta: opacidad 0.5, botón «Resuelto» con fondo `#EAF6EE`, borde `#C6E4D1`, texto `#1B7A45`.
- **Confianza del dato** (columna 1fr): estado por cuenta (Cuadra / Descuadra 62 € / Sin conciliar). La tarjeta de crédito pasa a «Cuadra» en verde cuando se resuelve la tarea correspondiente. Debajo, aviso de lo que implica cerrar.

### 6. Ajustes
Cuatro tarjetas en grid 2×2: Cuentas (tres cuentas con su método de entrada), Umbrales de aviso (colchón mínimo 3 meses, desviación ±10 % por partida, ventana de duplicados 7 días), Partidas (18 partidas en 6 grupos + botón de edición) y Exportar (tarjeta crema con CSV completo y PDF del mes).

---

## Interactions & Behavior

### Pie de impacto en Plan
- **Disparador**: aparece en cuanto cualquier celda editable difiere del último valor guardado. Se recalcula en cada pulsación, con 120 ms de debounce sobre el cálculo, no sobre la aparición. Si el usuario devuelve todas las celdas a su valor original, el pie se retira.
- **Contenido**: exactamente tres cifras, todas referidas al conjunto de la sesión y no a la celda activa — desviación de la sesión, colchón resultante (importe y meses), desplazamiento de la fecha libre de deuda.
- **Presentación**: barra `position:sticky; bottom:0`, fondo `#293E5E`, alto ~96 px, padding `18px 30px`, sombra `0 -8px 24px rgba(11,18,32,.16)`. Etiquetas 11.5 px mayúsculas `#A9B8CE`, cifras 22/700 blancas. La tabla conserva su scroll: no salta al aparecer el pie.
- **Acciones**: «Descartar» (contorno claro sobre navy) revierte **todas** las celdas de la sesión, no solo la última. «Guardar cambios» (fondo `#E5C9A8`, texto `#2B1D12`) consolida y retira el pie, dejando un aviso de dos segundos en la cabecera.
- **Fuera de rango**: si el colchón resultante baja de un mes, la cifra pasa a terracota y «Guardar» pide confirmación adicional.
- **Mes cerrado**: celdas de solo lectura, el pie no aparece y en su lugar se ofrece un enlace para reabrir el mes.
- **Salida**: abandonar la vista con cambios abiertos pide confirmación; moverse entre pestañas del mismo plan, no.

### Importación de extracto (Datos)
- Cuatro pasos: Cargar → Clasificar → Duplicados → Incorporar. **Nada entra en el plan hasta confirmar el paso 4.**
- Paso 1: se acepta CSV, Excel o volcado del banco; se detecta cuenta y rango de fechas y se avisa si solapa con un mes cerrado. Sin bloqueo.
- Paso 2: solo se muestran los movimientos sin regla previa. Cada uno exige una de tres respuestas. **Bloqueo**: «Continuar» queda deshabilitado (fondo `#C9D0DA`, cursor `not-allowed`) mientras quede algún movimiento sin decidir, y la nota a la izquierda dice cuántos faltan.
- Paso 3: candidatos por importe dentro de una ventana de siete días; se muestra siempre el movimiento ya registrado al lado. Mismo criterio de bloqueo.
- Paso 4: resumen del cambio en el plan antes de confirmar. Al incorporar se guarda como **una sola entrada revertible** del historial y las decisiones tomadas se convierten en reglas para la próxima importación.
- **Abandono a mitad**: la bandeja se guarda con sus decisiones parciales y reaparece en Datos en el paso donde se dejó.
- **Fichero repetido**: se detecta por huella del contenido y se ofrece continuar la bandeja existente en lugar de crear otra.
- **Deshacer**: revertir la importación devuelve las partidas a su valor anterior y conserva las reglas aprendidas.

### Estrategia de deuda
Seleccionar una tarjeta reordena inmediatamente la lista de ataque (avalancha = tipo descendente; bola de nieve = saldo ascendente; consolidar = préstamo único), actualiza la nota de orden y cambia la fecha «Libre de deuda» mostrada en Hoy.

### Cierre de mes
Cada tarea resuelta reduce el contador y atenúa su fila. El botón de cierre está deshabilitado mientras haya pendientes, mostrando «Cerrar mes · N pendientes»; con cero pendientes pasa a «Cerrar julio» y, al pulsarlo, a «Julio cerrado» en verde. Resolver la tarea de la tarjeta cambia su estado en «Confianza del dato» de descuadre a «Cuadra».

### Navegación
Barra lateral siempre visible; el ítem activo se resalta. Las insignias muestran: 3 decisiones en Hoy, 47 movimientos en Datos, y un punto en Plan cuando hay cambios sin guardar. Los botones de las tarjetas de Hoy navegan a la vista correspondiente.

---

## State Management

| Estado | Tipo | Uso |
|---|---|---|
| `nav` | `"hoy"\|"plan"\|"deuda"\|"datos"\|"cierre"\|"ajustes"` | Vista activa |
| `real` | mapa partida → número | Valores editados en Plan |
| `saved` | mapa partida → número | Último valor confirmado; la diferencia con `real` define «sucio» |
| `step` | 1–4 | Paso del importador |
| `cls` | mapa movimiento → decisión\|null | Clasificación del paso 2 |
| `dup` | mapa candidato → decisión\|null | Resolución del paso 3 |
| `done` | booleano | Importación confirmada |
| `estrategia` | `"avalancha"\|"bola"\|"consolidar"` | Estrategia de deuda seleccionada |
| `tareas` | mapa tarea → booleano | Tareas de cierre resueltas |
| `cerrado` | booleano | Mes cerrado |

Derivados (no se almacenan): desviación por partida, desviación de la sesión, colchón resultante y meses de colchón, desplazamiento de la fecha libre, pendientes de clasificación/duplicados/tareas, y el bloqueo del botón Continuar.

Datos: los valores del prototipo están embebidos. En producción vendrán de la fuente del hogar (plan mensual, movimientos importados, deudas y sus tipos).

## Design Tokens

**Colores**
- Navy profundo `#0B1220` (barra lateral, texto principal)
- Navy medio `#293E5E` (primario, títulos, pie de impacto)
- Navy hover `#1B2C48`
- Navy claro texto `#A9B8CE` · `#8FA0BA` · `#6E809C`
- Crema fondo `#FBFCF7` · lienzo exterior `#F0EEE9` · panel crema `#F7F4EF` (borde `#E9DECF`)
- Blanco tarjeta `#FFFFFF`, borde `#E8ECF1`, separador `#EEF1F5` / `#F3F5F8`, cabecera tabla `#F7F8FA`
- Texto secundario `#2B3547` · `#5B6578` · apagado `#8A93A3`
- Terracota `#8E5A43` (acento), alerta `#B2452F`, barra `#C98B6B`, botón cálido `#E5C9A8` (texto `#2B1D12`)
- Verde `#1F9D55`, texto verde `#1B7A45`, fondo verde `#EAF6EE`, borde verde `#C6E4D1`
- Bordes de control `#D8DEE6`, deshabilitado `#C9D0DA`, gris barra `#9AA7BC`

**Tipografía** — Inter (400/500/600/700)
- Título de vista 23/700, −0.01em · Título de tarjeta 15/700 · Cifra KPI 29/700 · Cifra pie 22/700 · Métrica 19/700
- Cuerpo 13.5/600 (etiquetas de fila) y 13 px/1.5–1.6 (texto) · Secundario 12.5 px · Micro 11.5 px · Etiqueta mayúsculas 11–11.5 px con `letter-spacing .06–.07em`
- Todas las cifras monetarias con `font-variant-numeric: tabular-nums`

**Espaciado** — 2, 3, 4, 6, 7, 9, 10, 12, 14, 16, 18, 20, 22, 26, 28, 30, 34, 44 px. Padding de tarjeta `20px 22px`; gap de grid 14–16 px.

**Radios** — 5 (barras), 7–9 (controles pequeños), 10 (botones), 14 (tarjetas), 999 (píldoras de paso).

**Sombras** — Tarjeta seleccionada `0 6px 18px rgba(11,18,32,.14)` · Pie de impacto `0 -8px 24px rgba(11,18,32,.16)`.

## Assets
Ninguno. Sin imágenes ni iconos: toda la jerarquía se resuelve con tipografía, color y forma. Tipografía Inter desde Google Fonts.

## Files
- `Finanzas Casa - App.dc.html` — prototipo navegable de las seis vistas con todas las interacciones descritas. **Es la referencia principal.**
- `Finanzas Casa - Mockups.dc.html` — historial de exploración: turno 5 contiene las especificaciones escritas del pie de impacto y de la importación; turnos 1–4 contienen el mapa del rediseño y las alternativas descartadas.
- `support.js` — runtime necesario para abrir los dos ficheros anteriores en el navegador. No forma parte del diseño.

Abrir cualquiera de los dos HTML directamente en el navegador; el prototipo es interactivo.
