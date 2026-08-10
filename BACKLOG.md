# Backlog operativo — seis vistas × evolución funcional

Fecha: 10 de agosto de 2026. Repositorio vivo: `javierbarriusom-a11y/contabilidadcasa`.
Sitio: `https://javierbarriusom-a11y.github.io/contabilidadcasa/`.

Este documento **sustituye a `BACKLOG_STATUS.md` como backlog vigente**. Aquel queda como
registro histórico de las entregas E1-E20, que sigue siendo válido y no se toca.

Por qué se rehace: hasta ahora había dos backlogs que no se hablaban. Uno funcional
(E1-E20, «qué sabe hacer la app») y otro de diseño (el catálogo de mockups, «qué aspecto
tiene cada pantalla»). El rediseño a seis vistas obliga a fusionarlos, porque organiza el
trabajo por **vista de producto**, no por entrega técnica. Lo que sigue es esa fusión, con
el estado real medido sobre el código publicado, no sobre lo que decía el plan.

Leyenda de estado:

| | Significado |
|---|---|
| ✅ | Hecho, fusionado a `main` y **visible en el sitio publicado** |
| 🟡 | Publicado pero **parcial**, con la omisión documentada y localizable |
| ⏳ | Pendiente, sin bloqueo: se puede empezar cuando se quiera |
| ⛔ | Bloqueado por una decisión de producto que el usuario no ha tomado |

---

## 1. Inventario real: qué hay publicado hoy

Contado sobre el `index.html` publicado, no sobre el plan.

- **34 pantallas** (`view-section`) en la aplicación.
- **16 con la piel nueva** (clase de ámbito `e19-*`): las migradas en E19 y E20.
- **18 heredadas**, sin migrar, que siguen en pie y en uso.

| Con piel nueva (16) | Heredadas todavía en pie (18) |
|---|---|
| `#home`, `#update-hub`, `#data-entry`, `#forecast`, `#prevision` | `#visual-detail`, `#update-data`, `#movements`, `#cashflow`, `#savings-plan` |
| `#escenario-simular`, `#escenario-aplicar`, `#escenario-guardados` | `#simulator`, `#new-life-simulation`, `#new-life-definitive` |
| `#deuda-comparar`, `#deuda-ruta`, `#asesor-decision` | `#debt-roadmap`, `#debt-liquidation-plan`, `#debt-control` |
| `#conciliar`, `#registrar-mes` | `#reconciliation`, `#data-audit`, `#operations-manual` |
| `#cuadro-mandos`, `#cambios-pendientes`, `#mapa-calor` | `#executive-advisor`, `#virtual-advisor`, `#savings-agent`, `#alerts-center` |

**El número que importa: 34, no 22.** El rediseño se dibujó cuando había 22 pantallas y
proponía reducirlas a 6. Desde entonces la app ha crecido a 34, porque cada mockup migrado
se añadió **junto a** la heredada en vez de sustituirla. Es decir: el trabajo hecho ha
mejorado la app y a la vez ha alejado el objetivo de seis vistas. No es un error —era la
regla acordada, «envolver, no sustituir»— pero conviene verlo escrito.

### Los quince mockups de los turnos 1-3

**15 de 15 migrados.** Cinco de ellos con omisiones documentadas:

| Mockup | Pantalla | Estado | Qué falta |
|---|---|---|---|
| 1a Hoy | `#home` | ✅ | — |
| 1b Ruta de deuda | `#deuda-ruta` | ✅ | — |
| 1c Comparador de estrategias | `#deuda-comparar` | 🟡 | La tercera estrategia es «No tocar nada», no «Consolidar» |
| 1d Asesor ejecutivo | `#asesor-decision` | 🟡 | Ver nota en `docs/E19_SISTEMA_DISENO.md` §8 |
| 1e Simular | `#escenario-simular` | ✅ | — |
| 1f Actualizar (hub) | `#update-hub` | ✅ | — |
| 1g Conciliación | `#conciliar` | ✅ | — |
| 2a Registrar el mes | `#registrar-mes` | 🟡 | Aviso «detectado en el extracto · ¿es anual?» |
| 2b Importar extracto | `#data-entry` | ✅ | — |
| 2c Previsión | `#prevision` | ✅ | — |
| 2d Aplicar escenario | `#escenario-aplicar` | ✅ | — |
| 2e Escenarios guardados | `#escenario-guardados` | 🟡 | Ver nota en §5 |
| 3a Cuadro de mandos | `#cuadro-mandos` | ✅ | — |
| 3b Bandeja de cambios | `#cambios-pendientes` | ✅ | — |
| 3c Mapa de calor | `#mapa-calor` | 🟡 | Panel de recomendaciones calculadas |

