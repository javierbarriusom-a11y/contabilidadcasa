# XDA-04 · Cobertura del libro — diseño

Paquete de la séptima auditoría (`docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md`, XDA-04). Decisiones del hogar del
**26/10/2026**:

- **Orden:** PR-1 ahora (registro, motor, WP-27 y aviso en el cierre) y PR-2 (la tira) cuando haya dos importaciones reales.
- **Periodo:** al importar, se deduce y se pregunta antes de confirmar.
- **Límite de paquetes:** «no hay límites».

## 1. El problema que había

Hasta el 26/10 la «cobertura» era **una sola fecha global**: la del último movimiento importado de cualquier cuenta
(`expectedLedgerCoveredUntil`). Eso fallaba de dos maneras:

- **Con un hueco entre extractos.** Si se importaba del 1 al 10 y del 20 al 31, la app daba por visto el día 15 y podía
  preguntar «¿no ha llegado el recibo del 15?».
- **Con varias cuentas.** Un extracto de CaixaBank al día hacía parecer al día a Mediolanum.

Además, el cierre firmaba sin saber si el mes estaba entero en los extractos.

**Lo que no se puede saber solo:** un CSV no dice qué periodo cubre. Un día sin movimientos no es un día sin mirar.
Lo único deducible es el primer y el último movimiento del fichero; por eso se pregunta.

## 2. PR-1 (hecho el 26/10)

| Pieza | Qué hace |
|---|---|
| `canonical-ledger-coverage.js` | Motor puro: rangos por cuenta (unidos, también los contiguos), `covers`, `gaps`, `month` (el mes en curso solo hasta hoy), `deduce`, `estimateFromLedger` y `addRange`. Sin importes ni conceptos |
| `cobertura-ui.js` | Almacén `ledger-coverage`, que viaja en la copia y la nube y entra en el lote. El periodo «estimado» de lo anterior se calcula al leer, sin guardarse. Incluye la pregunta en la revisión de Importar v2, el registro al confirmar y el aviso del cierre |
| `views/importar-v2.js` | «¿Qué periodo exportaste?» con dos fechas, rellenas con lo deducido. Se valida que contenga todos los movimientos y que no pase de hoy |
| `app.js` (+2) | `datosImportarApply` registra el periodo antes de la foto del lote, así que «Deshacer» lo quita; `ledger-coverage` se añade a `BACKUP_LOCAL_STORES` |
| `esperados-ui.js` + `canonical-expected-movements.js` | Con `coveredRanges`, un cargo solo se da por no llegado si se ha visto entero `[fecha esperada, primer día de preguntar]` en la cuenta de los recibos. Sin rangos, como antes |
| `views/cierre.js` | En el paso de firma, «Los extractos (no) cubren el mes entero» con el detalle por cuenta. Avisa, no bloquea |

**Fuentes del periodo:**

- **Declarado:** el hogar lo vio en la revisión de Importar v2 y confirmó la importación.
- **Deducido:** se importó desde el asistente de siempre, que no lo pregunta.
- **Estimado:** lo que ya había en el libro, por cuenta, del primer al último movimiento de extracto anterior al primer
  periodo registrado. Las anotaciones a mano (`manual-quick-capture`) no cuentan como cubiertas.

**Cuenta de los recibos:** la de los extractos sin etiqueta (CaixaBank, como el pulso de saldos). Una partida no dice
en qué cuenta se carga; si alguna se cargara en otra, no se preguntaría por ella hasta tener ese dato.

**Decisión técnica:** el almacén se crea vacío antes de la primera importación. «Deshacer» restaura la foto previa al
lote y esa restauración nunca borra un almacén que la foto no traía; sin el almacén vacío, deshacer la primera
importación dejaría su periodo registrado.

## 3. PR-2 (cuando haya dos importaciones reales)

- **Tira de 90 días por cuenta** en Importar y en el paso «Extracto» del repaso. Al tocar un hueco: «Importa un extracto
  que cubra del 11 al 19 oct», con la importación en un toque.
- **Deuda en la sombra (WP-41) y anomalías (WP-36)** dirán qué días no han podido mirar, en vez de callar.

## 4. Medida y retirada

- **Métricas:** días con hueco en los últimos 90, por cuenta (objetivo 0), y preguntas de «¿ha llegado…?» calladas por
  un hueco (`silent.unverifiable`).
- **Retirada (auditoría):** si en tres meses no hay ningún hueco, la tira se pliega a un aviso que solo sale cuando
  aparece uno.
