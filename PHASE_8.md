# Fase 8 - Contratos de deuda completos

## Objetivo

Representar cada deuda como un contrato identificable y no como una fila aislada, distinguiendo capital, cuota contractual, estado de pago, mora, vencimiento y acuerdo.

## Entregables

- `canonical-debt-contracts.js` como contrato normalizado de deuda.
- Identidad estable por entidad, tipo y número de producto.
- Estados `active`, `suspended`, `reunified` y `settled`.
- Capital inicial y actual, cuota original y cuota realmente programada.
- Fecha de suspensión, vencimiento, cuotas pendientes y atrasos estimados.
- Acuerdo asociado con importe, cuota, duración, inicio, estado y procedencia.
- Plan reunificado separado de sus productos componentes para evitar doble conteo.

## Reglas financieras

- Una deuda suspendida programa cuota cero y no genera ahorro liberado al amortizarla.
- Una deuda saldada no vuelve a aparecer como candidata.
- Retomar pagos incluye atrasos estimados y la cuota contractual hasta vencimiento.
- Los importes declarados y estimados conservan su procedencia.

## Garantías

Las pruebas cubren normalización, duplicados, pagos suspendidos, plan reunificado, atrasos y retoma de pagos.

