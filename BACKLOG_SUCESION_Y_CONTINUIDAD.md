# Backlog — Sucesión y continuidad

> Mapa de todos los backlogs del repositorio: [`BACKLOG_INDICE.md`](BACKLOG_INDICE.md).
> Continúa la numeración `LPX` (Patrimonio y vida) abierta en `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md`
> (`LPX1`-`LPX3`) en vez de inventar un prefijo nuevo — mismo criterio que ya aplicó la Oleada 4 al
> continuar `PVC`/`INV`/`LEV`/`DEB`/`GOB`.

Fecha de creación: 14 de septiembre de 2026 (sesión 192).

## 0. Origen y diagnóstico

Este documento recupera un hallazgo que quedó sin convertir en backlog: en la sesión 164 (10 de
septiembre), antes de priorizar `A5-1`, el hogar hizo una auditoría crítica sobre copiloto/IA,
fiscalidad, patrimonio, continuidad y multidispositivo — pero esa misma sesión se desvió a activar
`A5-1` y la auditoría nunca se convirtió en documento. Sus hallazgos quedaron registrados en
`PROJECT_STATE.md` (cierre de la sesión 164). Verificados contra el código real en la sesión 192,
ocho sesiones y dos oleadas completas (previsión/inversión/apalancamiento/deuda) después, dos siguen
intactos:

- **Fiscalidad**: `canonical-tax-tables.js` y `canonical-irpf-estimator.js` no cubren Sucesiones y
  Donaciones (ni Patrimonio/Grandes Fortunas). El hogar confirma en la sesión 192 que Patrimonio/
  Grandes Fortunas no le aplica — se descarta (§3). Sucesiones y Donaciones sí sigue siendo
  relevante — sí se aborda aquí, con el alcance reducido que exige la realidad del impuesto (ver
  abajo).
- **Continuidad**: `lpx3ContinuityChecklist()` (`LPX3`, sesión 141) no ha crecido desde entonces —
  dos comprobaciones automáticas (activos con procedencia, pólizas registradas) y tres casillas
  manuales globales (testamento, beneficiarios, a quién avisar), sin ningún dato real detrás de las
  tres casillas.

**Por qué el alcance de `LPX4` es un aviso, no una calculadora fiscal completa**: el Impuesto de
Sucesiones y Donaciones no es solo una tarifa progresiva — el resultado real depende también del
grupo de parentesco del heredero (I a IV), su patrimonio preexistente (que multiplica la cuota) y
bonificaciones autonómicas que varían muchísimo entre las 17 comunidades (en varias, la cuota entre
padres e hijos queda bonificada al 99%; en otras, no). Ninguno de esos tres datos existe hoy en
ningún `canonical-*.js` (verificado por `grep`: cero resultados para parentesco/heredero/beneficiario
fuera de un archivo no relacionado). Construir una calculadora completa exigiría inventar un modelo
de familia/herederos entero y sostener una tabla de bonificaciones por comunidad que caduca cada año
— desproporcionado, y contrario a la disciplina que ya aplica `validateBracketScale` en `A15-2`
(canonical-irpf-estimator.js): nunca se fabrica un tramo o bonificación sin fuente completa y
declarada por el hogar. El propio hallazgo de la sesión 164 ya anticipaba el alcance correcto: "aviso
temprano reusando el motor de patrimonio neto ya construido, no una calculadora fiscal nueva".

## 1. Tareas accionables (continúan `LPX1`-`LPX3`)

| ID | Tarea | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|
| ⏳ `LPX4` | Aviso temprano de coste fiscal por sucesión/donación | M | Alto | Reutiliza `lpNetWorthSnapshot()` (`LPX1`/`LPX2`) para el valor de la masa hereditaria — sin motor de patrimonio nuevo. Sin una bonificación/tipo efectivo declarado por el propio hogar, con fuente completa (mismo criterio de `hasCompleteSource`/`validateBracketScale` que `A15-2`), no calcula ninguna cifra: solo muestra el patrimonio neto y explica por qué el coste fiscal real depende de comunidad autónoma, grupo de parentesco y patrimonio preexistente del heredero — ninguno de los cuales infiere ni fabrica la app. Con la bonificación declarada, reutiliza `progressiveTax()` (mismo primitivo que `A15-2`/`LEV10`) sobre el patrimonio neto menos el mínimo exento declarado. Informativo: nunca decide ni sustituye asesoría fiscal real. |
| ⏳ `LPX5` | Destino declarado por activo | S-M | Medio | Extiende el checklist de `LPX3`: por cada activo de `assetsList()` (`A14-1`), un campo opcional "a quién se destina" (texto libre, nunca vinculante, nunca decide legítima ni sustituye testamento). Convierte la casilla global "a quién avisar" en algo trazable activo por activo, reutilizando el registro de activos ya existente. |
| ⏳ `LPX6` | Beneficiario declarado por póliza de vida | S | Medio | `canonical-life-coverage.js` (`SP1`) no declara beneficiario, solo importe y prima. Nuevo campo opcional por póliza; `LPX3` sustituye su casilla manual global "beneficiarios" por una comprobación real (al menos una póliza de vida con beneficiario declarado) — mismo tipo de cierre de bucle que `PVC13` hizo con `confidenceBands()`: de casilla de confianza a comprobación contra dato real. |

## 2. Postpuesto, declarado sin auditar (decisión del hogar, sesión 192)

El hallazgo de la sesión 164 daba por resueltos copiloto/IA y multidispositivo, pero ocho sesiones y
la Oleada 4 completa han pasado desde entonces (`GOB17`, entre otras, tocó justo el copiloto). El
hogar decide en la sesión 192 declarar aquí ambos frentes para no perderlos, pero posponer su
auditoría real — no se hace ahora mismo.

| Frente | Qué haría falta para retomarlo |
|---|---|
| Copiloto/IA (`E9-1`, `GOB17`, `canonical-e9-assistant.js`...) | Re-auditar contra el código actual antes de asumir que sigue "resuelto sin tarea nueva" — la suposición tiene 8 sesiones. |
| Multidispositivo (`MDX1`/`MDX2`, `RGX1`/`RGX2`) | Mismo motivo: dado por resuelto en la sesión 164, nunca re-verificado desde entonces. |

## 3. Descartado

| Frente | Motivo |
|---|---|
| Patrimonio / Grandes Fortunas | El hogar confirma (sesión 192) que no es relevante para su situación actual — a diferencia de Sucesiones y Donaciones, que sí puede aplicar. |

## 4. Advertencia (mismo criterio que el resto del proyecto)

`LPX4` nunca debe presentar una cifra fiscal sin que el propio hogar haya declarado la bonificación/
tipo efectivo con fuente completa — mostrar un importe con apariencia de exacto sobre una bonificación
inventada o de otra comunidad sería peor que no mostrar nada. `LPX5` y `LPX6` son declaraciones del
hogar, nunca una decisión legal: ninguna sustituye un testamento real ni determina la legítima.
