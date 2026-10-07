# WP-32 · Recordatorios en el momento de máximo valor — diseño

Paquete del plan definitivo (CAP-09, absorbe ND-10; Ola 2, fuera de la app, ≈ 1 sesión). Construido el 7/10/2026 sobre WP-07 (motor de fechas) y la exportación `.ics` de A17-2.

## 1. El problema

Un recordatorio fijo («lunes, miércoles y viernes: actualizad saldos») enseña a ignorarlo: casi siempre llega cuando actualizar no cambia ninguna cifra. El valor de poner al día los saldos está **justo antes de decidir** (cuánto se reparte al cobrar), **justo después de un cargo grande** y **el día de cerrar el mes**. El resto de días es ruido.

## 2. Lo que se entrega (y lo que no)

Una tarjeta en **Ajustes › «Recordatorios en el calendario del móvil»** que genera un fichero `.ics` con cuatro tipos de aviso, calculados con la previsión de hoy:

| Tipo | Cuándo | Solo si |
|---|---|---|
| **Cobro** | 2 días antes (si ya es tarde, hoy) | El día del cobro es seguro (por regla u observado). Varios cobros el mismo día, un solo aviso |
| **Cargo grande** | El día siguiente | El día del cargo es seguro y el importe ≥ umbral (500 €, editable) |
| **Cerrar el mes** | El día 1 | Siempre (la ventana de cierre es del 1 al 3) |
| **Campaña fiscal** | 1/12 y 20/12 | Siempre; el texto dice que son estimaciones |

Cada evento es de día completo, **transparente** (no bloquea el calendario) y con una alarma a las 9:00.

### Lo que NO es: un calendario suscribible

La especificación decía «calendario suscribible regenerado con la previsión». **No se puede, y se dice en la tarjeta:**

- El sitio es estático (GitHub Pages, sin servidor): nada puede regenerar un fichero cuando cambia el plan.
- El repositorio es **público**: una dirección con la previsión del hogar sería publicar sus finanzas (y la prueba de privacidad del CI bloquea justo eso).

Lo que sí hay: un fichero que se genera **en el dispositivo**, no sale de él y cubre 6 meses. Importarlo otra vez **actualiza** los avisos que siguen valiendo (los identificadores son estables: `rec-cobro-<fecha>`, `rec-cargo-<fecha>-<concepto>`…), pero **no puede borrar** los que ya no valen (un `.ics` no puede borrar nada). Consecuencia práctica: un cobro que se retrasa deja su aviso antiguo en el calendario hasta que se borre a mano. La tarjeta avisa de cuándo regenerar: nunca generado, más de 30 días, o menos de un mes cubierto por delante.

## 3. Decisiones que conviene cuestionar

1. **Nada con fecha estimada.** Un cobro o cargo con el día de relleno (el 8) generaría un aviso en un día cualquiera, que es el ruido que este paquete quiere evitar. La tarjeta dice cuántos se quedan fuera («12 cobros y 18 cargos con fecha estimada») y cómo entran: declarando el día de cargo en Plan › Partidas (WP-08). **Efecto: con pocas fechas ciertas habrá pocos avisos.** Con la demo salen 9 (cierres, fiscales y un cobro); con los datos del hogar saldrán más (las nóminas y el local ya tienen regla).
2. **Los títulos no llevan importes ni nombres.** Es lo que sale en la pantalla de bloqueo. El detalle (importe, concepto), que solo se ve al abrir el evento, sí. Hay una prueba que lo comprueba sobre el fichero real descargado.
3. **El umbral de «cargo grande» es un importe fijo (500 €), no un porcentaje.** Sencillo y explicable; si no sirve, se edita. Una alternativa (los N cargos mayores del mes) tendría más sentido con datos reales.
4. **Alarma a las 9:00 de cada día completo.** Sin horas por persona ni por cuenta: un móvil, una hora. Cambiable en el motor (`alarmHour`), no en la pantalla.
5. **Preferencias en este dispositivo**, no en la copia: describen el móvil donde se importa el fichero.

## 4. Pendiente

| Qué | Cuándo |
|---|---|
| El aviso «si no ha llegado, la app lo preguntará» del cargo grande | Cuando exista WP-27 (cargos que no llegaron): hoy el texto solo pide comprobarlo |
| Eventos de la campaña fiscal con la fecha límite real de cada acción (WP-23 PR-3) | Con los datos fiscales (H-03, 20/10) |
| Medir el éxito: «frescura ≤ 1 día en los momentos de decisión en ≥ 90 % de los meses» | Hay que medirlo con la frescura de los saldos cuando exista uso real; hoy está sin medir |
| Fondo claro fijo de los 15 `<fieldset>` de la app en modo oscuro (`styles.css`: `fieldset { background: #fbfcfd }`; la tarjeta de esta tarea lo anula en su hoja) | Hallazgo de esta tarea; se corrige en `styles.css` en un PR aparte, midiendo antes cuántos se ven mal |

## 5. Cómo se prueba

- `tests/wp32-recordatorios.test.cjs` (20): cada tipo, solo fechas seguras, agrupación de cobros, aviso que caería antes de hoy, solo lo que cae en el periodo del fichero, ventana de cierre, fiscal, tipos que se apagan, identificadores estables entre generaciones, tope de 150 eventos, `.ics` válido (CRLF, alarma, `DTEND`, escapes, plegado a 75 octetos sin partir caracteres de varios bytes) y frescura del fichero; cableado y diseño.
- `tests/qa1-flujos-completos.spec.cjs`: la tarjeta en 1280 y 390 px: las opciones se recuerdan al recargar, la descarga es un `.ics` con una alarma por evento, los títulos no llevan importes, «Generado hoy».
- `tests/opt4-axe-accessibility.spec.cjs`: la tarjeta en claro y en oscuro (encontró un `fieldset` blanco en oscuro: contraste 1,13:1; corregido en la hoja de la tarjeta).
