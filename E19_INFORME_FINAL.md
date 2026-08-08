# Informe final — E19-0, dataset dorado y esquemas validables

Fecha: 8 de agosto de 2026.
Alcance: cierre de los cinco días de E19-0. Este documento es el que, según el propio documento de
esquemas y dataset dorado, "debería decidir el orden real de la Ola 0": reúne lo encontrado en
`E19_INFORME_PARIDAD_DEUDA.md` (día 3), `E19_INVARIANTES.md` (día 4) y los casos combinados del día
5, y termina con una recomendación concreta de orden para E20.

## 1. Qué se construyó

| Día | Entregable | Archivos |
| --- | --- | --- |
| 1 | Esquema validable de `Escenario` y `Decisión`, 13 tipos, migraciones | `canonical-scenario-schema.js`, `migrations/scenario-schema-migrations.js` |
| 2 | Datasets sintéticos D1-D3 (120 meses, anonimizados) | `tools/build-golden-datasets.mjs`, `tests/golden/datasets/*.json` |
| 3 | Casos de deuda C001-C010 + informe de paridad | `tools/build-golden-debt-cases.mjs`, `E19_INFORME_PARIDAD_DEUDA.md` |
| 4 | Invariantes I-01 a I-09 por generación aleatoria | `canonical-scenario-invariants.js`, `E19_INVARIANTES.md` |
| 5 | Casos combinados C040-C045 + este informe | `tools/build-golden-combined-cases.mjs`, `canonical-scenario-schema.js` (resolveExecutionOrder) |

66 pruebas nuevas en total sobre las 312 que ya tenía el repositorio (378 en total, 3 de ellas
marcadas `test.todo` a propósito).

## 2. Los tres desenlaces previstos, contados

El documento anticipaba tres desenlaces posibles al ejecutar el dataset dorado contra el código
actual, y avisaba de que el segundo era "lo que espero que ocurra en varios casos, y es
precisamente el hallazgo que justifica el ejercicio". Así ha ido, caso por caso:

**1. Coinciden (motor heredado y motor canónico dan el mismo número).**
C001, C002, C006, C007 (tras la corrección, ver §3), C008, C009, C010 — 7 de los 10 casos de
deuda. También C044 y C045, verificados contra `resolveExecutionOrder()`.

**2. Discrepan entre pantallas — encontrado, y corregido.**
No apareció como una discrepancia *entre* dos motores en un caso escrito a mano, sino como un
**error real dentro del propio motor heredado**, detectado por generación aleatoria el día 4:
`legacy-debt-roadmap-engine.js` podía reportar que una deuda tardaba más en pagarse al amortizar
más (violación de I-07), por leer el saldo mutable del último mes simulado en vez del histórico de
cada fila. El caso dorado **C007** del día 3 ya lo exhibía sin que el informe de ese día lo
detectara, porque comparaba coste total, no duración. Corregido en un único punto; el detalle
completo está en `E19_INVARIANTES.md` §3.

**3. Ningún motor puede calcularlo — 6 casos, todos documentados, ninguno inventado.**
- **C003** (amortización con mes óptimo) y **C004** (amortización fraccionada recurrente): ningún
  motor busca un mes ni admite varias amortizaciones parciales sucesivas.
- **C005** (reunificación de 3 deudas), **C042** y **C043** (conflictos bloqueantes: dos
  amortizaciones sobre la misma deuda, o una reunificación y una amortización que se pisan):
  ningún motor conoce qué deudas quedan afectadas por la decisión de otra.
- **C040** y **C041** (efecto cascada: amortizar libera cuota, la cuota liberada financia una
  compra posterior, y el orden de las decisiones cambia el resultado): ningún motor comparte
  estado entre decisiones — cada uno calcula su cuadro de forma aislada.

## 3. Lo que sí se puede construir sin esperar al motor de Escenario

El día 5 confirma algo que no estaba en el documento original pero que se deduce directamente de
él: **el orden de resolución de las decisiones (§2.3 regla 1 del modelo de Escenario) es pura
teoría de grafos, no cálculo financiero**, y por tanto no tiene que esperar a E20-0.
`resolveExecutionOrder()` ya existe, ya está probado (casos C044 y C045, más el caso C045 original
del día 1) y es exactamente la pieza que F1 de E20 necesitará el primer día. Construirla ahora,
fuera del motor financiero, reduce lo que E20-0 tiene que entregar de una vez.

## 4. Recomendación de orden para E20

Cruzando los seis huecos funcionales encontrados con el catálogo de tipos de decisión del esquema
(día 1) y el plan de fases ya acordado (bloque E20 de la propuesta de rediseño):

1. **E20-0 (F1) puede envolver, no reescribir, cinco de los seis tipos de decisión más usados.**
   Amortización total, amortización parcial (vía `hybrid`), refinanciación, retomar pagos y
   acuerdo de quita ya están en paridad exacta hoy entre el motor heredado y el canónico (§2). F1
   puede envolver `canonical-e14-operations.js` para esos cinco sin riesgo de divergencia.
2. **`resolveExecutionOrder()` se incorpora a F1 tal cual, no se reescribe.** Ya resuelve el orden
   real de un conjunto de decisiones, detecta ciclos sin bucle infinito y dos casos dorados lo
   confirman.
3. **Reunificación y conflictos bloqueantes (C005, C042, C043) son el riesgo real de F1.** No son
   una migración: son lógica nueva que debe conocer el estado de cada deuda tras cada decisión
   anterior. Si F1 se entrega sin esto, cualquier escenario que combine reunificación con otra
   decisión sobre las mismas deudas debe rechazarse explícitamente (conflicto bloqueante) en vez
   de calcular un número silenciosamente incorrecto — igual que el propio motor heredado, hoy, no
   ofrece la operación en absoluto.
4. **El efecto cascada (C040, C041) es el criterio de aceptación real de F1, no un extra.** Un
   motor de Escenario que no comparta estado entre decisiones resueltas en orden no es
   funcionalmente distinto de los nueve módulos que se quiere sustituir. La prueba de aceptación de
   F1 debería ser, literalmente, C040/C041: dos decisiones que interactúan, en los dos órdenes,
   con resultados distintos y correctos.
5. **Amortización fraccionada y mes óptimo (C004, C003) pueden esperar a F2/F3.** Son
   funcionalidad nueva de valor pero no bloquean que F1 sea útil con los otros cinco tipos.

## 5. Estado de la puerta de calidad

- `npm test`: 378 pruebas (375 pass, 3 `test.todo` explícitos citando a E20-0), 0 fallos.
- `npm run verify`: tests, accesibilidad, rendimiento, build público, privacidad y smoke test, en
  verde.
- `git diff --check`: sin avisos.
- Ningún dato real en ningún fixture (titulares T1/T2, entidades Banco Operativo/Banco Ahorro y
  Entidad A-D, verificado por prueba automatizada desde el día 2).
- La aplicación en ejecución no ha cambiado de comportamiento salvo la corrección puntual de
  `legacy-debt-roadmap-engine.js` (día 4), que solo mejora un dato ya mostrado al usuario
  (duración estimada del plan de deuda heredado).

## 6. Cierre

E19-0 queda completo: los cinco días del documento de esquemas y dataset dorado están entregados,
verificados y documentados. El bloque siguiente de la propuesta de rediseño (E19 · piel visual,
independiente de este trabajo) y E20 (motor de Escenario unificado, que ahora tiene un dataset
dorado, un informe de paridad y una recomendación de orden con evidencia real en vez de una
apuesta) quedan listos para empezar.
