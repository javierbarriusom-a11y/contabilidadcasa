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

## 3. PR-2 (hecho el 12/11/2026, con dos importaciones reales)

Condición cumplida según el hogar el 12/11: «hay uno inicial para el coding y el actualizado de octubre para cerrar». El
inicial, si entró antes del 26/10, cuenta como «estimado» y la tira lo pinta así.

| Pieza | Qué hace |
|---|---|
| `canonical-ledger-coverage.js` | `strip` (la tira de N días de una cuenta: cubierto, hueco, sin dato; lo estimado aparte día a día, porque `merged` lo pierde al tocar un rango declarado), `afterImport` (qué hueco cierra un extracto, cuál abre y hasta cuándo queda cubierta) y `unseen` (lo que no se ha visto en una ventana, por cuenta) |
| `cobertura-ui.js` | `tiraHtml`, `trasImportarHtml` y `noMiradoReciente`; sin ningún extracto en ninguna cuenta no pinta nada |
| `views/movimientos-v2.js` | «Cobertura · últimos 90 días» entre la bandeja y la lista, como `Movimientos.png`; la línea «Aún no llegan solos» deja de prometerla |
| `views/repaso-v2.js` | La tira bajo las filas del paso «Extracto», sin botón propio (el del pie ya importa) |
| `views/importar-v2.js` | «Cobertura tras importar» bajo el cuadre, como `ImportarDesktop.png`, con el periodo que el hogar tiene delante |
| `anomalias-ui.js`, `sombra-ui.js` | «No he podido mirar del 4 al 9 oct en CaixaBank: no hay extracto de esos días», en su ventana de 45 días |

**Reglas de la tira:**

- Un **hueco** es un tramo sin ver con días vistos antes y después: falta un extracto en medio. Lo que va desde el último
  extracto hasta hoy es **sin dato** (es lo normal entre dos extractos). Lo de antes del primero también.
- Se clasifica con la historia entera de la cuenta. Un hueco que empieza antes de la ventana sigue siendo hueco.
- **Qué importar:** un solo extracto, del primer hueco hasta hoy (en el banco se exporta un periodo, no varios). Sin
  huecos, lo que va desde el último. La pista pide confirmar ese periodo en «¿Qué periodo exportaste?».
- **Desviación del diseño:** el diseño decía «en Importar y en el paso Extracto del repaso». La referencia
  (`Movimientos.png`) la pone en Movimientos, y es donde va (CLAUDE.md: la referencia es la base). Importar lleva su
  tarjeta «Cobertura tras importar», como `ImportarDesktop.png`.
- **XGO-01:** sin datos del hogar no se pinta, así que el inventario de titulares no cambia. Con datos, Movimientos suma
  el titular «Cobertura», que es el de la referencia.

## 4. Medida y retirada

- **Métricas:** días con hueco en los últimos 90, por cuenta (objetivo 0), y preguntas de «¿ha llegado…?» calladas por
  un hueco (`silent.unverifiable`).
- **Retirada (auditoría):** si en tres meses no hay ningún hueco, la tira se pliega a un aviso que solo sale cuando
  aparece uno.
