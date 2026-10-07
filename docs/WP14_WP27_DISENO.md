# WP-14 + WP-27 · «¿Ha llegado…?»: cobros esperados y cargos que no llegaron — diseño

Dos paquetes del plan definitivo con un mismo motor: WP-14 (ND-08 · cobros esperados, Ola 2, ≈ 1,5 sesiones) y WP-27 (CAP-06 · cargos que no llegaron, Ola 2, ≈ 2). Construidos el 7/10/2026 sobre WP-08 (días de cargo) y WP-07 (motor de fechas). Un solo PR porque comparten detector, almacén de respuestas y tarjeta.

## 1. El problema

- **Cobros:** «nómina del 30/9: no lo sé». Los ingresos dominan la caja y hoy dependen de que alguien se acuerde de registrarlos como reales.
- **Cargos:** un recibo que no llega es o un **riesgo** (póliza impagada que se anula, domiciliación rota) o un **error de previsión** (se sigue restando una salida que no ocurrirá). Nada lo vigilaba.

## 2. Qué es

Preguntas en la **bandeja única de decisiones de Hoy** (`decisionInboxItems`, no una tarjeta nueva), con botones que responden en un toque:

| Pregunta | Cuándo | Respuestas | Qué hace |
|---|---|---|---|
| **¿Ha llegado «Nómina»?** (cobro) | 2 días después de la fecha esperada | **Sí, por el importe previsto** · **Sí, otro importe** · **Aún no** | Registra el **real** de esa partida y mes (como en Registrar el mes) · pide el importe y lo registra · calla 2 días y vuelve a preguntar |
| **«Seguro del coche» no ha llegado** (cargo) | Ventana de 1 día + 3 días de margen, **y solo si el extracto llega hasta ese día** | **Se ha dado de baja** · **Ha cambiado de cuenta** · **Llegará tarde** · **Ya está pagado de otra forma** | Anula la serie desde ese mes (los meses siguientes dejan de contar) · calla esa serie · calla 3 días · registra el real por el importe previsto |

Cada cargo enseña el **historial** del recibo (hasta 6 cargos con fecha) para que se vea el patrón, y avisa de que, si es una póliza o una domiciliación, hay que mirar que no se haya quedado sin pagar. Todas las respuestas con efecto en la previsión dan el aviso de **Deshacer**.

## 3. Lo que NO pregunta (lo más importante del diseño)

1. **Fechas estimadas.** Con el día de relleno (el 8) «no ha llegado» es mentira. Solo se pregunta por fechas **por regla** o **indicadas por el hogar** (WP-08). Hoy, con la demo, no sale ninguna pregunta: las siete partidas esperadas tienen fecha estimada. Con los datos del hogar saldrán las nóminas y el local (tienen regla) y, según declare días de cargo, los recibos.
2. **Cargos sin extracto al día.** *Esta es la desviación respecto a la especificación y la parte que más hay que cuestionar.* La especificación decía «si un recibo no aparece en el extracto, pregunta». Pero **sin extracto importado hasta ese día, «no aparece» es indistinguible de «no lo he importado»**: preguntar sería inventar un hallazgo y, repetido cada mes, enseñar a ignorar la bandeja. Por eso WP-27 **calla** cuando el último movimiento importado es anterior al día en que ya tocaba preguntar, y lo cuenta como «no verificable». **Consecuencia práctica: WP-27 solo da valor si el hogar importa extractos con regularidad** (el cierre mensual ya lo pide). Los cobros no tienen esta condición: la propia respuesta («sí») es la forma más barata de registrarlos.
3. **Lo ya llegado:** con un real registrado o un movimiento importado que case con la partida.
4. **Gasto variable y asignaciones personales:** llegan repartidos por el mes; no hay un recibo que esperar.
5. **Lo ya respondido:** «aún no» y «llegará tarde» callan N días; «ha cambiado de cuenta» calla esa serie desde ese mes (los meses anteriores se siguen preguntando). Un recibo que cambió de cuenta no importada seguiría «sin llegar» cada mes para siempre.