### Los turnos 4-5 (el rediseño a seis vistas)

**0 de 6 vistas adoptadas como arquitectura.** De las diez piezas del material:

- **5a · pie de impacto**: ✅ implementado en `#cuadro-mandos` (E20-5).
- **4a-4f · las seis vistas**: ⛔ sin adoptar, pendiente de decisión.
- **5c/5d · importación por decisión**: ⏳ especificado y sin implementar.

---

## 2. Las seis vistas: cuánto está cubierto

Esta es la respuesta directa a «cuántas de las seis están en el repositorio vivo». La
respuesta corta: **cinco de las seis tienen su función construida y publicada; ninguna
existe como vista única, y la sexta no existe en absoluto.**

| Vista | Función cubierta | Pantallas nuevas que la cubren | Heredadas que habría que retirar |
|---|---|---|---|
| **1 · Hoy** | 🟡 parcial | `#home`, `#asesor-decision` | `#executive-advisor`, `#virtual-advisor`, `#savings-agent`, `#alerts-center` |
| **2 · Plan** | ✅ alta | `#cuadro-mandos`, `#cambios-pendientes`, `#mapa-calor`, `#prevision`, `#escenario-*` (3) | `#visual-detail`, `#forecast`, `#cashflow`, `#savings-plan`, `#simulator`, `#new-life-simulation` |
| **3 · Deuda** | ✅ alta | `#deuda-comparar`, `#deuda-ruta` | `#debt-roadmap`, `#debt-liquidation-plan`, `#debt-control` |
| **4 · Datos** | 🟡 parcial | `#update-hub`, `#data-entry`, `#registrar-mes` | `#update-data`, `#movements` |
| **5 · Cierre** | 🟡 parcial | `#conciliar` | `#reconciliation`, `#data-audit`, `#operations-manual` |
| **6 · Ajustes** | ⛔ **nada** | — | — |

### Lo que falta en cada una, medido

**1 · Hoy.** Los tres KPI del rediseño son *Colchón disponible*, *Deuda pendiente* y
*Libre de deuda*. Los tres que muestra hoy `#home` son *Liquidez hoy*, *Capacidad libre
real* y *Reserva protegida*. Coinciden en el primero; **deuda pendiente y fecha libre de
deuda no están en Hoy**, aunque ambas se calculan ya en `#deuda-comparar`.

**2 · Plan.** Es la más completa: la tabla editable con pie de impacto está construida y
publicada, que era el corazón del rediseño. Falta la banda de doce meses *dentro* de Plan
(existe suelta en `#mapa-calor` y `#prevision`) y el cuarto indicador del pie, la fecha sin
deuda, que hoy se omite a propósito porque editar un previsto no toca ningún contrato.

**3 · Deuda.** Estrategias y orden de ataque, construidos. La tercera estrategia difiere:
el rediseño pide *Consolidar*, la app ofrece *No tocar nada*. La «oferta en curso» vive en
`#asesor-decision` en vez de en la propia vista.

**4 · Datos.** Hub, importación y registro del mes, construidos. **Lo que falta es lo que
el turno 5 especifica y nadie ha implementado**: la importación como cuatro pasos con una
decisión explícita por movimiento dudoso y por duplicado. Hoy `#data-entry` tiene la
bandeja previa, no ese flujo.

**5 · Cierre.** Las diferencias como tareas, construido. Falta el panel «Confianza del
dato» por cuenta (cuadra / descuadra / sin conciliar), que hoy está disperso entre
`#conciliar` y `#data-audit`.

**6 · Ajustes.** No existe. Y no es cosmético: **`state.operatingReserve` —la reserva
operativa— no tiene ningún control en toda la interfaz** (cero apariciones en
`index.html`). El modelo la lee, tres pantallas la necesitan, y nadie puede configurarla.
Hoy eso degrada de verdad el producto:

- El pie de impacto de `#cuadro-mandos` no puede decir «meses bajo reserva» y cae a «meses
  en negativo».
