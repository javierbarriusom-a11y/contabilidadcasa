# Fase 3 - Motor financiero canónico

## Objetivo

Centralizar el cálculo mensual de ingresos, gastos, ahorro y saldos en un motor puro y verificable. La interfaz deja de depender de fórmulas repartidas por distintas vistas y obtiene una traza común para explicar cada resultado.

La migración es deliberadamente segura: durante esta fase el motor anterior se conserva como referencia. El resultado canónico solo se utiliza cuando supera sus invariantes y coincide con el cálculo anterior dentro de una tolerancia de 0,02 EUR.

## Contrato de entrada

El adaptador de `app.js` transforma el estado de la aplicación en una entrada normalizada con:

- horizonte y mes inicial;
- saldos iniciales de CaixaBank y Mediolanum;
- ingresos y gastos mensuales de detalle;
- crecimiento de ingresos e inflación de gastos;
- coche, refinanciación y proyectos por mes;
- objetivo de ahorro y regla de ajuste automático por falta de caja.

El motor no consulta el DOM, `localStorage`, Supabase ni variables globales. Una misma entrada produce siempre la misma salida.

## Contrato de salida

Cada fila mensual contiene:

- mes e índice temporal;
- saldos de apertura por cuenta;
- ingresos, gastos operativos, coche, deuda y proyectos;
- ahorro solicitado, aplicado y no aplicado por falta de caja;
- saldos de cierre de CaixaBank, Mediolanum y liquidez total;
- magnitudes auxiliares necesarias para conciliación y auditoría.

El `snapshot` añade resumen anual, huella de la entrada, invariantes, incidencias y traza de auditoría.

## Invariantes

El motor comprueba en todos los meses:

1. Todos los importes son finitos.
2. El cierre de CaixaBank cuadra con apertura, ingresos, salidas y ahorro aplicado.
3. El cierre de Mediolanum cuadra con apertura y ahorro aplicado.
4. La liquidez total equivale a CaixaBank más Mediolanum.
5. El cierre de un mes coincide con la apertura del siguiente.

Una vulneración impide activar el resultado canónico y deja visible el motivo en la vista de conciliación.

## Paridad y fallback

En cada recálculo completo se ejecutan el motor canónico y el motor anterior. Se comparan las columnas financieras relevantes mes a mes:

- si hay paridad y los invariantes son válidos, la aplicación consume las filas canónicas;
- si existe una diferencia, se mantiene el resultado anterior y la discrepancia queda registrada;
- el botón `Verificar motor` fuerza una nueva comparación sin alterar los datos financieros.

La optimización interna de escenarios usa directamente el motor puro y evita duplicar el cálculo anterior en cada candidato. Esto mantiene la respuesta del simulador mientras la pantalla principal conserva la comprobación de paridad.

## Persistencia y rendimiento

Las filas completas se mantienen únicamente en memoria. En la copia local o sincronizada se guarda un resumen compacto: huella, número de filas, resúmenes, invariantes, paridad y traza. Así se evita inflar `localStorage` o el documento remoto con cientos de filas derivadas que se pueden recalcular.

## Vista de control

La sección `Conciliación` muestra:

- estado operativo del motor;
- meses verificados y duración del cálculo;
- incidencias de invariantes;
- diferencias de paridad por mes, campo y motor;
- huella y eventos de auditoría.

Esta vista es técnica y de control. No introduce nuevas cifras manuales ni modifica el libro canónico de la fase 2.

## Pruebas

La suite cubre:

- determinismo y saldos mensuales conocidos;
- límite automático del ahorro cuando falta caja;
- detección de alteraciones en saldos;
- tolerancia de paridad;
- huella y traza de auditoría;
- agregación anual;
- todas las garantías acumuladas de las fases 0, 1 y 2.

## Definición de terminado

- Existe un único contrato puro para el flujo mensual.
- La app integra el resultado con fallback seguro.
- Conciliación informa paridad e invariantes de forma visible.
- Los escenarios internos no sufren el coste de la doble ejecución.
- La persistencia conserva solo evidencia compacta y no datos derivados masivos.
- Las pruebas y la verificación visual no muestran regresiones.

## Siguiente fase

La fase 4 podrá retirar progresivamente el cálculo anterior cuando la paridad esté demostrada con datos reales, y mover reglas de deuda, proyectos y transferencias entre cuentas a servicios canónicos especializados.