## 4. Decisiones a cuestionar

- **Ventana del cargo = 1 día y margen = 3.** Un cargo del sábado 5 que llega el lunes 7 no debe saltar. No hay calendario de festivos: un cargo tras un puente largo puede preguntarse de más; «Llegará tarde» lo calla.
- **«Aún no» no mueve la fecha esperada en la previsión.** La especificación decía «mueve la fecha esperada y marca la cifra de margen». Aquí solo calla y vuelve a preguntar: las cifras **mensuales** (lo que usa el margen de Hoy) no dependen del día, así que no habría nada que marcar, y mover la fecha exige un cambio en el motor de fechas (WP-07) con su regresión de 493 casos. **Queda para un PR aparte (PR-2)**, y solo afecta al motor diario (la banda de WP-16 y la cobertura hasta el próximo ingreso). Hasta entonces, la fecha de un ingreso retrasado en esos cálculos sigue siendo la prevista.
- **«Se ha dado de baja» anula la serie desde ese mes hasta el final del plan** (los mismos `deleted` por mes que el editor de series), no la serie entera: los meses ya realizados conservan su histórico. Se deshace con un toque, o desde el editor de series («quitar ajustes»).
- **Tope de 5 preguntas** a la vez, cobros primero y lo más atrasado antes; el resto se cuenta («N más por responder»). Una bandeja con veinte preguntas se ignora.
- **La fecha de «ayer» de un cargo grande en los recordatorios (WP-32)** ya no promete «si no ha llegado, la app lo preguntará» hasta que haya extracto: el texto de WP-32 solo pide comprobarlo. Con este paquete, lo preguntará **si hay extracto**; el texto se actualizará cuando el hogar importe con regularidad.

## 5. Cómo se prueba

- `tests/wp14-wp27-esperados.test.cjs` (21): cobro a los 3 días, sin extracto sí se pregunta; cargo con ventana + margen, **sin extracto no**; fechas de relleno, llegados y anulados callados y contados; aplazamientos con contador; «ha cambiado de cuenta» desde ese mes y no antes; efectos de cada respuesta (importes en formato español, cero válido, respuestas cruzadas rechazadas); orden, tope y desbordamiento; historial; almacén dañado y poda; cableado.
- `tests/qa1-flujos-completos.spec.cjs`: sobre filas **reales** de la demo (inyectando dos esperados vencidos): «Sí» registra el real (3.000 €) y **Deshacer** lo revierte; «otro importe» (2.950,50 con coma) + Enter; «Aún no» calla y **se recuerda tras recargar**; «baja» anula el mes y los siguientes y se deshace; sin extracto, un cargo no se pregunta.
- `tests/opt4-axe-accessibility.spec.cjs`: las preguntas en claro y en oscuro. Encontró que el texto de apoyo de **todos** los avisos de la bandeja tenía contraste 3,06:1 en claro (ámbar de `.warning`); corregido en `styles.css` con la tinta de las insignias de aviso.

## 6. Pendiente

| Qué | Cuándo |
|---|---|
| **PR-2:** mover la fecha esperada de un ingreso/cargo aplazado en el motor de fechas (para el motor diario y la banda de WP-16) | Cuando se quiera afinar la banda; necesita un gancho en `canonical-timing.js` y su regresión |
| Medir «ningún recibo esperado sin estado más de 3 días» con uso real (`staleCount` del motor) | Tras el cierre del 1-3/11 |
| Detectar recurrentes por historial importado (A16-3) además de los declarados en el plan | Cuando haya extractos suficientes; hoy solo se espera lo que el plan ya tiene con fecha segura |
| Actualizar el texto del recordatorio de «cargo grande» de WP-32 para que prometa la pregunta | Cuando el hogar importe extractos con regularidad |
