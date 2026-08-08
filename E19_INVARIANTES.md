# Invariantes del motor — E19-0, día 4

Fecha: 8 de agosto de 2026.
Alcance: invariantes I-01 a I-09 del documento de esquemas y dataset dorado, verificadas por
generación aleatoria (property-based testing) contra el código real que existe hoy en el
repositorio, sin esperar a que exista el motor de Escenario unificado (E20).

## 1. Qué significa «verificar una invariante sin motor de Escenario»

El documento define las 15 invariantes como propiedades de `motor(Escenario)`. Ese motor no existe
todavía — es exactamente lo que construirá E20. Pero seis de las quince invariantes no dependen de
ningún concepto exclusivo de `Escenario` (decisiones activas/inactivas, orden de resolución,
guardarraíles): son propiedades generales de cualquier motor de amortización o de proyección
mensual, y **ya son verificables hoy** contra `legacy-debt-roadmap-engine.js` y `canonical-engine.js`.
Las otras nueve sí exigen el motor de Escenario y quedan documentadas como pendientes, no como
aprobadas por omisión.

El catálogo completo (`canonical-scenario-invariants.js`) declara, para cada una de las 15, si es
verificable hoy y contra qué motor. Un test de meta-validación falla si esa clasificación se
desalinea con lo que realmente se ejecuta.

## 2. Resultado por invariante

| ID | Invariante | Estado | Evidencia |
| --- | --- | --- | --- |
| I-01 | Determinismo | ✅ Verificada (40 ejecuciones aleatorias × 2 motores) | `legacy-debt-roadmap-engine.simulate()` y `canonical-engine.buildScenario()` producen salida idéntica ante la misma entrada, siempre |
| I-02 | Conservación de caja | ✅ Verificada (40 hogares aleatorios, horizonte 6-36 meses) | `canonical-engine.js` ya lo comprueba internamente (`validateRows`); aquí se generaliza con datos aleatorios en vez de solo los datasets D1-D3 fijos del día 2 |
| I-03 | Cierre de cuentas | ✅ Verificada (mismos 40 hogares) | Idéntico mecanismo que I-02 |
| I-04 | Capital acotado | ✅ Verificada (40 cuentas aleatorias, principal 1.000-15.000 €, TIN 0-20 %, plazo 6-84 meses) | El saldo financiado nunca es negativo y el capital amortizado nunca supera el principal financiado |
| I-05 | Neutralidad de inactivas | ⏳ Pendiente de E20-0 | No existe hoy el concepto de decisión `activa:false` ejecutable — ninguna de las tres pantallas de deuda lo modela |
| I-06 | Conmutatividad de independientes | ⏳ Pendiente de E20-0 | No existe hoy una resolución ordenada de varias decisiones; cada motor actual recibe una única operación por cuenta |
| I-07 | Monotonía de amortización | ✅ Verificada (40 pares aleatorios de amortización) — **encontró un fallo real, corregido** | Ver §3 |
| I-08 | Monotonía de tipo | ✅ Verificada (40 pares aleatorios de TIN base vs. +0,1 a +5 pp) | Subir el TIN nunca reduce el coste financiero total, en ningún caso generado |
| I-09 | Escenario vacío ≡ base | ⏳ Pendiente de E20-0 | No existe hoy un `motor(Escenario)` que comparar contra el Plan canónico |

Las tres pendientes quedan como pruebas `test.todo` en `tests/canonical-scenario-invariants.test.cjs`,
citando explícitamente a E20-0 como su desbloqueo — no se han omitido en silencio.

## 3. Hallazgo real: I-07 encontró un error en `legacy-debt-roadmap-engine.js`

Con 40 pares aleatorios de amortización (mismo importe, TIN y plazo; solo cambia cuánto se
amortiza por adelantado), el primer intento falló en el par `amount:4016, apr:17%, term:76 meses`
al pasar la amortización inicial de 383 € a 719 €: el motor reportó que la deuda tardaba **más**
en pagarse (78 meses en vez de 76) al amortizar **más**, justo lo contrario de lo que exige I-07.

**Causa:** `durationMonths` se calculaba con el array de saldos mutable declarado antes del bucle
mensual. Al terminar la simulación, ese array contiene el saldo del **último** mes para cualquier
cuenta — así que si un residuo de coma flotante dejaba el saldo final en un valor positivo ínfimo
en vez de exactamente cero, la deuda parecía seguir viva durante el resto del horizonte simulado,
por muchos meses que llevara realmente pagada.

**Corrección:** usar el saldo histórico de cada fila (`row.balances`, ya calculado y redondeado en
esa fila) en vez del array mutable. Un único punto de cambio en `legacy-debt-roadmap-engine.js`;
no afecta a `totalPaid`, `totalLump` ni `peak` — solo a la duración reportada.

**Alcance real del error:** no era teórico. `debt-roadmap.html` muestra `durationMonths` al usuario
como «Duración estimada» del plan de deuda, y el caso dorado **C007** (retomar pagos suspendidos,
día 3) ya lo exhibía sin que el informe de paridad de ese día lo detectara, porque la comparación
de §2 de `E19_INFORME_PARIDAD_DEUDA.md` se basaba en el coste total, no en la duración. Los 40
casos aleatorios de I-07 sí lo encontraron a la primera ejecución. Es la evidencia más concreta,
hasta ahora, de por qué el documento insiste en generación aleatoria y no solo casos escritos a
mano: un caso a mano tenía que acertar exactamente la combinación que produce el residuo de coma
flotante; un generador que prueba 40 combinaciones cada vez que corre la suite, no.

## 4. Presupuesto de rendimiento

Se añade una primera medición del límite de 150 ms para 120 meses que el documento fija para el
futuro motor de Escenario (§6), aplicada ya a `canonical-engine.buildScenario()` como referencia:
hoy tarda muy por debajo del límite. Cuando exista el motor de E20, esta misma prueba debe
repetirse contra él, no sustituir a esta.

## 5. Qué queda para el día 5

- Casos combinados C040-C045 (donde el documento espera que aparezcan más bugs de este tipo: orden
  de decisiones, conflictos, ciclos) y casos de proyectos/compras C020-C024.
- Las invariantes I-10 a I-15 (guardarraíles duros, rebase, reversión, Monte Carlo, presupuesto)
  siguen fuera de alcance hasta E20 y E21 respectivamente; no se han estimado ni prometido para
  esta fase.
