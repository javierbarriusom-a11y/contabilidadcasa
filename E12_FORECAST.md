# E12a — Contrato canónico de forecast

## Objetivo

`finance-canonical-forecast/v1` es la única lectura futura para las vistas de la aplicación. Envuelve el
resultado de `finance-canonical-engine/v1`; no introduce un segundo cálculo ni modifica el plan por sí solo.

## Registro de supuestos

`finance-forecast-assumptions/v1` registra saldo operativo, ahorro separado, factores de ingresos y gastos,
crecimiento, inflación, ahorro objetivo y su ajuste automático. Cada entrada conserva valor, unidad, origen,
método y fecha de la última modificación. Su huella solo cambia cuando cambia un supuesto financiero.

## Serie mensual explicable

Cada mes identifica origen, método y confianza, conserva los totales del motor mensual y descompone ingresos
y salidas en real, recurrencia, evento, deuda, proyecto y ajuste manual. En E12a las categorías sin evidencia
se mantienen a cero; E12b podrá enriquecerlas sin cambiar los totales ni el contrato de consumo.

## Compatibilidad y barrera de paridad

Las vistas existentes reciben las mismas filas y valores que antes, ahora vinculadas a su mes explicable. La
aplicación detiene el forecast si ingresos, salidas, ahorro o saldos difieren más de dos céntimos del motor
canónico. El contrato forma parte del paquete público y del shell offline versionado.

## Fuera de alcance de E12a

- No aprende desviaciones ni estacionalidad.
- No genera probabilidades ni escenarios nuevos.
- No aplica supuestos o correcciones sin una acción confirmada del usuario.
- No retira ninguna vista actual.
