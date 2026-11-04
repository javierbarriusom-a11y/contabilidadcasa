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

