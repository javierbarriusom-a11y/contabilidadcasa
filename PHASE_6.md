# Fase 6: corte canónico y aceptación integral

La fase 6 completa la migración iniciada en las fases anteriores. El motor financiero canónico y el calendario canónico de decisiones son ahora las únicas fuentes de cálculo de la aplicación.

## Contrato de ejecución

- `canonical-engine.js` calcula saldos, ahorro y liquidez en todos los escenarios.
- `canonical-decisions.js` decide qué proyectos y deudas entran en el calendario financiero.
- `canonical-workflow.js` gobierna el ciclo de vida de cada decisión.
- Una decisión `simulated` o `pending` se puede revisar y comparar, pero no altera saldos.
- Solo las decisiones `approved` y `fixed` tienen impacto financiero.
- Las decisiones `executed`, `cancelled`, `discarded` o `deleted` conservan su trazabilidad y no se vuelven a programar.

## Sin fallback silencioso

La aplicación ya no sustituye un cálculo canónico por el cálculo histórico cuando detecta una diferencia. Si el motor canónico no está disponible o rompe una invariante, el cálculo se bloquea y muestra el error. Esto evita presentar cifras aparentemente válidas procedentes de dos reglas distintas.

El cálculo histórico permanece únicamente como referencia diagnóstica bajo el botón **Comparar con histórico** de la vista de conciliación. Ejecutar ese diagnóstico no cambia la fuente de los datos mostrados.

## Prueba de aceptación anonimizada

El fixture `tests/fixtures/anonymized-household.json` representa un hogar ficticio con:

- dos cuentas y cuatro cierres mensuales;
- gasto operativo, ahorro y refinanciación;
- una deuda con pagos suspendidos;
- proyectos pendientes, aprobados y ejecutados;
- una decisión de deuda fijada.

La prueba `tests/canonical-cutover.test.cjs` verifica de extremo a extremo que:

1. una decisión pendiente no mueve dinero;
2. aprobarla produce un único impacto por su importe exacto;
3. una deuda suspendida no inventa una cuota liberada;
4. las dos cuentas y la liquidez total se conservan cada mes;
5. la aplicación no contiene una ruta normal de regreso al motor histórico.

## Criterio de aceptación

- Todas las pruebas automáticas pasan.
- No existen valores no finitos ni discontinuidades mensuales.
- CaixaBank más Mediolanum coincide con la liquidez total.
- El resultado mensual explica la variación de liquidez.
- El diagnóstico histórico es opcional y nunca gobierna el dashboard.

## Recuperación

La recuperación ante una regresión se realiza mediante una versión de Git identificada y verificable. No existe un fallback en tiempo de ejecución que pueda mezclar reglas financieras sin dejar evidencia.
