# Fase 7 - Tesorería diaria canónica

## Objetivo

Convertir el flujo mensual en un calendario diario trazable para conocer el punto real de mínima caja y evitar recomendaciones basadas solo en cierres de mes.

## Entregables

- `canonical-daily-engine.js` como motor puro y reutilizable.
- Fechas observadas, reglas conocidas y estimaciones diferenciadas por nivel de confianza.
- Saldos diarios separados de CaixaBank, Mediolanum y liquidez total.
- Traspasos neutros para la liquidez familiar.
- Paridad obligatoria entre el cierre diario y el motor mensual canónico.
- Auditoría visible de eventos, cierres y mínimos intrames.

## Reglas financieras

- La nómina principal se imputa el último día laborable.
- El salario de Tere se imputa el día 25 y el local el día 1.
- Los gastos con fecha bancaria identificable conservan esa fecha.
- Los conceptos sin fecha fiable se alisan entre los días 1 y 15.
- Un traspaso entre cuentas no crea ni destruye patrimonio.

## Garantías

Las pruebas verifican valores finitos, conservación diaria, continuidad entre días, neutralidad de traspasos y paridad con el cierre mensual.

