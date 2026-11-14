# Backlog de noviembre · Oleada 1 — Contabilidadcasa

**Creado el 5 de noviembre de 2026, a petición del hogar:** «Hazme una propuesta de mejoras y nuevas features […] en el
sentido de usabilidad y mejora de la visibilidad de las previsiones, estado e impacto de forecasts financieros en
función de diferentes escenarios. El backlog que tenemos actualmente lo conservamos y lo incorporamos con la prioridad
adecuada dentro del nuevo plan. Será el backlog de noviembre oleada 1».

**Es la única fuente viva de lo que falta por hacer y en qué orden.** Sustituye como backlog vigente a
[`BACKLOG_DEFINITIVO.md`](BACKLOG_DEFINITIVO.md), que **no se borra ni se vacía**: sigue siendo la referencia de las
reglas de ritmo (su §4), las recetas y trampas del repositorio (su §10), el protocolo del panel de seguimiento (su §12),
el registro de decisiones de su §0 hasta el 5/11 y el detalle de sus 104 propuestas. Todo lo que tenía abierto está
aquí, con su prioridad nueva (§6). Mapa de todos los backlogs: [`BACKLOG_INDICE.md`](BACKLOG_INDICE.md).
**Porqué de cada propuesta nueva (`FX-nn`)**, con el análisis crítico y la especificación de UX/UI:
[`docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md`](docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md).
**El repositorio es público: ninguna cifra real del hogar aquí.**

Autocontenido a propósito: quien lo abra sin haber visto la conversación debe poder decidir qué hacer primero en 10
minutos.

---

## 0. Estado en una línea

**14/11/2026 (noche) · La medición del gasto variable, a la vista en Previsión.** El hogar no la encontraba dentro de la hoja de la insignia de confianza: pasa a su propia tarjeta y, si no puede medir, lo dice. Siguen pendientes las dos cifras y cuándo aplicar el recálculo (D-N12).

**14/11/2026 (noche) · D-N12, pregunta 1 contestada: «la Mastercard la pagamos entera, NO revolving».** Confirma el supuesto con el que ya mide la hoja del gasto variable; las cifras no cambian. Faltan las dos cifras de la hoja y cuándo aplicar el recálculo.

**14/11/2026 (noche) · PRV-01, primera parte: el gasto variable medido frente a lo previsto («¿seguimos?»).** La hoja «Por qué la confianza es…» de Previsión enseña lo gastado de verdad en variable, mes a mes, frente a los 1.750 € fijos que la previsión usa desde junio (corrección: la app sí tenía gasto variable, una cifra fija sin contrastar). Solo mide; recalcular sigue esperando a **D-N12**.

**14/11/2026 (tarde) · Deuda › Préstamo para saldar, construida a petición del hogar, y novena auditoría propuesta.** Quinta pestaña de Deuda para decidir en pareja un préstamo personal que cancele lo más caro y un plan agresivo; compara con «pagar lo mismo sin préstamo». La auditoría (`docs/PROPUESTA_NOVENA_AUDITORIA_2026-11-14.md`) propone recalcular la previsión hasta 2036 con el gasto variable real (no ejecutado: choca con D-N11 y espera a **D-N12**) y 53 funciones; decisiones nuevas del hogar **D-N12** (recálculo, con la modalidad de pago de la Mastercard Carrefour), **D-N13** (tipo de préstamo y TIN real), **D-N14** (orden de las 12 primeras) y **D-N15** (retiradas). No cambia la prioridad de D-N11 hasta que el hogar lo diga.

**14/11/2026 · #617 fusionado; el extracto del hogar confirma que los movimientos estaban al día.** Un extracto de CaixaBank del 7/8 al 12/11 trae 200 movimientos y ninguno nuevo: la lectura del 13/11 («el bucle de datos está parado») era incorrecta en su mitad de datos; el atasco es clasificar (71 % con partida, objetivo 95 %). **Decidido por el hogar el mismo 14/11 (D-N11): la prioridad hasta el 4/12 pasa a ser «que lo que entra quede con partida»** (clasificar hasta el 95 % antes del 1/12, con el repaso semanal como momento para hacerlo; sigue sin construirse previsión nueva). Clasificar, en cuanto esté publicado #617, para que los grupos sin propuesta lleven tipo (PROJECT_STATE 467; corrección en `docs/REVISION_POST_CIERRE_2026-11.md`).

**14/11/2026 · El medidor anota de qué tipo es cada grupo sin propuesta de Clasificar («adelante con el tipo en el medidor»).** Bizum, transferencia, recibo, comercio sin reglas o sin nombre reconocible: solo el tipo, nunca el concepto ni el importe. Así la revisión del 4/12 sabrá qué señal le falta a la propuesta sin depender de la memoria del hogar. Sale en Ajustes › Uso de la app y en «Funciones en prueba» (PROJECT_STATE 466).

**13/11/2026 · El repaso semanal, cada domingo en el calendario del móvil («continúa», con la prioridad de que entren los datos).** Los recordatorios del `.ics` suman un aviso semanal para el repaso, que el hogar dice que aporta pero no se hizo en noviembre. Hay que volver a descargar el fichero en Ajustes. Mejorar las propuestas de Clasificar espera a saber de qué tipo eran los grupos sin propuesta (PROJECT_STATE 465).

**13/11/2026 · Decisiones del hogar sobre las revisiones del 14 al 20/11 («sí» a la hoja).** Hoy se gradúa por uso (la métrica de tiempo se retira). Se retira «aceptar en bloque» (H12; XDA-05 PR-2). Cierre nuevo con H10, Clasificar y Previsión nueva se revisan el **4/12**, tras el cierre de noviembre; Plan › Mes, con el plan de diciembre. El repaso semanal **aporta** y se queda. **Prioridad hasta el 4/12: que entren los datos** (repaso, extractos y clasificar hasta el 95 % antes del cierre); no se construye más previsión hasta la revisión de salida. La app se usa «a veces» en el iPhone: el medidor de allí cuenta aparte (PROJECT_STATE 464).

**13/11/2026 · Hoja de las revisiones del 14 al 20/11 («la que tú creas mejor»).** En `docs/REVISION_POST_CIERRE_2026-11.md`: criterio escrito para Plan (14/11), Hoy (16/11), Clasificar, Cierre y Dinero parado (18/11) y Previsión (20/11), y recomendación para D-N2, D-N5 y D-N7. **Se propone mover Cierre nuevo con H10, y Clasificar con H12, al 4/12:** las dos se juzgan con el cierre de noviembre, que se hace del 1 al 3/12. Hoy, sin aplazarla otra vez sin medir. **Con las capturas del medidor:** el medidor no anotaba la Previsión nueva (arreglado); el repaso semanal no se ha usado en noviembre y Clasificar se queda en un 71 % con partida; se propone dar prioridad a que entren los datos antes de construir más previsión (PROJECT_STATE 464).

**13/11/2026 · XDA-10 completa: «Antes de decidir» en los simuladores de inversión («continúa con la siguiente tarea del backlog»).** Al aportar a un plan de pensiones (lo que queda sobre la reserva) y en el guardarraíl del apalancamiento (AP3 y el escalonado, solo cuando lo decide el colchón), dice si unos saldos antiguos cambiarían el veredicto. `app.js` sin líneas nuevas (PROJECT_STATE 463).

**13/11/2026 · #610 fusionado: el «Deshacer» se cierra al cambiar de pantalla y `app.js` recupera su margen («que el aviso se cierre al cambiar de pantalla» y «sigue con el backlog»).**
- El aviso de «Deshacer» (10 s) seguía visible en la pantalla siguiente y, en el móvil, tapaba sus botones: el toque en «Firmar cierre» caía en él. Ahora se cierra al cambiar de pantalla; dentro de una pantalla dura sus 10 s, como hasta ahora.
- **XGO-01 PR-4:** Laboratorio y el informe de uso de la app (33 funciones) pasan a `laboratorio-ui.js`. `app.js` queda en 32.075 líneas, con techo 32.203: 128 de margen, que con #607 se había quedado en 25.
- **Del núcleo (§5.1) no queda nada que pueda hacer Claude.** Lo que falta espera al hogar: H-35, H-03 (WP-23), las revisiones del 14 al 18/11 (D1-D2 y la navegación de 5 destinos), FX-21 resto, la cota del Euribor y la retención de la auditoría de Supabase (PROJECT_STATE 460 y 461).

**13/11/2026 · #607 fusionado hoy, no el lunes 16/11, a petición del hogar («fusiona hoy»).** Entra FX-03, el cambio de Hoy que estaba previsto para la semana del 16/11. Esa semana se queda sin cambio de Hoy nuevo, y la del 9/11 tiene dos: el punto de confianza (9/11) y FX-03. FX-41 sigue con su puerta: no se ve hasta el 23/11. Las líneas de Novedades del 16/11 pasan al 13/11 (PROJECT_STATE 459).

**12/11/2026 · FX-10 completa: el rango probable en Previsión («sigue con lo siguiente del backlog»).** Con 3 m, el gráfico pinta el rango probable (8 de cada 10 casos) según qué día caigan los pagos, y lo dicen el panel del día, la lectura y la tabla. Con la demo destapa algo: el titular (6.600 € el 14 dic) queda **por debajo** del rango (6.900 – 9.100 €), porque el plan pone el día 8 los pagos sin día confirmado. La pantalla lo dice; qué cifra es el titular se consulta (PROJECT_STATE 457).

**12/11/2026 · XDA-04 PR-2 hecho (condición cumplida: extracto inicial + octubre).** La tira de cobertura de 90 días por cuenta en Movimientos y en el repaso, «Cobertura tras importar» en Importar, y anomalías y deuda en la sombra dicen qué días no han podido mirar. En #607 (PROJECT_STATE 456).

**12/11/2026 · WP-21 PR-3 hecho («sigue con lo siguiente del backlog»).** «El local alquilado para la Renta» en Fiscal: lo que va a la base general de cada declarante (gastos con el límite de intereses y reparación y su arrastre a 4 años, amortización del 3 % con tope, sin la reducción de vivienda, retención del 19 %) y la próxima actualización de la renta. Falta H-36: teclear los datos del local. En #607 (PROJECT_STATE 455).

**12/11/2026 · FX-27 hecho («una vez en Previsión, y sigue con lo siguiente del backlog»).** A 120 días de la revisión de la hipoteca, «Euribor» va primero en «Comparar con» y la revisión sale en tres caminos (sin cambio, +1, +2) y, con una oferta fija tecleada, cuatro: cuota, cambio al mes y colchón. Los saldos sin fecha se dicen una vez en Previsión, no en cada prueba. FX-21 resto espera al hogar; FX-60 y RD-D1/D2, a las revisiones del 12-18/11. En #607 (PROJECT_STATE 454).

**12/11/2026 · XDA-10 PR-2 hecho («sigue con XDA-10 PR-2»).** «Antes de decidir» también al cancelar una deuda entera (una línea para los tres guardarraíles, con el más justo), en «Comparar con» de la Previsión (pruebas, «¿Y si…?» y escenarios guardados; en la del Euribor, también el Euribor tecleado, con una cota de 1 punto por mes) y en la reserva de Escenarios. En #607 (PROJECT_STATE 453).

**12/11/2026 · FX-50 hecho («sí a la primera, sigue con la segunda parte»).** «Hasta 2036» es la única previsión a largo plazo: año a año con abanico, hitos (también los objetivos de ahorro), «Sin proyectos» y la prueba elegida. En el diseño nuevo, «Proyección» lleva ahí y conserva «Gastos recurrentes»; el clásico, igual. En #607 (PROJECT_STATE 452).

