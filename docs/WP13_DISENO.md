# WP-13 · Índices oficiales con caducidad — diseño (PR-1: tecleados con fecha)

Paquete del plan definitivo (ND-11, Ola 2, ≈ 1,5 sesiones). **Se corta en dos PRs** por decisión del hogar del 7/10/2026:

| PR | Qué | Estado |
|---|---|---|
| **PR-1** | Euribor 12 meses, €STR e IPC **tecleados con la fecha del dato**, con caducidad y aviso. **Sin ninguna conexión externa.** | Hecho el 7/10/2026 |
| **PR-2** | Fuente oficial (CORS directo o función privada de solo lectura), con vuelta al valor tecleado | **Espera a la decisión de `O-6` del 16/10/2026** (`docs/ND13_SPIKE_CONEXION.md`) y a la revisión de seguridad (`docs/NTC06_AMENAZAS.md`, prueba `ntc6-conexiones-externas`) |

## 1. Por qué se corta

WP-20 (revisión del tipo variable de la hipoteca) es el camino crítico **por fecha**: la revisión es en marzo y el preaviso cae a primeros de enero. Esperar a la decisión de O-6 para empezarlo recorta el margen sin necesidad: el plan ya admite que el motor use «tipos de WP-13 o tecleados con fecha» (`docs/PLAN_DESARROLLO_DEFINITIVO.md`, WP-42). El valor tecleado con fecha **es** la vuelta atrás de PR-2; construirlo primero no se tira.

## 2. Lo que se entrega

Una tarjeta en **Deuda › Contratos › «Índices de referencia»** (`indices-ui.js`; motor puro en `canonical-rate-indices.js`):

- Tres índices, cada uno con su último valor, **la fecha a la que se refiere el dato** y un estado **vigente / caducado / sin dato** con su edad en días.
- Formulario de valor (coma o punto, signo, «%») y fecha (por defecto hoy; nunca futura). Un segundo valor con la misma fecha **sustituye**.
- Historial de los últimos 12 valores con «Quitar»; se conservan 120 por índice.
- Almacén `rate-indices` en la copia y la nube (datos públicos, sin importes).
- El motor expone `latest`, `valueAt(fecha)` y `monthlyAverage(mes)` para WP-20 (regla del índice del contrato: media mensual o valor de un día).

### Lo que NO es

- **No consulta ninguna fuente.** Una prueba impide que `canonical-rate-indices.js` contenga `fetch`, `XMLHttpRequest`, URLs o acceso al DOM.
- **No es un histórico de mercado.** Es lo que el hogar teclea; `monthlyAverage` es la media **de los puntos tecleados** del mes y devuelve cuántos son.

## 3. Decisiones que conviene cuestionar

1. **Plazos de caducidad: Euribor 35 días, €STR 10, IPC 75.** Son de criterio, no de mercado: el Euribor y el IPC se publican una vez al mes (el IPC con retraso), el €STR cada día hábil. Si el hogar teclea el Euribor solo cuando le toca revisar, verá «caducado» casi siempre; es lo correcto (el dato *lo está*), pero puede irritar. Los plazos son una constante en el motor, no una pantalla.
2. **La fecha es la del dato, no la del tecleo.** Se guarda además el día de alta (`enteredAt`) para auditar, pero la caducidad cuenta desde la fecha del dato. Teclear hoy el Euribor del 1 de octubre lo hace tener 6 días.
3. **Rangos de cordura** (Euribor/€STR de −2 a 15 %, IPC de −10 a 30 %): rechazan `23,5` por `2,35`. Un rango no sustituye a mirar el dato; solo caza el error de coma.
4. **Un solo punto por índice y fecha.** Simple y explicable; se pierde el rastro de una corrección (queda el valor nuevo).
5. **Origen `manual` / `oficial` ya modelado.** PR-2 solo tiene que escribir `source: "oficial"`; el valor tecleado de la misma fecha se conserva como reserva si no se pisa.

## 4. Pendiente y deuda conocida

| Qué | Cuándo |
|---|---|
| **Duplicación con DEB4:** el «Euribor actual» del radar de refinanciación (Ajustes › Hipoteca variable → fija) es un campo propio con fecha mensual. Hoy hay dos sitios donde teclear el Euribor | PR-2: el radar leerá este almacén. No se unifica ahora para no tocar `app.js` (37.4xx de 37.495) sin necesidad |
| PR-2: fuente oficial | Tras `O-6` (16/10). Si `O-6` se cierra sin verificación práctica, PR-2 se archiva y los índices siguen siendo manuales |
| Medir: «índices vigentes cuando hacen falta» | Con uso real; hoy sin medir |

## 4 bis. Correcciones posteriores (mismo día, en el PR de WP-20)

- **Un clic muy temprano se perdía:** el formulario se pinta antes de que `init()` enganche sus eventos. Pintar la tarjeta ahora garantiza (de forma idempotente) que están enganchados. Era la causa de una prueba de axe intermitente en oscuro (≈ 1 de cada 4-6 ejecuciones; 0 en 8 tras el arreglo).
- **Fechas en prosa como en España** (`7/10/2026`, no `2026-10-07`).
- Al guardar o quitar un valor, la tarjeta de WP-20 se repinta: su resultado usa este Euribor.

## 5. Cómo se prueba

- `tests/wp13-indices.test.cjs`: parseo de tipos, validación (coma de más, fecha futura/inexistente/antigua, rangos), sustitución por fecha, caducidad exacta de cada índice (último día vigente y primero caducado), historial acotado, almacén corrupto, media mensual y valor a una fecha, ausencia de red y cableado (tarjeta, scripts, copia, service worker, build).
- `tests/qa1-flujos-completos.spec.cjs`: la tarjeta en 1280 y 390 px — guardar, caducar, quitar, recargar.
- `tests/opt4-axe-accessibility.spec.cjs`: la tarjeta en claro y en oscuro.
