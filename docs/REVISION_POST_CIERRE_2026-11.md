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
