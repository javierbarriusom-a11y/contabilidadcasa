# Revisión tras el primer cierre real (noviembre de 2026)

Hoja preparada el 30/10/2026 para que las revisiones de «Funciones en prueba» (Ajustes) se decidan en minutos y con un
criterio escrito antes de ver los datos, no después. El lugar donde se decide es la propia app: cada función, al cumplir
sus 14 días, pide «Graduar», «Aplazar» o apagarla, y enseña lo medido (medidor XGO-02, en este dispositivo).

**Aviso que condiciona todo:** con un solo hogar y un solo cierre, dos semanas de uso dan muy pocos datos. La regla de
esta hoja es asimétrica a propósito:
- **Se apaga** lo que molesta, confunde o no se ha visto nunca. Para eso no hace falta esperar.
- **Se gradúa** solo lo que se ha usado en el cierre sin volver a lo de siempre.
- **El resto se aplaza** hasta el horizonte que fija su propia métrica, y no se juzga por una cifra de n = 1.

## 2/11 · Diseño nuevo y Hoy nuevo

| Función | Métrica escrita | Cómo decidir |
| --- | --- | --- |
| Diseño nuevo (`tema-v2`) | Que lo uséis sin volver al de siempre | **Graduar** si en estas dos semanas no habéis vuelto a `?tema=clasico`. Graduar solo marca la decisión: retirar el código del tema clásico es un PR aparte y se consulta antes (CLAUDE.md: retirar una pantalla en uso). |
| Hoy nuevo (`hoy-v2`) | Tiempo hasta la primera acción | **No hay línea base.** WP-02 sigue esperando los 3 intentos cronometrados con saldos del día, así que la cifra no se puede comparar con nada. **Aplazar** y hacer la línea base (unos 3 minutos) antes de la siguiente revisión. Sin esos intentos, «más rápido» es una impresión. |

## 4/11 · Movimientos, Importar y Clasificar

El cierre del 1 al 3/11 es la prueba real de estas tres pantallas.

| Función | Métrica escrita | Cómo decidir |
| --- | --- | --- |
| Movimientos nuevo | Extractos importados por semana | **Graduar** si el cierre se hizo desde aquí sin abrir «Ver el asistente de siempre». |
| Importar en tres pasos | Extractos importados por semana | **Graduar** si el extracto de octubre entró con ella y el cuadre «al céntimo» funcionó. Si hizo falta el asistente de siempre, **aplazar** y anotar por qué. |
| Clasificar por lotes | Gasto con partida ≥ 95 %, propuestas aceptadas tal cual, ≤ 4 s por grupo | Mirar en Ajustes el «gasto importado con partida (últimos 90 días)». **Graduar** si octubre quedó entero con partida desde la bandeja. Si quedó por debajo del 95 %, **aplazar**: aceptar en bloque (XDA-05 PR-2) sigue esperando a tener 20 grupos de confianza alta. |

