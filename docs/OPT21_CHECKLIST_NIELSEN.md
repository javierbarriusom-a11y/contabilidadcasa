# OPT-21 — Checklist mensual de heurísticos de Nielsen

Gobernanza continua (`BACKLOG_OPTIMIZACION.md`, Fase 4), sin fecha de cierre: una vez al mes,
revisar **Hoy**, **Registrar** y **Plan** —las tres pantallas de uso diario— contra los diez
heurísticos de usabilidad de Jakob Nielsen, y documentar los hallazgos como una entrada más del
backlog. Mismo hábito de documentación que ya se aplica al resto del proyecto (`PROJECT_STATE.md`,
un cierre por sesión).

**Por qué existe**: OPT-8 (alerta de gasto hormiga) y sesiones anteriores encontraron deriva de UX
acumulada sin que nadie la buscara a propósito — un hábito mensual la detecta antes de que se
acumule otra vez, en vez de esperar a que alguien tropiece con ella.

## Cómo se revisa

Para cada pantalla (Hoy, Registrar, Plan) y cada heurístico de la tabla siguiente: abrir la pantalla
con datos reales (o el dataset sintético de `npm run test:e2e`), comparar contra la pregunta guía, y
anotar solo lo que sea un hallazgo real y concreto —una captura, un elemento, una frase—, no una
impresión genérica. Sin hallazgo, la casilla queda en blanco; no hace falta rellenar "todo bien".

| # | Heurístico (Nielsen) | Pregunta guía |
|---|---|---|
| 1 | Visibilidad del estado del sistema | ¿Queda claro en todo momento qué está pasando (guardando, calculando, guardado)? |
| 2 | Correspondencia entre el sistema y el mundo real | ¿El lenguaje y el orden de la información son los que usaría la persona, no jerga interna? |
| 3 | Control y libertad del usuario | ¿Hay una salida clara de cada acción (deshacer, cancelar, volver) sin perder datos? |
| 4 | Consistencia y estándares | ¿El mismo concepto se llama y se ve igual en las tres pantallas? |
| 5 | Prevención de errores | ¿Se puede evitar un error obvio antes de cometerlo (validación, confirmación), no solo avisar después? |
| 6 | Reconocer antes que recordar | ¿La persona necesita memorizar algo de otra pantalla, o todo lo que necesita está a la vista aquí? |
| 7 | Flexibilidad y eficiencia de uso | ¿Hay un camino más rápido para quien ya sabe usar la pantalla, sin penalizar a quien no? |
| 8 | Diseño estético y minimalista | ¿Hay información que compite por atención sin aportar a la decisión de esta pantalla? |
| 9 | Ayudar a reconocer y recuperarse de errores | ¿Un mensaje de error dice qué pasó y qué hacer, en lenguaje llano? |
| 10 | Ayuda y documentación | ¿La ayuda contextual (A12-4) cubre lo que de verdad genera dudas, no solo lo obvio? |

## Registro de revisiones

Cada revisión se añade aquí, con fecha, y sus hallazgos reales se llevan como tareas nuevas al
backlog vigente (`BACKLOG_ULTIMATE_SEPTIEMBRE.md` u otro), citando esta tabla en su Nota.

### 29 de agosto de 2026 — arranque del hábito (OPT-21)

Sesión de construcción de la checklist, no de revisión: esta tabla y el proceso quedan listos hoy.
La primera revisión real de Hoy/Registrar/Plan queda pendiente para la próxima vez que se abra esta
sesión con cadencia mensual — no se ha fabricado ningún hallazgo para no inventar deriva de UX que
no se ha comprobado de verdad contra la pantalla real.