- El mapa de calor colorea contra «un mes de salidas» en vez de contra la reserva real.
- El comparador de deuda usa un suelo de 0 € por defecto en vez de la reserva del hogar.

Es la mayor desproporción del backlog: la vista más barata de construir es la que más
desbloquea.

---

## 3. El backlog fusionado

Seis bloques que son las seis vistas, más uno transversal. Cada tarea lleva el origen
(mockup, entrega funcional o hallazgo) para que se pueda rastrear.

### V6 · Ajustes — *el bloque con mejor relación esfuerzo/valor*

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V6-1 | **Control de reserva operativa** en la interfaz, escribiendo `state.operatingReserve` | ⏳ | **Alta** | Hallazgo: el modelo la usa y nadie puede fijarla |
| V6-2 | Umbrales de aviso: colchón mínimo en meses, desviación por partida, ventana de duplicados | ⏳ | Media | Mockup 4f · Ajustes |
| V6-3 | Vista `#ajustes` que reúna cuentas, umbrales, partidas y exportación | ⏳ | Media | Mockup 4f |
| V6-4 | Exportar CSV y PDF del mes desde un sitio único (hoy `downloadCsv` está disperso) | ⏳ | Baja | Mockup 4f |

**V6-1 es la primera tarea recomendada de todo el backlog.** Es pequeña, no rompe nada, y
mejora inmediatamente tres pantallas ya publicadas sin tocarlas.

### V1 · Hoy

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V1-1 | Hoy con la piel nueva y tres decisiones | ✅ | — | Mockup 1a · E19-2 |
| V1-2 | Asesor ejecutivo, una decisión abierta a la vez | 🟡 | — | Mockup 1d · E20-2 |
| V1-3 | Sumar los KPI *Deuda pendiente* y *Libre de deuda* a Hoy | ⏳ | Media | Mockup 4b; el cálculo ya existe en `#deuda-comparar` |
| V1-4 | Fundir `#executive-advisor`, `#virtual-advisor`, `#savings-agent` y `#alerts-center` en Hoy | ⛔ | — | Mockup 4b · requiere la decisión T-1 |

### V2 · Plan

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V2-1 | Simular → comparar → aplicar en una vista | ✅ | — | Mockups 1e/2d/2e · E20-1 |
| V2-2 | Los once tipos de decisión del motor | ✅ | — | E20-3 |
| V2-3 | Cuadro de mandos con pie de impacto | ✅ | — | Mockup 3a + spec 5a · E20-5 |
| V2-4 | Bandeja de cambios reversible | ✅ | — | Mockup 3b · E20-5 |
| V2-5 | Mapa de calor mensual | 🟡 | — | Mockup 3c · E20-5 |
| V2-6 | Cuarto indicador del pie: fecha sin deuda | ⏳ | Baja | Mockup 4c; hoy se omite con motivo, ver §12 del diseño |
| V2-7 | Banda de doce meses integrada en Plan | ⏳ | Baja | Mockup 4c |
| V2-8 | Fundir `#visual-detail`, `#forecast`, `#cashflow`, `#savings-plan`, `#simulator` y `#new-life-simulation` | ⛔ | — | Mockup 4c · requiere T-1 |

### V3 · Deuda

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V3-1 | Comparador de estrategias | 🟡 | — | Mockup 1c · E20-2 |
| V3-2 | Ruta de deuda como línea de tiempo | ✅ | — | Mockup 1b · E20-2 |
| V3-3 | Estrategia **Consolidar** como tercera opción real | ⏳ | Media | Mockup 4d; hoy la tercera es «No tocar nada» |
| V3-4 | Oferta en curso dentro de la vista de deuda | ⏳ | Baja | Mockup 4d; hoy vive en `#asesor-decision` |
| V3-5 | Fundir `#debt-roadmap`, `#debt-liquidation-plan` y `#debt-control` | ⛔ | — | Mockup 4d · requiere T-1 |

### V4 · Datos

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V4-1 | Hub ordenado por lo que tienes delante | ✅ | — | Mockup 1f · E19-3 |
| V4-2 | Importación con bandeja previa | ✅ | — | Mockup 2b · E19-4 |
| V4-3 | Registrar el mes, una fila por partida | 🟡 | — | Mockup 2a · E20-4 |
| V4-4 | **Importación en cuatro pasos con decisión por movimiento y por duplicado** | ⏳ | **Alta** | Spec 5c + prototipo 5d · especificado y sin implementar |
| V4-5 | Detección de partida anual desde el extracto | ⏳ | Baja | Mockup 2a, omisión documentada |
| V4-6 | Fundir `#update-data` y `#movements` en Datos | ⛔ | — | Mockup 4e · requiere T-1 |

