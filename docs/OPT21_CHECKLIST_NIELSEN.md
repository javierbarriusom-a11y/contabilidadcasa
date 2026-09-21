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

### 16 de septiembre de 2026 — primera revisión real (`T1`, sesión 197)

Primera revisión real contra las tres pantallas (`renderHomeDashboard()`/`#home`,
`renderRegistrar()`/`#registrar`, `renderPlan()`/`#plan`), con evidencia `file:line` concreta antes
de anotar nada — mismo criterio que exige esta checklist. Siete hallazgos reales; dos se corrigieron
en la misma sesión por ser triviales y sin decisión de producto de por medio, cinco quedan como
tareas nuevas en `BACKLOG_CONTABILIDADCASA_2_0.md` §4 (`T15`-`T19`).

| # Heurístico | Hallazgo | Estado |
|---|---|---|
| 1. Visibilidad del estado | Plan nunca confirma «guardado»: a diferencia de Registrar («guardado hace poco, a las HH:MM»), la barra de impacto de Plan solo desaparece (`hidden`) al no haber cambios pendientes, sin distinguir «nada que guardar» de «ya guardado». | ✅ Corregido — `T15` (sesión 199, `BACKLOG_CONTABILIDADCASA_2_0.md` §4) |
| 2. Correspondencia con el mundo real | `index.html:709`: el control de Plan mostraba literalmente «Sobres · Fase 6» — un identificador de fase de backlog interno filtrado a la UI. | ✅ Corregido en esta sesión (ahora dice solo «Sobres») |
| 4. Consistencia | Tres vocabularios distintos para «previsto vs. real» en las tres pantallas de uso diario: Registrar define «Previsto/Real/Usado»; Plan usa «Ingreso previsto/Comprometido/Asignado/Sin asignar» sin conectarlo; Home usa «Gasto previsto/Gasto real a hoy/Desviación». | ✅ Corregido — `T16` (sesión 208, alcance acotado tras investigar: solo la tarjeta «El mes en una línea» de Hoy necesitaba el cambio; detalle en `BACKLOG_CONTABILIDADCASA_2_0.md` §4) |
| 6. Reconocer, no recordar | La pestaña Previsión de Plan no repite la cifra de reserva protegida que sí aparece en Home y Registrar — solo enlaza fuera (`index.html:747`). | ✅ Corregido — `T17` (sesión 199, `BACKLOG_CONTABILIDADCASA_2_0.md` §4) |
| 8. Diseño minimalista | El propio comentario de `index.html:307-311` declara «máximo 4 bloques en la zona principal, sin scroll en desktop» para Home; la implementación real tiene 9 artículos estáticos más 2 rejillas dinámicas (`homeBudgetGlance`, `homeKpis`) — no cumple su propia regla. | ✅ Verificado sin construir nada — `T18` (sesión 208): recuento real dio 3 artículos + 2 rejillas, exactamente los 4 bloques de la regla; detalle en `BACKLOG_CONTABILIDADCASA_2_0.md` §4. `BACKLOG_CONTABILIDADCASA_3_0.md` añade `FLU-1`: un test automático que fije esto como invariante hacia adelante |
| 9. Recuperación de errores | `app.js:28244`, dentro de `undoLastImportBatch()`: «No se pudo deshacer» mostraba el error crudo sin ninguna instrucción de qué hacer, rompiendo el patrón «qué pasó + qué hacer» que sigue el resto de Registrar. | ✅ Corregido en esta sesión (añade «Vuelve a intentarlo; si persiste, comprueba tu conexión y recarga la página.») |
| 10. Ayuda y documentación | «Guía de este flujo» existe en Home y Registrar (`index.html:288`, `476`) pero no en Plan — justo la pantalla con el vocabulario más distinto (hallazgo 4) y que no repite las cifras clave (hallazgo 6). | ✅ Corregido — `T19` (sesión 199, `BACKLOG_CONTABILIDADCASA_2_0.md` §4) |

Heurísticos 3 (control y libertad), 5 (prevención de errores) y 7 (flexibilidad) se revisaron sin
hallazgo real que anotar — deshacer/cancelar/descartar cubiertos con criterio, validación bloqueante
real antes de importar, y atajo global (Cmd/Ctrl+K) más importación en lote ya cubren lo esencial.

### 29 de agosto de 2026 — arranque del hábito (OPT-21)

Sesión de construcción de la checklist, no de revisión: esta tabla y el proceso quedan listos hoy.
La primera revisión real de Hoy/Registrar/Plan queda pendiente para la próxima vez que se abra esta
sesión con cadencia mensual — no se ha fabricado ningún hallazgo para no inventar deriva de UX que
no se ha comprobado de verdad contra la pantalla real.
