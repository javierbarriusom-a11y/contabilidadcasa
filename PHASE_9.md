# Fase 9 - Comparador de acuerdos de deuda

## Objetivo

Comparar alternativas de una misma deuda antes de comprometer el plan real y recomendar solo opciones compatibles con la reserva operativa.

## Alternativas

- No actuar.
- Pago único.
- Pago fraccionado.
- Reunificación.
- Retomar pagos.

## Criterios de comparación

1. Respetar la reserva operativa.
2. Reducir la deuda pendiente.
3. Minimizar el coste total.
4. Cerrar antes el contrato.
5. Conservar el mayor mínimo de CaixaBank.

## Flujo de decisión

- La comparación genera una revisión previa, no una mutación del plan.
- Cada alternativa muestra caja mínima, deuda restante, coste, fecha de cierre e impacto final.
- Solo la confirmación explícita incorpora la opción elegida al ciclo canónico de decisiones.
- La referencia `No actuar` permanece visible para medir coste de oportunidad.

## Garantías

Las pruebas validan reparto exacto de céntimos, reserva, orden de alternativas, recomendación y exposición correcta en navegador.
