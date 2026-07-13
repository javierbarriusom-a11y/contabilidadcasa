# Fase 2 - Libro canónico y conciliación

## Objetivo

Disponer de una fuente contable verificable para contrastar movimientos bancarios, datos reales capturados y saldos antes de que una cifra alimente decisiones de deuda, ahorro o proyectos.

## Contrato del libro

El módulo `canonical-ledger.js` genera una instantánea con esquema `finance-canonical-ledger/v1` que contiene:

- movimientos normalizados con identidad y huella estables;
- cuenta, fecha, signo, saldo posterior, procedencia y clasificación;
- duplicados enlazados al primer movimiento, sin sumarlos dos veces;
- importes reales mensuales normalizados por partida;
- conciliación mensual y por concepto entre banco y dato real;
- continuidad de saldo independiente para cada cuenta;
- indicadores de cobertura, diferencias y calidad;
- historial limitado de cambios contables reales.

La instantánea se guarda junto al estado local, la copia de seguridad y la sincronización remota. Los estados anteriores migran de forma no destructiva al reconstruirse por primera vez.

## Invariantes

1. Un movimiento duplicado nunca puede incrementar ingresos o gastos conciliados.
2. Cada movimiento utilizable debe estar clasificado o figurar expresamente como pendiente.
3. La continuidad de saldo se comprueba por cuenta y tolera extractos ordenados en ambos sentidos.
4. Un mes solo está conciliado cuando ingresos y gastos bancarios coinciden con los datos reales dentro de una tolerancia de dos céntimos.
5. Recalcular el mismo contenido no añade ruido al historial de auditoría.
6. Las diferencias se muestran por mes y por partida, sin compensar silenciosamente ingresos con gastos.

## Flujo operativo

1. Importar el extracto en `Movimientos`.
2. Clasificar los movimientos pendientes con el diccionario bancario.
3. Registrar o importar importes reales en el detalle mensual.
4. Abrir `Conciliación` y revisar invariantes, meses y partidas con diferencias.
5. Corregir la clasificación o el dato real en su pantalla de origen.
6. Exportar la evidencia JSON cuando se necesite conservar una fotografía verificable.

## Vista de conciliación

La sección `Conciliación` incluye:

- calidad del libro, cobertura, pendientes y diferencias;
- comprobación visible de duplicados, clasificación, continuidad y banco = real;
- tabla mensual de ingresos y gastos banco vs. real;
- movimientos sin clasificar;
- continuidad de saldo por cuenta;
- diferencias por partida;
- acceso directo a movimientos y detalle mensual;
- exportación de la instantánea canónica.

## Garantías cubiertas por pruebas

- identidades deterministas y detección de duplicados;
- conciliación exacta de ingresos y gastos;
- detección de diferencias y movimientos sin clasificar;
- continuidad con extractos antiguos o recientes primero;
- auditoría idempotente ante reconstrucciones sin cambios;
- aislamiento de saldos entre CaixaBank y Mediolanum.

## Definición de terminado

- El libro se reconstruye tras cambios relevantes y al iniciar la app.
- La instantánea persiste en local, backup y sincronización.
- Todos los indicadores de conciliación proceden de la misma instantánea.
- Los errores contables quedan visibles y accionables.
- La batería de regresión y del libro canónico pasa completa.
- La vista funciona en escritorio y en anchuras reducidas.

## Límite deliberado

En esta fase el libro canónico es la capa única de control y conciliación. Los motores históricos de flujo, deuda, ahorro y proyectos todavía conservan sus adaptadores actuales. Su migración para consumir directamente este contrato será gradual en la fase siguiente, evitando cambiar de golpe cálculos financieros ya utilizados.
