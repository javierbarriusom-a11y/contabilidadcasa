# WP-53 · Sin duplicados entre canales de captura — diseño

**Estado:** entregado como «en curso» (50 %). **Fuente:** `CAP-10` (`docs/PLAN_DESARROLLO_DEFINITIVO.md`), `docs/WP30_DISENO.md` §6, `PROJECT_STATE.md` (WP-25, «riesgo de fondo»).
**El repositorio es público: ningún dato real del hogar aquí.** Los ejemplos son inventados.

## 1. Qué pedía el plan y qué había de verdad

El plan: «emparejamiento por importe exacto, fecha ±2 días y comercio por similitud entre captura manual, enlaces de WP-25 y extracto; el extracto manda en importe y fecha».

Al leer el código aparecieron tres cosas que el plan no decía:

1. **Había un detector de duplicados, y hacía lo contrario de lo pedido.** El paso 3 de «Importar extracto» ya proponía duplicados por importe y ventana de días (7 por defecto, sin mirar el concepto). Pero «Es duplicado» **descarta la fila del banco y conserva la anotada a mano**: la fecha y el importe que prevalecen son los de la captura, no los del extracto.
2. **Los canales no son uno, son cuatro, y solo dos dejan un movimiento:**

   | Canal | Qué crea | ¿Se puede emparejar? |
   |---|---|---|
   | Captura rápida (DEX1) y foto de ticket (A17-3) | un **movimiento** (`manual-quick-capture`, `receipt-photo`) con fecha e importe | sí, ya |
   | «Registrar gasto» (FLU-2) y enlace de WP-25 sin tarjetas | una **partida nueva** con su real; **sin fecha ni cuándo se anotó** | no, hasta ahora |
   | La hoja de WP-30 (con tarjetas) | una **compra** en su almacén (`card-purchases`), no un movimiento | **no, a propósito** (§5) |
   | El extracto | movimientos del banco | — |

3. **El doble conteo real era el de la partida**: «Registrar gasto» crea una partida con su real y, cuando llega el extracto, el movimiento del banco se asigna a *otra* partida (la de la regla): el mismo pago cuenta dos veces. Es el «riesgo de fondo» que WP-25 dejó escrito.

## 2. Regla de emparejamiento (`canonical-capture-dedupe.js`, puro)

- **Importe exacto, al céntimo y con el mismo signo.** Una propina o un redondeo no se adivinan: la captura queda sin emparejar y se ve.
- **Fecha a ±2 días** de la captura.
- **Comercio por similitud** (Dice sobre palabras, tras quitar acentos y el ruido de banco —«compra», «tarj.», cifras, «SA»…—, con prefijos de 4+ letras y «un nombre dentro de otro»). **Si de un lado no queda ninguna palabra útil, la similitud es `null`, no 0**: dato ausente no es «distinto».
- **Confianza.** `alta` = importe + fecha + similitud ≥ 0,5. `media` = importe + fecha, pero comercio distinto o sin nombre comparable.
- **Una captura, una fila.** Asignación voraz y determinista (primero `alta`, luego mayor similitud, luego menos días, luego id): dos cafés iguales no se funden y el resultado no depende del orden de entrada.
- **No empareja nada solo.** Devuelve parejas con su confianza y su frase; quien llama pregunta.

## 3. Qué hace con el par (`captura-duplicados-ui.js`)

En el **paso 3** de Importar extracto, la fila con pareja se pinta aparte: lado a lado, de dónde sale lo anotado, **por qué se propone** («mismo importe, 1 día después de anotarlo, comercio parecido en un 100 %») y **qué se conserva** antes de pulsar. Botones: **«Es la misma compra»** / **«Son distintas»**.

| Captura | «Es la misma compra» al confirmar |
|---|---|
| movimiento (captura rápida, ticket) | se **quita la captura** y se queda la fila del banco: manda el extracto en importe y fecha |
| partida («Registrar gasto», enlace sin tarjetas) | la **fila del banco se asigna a esa partida** (regla «solo este movimiento», clave `transactionIdentity`), y `applyMovementMappingsToActuals` escribe como real lo que dice el banco, sin sumarse aparte |

- Todo ocurre **dentro del lote reversible** de la importación: «Deshacer último lote» devuelve la captura (o quita la asignación).
- «Son distintas» no toca nada y deja el chip «Duplicado revisado» como siempre.
- **Una partida solo se empareja con una fila de su mes** y solo si sigue existiendo, no tiene ya un movimiento asignado y el mes no está firmado: el real se escribe por partida y mes, y en otro mes no la sustituiría.
- La antigua decisión «Es duplicado» **se conserva** para el caso que sí es suyo: una fila que ya estaba en un extracto anterior. Solo cambia cuando el candidato es una captura.

