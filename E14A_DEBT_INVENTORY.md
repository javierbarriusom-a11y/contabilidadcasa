# E14a — Inventario del plan visual de deuda

El plan visual conserva sus datos operativos y supuestos, pero recibe en modo de solo lectura los datos
financieros que ya tienen una fuente canónica. Un campo ambiguo mantiene su valor anterior y no se migra.

| Clasificación | Campos | Tratamiento E14a |
| --- | --- | --- |
| Canónico | `liquidity`, `monthly`, `cb_amount`, `bk_amount`, `baseMonth` | Lectura desde forecast y contratos; no se envía de vuelta al estado del plan visual |
| Operativo | `tasks`, `scenario`, `agreement`, `wizink_hito_mes` | Sigue editable y versionado dentro de `debtRoadmapState` |
| Supuesto | `profile`, `buffer`, `preserveCash`, estrategias, quitas, fechas, pagos únicos, TAE, plazos, porcentaje financiado, horizonte y tipo de referencia | Sigue editable; se identifica como hipótesis del usuario |
| Nota | `notes` | Texto libre sin interpretación ni migración automática |

## Cálculos existentes

- Fondo negociador, oferta inicial, zona de cierre y capacidad útil: cálculo local derivado de datos
  canónicos más supuestos del plan.
- Pago financiado: fórmula de cuota constante con TAE y plazo introducidos como supuestos.
- Forecast, saldo pendiente, margen, escenarios A/B/C y recomendación: simulaciones locales del plan
  visual. No sustituyen el forecast canónico ni escriben en él.
- Progreso, checklist y semáforo: seguimiento operativo, sin impacto financiero automático.

## Correspondencias seguras

- `Entidad A` y `Entidad B` se vinculan únicamente cuando existe un solo contrato canónico con ese nombre.
- Liquidez, capacidad y mes base se usan únicamente cuando el forecast canónico es válido.
- Si falta el forecast, no supera paridad o hay cero/múltiples contratos candidatos, el adaptador marca
  el campo como ambiguo y conserva el valor previo.

## Contrato de estrategia

`finance-debt-strategy/v1` normaliza quita, pago único, refinanciación, suspensión, mora, reanudación de
pagos y espera. Incluye deuda objetivo, capital, importe, TAE, cuota, plazo, fechas, mora, estado y fuente.
E14a solo lo valida y expone; aplicar una estrategia al plan canónico queda fuera de alcance hasta E14b.