Ese mismo día, si octubre está firmado, se publica «Dinero parado» (#571).

## 7/11 · Repaso semanal

| Función | Métrica escrita | Cómo decidir |
| --- | --- | --- |
| Repaso semanal | Minutos de mantenimiento a la semana (10 o menos) | Con **dos repasos hechos**, la cifra ya dice algo: **graduar** si la mediana es ≤ 10 min. Con uno o ninguno, la pregunta no es la cifra sino por qué no se hace. Si es porque no aporta, **apagar**; si es por falta de tiempo esas semanas, **aplazar**. |

## 12/11 · Las ocho del 26 al 29/10

Las siete con interruptor propio se encendieron el 29/10 (antes nacían apagadas). Su métrica habla de dos meses, así que el
día 12 solo se decide apagar, nunca graduar.

| Función | Apagar el 12/11 si… | Si no, |
| --- | --- | --- |
| Qué mueve cada día | estorba en Plan › Previsión o no se ha mirado nunca | aplazar hasta enero (dos meses) |
| Lo que la app te pide | no se ha abierto nunca | aplazar hasta enero |
| Ver con datos de ejemplo | confunde lo inventado con lo vuestro | aplazar hasta enero |
| El arreglo más barato | ha avisado de un descubierto que no lo era | queda dormida si no salta (no es un fallo) |
| Antes de decidir | ha bloqueado una decisión sin motivo | queda como etiqueta si nunca salta |
| Aportado frente a valor | la cifra no se entiende tras valorar la cartera en el cierre | aplazar hasta la próxima valoración |
| Siguiente paso de la cartera | propone algo que no tiene sentido para vosotros | aplazar: sin la política firmada (H-12), sus reglas aún no mandan |
| Guía del cierre (sin interruptor) | nadie la abrió en el cierre | **graduar** si se usó para cerrar octubre |

## Lo que no es de Funciones en prueba, pero se lee tras firmar

- **Acierto de la caja a fin de mes (WP-12):** con el primer cierre dirá «datos insuficientes (1 de 3)». Es lo esperado: no da cifra hasta el tercer cierre comparable, en enero.
- **El cierre en sí:** cuántos minutos llevó y qué bloqueó. Si algo bloqueó, conviene apuntarlo, porque es la entrada más valiosa para la siguiente sesión. El primer arreglo del 29/10 salió de una sola captura del hogar, y el ensayo que vino detrás encontró tres más.
- **Reales con efectivo (29/10):** que las partidas con algo pagado fuera del banco marquen «Banco X € + Y € anotado aparte» con lo esperado.

## Resultado del cierre de octubre (anotado el 4/11)

- **Duración:** unos **45 minutos** (dato del hogar). Es la línea base del cierre: el de noviembre, con el cierre nuevo (RD-C3), se compara con ella. **Desde el 4/11 el cierre se mide solo** (medidor de utilidad: tiempo activo en Cierre, Movimientos y Registrar, sin las pausas de más de 3 min; grupos sin partida al empezar y lo que queda en «Por clasificar» al firmar). Se ve en «Lo que guarda la firma» y en Ajustes › Uso de la app.
- **Lo que más costó:** clasificar movimientos. Lo pendiente se dejó en «Por clasificar» desde Cierre.
- **Lo que bloqueó y se arregló ese mismo día:**
  - el saldo calculado de CaixaBank tomaba un saldo intermedio (#581);
  - Cierre pasó solo a noviembre con octubre sin firmar, y «Firmar» no decía qué faltaba (#582).
- **Dónde se cierra:** en el ordenador.
- **XGO-01:** la excepción de +2 titulares en Cierre (las tres comprobaciones a la vez) se mantiene hasta la revisión del cierre nuevo el **18/11**. Ese día se decide con lo medido si se queda o si a cambio se pliega el ritual anual.

## Decisiones del hogar sobre las revisiones del 2/11 y el 4/11 (anotadas el 4/11)

Tomadas con la hoja de decisiones de la sesión 399. Los botones de «Graduar» y «Dos semanas más» los pulsa el hogar en
Ajustes › Funciones en prueba: el estado de cada función vive en su navegador, no en el repositorio.

| Función | Decisión | Por qué |
| --- | --- | --- |
| Diseño nuevo | **Graduar** | Octubre se cerró entero con él, sin volver a `?tema=clasico`. Retirar el tema clásico es un PR aparte y se consulta antes. |
| Hoy nuevo | **Dos semanas más** (16/11) | Sin línea base fiable: los tres días del medidor anteriores al primer cambio (22-24/10) son ruido con un solo usuario. Ningún cambio de Hoy la semana del 8/11, para medir el del 1/11 en una semana normal. |
| Movimientos nuevo | **Graduar** | El cierre se hizo desde aquí. |
| Importar en tres pasos | **Graduar** | El extracto real de octubre entró completo y cuadró al céntimo (tras #574 y #576), sin el asistente de siempre. |
| Clasificar por lotes | **Dos semanas más** (18/11) | Octubre se firmó con movimientos en «Por clasificar»: el gasto con partida queda por debajo del 95 %, por el atasco de 13 meses de historial. Se juzga con el cierre de noviembre, ya con las reglas que no dependen del mes. Ese día se decide también la puerta de «aceptar en bloque» (H12). |


## Del 14 al 20/11 · Plan, Hoy, Clasificar, Cierre, Dinero parado y Previsión (hoja del 13/11)

Preparada por Claude el 13/11, con el mismo criterio asimétrico de arriba: se escribe **antes** de ver los datos. Seis
revisiones y cinco decisiones caen en una semana. Lo medido se lee en Ajustes › Funciones en prueba (la línea «Medido:» de
cada fila) y en Ajustes › Uso de la app; vive en vuestro navegador, no en el repositorio.

**Dos fechas no se pueden cumplir como están escritas** (propuesta de Claude; se consulta):
- **Cierre nuevo (18/11).** Su métrica es «cierres firmados desde aquí» y desde el 4/11 no ha habido ningún cierre:
  el 18/11 daría 0 por construcción. Se propone moverla al **4/12**, tras el cierre de noviembre (1-3/12), y con ella
  **H10** (la excepción XGO-01 de Cierre), que hasta entonces se mantiene.
- **Clasificar por lotes y su puerta (H12), 18/11.** La decisión del 4/11 dice que se juzga «con el cierre de
  noviembre», que se hace del 1 al 3/12. Se propone el **4/12**, el día de la revisión de salida de la oleada.

| Fecha | Función | Métrica escrita | Cómo decidir |
| --- | --- | --- | --- |
| 14/11 | Plan › Mes nuevo (`plan-v2`) | Previstos guardados desde aquí sin volver a «la tabla de siempre» | **Graduar** si en estas dos semanas habéis cambiado algún previsto desde la vista nueva y no habéis necesitado la tabla de siempre. Si no habéis tocado ningún previsto, no hay nada que juzgar: **aplazar** al plan de diciembre. Si para algo hizo falta la tabla, **aplazar** y anotar para qué. |
| 16/11 | Hoy nuevo (`hoy-v2`) | Tiempo hasta la primera acción | **No aplazarla otra vez sin medir.** La línea base (WP-02, tres intentos cronometrados con saldos del día, unos 3 minutos) está pendiente desde el 16/10. Además, Hoy cambió el 9/11 (punto de confianza) y el 13/11 (FX-03), así que la semana no es limpia. Dos salidas: **(a)** hacer los tres intentos ese día y **graduar** si la mediana es ≤ 15 s; **(b)** cambiar la métrica por el uso (abrir Hoy sin pulsar «Ver todo el detalle») y **graduar** con ella. Recomendación: (a) si hay 3 minutos; si no, (b). Un tercer aplazamiento sin medir es lo único que no conviene. |
| 18/11 → 4/12 | Clasificar por lotes (`clasificar-v2`) y H12 | Gasto con partida ≥ 95 %, tal cual, ≤ 4 s por grupo | **El 18/11, solo mirar** el contador de la puerta en Ajustes › Uso de la app: grupos de confianza alta medidos y % aceptado tal cual. El **4/12**, con noviembre cerrado: **graduar** si noviembre queda entero con partida desde la bandeja. Para H12, si a esa fecha hay menos de 10 grupos de confianza alta medidos, la puerta de 20 tardará meses con un solo hogar: entonces se decide bajarla o retirar la propuesta, no esperar más. |
| 18/11 → 4/12 | Cierre nuevo (`cierre-v2`) y H10 | Cierres firmados desde aquí sin abrir «el cierre paso a paso» | Sin cierre, no hay dato. El **4/12**: **graduar** si noviembre se firmó desde el cierre nuevo sin volver al paso a paso. Comparar su duración con los 45 minutos de octubre (lo mide solo, «Lo que guarda la firma»). H10, el mismo día: si las tres comprobaciones a la vez ayudaron, la excepción se queda y se pliega a cambio el ritual anual; si no, se vuelve al paso a paso. |
| 18/11 | Dinero parado (`dinero-parado`) | Veces que se lleva a la escalera o se compara (dos meses) | Como las del 12/11: el 18/11 solo se **apaga** si molesta o confunde. Si no, **aplazar** a enero. |
| 20/11 | Previsión nueva (`prevision-v2`) | Días con Previsión vista a la semana (2 o más) sin volver a «Ver todo el detalle» | **Graduar** si las dos semanas llegan a 2 días o más y no habéis vuelto a «Ver todo el detalle». Si no llega, **aplazar** al 4/12, no apagar: la pantalla cambió mucho el 13/11 (#607: rango probable, Euribor, «Hasta 2036», cascada) y lo de antes medía otra cosa. Es también la métrica M-PREV-USO de la oleada. |

**Si la revisión del 12/11 (las ocho del 26 al 29/10) no se hizo,** sigue valiendo su tabla de arriba: ese día solo se
decidía apagar.

### Decisiones del backlog con fecha 18/11 (`BACKLOG_NOVIEMBRE_OLEADA_1.md` §7)

| # | Pregunta | Recomendación de Claude |
| --- | --- | --- |
| D-N2 | Horizontes de Previsión: 3 m · 12 m · 24 m · Hasta 2036 | **Confirmar.** Están aplicados desde el 6/11 y la tabla de siempre conserva los suyos. Solo cambiaría si habéis echado de menos los 48 meses. |
| D-N5 | Escenarios en la previsión, solo de lectura; aplicar, en Escenarios | **Confirmar.** Es como está construido (FX-20, FX-21, FX-22): «Guardar como escenario» no aplica nada. |
| D-N7 | Tope blando de 3 funciones nuevas en prueba a la vez | **Sí, aunque el 26/10 se levantó el límite de paquetes.** Este tope es otra cosa: cuántas cosas hay que revisar a la vez. Esta semana caen seis revisiones juntas, y con un solo hogar eso diluye la atención de cada una. |

**Cómo hacerlo en 10 minutos:** abrid Ajustes › Funciones en prueba, copiad en el chat la línea «Medido:» de cada fila de
esta tabla y decid «sí» o lo que cambiéis. Claude anota las decisiones aquí, en el backlog y en `PROJECT_STATE.md`. Los
botones «Graduar» y «Dos semanas más» los pulsáis vosotros: el estado vive en vuestro navegador.

### Lectura del medidor de noviembre (capturas del hogar del 13/11)

Medido en el dispositivo de las capturas, del 1 al 13/11. **El medidor cuenta por navegador:** si usáis también el
iPhone, lo de allí no está aquí.

| Función | Medido | Lectura de Claude |
| --- | --- | --- |
| Diseño nuevo | 7 días, 0 vueltas al de siempre | Graduado el 4/11; se confirma. |
| Hoy nuevo | 7 días, 1 acción (14 %), 473,3 s hasta la primera acción (mediana de 2), 1 vez «Ver todo el detalle» | **La métrica de tiempo no sirve para Hoy:** Hoy se lee, casi nunca se actúa en él, y 473 s solo dicen cuánto tardasteis en ir a otra cosa. Se ve a diario y casi nunca hace falta el detalle. **Recomendación para el 16/11: graduar por uso (salida b) y retirar la métrica de tiempo.** |
| Movimientos nuevo | 7 días, 21 acciones (43 %), 1 vez «Ver todo el detalle» | Es la pantalla de trabajo; graduada el 4/11. |
| Importar en tres pasos | 1 día, 2 extractos, 0 veces al asistente | Funciona, pero en noviembre solo ha entrado un día de extractos. |
| Clasificar por lotes | 1 día, 7 reglas, 2 saltados, **0 % tal cual (0 de 2)**, **5 grupos sin propuesta**, 15,5 s por grupo (objetivo 4 s), **gasto con partida 71 %** (objetivo 95 %), 0 grupos de confianza alta | El problema no es aceptar en bloque, sino las propuestas: 5 de 7 grupos sin propuesta y las 2 que había, corregidas. Con 0 grupos de confianza alta, la puerta de 20 (H12) no se abrirá. **Recomendación:** decidir H12 ya y **retirar XDA-05 PR-2** (aceptar en bloque); si hay que mejorar algo, que sea la cobertura de las propuestas. Con n = 7 es una señal, no una prueba. Y el 71 %: el cierre de noviembre volverá a acabar en «Por clasificar» si no se clasifica antes. |
| Repaso semanal | Aún sin usar en noviembre | **Es el hallazgo más importante junto con el de Previsión.** El bucle de datos semanal (repaso, extracto, clasificar) no está ocurriendo: un solo día de importación y ningún repaso en 13 días. Todo lo de previsión depende de que entren datos. Pregunta para el hogar: ¿no aporta, no hay tiempo o no se ve? |
| Cierre nuevo | Aún sin usar | Esperado: no ha habido cierre. Al 4/12. |
| Plan nuevo | Aún sin usar (el medidor funciona: comprobado) | No habéis abierto Plan › Mes en noviembre en este dispositivo. Al plan de diciembre. |
| **Previsión nueva** | Aún sin usar | **Fallo del medidor, arreglado el 13/11:** al abrir la pestaña Previsión no se anotaba la visita (ver PROJECT_STATE 464). La cifra no vale. Medirá desde el despliegue del arreglo: el 20/11 habrá menos de una semana de datos, así que **su revisión también pasa al 4/12**. Las acciones sí se anotaban: si hubierais tocado un horizonte o una prueba, saldría; sin ninguna, lo probable es que tampoco se haya usado mucho. |
| Previsión (Herramientas, FX-62) | Aún sin usar | La de siempre; ahí el medidor sí funciona. |
| Escenarios | 2 días, 0 decisiones simuladas o guardadas | Se ha mirado, sin usarlo. |
| Lo que la app te pide | 4 días, 1 dato buscado (25 %) | Hace su trabajo, poco a poco. |
| Dinero parado | 1 día, 0 | Aplazar a enero (métrica de dos meses). |
| Guía del cierre | 1 día, 0 pasos | Esperado sin cierre. |
| Antes de decidir, El arreglo más barato, Ver con datos de ejemplo, Qué mueve cada día, Aportado frente a valor, Siguiente paso de la cartera | Aún sin usar | No molestan; se quedan hasta enero, como dice la tabla del 12/11. |

**Lectura de conjunto (de Claude, para cuestionar):** el uso está en Hoy y Movimientos, en consultar y registrar. La capa de
plan y previsión, que es donde se ha puesto casi todo el esfuerzo de la oleada, no tiene uso medido (en parte por el fallo
del medidor), y el bucle de datos que la alimenta está parado. Antes de construir más previsión conviene:
1. medir bien (el arreglo de hoy);
2. dar prioridad, estas tres semanas, a que entren los datos: repaso semanal, extractos y clasificar hasta el 95 % antes
   del cierre de noviembre;
3. aplicar el 4/12 la regla de parada de §8 del backlog con datos de verdad, y no seguir con la Oleada 2 por inercia.

### Decisiones del hogar sobre esta hoja (13/11)

El hogar respondió el mismo 13/11: «sí» a las propuestas. Además, la app se usa «a veces» en el iPhone (allí el medidor
cuenta aparte), y el repaso semanal «aporta».

| Función o decisión | Decisión | Qué hace el hogar en la app |
| --- | --- | --- |
| Hoy nuevo | **Graduar por uso.** La métrica pasa a ser los días con Hoy visto sin pulsar «Ver todo el detalle»; se retira la de tiempo hasta la primera acción | El 16/11, «Graduar» |
| Plan › Mes nuevo | **Aplazar** al plan de diciembre: en noviembre no se ha usado | El 14/11, «Dos semanas más» |
| Clasificar por lotes | Se revisa el **4/12**, con el cierre de noviembre | El 18/11, «Dos semanas más» |
| H12 · «aceptar en bloque» (XDA-05 PR-2) | **Se retira la propuesta.** El medidor deja de enseñar la puerta (se sigue calculando, por si se retoma) | Nada |
| Cierre nuevo y H10 | Se revisan el **4/12**, con el cierre de noviembre; la excepción XGO-01 se mantiene hasta entonces | El 18/11, «Dos semanas más» |
| Previsión nueva | Se revisa el **4/12**: el medidor la cuenta desde el arreglo del 13/11 | El 20/11, «Dos semanas más» |
| Dinero parado | **Aplazar** a enero | El 18/11, «Dos semanas más» |
| Repaso semanal | **Se queda: aporta.** Lo que falta es hacerlo cada semana | — |
| D-N2, D-N5, D-N7 | **Confirmadas** como recomienda la hoja | — |
| Prioridad hasta el 4/12 | **Que entren los datos:** repaso semanal, extractos y clasificar hasta el 95 % antes del cierre de noviembre. No se construye más previsión hasta la revisión de salida, donde se aplica la regla de parada del §8 del backlog | — |