## 4. El registro de capturas (`capture-log`)

«Registrar gasto» y el enlace sin tarjetas dejan ahora una entrada (`id`, partida, mes, **fecha**, importe, concepto, canal, **cuándo se anotó**). No es un dato nuevo del hogar: es lo que ya se tecleaba, que antes se perdía. Máximo 200 entradas; se podan las de más de 120 días. Va en la copia de seguridad y la nube (`BACKUP_LOCAL_STORES`). Las capturas anteriores a este paquete **no tienen entrada y no se pueden emparejar**.

Si la fecha del enlace cae en un mes cerrado y la ventana usa el primer mes abierto, la entrada lleva la fecha del enlace y el mes de la partida: no se emparejará (mes distinto). Es lo correcto: sustituir el real de otro mes sería escribir donde no toca.

## 5. Lo que NO se hace, y por qué

- **Las compras de la hoja de WP-30 no se emparejan fila a fila.** La tarjeta liquida en un cargo único; el extracto no trae el ticket. De eso se ocupa la conciliación de WP-30 («tus compras sumaban X, el cargo fue Y»). Si algún día se importa el extracto *de la tarjeta* (una línea por compra), habrá que emparejar ahí, y ese formato no se conoce.
- **No se empareja por importe aproximado.** Se prefiere dejar una captura sin emparejar a fundir dos pagos distintos.
- **El importe del paso 4 («Tras importar») no refleja la asignación de la partida**: la vista previa se calcula antes de que exista. El resultado final sí es el correcto (comprobado en el navegador).
- **Avisar al capturar** («esto ya está en el extracto») no se hace: el orden habitual es capturar primero y recibir el extracto después. Queda como mejora.
- **«<48 h»**: el panel de uso sigue «sin medir». La hoja guarda cuándo se anota (WP-30), pero el cargo de la tarjeta llega agregado; las capturas con movimiento o partida sí se podrían cruzar, pero el hogar con tarjetas usa la hoja y no producen datos. Prefiero no inventar un porcentaje.

## 5 bis. Defecto encontrado al probar: deshacer no quitaba las reglas aprendidas

Al comprobar en el navegador que «Deshacer último lote» devolvía la asignación de la partida, no la devolvía. Causa, **anterior a este paquete**: `datosImportarApply` fotografía el estado «antes» con `appStatePayload`, que guarda **la referencia** de `movementMappings` (no una copia); después añade las reglas aprendidas **en el mismo objeto**, así que cuando `createImportBatch` clona el «antes» ya lleva las reglas nuevas. Resultado: al deshacer volvían los movimientos y los reales, pero **las reglas de concepto aprendidas en ese lote se quedaban**. Se corrige copiando el objeto justo después de la foto (`movementMappings = { ...movementMappings }`); la asignación de la partida de este paquete también se crea sin mutar. Comprobado en el navegador (antes: 1 asignación tras deshacer; después: 0) y fijado por una prueba que mira el orden en `datosImportarApply`. Los movimientos no estaban afectados porque `baseData` se reasigna con un array nuevo.

**Lo que no cambia:** una fila del banco **sin pareja** pero con una captura del mismo importe a 3-7 días sigue saliendo como el candidato de siempre («Es duplicado» descarta la fila del banco y conserva la captura). Es el comportamiento anterior, no peor; unificarlo con la regla de «manda el extracto» cambiaría un aviso que hoy protege.

## 6. Fricción conocida

El paso 2 (clasificar) precede al 3: la fila del banco con pareja de partida pide primero una partida aunque el paso 3 vaya a asignarla. Se resuelve con «Ignorar» en el paso 2 y «Es la misma compra» en el paso 3 (la asignación de la pareja manda sobre la regla). Mejorable: ofrecerlo ya en el paso 2.

## 7. Qué lo mide y qué falta (para subir del 50 %)

- Falta **un extracto real con capturas reales**: la similitud de comercio está calibrada con nombres inventados («COMPRA TARJ. 4412 MERCADONA SA») y el umbral 0,5 es mío.
- Faltan los avisos al capturar y la vista previa del paso 4 con la asignación.
- El éxito del paquete es **«cero duplicados que el hogar tenga que adivinar»**; hasta que haya un mes de capturas y su extracto, no se puede afirmar.