**12/11/2026 · FX-50 PR-1 hecho («continúa con lo siguiente del backlog»).** Con «Hasta 2036», la Previsión enseña el año a año: la liquidez de cada 31/12 con un abanico que se abre (los supuestos de FX-51 un punto peor o mejor) y los hitos (colchón completo, deuda cero, fin de la hipoteca). Queda el PR-2: objetivos de ahorro, escenarios en el año a año y absorber `#forecast` (se consulta). En #607 (PROJECT_STATE 451).

**12/11/2026 · XPR-11 hecho («deja la banda y continúa con XPR-11»).** Con días de cargo conocidos en el 70 % del gasto fijo, la Previsión propone hasta tres recibos que pedir cambiar de día, con cuánto sube el mínimo del mes, «Lo he pedido» y «Ya se carga». Arreglado de paso: el día de cargo indicado ya no se ve «estimado». La banda de barras por mes se queda (decisión del hogar). En #607 (PROJECT_STATE 450).

**12/11/2026 · FX-15 hecho y los botones quietos («quita la subida de los botones y continúa»).** El resumen por periodo es una cascada de la liquidez que cuadra (con el ahorro aparte) y la tabla mensual cabe en el móvil; ningún botón se mueve al pasar el ratón. Viajan en #607 (PROJECT_STATE 447 y 448).

**11/11/2026 · FX-14 hecho: el mes en curso al ritmo real («activa estas y luego continúa»).** Con 3 meses de extracto completos, Plan › Mes dice a qué ritmo cerrará el gasto variable (con banda y acierto) y la Previsión, cómo acabaría el mes así. La previsión no cambia: sigue con lo prudente. Viaja en #607 (PROJECT_STATE 444).

**11/11/2026 · FX-43 hecho («continuamos»).** La carta del mes cuenta la previsión: cuánto hubo en caja frente a lo previsto el día 1 y el 15, y qué espera del mes siguiente. Lista para la primera carta, la del cierre de noviembre. Sale con #607 el 16/11 (PROJECT_STATE 443).

**11/11/2026 · FX-41 hecho, con puerta de fecha («continua con FX-41»).** Los avisos de previsión con umbral salen en «Decidir esta semana» de Hoy y en el calendario del móvil, solo cuando la previsión cruza el suelo, el mínimo de la cuenta, el colchón o pierde más de un 10 % de fin de año. Se activan el 23/11 (el cambio de Hoy de esa semana) y viajan en #607 con FX-03 (PROJECT_STATE 442).

**11/11/2026 · Las tres decisiones del hogar («ok a las tres cosas»).**
- La deuda y el patrimonio a 24 m, a la centena: amortizar enseña el interés ahorrado.
- El panel del día, una línea por movimiento como la referencia: 70 px de margen bajo los 900 px a 1440.
- El cambio de Hoy de la semana del 16/11 será **FX-03**, la trayectoria cosida: el gasto variable, repartido y no entero el día 8. Va antes que FX-41, que avisaría por ese artefacto, y se fusiona el lunes 16/11 (PROJECT_STATE 440).

**10/11/2026 · FX-22 hecho: aplazar un pago («continuamos?»).** «¿Y si…?» suma una cuarta palanca: un pago del plan, 1, 2 o 3 meses después, al mismo día. Guardada en Escenarios, son dos «Cambio de gasto» con los mismos meses. Los atajos del día elegido («¿Y si…? El 8 dic: un gasto ese día · aplazar un pago») sustituyen al clic largo, que no se descubre ni tiene teclado. Se corrige la frase cuando la prueba mejora el punto más bajo (PROJECT_STATE 439).

**10/11/2026 · FX-20 hecho, versión completa: la deuda y el patrimonio a 24 meses («haz la mejor versión y más completa»).** La tabla de impacto añade la liquidez, la deuda viva y el patrimonio (sin vivienda ni cartera) a 24 meses. Los da un motor nuevo, `canonical-debt-horizon.js`, con:
- el calendario francés de cada contrato;
- lo que el plan ya amortiza;
- las decisiones de un escenario guardado;
- el Euribor, que también hace deber más.

Una frase cuadra caja, deuda y patrimonio («lo que sale de la caja va a deber menos, no se pierde»). Corrige la 436: el Euribor sí mueve el capital (PROJECT_STATE 438).

**10/11/2026 · FX-13 hecho: la previsión por cuenta y el traspaso sugerido («continuar»).** Bajo el gráfico, «Total · Por cuenta»: la cuenta corriente con su mínimo y el ahorro. Si la cuenta corriente se queda corta con el total sano, una tarjeta propone el traspaso concreto a 0 € sin moverlo (PROJECT_STATE 437). FX-20 (deuda y patrimonio a 24 m) sigue esperando la respuesta del hogar.

**9/11/2026 · FX-22 PR-1: «¿Y si…?» desde la Previsión («continua»).** En «Comparar con», un gasto único y un cambio de ingreso o de gasto al mes, sumados; la respuesta primero («Sí, os lo podéis permitir», «Sí, pero pasando dinero del ahorro a tiempo» o «No sin tocar nada») y «Guardar como escenario» con paridad de meses. **Se consulta:** cerrar FX-20 sin la deuda ni el patrimonio a 24 m (dirían «igual» o repetirían la liquidez) (PROJECT_STATE 436).

**9/11/2026 · FX-23 completo: Comparar con las pruebas de estrés sin guardar y el minigráfico por columna (D-N10).** En Escenarios › Comparar, las tres pruebas de D-N3 sin guardarlas (la que falta, desactivada con su motivo) y una línea por columna con la liquidez a fin de mes en la misma escala. De paso, las cabeceras de esa tabla pasan el contraste (PROJECT_STATE 435).

**9/11/2026 · D-N10 decidida por el hogar y FX-42 hecho («continua así»).** La franja anual del mapa no se mueve; el Repaso sigue; FX-23 se completa (presets sin guardar y mini-gráfico); el suelo real lo fija el hogar. FX-42: el «Listo» del Repaso cuenta la previsión en tres líneas como mucho, sin paso nuevo (PROJECT_STATE 434).

**9/11/2026 · FX-51 PR-2: los supuestos del plan, vistos desde la Previsión («continua»).** «Con estos supuestos», plegado bajo «Lo que viene»: cada supuesto general con su valor y cuánto quitaría si sale peor, con las mismas cifras que Ajustes; el Euribor lleva a su prueba y «Cambiarlos en Ajustes», a la lista (PROJECT_STATE 433).

**9/11/2026 · FX-12 hecho: «Lo que viene en 90 días» por semanas («sigue con FX-12»).** Cada semana con su neto; desde 150, 300 o 1.000 € (se recuerda); «¿sabes el día?» en cada pago de día estimado; sin traspasos ni el gasto variable, que se dice aparte; y las mismas marcas bajo el gráfico, en rojo si ese día sale más de lo que entra. **Se consulta:** mover aquí la franja anual del mapa de pagos grandes (PROJECT_STATE 432).

**8/11/2026 (noche) · WP-37 en C2 completo: sin suelo fijado, la Previsión lo dice.** «Por encima del suelo inicial de 1.500 €» y «Fijar el suelo», que lleva al campo de Ajustes. Ajustes ya no dice que el suelo «solo lo usa Hoy» (PROJECT_STATE 431).

**8/11/2026 (tarde) · #598 publicado y WP-37: un recálculo que falla ya no deja la app a medias («Fusiónalo ya todo sin esperar» y «continua»).**
- **#598** se fusionó el domingo 8/11, no el lunes, a petición del hogar. El punto de Hoy ocupa el hueco semanal de Hoy de la semana del 9/11: el siguiente cambio de Hoy, la semana del 16/11.
- **WP-37:** si el recálculo falla, la app devuelve las cifras de antes enteras, lo dice en todas las pantallas y lo reintenta en el siguiente pintado. Antes se cortaba sin avisar, no reintentaba y podía mezclar cifras nuevas y viejas (PROJECT_STATE 430).