### V5 · Cierre

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V5-1 | Las diferencias como tareas, no como tablas | ✅ | — | Mockup 1g · E20-2 |
| V5-2 | Panel «Confianza del dato» por cuenta | ⏳ | Media | Mockup 4f |
| V5-3 | Fundir `#reconciliation`, `#data-audit` y `#operations-manual` | ⛔ | — | Mockup 4f · requiere T-1 |

### T · Transversal

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| T-1 | **Decidir si se adopta la arquitectura de seis vistas** y se retiran las heredadas | ⛔ | **Bloqueante** | Turnos 4-5 |
| T-2 | Cambio de acento azul `#0072E3` → navy `#293E5E`, si se adopta T-1 | ⛔ | — | Handoff, sección de tokens |
| T-3 | E10: activación real de IA, hogar, push, PSD2 e importación programada | ⏳ | Baja | Única entrega funcional sin verificar |
| T-4 | Reducir el número de pantallas, se adopte o no el rediseño | ⛔ | — | Hallazgo: 34 pantallas y creciendo |

---

## 4. La decisión que bloquea catorce tareas

**T-1 bloquea cinco fusiones (V1-4, V2-8, V3-5, V4-6, V5-3), T-2, T-4** y condiciona el
resto. No es una tarea de programación: es decidir si se retiran pantallas que hoy
funcionan y están en uso.

Los datos para decidirlo, sin recomendación disfrazada de hecho:

- **A favor de adoptarlo**: hay 34 pantallas para lo que el rediseño resuelve con 6. Cada
  entrega nueva empeora ese número. Nueve de los pares nueva/heredada ya conviven, y quien
  usa la app tiene que saber cuál de las dos mirar.
- **En contra, o al menos a favor de esperar**: las pantallas nuevas llevan días, no meses,
  en uso real. Retirar una heredada que todavía hace algo que la nueva no hace es una
  pérdida de función difícil de detectar hasta que se echa en falta. Los cinco mockups
  marcados 🟡 son exactamente eso: sitios donde la nueva aún no cubre todo.

**Camino intermedio, si se quiere avanzar sin decidir del todo**: hacer las tareas que
suman función sin retirar nada (V6-1, V4-4, V1-3, V3-3, V5-2). Todas mejoran vistas que ya
existen y ninguna depende de T-1. Cuando las 🟡 estén cerradas, retirar la heredada
correspondiente deja de ser una apuesta.

---

## 5. Orden recomendado

Por valor entregado frente a esfuerzo y riesgo, sin tocar la decisión pendiente:

1. **V6-1** · control de reserva operativa. Pequeña, desbloquea tres pantallas publicadas.
2. **V4-4** · importación en cuatro pasos. La única pieza del turno 5 con especificación
   escrita y prototipo que sigue sin construir.
3. **V1-3** · deuda pendiente y fecha libre de deuda en Hoy. El cálculo ya existe.
4. **V3-3** · estrategia Consolidar, para cerrar la 🟡 de 1c.
5. **V5-2** · confianza del dato por cuenta.
6. **V6-2/V6-3** · el resto de Ajustes.
7. **T-1** · con las 🟡 ya cerradas, la decisión sobre retirar heredadas se toma con mucha
   menos incertidumbre.

E10 (T-3) permanece al final: depende de aceptación externa real, no de trabajo local.

---

## 6. Puerta de aceptación

Sin cambios respecto a `BACKLOG_STATUS.md` §6. Una tarea no pasa a ✅ hasta que:

1. `npm run verify` en verde con cifras reales (pruebas, accesibilidad, rendimiento, build,
   privacidad, smoke).
2. QA en escritorio y móvil sin desbordamiento ni errores de consola propios.
3. `PROJECT_STATE.md` actualizado con esas cifras, nunca inventadas.
4. Fusionada a `main` y **verificada en el sitio publicado** — hasta entonces es 🟡, no ✅.
5. Cualquier omisión respecto al mockup, escrita y localizable en
   `docs/E19_SISTEMA_DISENO.md`.