**8/11/2026 · Los escenarios guardados en «Comparar con» de la Previsión (FX-20 con FX-23, «sigue»); publicado el 8/11 (#598, fusionado antes a petición del hogar).**
- **Qué es:** «O un escenario guardado» bajo la fila: los de Escenarios › Guardados que no están ya en el plan, con su línea, su frase y la misma tabla. Se cambian o se aplican en Escenarios.
- **Cálculo:** el motor de Escenarios por meses (el cierre de cada mes es el suyo) y el diario de siempre; lo que se paga de golpe cae el día más bajo de su mes, como la prueba del imprevisto (PROJECT_STATE 429).
- **Queda:** deuda y patrimonio a 24 m (FX-20) y el mini-gráfico por columna de FX-23. Los presets sin guardar en Escenarios › Comparar se proponen como no necesarios: Previsión ya los compara con el plan.

**8/11/2026 · Arreglado: las pruebas de estrés y «qué ha cambiado» calculaban sin los proyectos ni los pagos de deuda programados.** Con un proyecto, la prueba se comparaba con otro plan (un imprevisto podía dejar el 31/12 por encima del plan). Ahora parten de la misma entrada que la línea del plan; también FX-51 (PROJECT_STATE 428).

**8/11/2026 · FX-40, PR-2: el puente del 31/12 (WP-43) dentro de «Por qué» («sí, mueve el puente del 31/12 a «Por qué»»); publicado el 8/11 (#598, fusionado antes a petición del hogar).**
- **En el tema nuevo:** la tarjeta deja Plan › Previsión (un titular menos) y su contenido va como segunda parte de la hoja «Por qué». «Ver el puente completo» de Cierre abre la hoja.
- **En el tema clásico y con «Ver todo el detalle»:** la tarjeta sigue igual.
- **Mismo código y mismo motor:** no se borra nada.

**8/11/2026 · FX-40, PR-1: qué ha cambiado desde tu última visita («sigue con FX-40»); publicado el 8/11 (#598, fusionado antes a petición del hogar).**
- **Qué es:** bajo la cifra de Previsión, «−90 € frente a tu visita del 6 nov. Por qué ▸», con un puente de cuatro causas: el paso del tiempo, datos nuevos (o «saldo de hoy (calculado)» con saldos por calendario), supuestos, y cambios del plan u otros. Siempre cuadra.
- **Fotos:** ligeras, una por visita y día, en este dispositivo.
- **Pendiente (PR-2):** mover aquí el puente del 31/12 de WP-43 (se consulta: es una tarjeta en uso) y medir los cambios del plan por separado.

**8/11/2026 · Arreglado: una inflación anual distinta de 0 cortaba el recálculo de la app («Haz esta tarea aquí»).** Ya estaba en `main`. El redondeo al céntimo de la entrada diaria acumulaba un desfase que rompía la paridad diaria-mensual; ahora el resto del redondeo se lleva mes a mes, sin tocar la tolerancia (PROJECT_STATE 425).

**8/11/2026 · Dos pruebas de estrés a la vez (FX-20, «sigue con las dos pruebas a la vez»); publicado el 8/11 (#598, fusionado antes a petición del hogar).**
- **Qué es:** «Sumar otra prueba» junta dos pruebas sobre la misma trayectoria, con un solo recálculo: una línea, una frase, la tabla y «Guardar como escenario» con las dos.
- **El imprevisto** va el último y cae el peor día de la combinación.
- **Por separado y juntas:** una nota dice cuánto baja el punto más bajo cada una y las dos juntas.
- **Desviación:** la propuesta decía dos líneas a la vez; se ha hecho la combinación, que es lo que preocupa (PROJECT_STATE 424).

**7/11/2026 · El colchón en meses en la tabla de impacto (FX-20, «sigue con el colchón en meses»); publicado el 8/11 (#598, fusionado antes a petición del hogar).**
- **Qué es:** la fila «Colchón en el punto más bajo (meses)» en cada prueba de estrés: cuántos meses de gasto corriente cubre la liquidez en el peor momento, en el plan y en la prueba.
- **Fórmula:** la de «Colchón más justo» y Escenarios (gasto corriente medio de los 12 primeros meses del plan), ahora en el contrato de cifras (`cushionMonths`).
- **Objetivo:** si la prueba deja el colchón por debajo del objetivo de Ajustes y el plan no, la frase lo dice.
- **Desviación:** en el punto más bajo, no a fin de año como decía la propuesta (ver PROJECT_STATE 423).
- **También el 7/11:** el límite de diez escenarios vivos, en Deuda › Comparar y en «guardar con aviso» del simulador (PROJECT_STATE 422).

**7/11/2026 · «Guardar como escenario» hecho (FX-21, «sigue con Guardar como escenario»); publicado el 8/11 (#598, fusionado antes a petición del hogar) con el punto de Hoy.**
- **Qué es:** bajo la tabla de impacto de cada prueba de estrés, un botón lleva la prueba a Escenarios › Guardados como «guardado», sin aplicar nada (A11-4). Allí se carga en el simulador para combinarla o cambiar importes.
- **Cómo pasa cada prueba:** con los tipos de fábrica de Escenarios y el mes fijado (el modo «óptimo» la movería de mes).
  - Un sueldo menos → «Cambio de ingreso» negativo, un tramo por cada importe distinto: una paga extra no se promedia.
  - El Euribor → «Cambio de gasto» con lo que sube la cuota, de la revisión a su último plazo dentro del plan.
  - El imprevisto → «Imprevisto» del mismo importe en su mes.
- **Garantía:** recalculada en Escenarios da los mismos meses que la prueba (prueba unitaria de paridad con los motores reales para las tres; en la app, el imprevisto quita exactamente sus 3.000 €).
- **Lo que se pierde al pasar:** el día. Escenarios cuenta por meses; la nota del escenario lo dice.
- **Frenos:** respeta los diez escenarios vivos de E-11b (si no cabe, lo dice y no guarda nada), se valida con el esquema de Escenarios y la misma prueba no se guarda dos veces.
- **Hallazgo corregido el mismo 7/11:** «Guardar como escenario» de Deuda › Comparar (y «guardar con aviso» del simulador) ya respetan el límite de diez, con el diálogo de Escenarios.

**7/11/2026 · El punto de confianza en Hoy, hecho y listo para el lunes 9/11 («primero el punto de confianza en Hoy y sigue»).**
- **Qué es:** junto a «Fin de mes», la cifra de Hoy que sale de la previsión, un punto con la confianza de la previsión, sin texto extra.
  - El nivel va por forma además de por color (○ baja, ◐ media, ● alta), con su nombre para lectores de pantalla y al pasar el ratón.
  - Al tocarlo, lleva a Plan › Previsión con la hoja del porqué abierta y el foco en la insignia.
  - Es la misma insignia: no hay otro cálculo.
- **Cuándo se publica:** es el cambio de Hoy de la semana del 9/11 («un cambio de Hoy por semana»; el de esta semana fue D-N4). Se fusiona el lunes 9/11, no antes.
- **Después, en la semana del 16/11:** «De verdad libre» en Hoy, si el hogar lo quiere.

**7/11/2026 · D-N9 decidida («D-N9 opción b y sigue») y XPR-08 hecha: «De verdad libre», una sola cifra bajo el titular de Previsión.**
- **Qué es:** lo que queda sobre el suelo en el punto más bajo, menos lo que el plan aún no descuenta. Eso son dos cosas:
  - lo que no está en el plan y cae dentro del horizonte (un seguro del inventario, lo que falta de un cargo «cada N meses»). Se aplica a la trayectoria desde su día y se busca otra vez el mínimo: si cae cuando el saldo ya ha subido, no come nada;
  - la parte ya devengada de lo que cae después del horizonte (importe × meses transcurridos ÷ meses del ciclo).
- **De dónde sale:** del mismo mapa de pagos grandes (WP-49); el cálculo es `provisions()` de `canonical-large-payments.js`.
- **Cuándo sale:** solo cuando hay algo que restar. Si no, lo libre es la cifra de arriba y repetirla sería ruido.
- **Sin botón «Apartar»:** la app no mueve ni reserva dinero (A11-4). Dice cuánto apartar al mes y lleva al mapa de pagos grandes, que está en la misma pantalla.
- **Con dos seguros FICTICIOS** (casa, 600 € el 15 mar; coche, 300 € el 5 dic): «De verdad libre: 3.400 €. De los 4.100 € sobre el suelo, 700 € ya son de lo que viene». Apartando unos 50 € al mes no se toca el colchón.
- **Cambia con el horizonte, a propósito:** a 3 meses se reserva lo devengado de lo que aún no se ve; a 12 se ve si ese pago llega a bajar el mínimo o no.

**7/11/2026 (mañana) · XPR-07 dentro de la Previsión nueva; XPR-08 pasa a decisión (D-N9).**
- **XPR-07, el arreglo más barato, en Plan › Previsión:** la misma tarjeta «Para no bajar del suelo el …», debajo del gráfico, con la trayectoria que pinta la pantalla.
  - **Con su interruptor:** sigue en prueba hasta su revisión del 12/11, porque graduarla es decisión del hogar.
  - **Cuándo sale:** solo con un descubierto previsto en 30 días. Como a menos de 30 días se redondea a la decena, su cifra coincide con la del titular.
- **XPR-08 («de verdad libre») no se construye sin D-N9.** La Previsión nueva ya descuenta, en su punto más bajo, todo lo que el plan pone dentro del horizonte (el IBI incluido). Una tercera cifra de «libre» junto al «Disponible» de Hoy y al margen del punto más bajo confundiría. Recomendación y opciones, en §7.

**7/11/2026 · Panel del día e insignia de confianza en Plan › Previsión («sigue con el panel del día y la insignia de confianza»).**
- **Panel del día (FX-10 PR-2):** el de `PrevisionDesktop.png`, a la derecha del gráfico en escritorio y debajo en móvil. De entrada muestra el punto más bajo, con:
  - su saldo y cómo se reparte entre la cuenta corriente y el ahorro;
  - qué lo mueve, con la certeza de cada cosa y «¿sabes el día?» en lo estimado;
  - con una prueba de estrés, cuánto quedaría ese día.

  Sigue al ratón; un clic, un toque o ← → lo fijan, y «Volver al punto más bajo» lo suelta. En 12 m y más, dice lo que entra y sale desde el punto anterior. El gasto variable dice «sin día fijo» y no pide día de cargo.
- **Insignia de confianza (FX-31):** «Confianza baja · media · alta» junto al titular. Junta tres señales que ya existían: los días de cargo (WP-10), los saldos (WP-26) y el acierto (WP-12).
  - **Reglas:** «alta» solo con las tres bien; «baja» con dos o más flojas.
  - **La hoja** dice por qué y propone la tarea que más la sube, ordenada por euros de incertidumbre por minuto (la cola de WP-45). A esa cola se suma la tarea propia de decir el día de cargo de las partidas grandes.
  - **Con la demo:** confianza baja, y lo primero es decir el día de cargo de 5 partidas, unos 2,5 min (supuesto) para 2.980 €. Coincide con H-35, pendiente del hogar.
- **Lectura del gráfico:** queda en día, saldo y margen, redondeados como el panel. Antes decía 5.620 € junto a los 5.600 € del titular.
- **Sin titulares nuevos (XGO-01):** Plan › Previsión sigue en 4.
- **Hoy no cambia:** el punto de confianza en Hoy espera a su hueco semanal.
- **Una sola insignia (petición del hogar: «unifica la etiqueta de fiabilidad con la insignia»):**
  - **Qué cambia:** Herramientas › Previsión ya no enseña «Fiabilidad de la previsión: media/baja» (P3). Enseña la misma insignia de Plan › Previsión, con su hoja, también con el tema clásico.
  - **Lo que medía P3** (el error del neto mensual en los meses conciliados, PVC17) entra en la señal «Acierto»:
    - con 6 meses o más y la caja a fin de mes aún sin 3 cierres, la señal queda «a medias» y lo dice con su error medio;
    - con menos, lo cuenta sin subirla.
  - **Así** no hay dos respuestas distintas a «¿cuánto me fío?», y no se pierde nada.

**6/11/2026 (noche) · D-N8 decidida: el traspaso al ahorro deja la reserva en la cuenta corriente («D-N8 sí, y sigue»).**
- **Qué cambia:** a fin de mes el plan deja en la cuenta corriente un mes de gastos **más la reserva operativa** de Ajustes antes de traspasar al ahorro. Sin reserva puesta (0 €), el plan es exactamente el de antes.
- **Dónde:** en el motor y en todos los cálculos que repiten ese traspaso, a la vez: la referencia histórica que vigila la paridad con el motor, la proyección de saldos hasta hoy y los escenarios E13. La reserva entra además como supuesto en el registro central de Ajustes, que pasa de 13 a 14.
- **Lo que no cambia:** la liquidez total, mes a mes. Solo cambia cuánto hay en cada cuenta. El primer traspaso baja una vez lo que valga la reserva y el resto llega igual.
- **Con la demo y una reserva de 1.000 €:** la cuenta ya no toca 0 € el 8 dic. Lo más bajo es justo 1.000 €, y el aviso de Previsión no salta.
- **Si la reserva no cabe:** el plan no traspasa nada y el aviso dice cuánto pasar del ahorro. Con 4.000 €: «habría que pasar unos 180 € del ahorro».
- **Con el ajuste automático del ahorro apagado**, el traspaso lo decide el hogar y la reserva no lo toca.

**6/11/2026 (noche) · El suelo, también en la cuenta corriente: decisión del hogar («sí, suelo también en la cuenta corriente, y sigue»).**
- **El suelo de la cuenta corriente** es la reserva operativa de Ajustes, o 0 € si no está puesta (no quedar en descubierto). No es el colchón heredado de 2.500 € (`agentCaixaFloor()`), que el motor no usa y que en la demo pondría 77 días en rojo con un plan sano.
- **En Plan › Previsión:**
  - si el propio plan deja la cuenta por debajo, el titular avisa con lo que hay que hacer: «traspasar X € menos al ahorro el día D» si basta con el traspaso anterior, o «pasar X € del ahorro antes de ese día»;
  - cada prueba de estrés tiene la fila «Cuenta corriente, lo más bajo» y la frase lo dice aunque el total aguante. Con la demo, sin el sueldo de A la cuenta queda en descubierto el 8 dic (hasta −2.500 € el 8 ene 2027) y habría que pasar unos 2.600 € del ahorro; el imprevisto la deja en −3.000 € el 8 dic;
  - lo que hay que pasar se redondea hacia arriba (quedarse corto no sirve).
- **Hallazgo que pasa a decisión (D-N8):** el motor mensual no usa la reserva operativa al traspasar al ahorro. Por eso, con reserva o sin ella, la cuenta llega a 0 € el día antes de la nómina. No lo he cambiado: mueve las cifras de traspaso del plan. *(Decidida y hecha la misma noche: ver arriba.)*
- **Hoy no cambia esta semana** (ya hubo un cambio, D-N4). El mismo aviso en Hoy queda para su próximo hueco semanal.

**6/11/2026 (noche) · D-N3 decidida por el hogar («D-N3 sí, sueldo por titular y sigue») y las tres pruebas de estrés construidas sobre la Previsión nueva (FX-20 y FX-21).**
- **Dónde:** en Plan › Previsión (C2), bajo el gráfico, la fila «Comparar con»: Solo el plan · Un sueldo menos · Euribor · Imprevisto 3.000 €.
- **Qué hace:** la prueba elegida se pinta como línea discontinua con su nombre. Debajo van una frase y una tabla, plan frente a prueba: punto más bajo, «¿bajáis del suelo?», 31 de diciembre y el último día del horizonte. Si se baja del suelo, la frase dice cuándo, cuánto falta y el recorte mensual que lo evitaría, o el plan B. Una nota dice qué se ha cambiado exactamente.
- **Un sueldo menos, por titular:** «De quién» (cada ingreso que llega 3 de cada 4 meses; la app no guarda de quién es cada ingreso, así que cada partida hace de titular) y «Durante» 3 o 6 meses. Con la demo:
  - sin el de A 3 meses, el punto más bajo pasa a 2.500 € el 8 ene 2027 y el 31/12 queda 7.800 € más abajo;
  - sin el de B 6 meses, el punto más bajo queda en 3.600 € el 8 dic.
- **Euribor +1 o +2 puntos en la próxima revisión:** usa la revisión de WP-20 (Deuda › Contratos) y el Euribor tecleado (WP-13). Sube la cuota desde la revisión hasta el último plazo, frente a la que lleva el plan, que no cambia la cuota.
  - Sin hipoteca o sin datos (la demo no tiene), dice qué falta y lleva a Deuda › Contratos.
  - Si la revisión cae después del horizonte, lo dice («elige 12 m o más») en vez de enseñar «igual».
  - Con una hipoteca inventada de 120.000 € (cuota 640 €, Euribor 2,35 %, diferencial 0,99 %, revisión el 1 mar 2027), +2 puntos llevan la cuota a 813 € y quitan unos 1.500 € a un año vista.
- **Imprevisto de 3.000 €** el día más bajo del plan.
- **«Gasto variable +10 %»** sale de la fila (D-N3 son tres) y queda en la biblioteca del motor para el resto de FX-21.
- **Garantías:** no cambia el plan ni mueve dinero (A11-4, R-N3). Recalcula con los motores de siempre y, sin cambios, su línea es la del plan día a día; una e2e lo comprueba. Las diferencias de la tabla son la resta de las cifras que se ven (15.700 frente a 14.200 es −1.500, no −1.600).
- **Motor nuevo:** `canonical-stress-scenarios.js` (v2), puro y probado en Node con motores falsos y con el motor de revisión real.
- **Hallazgo para el hogar (no corregido; no es de esta tarea):** sin el sueldo de A 3 meses, la cuenta corriente prevista queda en −2.510 € en enero, aunque la liquidez total (2.490 €) siga sobre el suelo. El plan cuenta el ahorro como disponible, pero haría falta pasarlo a la cuenta a tiempo.
- **Pendiente de la especificación:**
  - la tabla trae 5 de los 6 indicadores (el colchón en meses, hecho el 7/11; faltan la deuda y el patrimonio a 24 meses);
  - ~~dos pruebas a la vez~~ (hecho el 8/11, como combinación);
  - ~~«Guardar como escenario»~~ (hecho el 7/11);
  - ~~importes editables (los 3.000 € del imprevisto)~~ (hecho el 7/11).
- **FX-23, PR-1:**
  - Decidir › Escenarios › Comparar ya funciona con un solo escenario guardado, frente al plan. Antes pedía dos, y con uno solo no había nada que ver. El botón pasa a «Comparar con el plan».
  - Si no hay ninguno guardado, la pantalla remite a «Comparar con» de Previsión.
  - La entrada de Simular dice «Prueba una decisión sin tocar el plan…», en vez de «Motor unificado (E20) conectado a la interfaz…».
  - Faltan los presets sin guardar y el mini-gráfico por columna.

**6/11/2026 · R-N5 levantada por el hogar y Plan › Previsión nueva (C2, FX-10 PR-1) construida.**
- Con el tema nuevo, Plan › Previsión abre con el punto más bajo del horizonte, su fecha y lo que queda sobre el suelo. Con la demo: «unos 5.600 € el 8 dic · 4.100 € por encima del suelo de 1.500 €. A 31 de diciembre, 13.000 €».
- Debajo va el gráfico único de FX-11 con el suelo y los cobros como hitos, los horizontes 3 m · 12 m · 24 m · Hasta 2036 (la recomendación de D-N2, que se recuerda por dispositivo) y «Lo que viene en 90 días», con la certeza de cada día.
- Todo sale del mismo motor, el mismo suelo y el mismo redondeo que Hoy.
- La tabla de meses sigue tras «Ver todo el detalle». El plan B, el puente y el mapa de pagos siguen a la vista debajo: esconderlos sería casi retirar funciones en uso.
- Plan › Previsión pasa de 5 a 4 titulares visibles: la base de XGO-01 baja de 226 a 225.
- Medido en el medidor (`prevision-v2`) y en Funciones en prueba como parte del diseño nuevo.

**6/11/2026 · FX-11, el gráfico de previsión único, construido sin cambiar ninguna pantalla (S1 adelantada; el hogar dijo «¿seguimos?»).**
- **FX-61:** `ChartKit.forecastPlotHtml` (`chart-kit.js`) se suma al kit de WP-28, que ya existía con recorrido, frase y tabla. Por eso FX-61 queda absorbida, sin sesiones propias.
- **Qué pinta:** lo real hasta hoy en tinta continua, el plan desde hoy en azul continuo, el rango probable y el suelo en rojo discontinuo, más la marca de hoy, la costura diario/mensual, los hitos y hasta dos escenarios en azul discontinuo con su nombre al final de la línea.
- **Etiquetas:** las del eje Y van redondeadas (800, no 803) y en HTML superpuesto; dentro del SVG estirado se deformarían.
- **Color:** token nuevo `--e19-forecast`. En el tema nuevo es su azul («azul = previsto») y en el clásico, el acento de siempre.
- **Uso:** ninguna pantalla lo pinta todavía; lo estrena Previsión C2 la semana del 19/11.

**6/11/2026 · D-N4 decidida por el hogar («sí, saldo arriba y margen debajo») y FX-01 cerrada.** En Hoy, «Fin de noviembre» enseña ahora el saldo previsto (demo: 10.350 €), el mismo de la banda de caja «según el plan» y del motor diario, y debajo «8.850 € sobre el suelo». Antes enseñaba solo el margen, que se leía como saldo. Se trata como corrección, según la recomendación de D-N4, así que no gasta el cambio de Hoy de la semana. Una e2e nueva, «FX-01 · una sola cifra de previsión», lo comprueba a 390 px (también en Safari) y 1440 px: Hoy, la banda y el motor diario dan el mismo saldo a fin de mes, y el titular de Previsión y su resumen, el mismo punto más bajo. **Semana S0 completa:** solo falta H-35 (del hogar, antes del 11/11).

**6/11/2026 (tarde) · FX-51, primera entrega: lo que mueve cada supuesto, en Ajustes › Supuestos.** Para la inflación, la subida de los ingresos y los factores de gasto e ingreso, la app recalcula el plan con el mismo motor, moviendo cada supuesto en su sentido desfavorable, y dice cuánta liquidez quita a fin del año que viene y al final del plan. Con la demo: «Con un punto más de inflación: a fin de 2027, 320 € menos; a fin de 2036, 27.000 € menos». Cada recálculo tarda ~1 ms. Las diferencias se redondean a dos cifras significativas: la regla de los niveles borraba 320 €. **Error que ya existía, corregido:** el registro decía «Factor general de ingresos ×0» y «de gastos ×0» con los factores sin tocar, que el motor usa como ×1. Pantalla nueva, ninguna.

**6/11/2026 · D-N1 aprobada por el hogar («sí, empieza con la semana S0») y S0 construida en un PR.** Con la demo (reloj 5/11):
- **FX-02:** Previsión decía «El punto delicado es nov 26 · cae a 5.350 € el 01 nov», una fecha ya pasada. El motor mensual pone el mínimo siempre en el día 1. Ahora toma el punto más bajo del motor diario, el mismo de Hoy, solo desde hoy: «El punto delicado es dic 26 · Lo más bajo llega el 8 dic: unos 5.600 €». Hasta 90 días lleva el día; más allá, el mes. El «Mínimo del periodo» del resumen dice lo mismo, con el mismo redondeo. Las barras siguen siendo el mensual, rotulado como «el peor orden del mes».
- **FX-04:** sin céntimos en la banda de caja ni en la sensibilidad. El titular va a la decena hasta 30 días, a la centena hasta un año y al millar después.
- **FX-30:** «rango probable (8 de cada 10 casos)», «lo más probable» y «peor caso razonable» en vez de P10/P50/P90 y «trayectorias». La sensibilidad ya no dice «207 %» ni «−5.350 €», sino «aguanta aunque no llegue el ingreso previo a la nómina».
- **FX-16:** Previsión cabe a 390 px: cifras en dos columnas, la tabla mensual con todas sus columnas a la vista desplazando y las etiquetas del gráfico sin pisarse.
- **FX-62:** Previsión y Escenarios, en el medidor de utilidad.
- **FX-01, primera parte:** `canonical-forecast-contract.js`, el contrato de las cifras de previsión, con su prueba.
- **Pendiente:** la prueba de coherencia entre todas las pantallas y la etiqueta de Hoy «Fin de noviembre», que espera **D-N4**. **H-35** sigue siendo del hogar (antes del 11/11).
- **Panel de seguimiento al día (6/11):** pestaña «Noviembre · Oleada 1» con las 41 filas (§9). FX-02, FX-04, FX-16, FX-30 y FX-62 hechas, y FX-01 en curso.
- **Dos filas revisadas al mirar el código (6/11):**
  - **FX-03:** el cierre de cada mes ya cuadra entre el motor diario y el mensual; es una invariante que hace fallar la app si no se cumple. Lo que difiere es la forma dentro del mes: el motor diario carga el gasto variable estimado entero el día 8, y la banda lo reparte por días. Arreglarlo cambia la cifra de Hoy, así que va tras la revisión de Hoy del 16/11, como el cambio de Hoy de esa semana.
  - **FX-51:** el registro de supuestos ya existe en Ajustes, con su fecha y su caducidad. Falta el impacto de cada supuesto.

**5/11/2026 · WP-21, la parte de inversión hecha antes de su turno** (#588, en otra sesión en paralelo con la que creó este backlog): «Datos para la Renta» en Inversión › Cartera (titular, depositario, dividendos e intereses, pérdidas por bloque) y el «Informe de inversión para la Renta» en Herramientas avanzadas › Fiscal, con CSV, impresión y su línea en el borrador GOB8. Sin cambios en la previsión ni en Hoy. Queda en la Oleada 2 solo el local alquilado (PR-3); lo que falta para que dé cuota son los datos del hogar.

**5/11/2026 · nace este backlog.** Tesis de la oleada: **la previsión no necesita más motores, necesita una sola
verdad, una sola pantalla y los escenarios encima.** Con la demo, la misma pregunta («¿cuánto tendremos?») recibe
cuatro respuestas de tres motores (8.850 € de margen en Hoy, 5.350 € «el 01 nov» en Previsión, 10.350 € en la banda,
2,4 meses en la cabecera), lo mejor de la previsión está plegado y ningún escenario se puede ver sobre ella. Por eso la
oleada va en este orden: **coherencia (semana del 6/11) → cimientos sin cambios visibles (12-18/11, semana de
revisiones) → Previsión nueva C2 (19-25/11) → escenarios superpuestos y pruebas de estrés (26/11-2/12) → cierre de
noviembre como prueba de fuego (1-4/12).** Pendiente: que el hogar conteste las decisiones D-N1 a D-N7 (§7).

## 1. Cómo empezar la próxima sesión (10 minutos)

1. Leer §0, §2, §4 y §5.1 de este documento y la última entrada de `PROJECT_STATE.md`.
2. Antes de tocar una pantalla, `docs/rediseno/ESTADO.md` entero (CLAUDE.md). Antes de tocar la previsión, §4-§6 de la
   propuesta octava.
3. `git status`, `git log --oneline -5`; la rama parte de `origin/main` (receta en `BACKLOG_DEFINITIVO.md` §10).
4. Lo siguiente es la primera fila de §5.1 sin hacer **de la semana en curso** (§4). Si una fila espera una decisión del
   hogar (§7), se salta a la siguiente y se dice.
5. Al cerrar: validar, `PROJECT_STATE.md` con cifras reales, **este documento** (§0 y la columna «Estado» de §5),
   `docs/rediseno/ESTADO.md` si es una pantalla, commit, push, PR en borrador, CI y fusión en verde (CLAUDE.md).

---

## 2. Qué cambia frente a `BACKLOG_DEFINITIVO.md`

| Antes (hasta el 5/11) | Desde esta oleada |
|---|---|
| El siguiente paso lo marcaban WP-23, el rediseño (§8 de `ESTADO.md`) y lo que pidiera el uso real | Un eje explícito para noviembre: **previsión y escenarios visibles**, con fechas por semana (§4) |
| Previsión C2 era «la siguiente pantalla, tras las revisiones» sin más alcance que la referencia | C2 se amplía con escenarios superpuestos, insignia de confianza, qué ha cambiado y lo que viene (FX-10…FX-40) |
| XPR-01…05 y 08…11 de la séptima auditoría seguían como propuesta | Adoptadas con prioridad (§5); XPR-06 y XPR-07 se gradúan dentro de C2 |
| NPV-06 («¿Y si…?» desde Previsión), NIN-09 (estrés en una pulsación) y NDB-03 (¿me lo puedo permitir?) en P3 | NIN-09 sube a P0 dentro de FX-21; NPV-06 y NDB-03, a P1 dentro de FX-22 |
| WP-28 (kit de gráficos) aparcado | Desaparcado como FX-61: C2 es su primera pantalla |
| Siete motores o pantallas de escenarios | Uno visible (Previsión + Decidir › Escenarios) y unificación de motores en P2 (FX-25) |

Lo que **no** cambia: el resto de prioridades y estados de `BACKLOG_DEFINITIVO.md` (se reproducen en §6), sus reglas
(§3 aquí) y el calendario con fecha fija (fiscal, revisiones, cierres).

---

## 3. Reglas vigentes

**Heredadas sin cambio** (detalle en `BACKLOG_DEFINITIVO.md` §4 y CLAUDE.md):
- Lo nuevo nace encendido, con revisión a los 14 días en Ajustes › Funciones en prueba (29/10).
- **Un cambio de Hoy por semana**, cada uno con su línea en Novedades. Las correcciones de errores no cuentan.
- **Uno entra, uno sale** (GOV-02), comprobado por el CI (XGO-01). Una excepción se escribe en
  `docs/gobierno/superficie.json`.
- GOV-01: ≤ 10 min/semana para mantener la app. GOV-04, GOV-05 y GOV-06 igual.
- Nada se ejecuta solo (A11-4). Las acciones que cambian el plan conservan su paso de revisión.
- No se retira una pantalla en uso sin consultar; retirar es redirigir sin borrar código.
- Sin límite de paquetes en curso (26/10).
- Frenos de publicación de CLAUDE.md.

**Nuevas de esta oleada** (propuestas por Claude; el hogar puede vetarlas con D-N1):
- **R-N1 · Contrato de cifras.** Desde FX-01, toda cifra de previsión que se pinte pasa por el contrato
  (`canonical-forecast-contract.js`). Una cifra nueva fuera de él no pasa el CI.
- **R-N2 · Nunca céntimos en una previsión** (FX-04).
- **R-N3 · Los escenarios sobre la previsión son de solo lectura.** Aplicar sigue en Decidir › Escenarios con su
  revisión.
- **R-N4 · Tope blando de 3 funciones nuevas en prueba a la vez durante la oleada** (D-N7). No limita construir: limita
  lo que se enciende a la vez para que cada revisión de 14 días mida una sola cosa.
- ~~**R-N5 · La recomendación del 4/11 se respeta:** ninguna pantalla nueva antes de las revisiones del 12 al 18/11.~~
  **Levantada por el hogar el 6/11/2026:** «puedes saltarte esta restricción […] y sigue además con el resto de
  funcionalidades». Coste conocido: las revisiones del 12 al 18/11 medirán pantallas recién cambiadas. Sigue en pie «un cambio
  de Hoy por semana».

---

## 4. Calendario de la oleada (6/11 - 4/12/2026)

| Semana | Tema | Desarrollo | Hitos y tareas del hogar |
|---|---|---|---|
| **S0 · 6-11/11** | Una sola verdad (correcciones) | FX-02, FX-04, FX-30, FX-16, FX-62 y FX-01 | **H-35** días de cargo de las 10 partidas más grandes (≈ 15 min) · **H-03** datos fiscales en la app (antes del 12/11) · 7/11 revisión del Repaso semanal |
| **S1 · 12-18/11** | Revisiones y cimientos sin cambio visible | FX-61/FX-11 (kit de gráficos), FX-03 (trayectoria cosida), FX-51 (motor de supuestos) · WP-23 con los datos del hogar | 12/11 revisión de las 8 funciones encendidas el 29/10 · **14/11 campaña fiscal lista (WP-23)** · 14/11 revisión de «Plan nuevo» · 15/11 posible cambio de Hoy (avisos de WP-36) · 16/11 revisión de Hoy · 18/11 revisión de Cierre y Clasificar, **H10** y **H12** · respuestas D-N1…D-N7 |
| **S2 · 19-25/11** | Previsión nueva (C2) | FX-10 con FX-11, FX-31, FX-12 (plegado) y XPR-06/07/08 integradas | 20/11 fin de la Ola 2 del plan anterior |
| **S3 · 26/11-2/12** | Escenarios sobre la previsión | FX-20, FX-21 (3 primeras pruebas de estrés), FX-23, FX-40, FX-42 | **30/11 H8** (A5-1/A5-4, activar o archivar) |
| **S4 · 1-4/12** | Prueba de fuego: cierre de noviembre | FX-43 (la carta cuenta la previsión) y arreglos de lo que salga | **1-3/12 cierre de noviembre** (primer coste del cierre medido; primera carta del mes) · **4/12 revisión de salida de la oleada** (§8) |

**Capacidad:** el núcleo (§5.1) suma ≈ 28 sesiones (33 antes de revisar FX-03, FX-51 y FX-61 el 6/11). Al ritmo de octubre no es el cuello de botella; lo son las
revisiones y los datos del hogar. Si algo se retrasa, se cae primero lo marcado «si da tiempo» y nunca S0.

---

## 5. Backlog priorizado

Columnas: **ID** · **Qué** · **Origen** (8ª = propuesta octava; 7ª = séptima auditoría; Def = `BACKLOG_DEFINITIVO.md`)
· **Esf.** (S ≤ 1 sesión, M 2-3, L 4+) y sesiones · **Depende** · **Semana** · **Hecho cuando** · **Estado**.

### 5.1 P0 — Oleada 1, núcleo (6/11 - 4/12/2026)

| # | ID | Qué | Origen | Esf. | Depende | Sem. | Hecho cuando | Estado |
|---|---|---|---|---|---|---|---|---|
| 1 | **FX-02** | El «punto delicado» nunca en una fecha pasada ni en el día 1 inventado; sensibilidad sin «207 %» ni importes negativos | 8ª | S · 0,5 | — | S0 | Reloj 5/11: ningún titular con fecha < hoy; pruebas de mínimo al principio, al final y en el mes siguiente | **Hecho 6/11** |
| 2 | **FX-04** | Precisión según el horizonte; nunca céntimos en una previsión | 8ª | S · 0,5 | — | S0 | Barrido de vistas con la demo sin céntimos en previsiones | **Hecho 6/11** (banda de caja, titular y sensibilidad; el resto de pantallas, con FX-01) |
| 3 | **FX-30** | Lenguaje de incertidumbre para personas (rango probable, peor caso razonable) | 8ª | S · 1 | — | S0 | Las 6 frases de la tabla de la propuesta §8 cambiadas; «¿cómo se calcula?» plegado | **Hecho 6/11** (banda de caja y sensibilidad de Previsión) |
| 4 | **FX-16** | Remates del móvil en Previsión (cifras cortadas, columnas ocultas, eje que se pisa) | 8ª | S · 0,5 | — | S0 | `check-mobile-overflow` vigila Previsión; nada cortado a 320 y 390 px | **Hecho 6/11** |
| 5 | **FX-62** | Medir Previsión y Escenarios en el medidor de utilidad | 8ª | S · 0,5 | — | S0 | Eventos de vista, horizonte, día fijado, escenario y preset en Uso de la app | **Hecho 6/11** |
| 6 | **FX-01** | Contrato de cifras de previsión + glosario con vuestras cifras (absorbe XUX-05); Hoy «Fin de noviembre» con su unidad | 8ª, 7ª | M · 2 | FX-04 | S0 | Prueba de coherencia: cada etiqueta, mismo valor en todas las pantallas (demo + 5 hogares sintéticos × 5 fechas) | **Hecho 6/11**: contrato (#590), Hoy con el saldo arriba y el margen debajo (D-N4) y la e2e de coherencia (Hoy, banda, motor diario, titular y resumen) |
| 7 | **H-35** | (Hogar) Día de cargo de las 10 partidas más grandes | 8ª | ≈ 15 min | — | S0 | Calidad de la previsión ≥ 40 % del gasto con día conocido | Tarea del hogar |
| 8 | **WP-23** | Campaña fiscal de fin de año con los datos del hogar (FIS-01, DAC-02, FIS-02) | Def P0 | — | H-03 | S1 | Lista con euros reales el 14/11; acciones antes del 31/12 | Esperando H-03 (12/11) |
| 9 | **FX-61** | WP-28 desaparcado: kit de gráficos táctil y accesible | Def P1 (WP-28) | M · 3,5 | — | S1 | Recorrido táctil y teclado, frase automática y «ver como tabla» en el componente | **Revisado 6/11: ya estaba hecho** (WP-28, `chart-kit.js`: recorrido con dedo, ratón y teclado, frase automática y «Ver como tabla»). Se aparcó solo la migración de los demás gráficos, que se hace con cada pantalla |
| 10 | **FX-11** | Gráfico de previsión único (real, plan, rango, suelo, hitos, escenarios, costura) | 8ª | M · incl. en FX-61 | FX-61 | S1 | Lo usan Previsión y Escenarios; axe; frase automática correcta con la demo | **Hecho 6/11** (`ChartKit.forecastPlotHtml` y su token `--e19-forecast`); todavía no lo pinta ninguna pantalla: lo estrena C2 |
| 11 | **FX-03** | Una sola forma de la trayectoria en los primeros 90 días: el motor diario reparte el gasto variable por los días del mes, como la banda, en vez de cargarlo entero el día estimado. **El cierre de cada mes ya cuadra** entre motores (invariante `monthly-parity` de `canonical-daily-engine.js`). Absorbe la parte de previsión de RD-COB2 | 8ª, Def §5.0 | M · 2 | FX-01 | S2 (tras la revisión de Hoy del 16/11) | La banda «según el plan» y el motor diario dan el mismo saldo cada día (demo + sintéticos); el titular y la banda, la misma fecha de mínimo | **Revisado 6/11:** cambia la cifra de Hoy, así que entra como el cambio de Hoy de una semana **11/11, preparado** (PR abierto, se fusiona el 16/11): el gasto variable repartido por los días del mes en euros enteros, con el mismo cierre de mes; XPR-07 mira hasta el final del bajón |
| 12 | **FX-51** | Supuestos del plan: **el registro ya existe** (Ajustes, con fecha y caducidad, A7-2/PVC15). Falta el impacto de cada supuesto (±1 punto) en el fin de año y a 24 meses, verlo desde Previsión y sumar Euribor, rentabilidad de la cartera y renta del local | 8ª | M · 1,5 | — | S1-S2 | Cada supuesto con su impacto ±1 en el fin de año; editar enseña antes/después | **PR-1 hecho 6/11**: el impacto de los cuatro supuestos generales, en Ajustes; el «×0» de los factores, corregido. **PR-2 hecho 9/11**: «Con estos supuestos» en Previsión (mismas cifras que Ajustes, el Euribor lleva a su prueba, «Cambiarlos en Ajustes»). Rentabilidad de la cartera y renta del local: no están en el motor; meterlas es otra tarea (cambia el plan) |
| 13 | **FX-10** | **Plan › Previsión con el diseño nuevo (C2), ampliada** | 8ª, Def §5.0 (C2) | L · 4 | FX-01, FX-11 | S2 | Cifra + gráfico + panel del día sin desplazar a 1440 × 900; cifra + gráfico a 390 × 844; menos titulares que hoy (XGO-01); e2e 390 `@safari` y 1440; axe claro/oscuro | **PR-1 hecho 6/11**: punto más bajo con su fecha, gráfico único con el suelo y los cobros, horizontes 3/12/24 m y hasta 2036, «Lo que viene» y lo de siempre tras «Ver todo el detalle». **PR-2 en parte, 7/11:** el panel del día (a la derecha del gráfico en escritorio, debajo en móvil; sigue al ratón, un clic, un toque o ← → lo fijan) y la insignia de FX-31. **12/11, PR-3 (en #607, fusionado el 13/11): el rango probable con 3 m** (área azul, nota, panel del día y tabla; de la banda de caja a 91 días, anclado al plan). XPR-07/08 dentro, hechas el 7/11. **FX-10 completa** |
| 14 | **XPR-06** | Qué mueve cada día, dentro de C2 (sale de su interruptor) | Def §5.0 | — | FX-10 | S2 | Panel/hoja del día de C2 | Hecho, en prueba (revisión 12/11). **7/11: lo mismo, ya sin interruptor, en el panel del día de C2**; la hoja de la banda de caja sigue tras el suyo hasta su revisión |
| 15 | **XPR-07** | El arreglo más barato, dentro de C2 | Def §5.0 | — | FX-10 | S2 | Tarjeta de remedio de C2 | Hecho PR-1, en prueba (revisión 12/11). **7/11: también dentro de C2**, debajo del gráfico, con su interruptor |
| 16 | **XPR-08** | «De verdad libre»: disponible tras apartar lo que viene | 7ª | S-M · 1,5 | FX-10 | S2 | Tarjeta de C2 con «Apartar» que lleva al sobre | **Hecha el 7/11 con D-N9 (b)**: una sola cifra bajo el titular de C2 (`provisions` de `canonical-large-payments.js`); dice cuánto apartar al mes y lleva al mapa. En Hoy, cuando se levante su congelación |
| 17 | **FX-31** | Una insignia de confianza de la previsión, con la tarea que más la sube (XPR-03 en parte; WP-10, WP-12, WP-45) | 8ª, 7ª | S-M · 1,5 | FX-10 | S2 | Insignia en Previsión y punto en Hoy; hoja con por qué y tarea por € de incertidumbre/minuto | **Hecha en Previsión el 7/11** (`canonical-forecast-confidence.js`): baja · media · alta con tres señales, el porqué y la tarea que más la sube por € por minuto (cola de WP-45). El punto en Hoy, hecho el 7/11 y publicado el 9/11 (cambio de Hoy de esa semana) |
| 18 | **FX-12** | Lo que viene en 90 días: hitos del horizonte (absorbe la franja de WP-49) | 8ª, Def P2 | M · 2 | FX-10 | S2 (plegado) / S3 | Lista por semana con certeza y «¿sabes el día?»; mismos hitos en el gráfico | **Hecho 9/11** («sigue con FX-12»): por semanas con su neto, umbral 150 · 300 · 1.000 € recordado, «¿sabes el día?» en cada pago estimado, sin traspasos ni gasto variable (dicho aparte) y las mismas marcas en el gráfico (rojas si sale más). La franja anual de WP-49 no se traslada sin consultar (retiraría una tarjeta en uso) |
| 19 | **WP-37** | Estados completos y «deshacer», aplicados a C2 | Def P1 | — | FX-10 | S2 | Vacío, sin saldos, sin suelo y error en C2 | **Hecho en C2 el 8/11**: error (recálculo atómico con aviso y reintento, en toda la app, #599) y sin suelo (dice que el de 1.500 € es el inicial y lleva a fijarlo). Vacío ya existía; sin saldos no se da (saldos del arranque; lo viejo lo dicen la insignia y FX-40) |
| 20 | **FX-20** | **Escenarios superpuestos en la previsión** (solo lectura) y tabla de impacto plan frente a escenario | 8ª | L · 3,5 | FX-10, FX-03 | S3 | Línea discontinua con su nombre; tabla de 6 indicadores; frase determinista; e2e y axe | **PR-1 hecho 6/11**: «Comparar con» en C2 con las pruebas de FX-21, la línea discontinua con su nombre, frase determinista y tabla con 4 de los 6 indicadores (punto más bajo, suelo, 31/12 y final del horizonte); e2e 390 `@safari`/1440 con paridad de motor y axe claro/oscuro. **7/11:** el colchón en meses en el punto más bajo (con el objetivo de Ajustes en la frase). **8/11:** dos pruebas a la vez, combinadas sobre la misma trayectoria. **8/11:** los escenarios guardados en la fila («O un escenario guardado», con paridad de cierre de mes con Escenarios). **10/11, hecho (versión completa):** la deuda viva y el patrimonio a 24 m con `canonical-debt-horizon.js`: contratos, lo que el plan amortiza, escenarios guardados y Euribor, con su frase |
| 21 | **FX-21** | Pruebas de estrés del hogar, **3 primeras**: Euribor +1/+2, un sueldo menos 3-6 meses, imprevisto de 3.000 € (absorbe NIN-09 y XNF-03) | 8ª, Def P3, 7ª | M · 2 | FX-20 | S3 | Cada una dice: ¿bajamos del suelo?, ¿cuándo?, ¿cuánto falta?, qué palanca lo arregla | **Las 3 de D-N3 hechas 6/11** (`canonical-stress-scenarios.js` v2): un sueldo menos por titular 3 o 6 meses, Euribor +1/+2 en la próxima revisión (con WP-20) e imprevisto de 3.000 € el peor día. El importe del imprevisto se elige desde el 7/11 (1.000, 3.000 o 6.000 €; se publica el 9/11 con el punto de Hoy). «Guardar como escenario» hecho el 7/11 (a Escenarios › Guardados con los tipos de fábrica y paridad de motor; sale el 9/11). Gasto +10 % queda en la biblioteca |
| 22 | **FX-23** | Comparar el plan con un solo escenario o un preset; texto de Escenarios en lenguaje de hogar | 8ª | S-M · 1,5 | FX-20 | S3 | Comparar con 1 escenario sin el aviso de «hacen falta dos» | **PR-1 hecho 6/11**: Comparar acepta un escenario («Comparar con el plan»), el vacío remite a «Comparar con» de Previsión y Simular se explica sin jerga. **8/11:** el plan frente a un escenario guardado, también en Previsión (con FX-20). **9/11 (D-N10), hecho:** las pruebas de estrés sin guardar en Comparar (las de D-N3, con paridad de meses) y el minigráfico por columna (liquidez a fin de mes, misma escala) |
| 23 | **FX-40** | Qué ha cambiado desde tu última visita: puente con 4 causas (absorbe XUX-07; WP-43 se mueve a Previsión) | 8ª, 7ª, Def P2 | M · 2,5 | FX-01 | S3 | «−300 € frente al lunes [por qué]» con datos nuevos / plan / supuestos / tiempo; WP-43 sale de `#plan` | **PR-1 hecho 8/11** (publicado el 8/11): la línea bajo la cifra y el puente de 4 causas, que cuadra; fotos por visita en este dispositivo. **PR-2 hecho 8/11:** el puente de WP-43 dentro de «Por qué» (decidido por el hogar). Falta medir el plan por separado |
| 24 | **FX-42** | La previsión en el «Listo» del Repaso semanal (no es un paso nuevo) | 8ª | S · 0,5 | FX-40 | S3 | Tarjeta de 3 líneas en «Listo» | **Hecho 9/11** (el Repaso sigue, D-N10): en «Listo», lo más bajo en 30 días con su margen, qué ha cambiado desde la visita anterior (sin dejar foto) y el aviso si se baja del suelo o la cuenta queda en descubierto; «Ver la previsión» |
| 25 | **FX-43** | La carta del mes cuenta la previsión (WP-29) | 8ª, Def P1 | S · 0,5 | WP-12 | S4 | Primera carta con el cierre de noviembre | **11/11, hecho (en #607, fusionado el 13/11)**: la caja del cierre frente a lo previsto el día 1 y el 15 (WP-12) y lo más bajo del mes siguiente frente al suelo; sin datos, el hueco no sale |

**Si da tiempo dentro de la oleada** (si no, abren la Oleada 2): FX-21 resto de presets (gasto +10 %, la paga variable
no llega, el inquilino no paga, caída de mercado −20 %), FX-41 (avisos de previsión con umbral, como cambio de Hoy de
una semana) y FX-14 (el mes en curso al ritmo real).

### 5.2 P1 — Oleada 2 (7/12/2026 - 22/1/2027, el tramo que era la Ola 3)

| # | ID | Qué | Origen | Esf. | Depende | Nota |
|---|---|---|---|---|---|---|
| 1 | FX-21 (resto) | Las otras 4 pruebas de estrés | 8ª | M · 1 | FX-20 | Las que tengan sus datos (local, cartera, ingresos inciertos) |
| 2 | FX-14 / XPR-04 | El mes en curso al ritmo real | 7ª | M · 2 | FX-03 | Previsión y Plan › Mes · **11/11, hecho (en #607, fusionado el 13/11)**: motor `canonical-variable-pace.js` con el perfil del hogar, puerta de 3 meses, banda y acierto del día 15 por ensayos sin trampa; la cifra prudente sigue mandando |
| 3 | FX-13 / XPR-05 | Previsión por cuenta y traspasos sugeridos; desbloquea XPR-07 PR-2 (traspasos) | 7ª, Def §5.0 | M · 2,5 | FX-10 | Nunca ejecuta el traspaso · **Hecho 10/11**: «Total · Por cuenta» en el gráfico (cuenta corriente con su mínimo y ahorro) y la tarjeta del traspaso sugerido (traspasar menos al ahorro o pasar del ahorro antes del día, a 0 €) |
| 4 | FX-22 | «¿Y si…?» rápido desde la previsión (NPV-06 y NDB-03 promovidas) | 8ª, Def P3 | M · 2 | FX-20 | Responde «¿me lo puedo permitir?» · **PR-1 hecho 9/11**: gasto único, cambio de ingreso y de gasto al mes, con veredicto y «Guardar como escenario»; **10/11, hecho:** «aplazar un pago» (1-3 meses, paridad con Escenarios) y los atajos del panel del día en lugar del clic largo |
| 5 | FX-41 | Avisos de previsión con umbral en Hoy y en el calendario (WP-32) | 8ª | S-M · 1,5 | FX-40 | Entra como el cambio de Hoy de una semana · **11/11, hecho con puerta de fecha (activo el 23/11, en #607 con FX-03)**: suelo, cuenta, colchón y fin de año, solo al cruzar el umbral en 90 días; en «Decidir esta semana» y en el calendario (título sin importes) |
| 6 | FX-60 / XUX-01 | Navegación por cinco preguntas; Plan › Previsión, único sitio de la previsión; Escenarios en Decidir | 7ª, Def §5.0 | L · 4 | FX-10 | Redirige `#forecast`, Previsión mensual, Análisis, Mapa de calor |
| 7 | RD-D1/D2 | Patrimonio e Inversión con el diseño nuevo | Def §5.0 | L | FX-11 | Usan el gráfico único |
| 8 | FX-50 | Hasta 2036 legible: vista anual con hitos y supuestos (absorbe `#forecast`; sobre WP-46) | 8ª | M-L · 3 | FX-51, FX-03 | **12/11, hecho (en #607, fusionado el 13/11)**: año a año con abanico de supuestos, hitos (con los objetivos de ahorro), «Sin proyectos» y la prueba elegida; `#forecast` lleva ahí en el v2 (decisión del hogar) |
| 9 | FX-15 | Resumen por periodo en cascada; tabla que cabe en el móvil | 8ª | S · 1 | FX-10 | Tras «Ver todo el detalle» · **12/11, hecho (en #607, fusionado el 13/11)**: cascada de la liquidez que cuadra, con el ahorro aparte; tabla con neto y saldo final y fila desplegada en el móvil. La banda de barras por mes sigue (retirarla se consulta) |
| 10 | FX-27 / XDO-02 | La revisión de la hipoteca como escenario con fecha | 8ª, 7ª | M · 2 | FX-21, WP-20 | Sube a primera fila a ≤ 120 días de la revisión · **12/11, hecho (en #607, fusionado el 13/11)**: «Euribor» delante a ≤ 120 días y la revisión en tres caminos (+ el fijo de DEB-4) con cuota y colchón; el mixto no se puede teclear |
| 11 | XDA-10 PR-2 | Antes de decidir: Euribor, cancelar deuda (DEB-15), simuladores e **escenarios** | Def §5.0 | S-M | FX-20 | Encaja con los presets · **12/11, hecho (en #607, fusionado el 13/11)**: cancelar entera (DEB-15/17, una línea), «Comparar con» (saldos y Euribor) y la reserva de Escenarios. **13/11, PR-3 hecho:** la aportación a pensiones (lo que queda sobre la reserva) y el guardarraíl del apalancamiento (AP3 y LEV14, solo cuando lo decide el colchón). XDA-10 completa |
| 12 | WP-34 / PRV-08 | Revisión base cero del plan (enero) | Def P1 | — | — | Enero 2027, con FX-51 a la vista |
| 13 | WP-21 | Paquete Renta: ~~inversión~~ (hecha el 5/11, #588) y local alquilado (PR-3) | Def P2 | M · 2 | WP-31 | Antes del 31/3/2027 · **PR-3 hecho 12/11 (en #607, fusionado el 13/11)**: `canonical-rental-tax.js` y «El local alquilado para la Renta» en Fiscal; con los datos del local (H-36) da la cifra |
| 14 | XPR-11 | Mover los días de cargo a donde menos duelen (palanca del remedio) | 7ª | S · 1 | FX-12 | **12/11, hecho (en #607, fusionado el 13/11)**: `canonical-charge-day-moves.js`, hasta 3 recibos por el mínimo de cada mes, puerta del 70 %; «Lo he pedido» y «Ya se carga» (guarda el día de cargo). Se ve con H-35 |
| 15 | XDA-04 PR-2 | Tira de cobertura de 90 días por cuenta | Def §5.0 | S | dos importaciones reales | **12/11, hecho (en #607, fusionado el 13/11)**: condición cumplida (extracto inicial + octubre). Tira en Movimientos (como la referencia) y en el paso «Extracto» del repaso, «Cobertura tras importar» en Importar, y WP-36/WP-41 dicen qué días no han podido mirar |
| 16 | WP-54 | Primera ronda de la prueba con 5 personas ajenas, **con C2 y los presets como tareas** | Def (continuo) | — | FX-10, FX-21 | Desde diciembre |

### 5.3 P2 — planificada, con disparador de datos (febrero - mayo 2027)

| ID | Qué | Origen | Disparador |
|---|---|---|---|
| FX-32 / XPR-01 | El rango cubre también los importes | 8ª, 7ª | 3 cierres con reales por partida |
| FX-33 / XPR-02 / XPR-03 | La previsión corrige su sesgo y su rango se calibra | 8ª, 7ª | 3 cierres comparables (≈ febrero 2027, WP-12) |
| FX-34 / XPR-10 | Probabilidad sugerida para los ingresos inciertos | 8ª, 7ª | 6 meses de ingresos |
| FX-35 / XPR-09 | Detector de cambios de nivel del gasto | 8ª, 7ª | 4 meses de reales por partida |
| FX-26 | Diario de decisiones con lo que se esperaba | 8ª | El primer escenario aplicado |
| FX-25 | Un solo motor de escenarios (E13 y simulador → E20, con paridad) | 8ª | Tras FX-20; retirar pantallas se consulta (D-N6) |
| FX-52 | Qué supuesto pesa más (tornado) | 8ª | Tras FX-51 |
| FX-53 / XIN-04 | Objetivos con probabilidad y aportación necesaria | 8ª, 7ª | Tras FX-50 |
| FX-63 | Rendimiento de escenarios superpuestos (≤ 100 ms percibidos) | 8ª | Si `perf-screens` lo pide con FX-20 |
| WP-42 (resto) | Escalera del próximo euro (NIN-05, CAR-03); NIN-08 ya hecho | Def P2 | Aparcado; se retoma tras FX-60 |
| RD-D3 | Deuda con el diseño nuevo | Def §5.0 | Tras NTC-05 (un solo motor de deuda) |
| RD-D4 / RD-E2 | Taller de deuda nueva; Lo que la app te pide + Laboratorio | Def §5.0 | Tras D3 |
| XDA-03 nivel 2 | pdf.js en el propio sitio | Def §5.0 | Solo si una cuenta da únicamente PDF |
| DAC-05 | ¿Cobra el banco la cuota pactada? | Def P3 → P2 | Ya hay extractos mensuales (la condición que recomendó Claude) |

### 5.4 P3 — catálogo con disparador (sin cambio salvo las promovidas)

Las 27 de `BACKLOG_DEFINITIVO.md` §5.4 **siguen igual, con el mismo disparador**, salvo tres que suben: **NPV-06** y
**NDB-03** (a FX-22, P1) y **NIN-09** (a FX-21, P0). Quedan: CAP-01 (nivel 2), CAP-03, CAP-04, PRV-03, PRV-07, DAC-03,
UXS-01, UXS-02, UXS-03, UXS-06, HOG-01, HOG-03, ND-05, ND-06, NPV-12, NIN-04, NIN-07, NDB-04, NXP-03, NXP-06, NHG-01,
NHG-04 y NTC-05 (DAC-05 pasa a P2, §5.3). Nuevas en P3: **FX-24** (escenarios con probabilidad; disparador: el hogar
pide ponderarlos), **FX-64** (una lectura de la previsión para compartir; disparador: el hogar la pide) y **XIN-07**
(fecha de independencia financiera; disparador: el hogar la pide). Del §5.0: **XUX-02** (más tarjetas «Ver cómo
quedaría») y **XDA-01 PR-2** (pausar, valor por minuto), si el medidor dice que se usan.

### 5.5 P4 — bloqueadas por un tercero o un evento (sin cambio)

ND-12, NDB-05, DNU-01, DNU-02 y HOG-04, con los mismos desbloqueos de `BACKLOG_DEFINITIVO.md` §5.5.

### 5.6 Archivo (sin cambio)

NXP-07, NHG-02, CAP-08 y NHG-03 (`BACKLOG_DEFINITIVO.md` §5.6).

### 5.7 Tareas del hogar de la oleada

| ID | Qué | Para | Fecha |
|---|---|---|---|
| **H-35** | Día de cargo de las 10 partidas más grandes (Plan › Partidas o «¿sabes el día?») | La calidad de la previsión, que hoy es la palanca de visibilidad más barata | **Antes del 11/11** |
| H-03 | Datos fiscales en la app | WP-23 | 12/11 |
| D-N1…D-N7 | Contestar las decisiones de §7 | Arrancar S2 y S3 | 18/11 |
| H10 | Excepción XGO-01 de Cierre | Revisión del Cierre nuevo | **4/12** (movida el 13/11). H12 (aceptar en bloque): **decidida el 13/11, se retira** |
| H8 | A5-1/A5-4: activar o archivar | Gobierno | 30/11 |
| H-37 | Clasificar lo que queda sin partida de agosto a noviembre **con #617 ya publicado** (recargar la app antes), y mandar la línea de Clasificar de Ajustes › Uso de la app | Saber de qué tipo son los grupos sin propuesta y subir el 71 % hacia el 95 % | Antes del 1/12 |
| H-06 (nov.) | Cierre de noviembre con saldos del día | Coste del cierre, carta, backtest | 1-3/12 |
| H-34, H-26 | Desplegar el buzón; tres tiempos de carga en el iPhone | XDA-02 PR-2, WP-52 | Sin fecha |
| **H-36** | Datos del local alquilado en la app (Fiscal › Borrador de apoyo para la Renta › El local alquilado): contrato, compra y gastos de 2026, nunca por el chat (≈ 15 min) | WP-21 PR-3, el local en la Renta | Antes del 31/1/2027 |

Las demás tareas del hogar del plan (H-22 a H-33 y las de cada paquete «esperando al hogar») siguen como estaban en el
panel de seguimiento.

---

## 6. Dónde queda cada cosa abierta de `BACKLOG_DEFINITIVO.md`

**Nada se pierde.** Esta tabla es la prueba: cada fila abierta del backlog anterior, con su sitio nuevo.

| Del backlog anterior | Estado al 5/11 | Sitio en esta oleada |
|---|---|---|
| §5.0 RD-COB2 (cobro con el mismo mes del año anterior) | Propuesta | Dentro de **FX-03** (P0, S1) |
| §5.0 XPR-06 | Hecho, en prueba | Se gradúa dentro de **C2** (P0, S2) |
| §5.0 XPR-07 PR-1 / PR-2 | PR-1 hecho, en prueba | PR-1 dentro de C2 (P0); PR-2 con **FX-13** (P1) y WP-41 |
| §5.0 XDA-10 PR-2 | **Hecho 12/11** (en #607); los simuladores de inversión, PR-3, **hecho 13/11** | P1 Oleada 2 (#11) |
| §5.0 XUX-02 (más tarjetas), XDA-01 PR-2 | Si se usan | P3 (sin cambio de criterio) |
| §5.0 XDA-05 PR-2 | Puerta del medidor | **H12, 18/11** (sin cambio) |
| §5.0 XDA-02 PR-2 | Construido sin desplegar | H-34 (hogar) |
| §5.0 XDA-04 PR-2 | **Hecho 12/11** (en #607) | P1 Oleada 2 (#15) |
| §5.0 XDA-03 nivel 2 | Solo si una cuenta da solo PDF | P2 con su condición |
| §5.0 Rediseño: C2 | Siguiente pantalla | **FX-10** (P0, S2) |
| §5.0 Rediseño: D1-D2, navegación | Tras revisiones | P1 Oleada 2 (#6, #7) |
| §5.0 Rediseño: D3, Taller, E2 | Tras NTC-05 | P2 (sin cambio de condición) |
| §5.0 revisiones RD-B5 (7/11), Plan nuevo (14/11), Hoy (16/11), Cierre y Clasificar (18/11) | Con fecha | Calendario §4, sin cambio |
| P0 WP-23 (FIS-01, DAC-02, FIS-02) | En curso, espera H-03 | **P0, S1** (sin cambio) |
| P1 WP-28 (NPV-07) | Aparcado | **FX-61, P0, S1** |
| P1 WP-37 (NXP-04) | Aparcado | Se aplica a C2 (P0, S2) y a cada pantalla nueva |
| P1 WP-29 (NHG-05) | Esperando al hogar | **FX-43**, primera carta 1-3/12 |
| P1 WP-35 (PRV-02, PRV-04) | Esperando al hogar | Fila plegada de C2; base de la prueba «la paga no llega» |
| P1 WP-36 (ND-07) | Esperando al hogar | Cambio de Hoy candidato del 15/11 (sin cambio) |
| P1 WP-38 (PRV-05, NPV-09) | Esperando al hogar | Palanca que nombran las pruebas de estrés (FX-21) |
| P1 WP-34 (PRV-08) | Esperando al hogar | Enero, P1 Oleada 2 (#12) |
| P1 WP-31, WP-52 y demás P1 hechos o esperando | Como estaban | Sin cambio (panel) |
| P2 WP-43 (PRV-01) | Esperando al hogar | **FX-40** (lo mueve a Previsión) |
| P2 WP-45 (ND-09, CAP-07) | Esperando al hogar | Base de **FX-31** |
| P2 WP-46 (NPV-10) | Esperando al hogar | Base de **FX-50** |
| P2 WP-49 (NPV-04) | Esperando al hogar | Dentro de **FX-12** |
| P2 WP-16 (NPV-01) | Hecho | Base de FX-11 y FX-20 |
| P2 WP-42 (CAR-03, NIN-05) | Aparcado | P2 (tras FX-60) |
| P2 WP-21 (NIN-10, FIS-03) | Inversión hecha (PR-0 a PR-2, 5/11); falta el local (PR-3) y los datos del hogar | P1 Oleada 2 (#13), antes del 31/3 |
| P2 WP-17, WP-18, WP-19, WP-39, WP-40, WP-41, WP-44, WP-47, WP-48, WP-50, WP-51, WP-53 | Hechos o esperando al hogar | **Sin cambio**: siguen con su tarea del hogar; no son de esta oleada |
| P3 (27) | Catálogo | §5.4: tres promovidas, DAC-05 a P2, el resto igual |
| P4 (5), Archivo (4) | — | Sin cambio |
| §6 pendientes: H8, H10, H12, `O-6`, OPT-10–13, ARQ-4, I3, I6, Cola B, UX-P1…P7 | — | Sin cambio (H8 30/11; H10 el 4/12 y H12 decidida el 13/11; `O-6` se mira en enero; OPT-10–13 en enero) |
| Séptima auditoría: XPR-01…05, 08…11, XUX-01, XUX-05, XUX-07, XNF-03, XIN-04, XIN-07, XDO-02 | Propuestas | **Adoptadas** aquí con la prioridad de §5 |
| Séptima auditoría: el resto (XDA-06…09, XIN-01/03/05/06/08, XDO-01/03…06, XDN-*, XUX-04/06, XNF-01/02/04/05/06) | Propuestas | **Sin cambio**: siguen como propuesta, fuera de esta oleada |

---

## 7. Decisiones que pide esta oleada al hogar

| # | Pregunta | Recomendación de Claude | Para cuándo |
|---|---|---|---|
| **D-N1** | ¿Se adopta este backlog como vigente, con el orden por semanas y las reglas R-N1 a R-N5? | Sí | Para empezar S0 (las correcciones de S0 no esperan: son errores) |
| **D-N2** | Horizontes de Previsión: los de la referencia (3 m · 12 m · 24 m · Hasta 2036) en lugar de los de hoy (12 · 24 · 48 · 2036) | Los de la referencia: el riesgo de caja está en los 3 primeros meses | 18/11 · **aplicada la recomendación en C2 el 6/11, reversible** (la tabla de siempre conserva los suyos) |
| **D-N3** | Las 3 primeras pruebas de estrés | Euribor +1/+2 (hipoteca variable), un sueldo menos 3-6 meses, imprevisto de 3.000 € | **Decidida el 6/11: sí, con el sueldo por titular** (construida el mismo día: Euribor con los datos de WP-20, sueldo por titular 3 o 6 meses, imprevisto) |
| **D-N4** | Hoy «Fin de noviembre 8.850 €» es margen sobre el suelo. ¿Se rotula «Margen a fin de noviembre» o se enseña el saldo con el margen debajo? ¿Cuenta como corrección (fuera de «un cambio de Hoy por semana»)? | Saldo arriba y margen debajo; sí, es corrección | **Decidida el 6/11: saldo arriba y margen debajo** (hecha el mismo día; tratada como corrección) |
| **D-N5** | Los escenarios sobre la previsión, solo de lectura; aplicar, en Decidir › Escenarios | Sí (R-N3) | 18/11 |
| **D-N6** | Tras la paridad (FX-25), ¿redirigir el laboratorio E13 y el simulador de decisiones a Escenarios? | Sí, con dos meses de redirección; se pregunta de nuevo antes de hacerlo | Febrero 2027 |
| **D-N7** | Tope blando de 3 funciones nuevas en prueba a la vez durante la oleada | Sí (R-N4) | 18/11 |
| **D-N8** | El motor mensual traspasa al ahorro todo lo que pasa de un mes de gastos y **no deja la reserva operativa en la cuenta corriente**. Con los gastos estimados el día 8 y la nómina el 15, la cuenta toca 0 € cada mes antes de cobrar. ¿Se cambia el motor para que el traspaso deje la reserva en la cuenta? | Sí: la liquidez total no cambia, solo cuánto va a cada cuenta; el traspaso del primer mes baja una vez lo que valga la reserva. Cambia las cifras de traspaso que el hogar ve en el plan, así que se consulta | **Decidida el 6/11: sí** (hecha esa noche) |
| **D-N9** | XPR-08 «De verdad libre» en C2. La Previsión nueva ya descuenta, en su punto más bajo, todo lo que el plan pone dentro del horizonte; XPR-08 además reserva la parte devengada de los pagos grandes (importe × meses transcurridos ÷ meses del ciclo). ¿Qué cifra enseña C2? (a) una tarjeta aparte con su propio «libre» (tres cifras de «libre» en la app); (b) **una sola cifra**: el margen del punto más bajo menos lo devengado de los pagos grandes que caen después del horizonte o que no están en el plan (seguros del inventario, cargos cada N meses), con «Apartar» hacia el sobre; (c) dejarlo para Hoy cuando se levante su congelación | (b): una cifra, la que de verdad se puede gastar, y sin contar dos veces lo que el plan ya descuenta. Cambia lo que significa «libre» en Previsión, así que se consulta | **Decidida el 7/11: (b)** (hecha ese día) |
| **D-N10** | Tras FX-12 y FX-23 PR-1: ¿la franja anual del mapa de pagos grandes pasa a «Lo que viene»? ¿Sigue el Repaso semanal tras su revisión del 7/11? ¿Se cierra FX-23 sin los presets sin guardar? | **Decidido por el hogar el 9/11**: la franja **no** se mueve; el Repaso **sigue** (FX-42 se hace); FX-23 **no** se cierra sin hacer su resto (presets sin guardar y mini-gráfico). El suelo real lo fija el hogar en Ajustes (tarea del hogar) | 9/11 |
| **D-N11** | Prioridad hasta el 4/12 (decidida el 13/11: «que entren los datos»). El extracto del 14/11 (200 movimientos del 7/8 al 12/11, ninguno nuevo) dice que los movimientos ya estaban al día: ¿se reformula como «que lo que entra quede con partida»? | Sí: clasificar hasta el 95 % antes del 1/12, con el repaso semanal como momento para hacerlo. No cambia qué se construye (nada de previsión nueva), solo dónde se pone el esfuerzo del hogar | **Decidida el 14/11: sí** |

---

## 8. Métricas y revisión de salida (4/12/2026)

| Métrica | Objetivo | Se mide con |
|---|---|---|
| M-COHERENCIA | 100 % de las cifras del contrato iguales en todas las pantallas | Prueba de FX-01 en el CI |
| M-PREV-USO | ≥ 2 días por semana con Previsión vista, 4 semanas desde C2 | Medidor (FX-62) |
| M-PREV-T | Mediana ≤ 10 s hasta la primera interacción en Previsión | Medidor |
| M-ESC | ≥ 1 escenario o prueba de estrés superpuesta por semana, 3 de 4 semanas | Medidor |
| M-CONF | Gasto con día conocido ≥ 40 % al cierre de noviembre (≥ 70 % en enero) | WP-10 |
| M-SUPERFICIE | −15 % de titulares visibles por defecto en Plan y Escenarios | XGO-01 |
| GOV-01 | ≤ 10 min/semana (sin cambio) | Repaso (B5) |
| Coste del cierre | Por debajo de la línea base de octubre (≈ 45 min) | Medidor, cierre de noviembre |

**Revisión de salida el 4/12:** seguir, ajustar o parar. **Regla de parada:** si en 4 semanas desde C2 no se mueve
ninguna de M-PREV-USO, M-ESC o M-CONF, no se abre la Oleada 2 sin revisarla con el hogar.

---

## 9. Seguimiento

- **El panel de seguimiento** (artefacto privado, `BACKLOG_DEFINITIVO.md` §12) mide el plan de la línea base del 3/10 y, **desde el 6/11, tiene la pestaña «Noviembre · Oleada 1»** con las 41 filas de §5.1 y §5.2: pista `noviembre` de `docs/plan/plan-definitivo.json`, fuera de la línea base como el §5.0. Su estado vive en la colección `noviembre` de la base del panel, y `tests/plan-seguimiento-sincronizado.test.cjs` exige que coincida con este backlog.
- Cada fila cerrada actualiza la columna «Estado» de §5 y una línea en §0.
- Cada pantalla cerrada actualiza `docs/rediseno/ESTADO.md` §2 (y §8 si cambia el orden).

## 10. Dónde está el detalle

| Tema | Documento |
|---|---|
| Porqué, análisis crítico y especificación de UX/UI de cada `FX` | `docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md` |
| Reglas de ritmo, recetas y trampas, protocolo del panel | `BACKLOG_DEFINITIVO.md` §4, §10 y §12 |
| Paquetes WP-01…WP-54 (enfoque técnico, pruebas) | `docs/PLAN_DESARROLLO_DEFINITIVO.md` |
| Rediseño: estado, decisiones y referencias | `docs/rediseno/ESTADO.md`, `docs/rediseno/referencias/` |
| Catálogo `X..-nn` | `docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md` |
| Registro sesión a sesión | `PROJECT_STATE.md` |
