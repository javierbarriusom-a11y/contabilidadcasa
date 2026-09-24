---
name: finanzas-casa-workflow
description: Flujo de trabajo de sesión para el repositorio vivo contabilidadcasa. Al empezar a trabajar lee PROJECT_STATE.md y BACKLOG_STATUS.md, revisa brevemente el estado de Git y propone un plan antes de tocar código. Al cerrar la sesión valida con las pruebas del proyecto, actualiza PROJECT_STATE.md y el backlog vigente y publica sin pedir permiso (commit, push, PR en borrador y fusión a main con el CI en verde), tal como autoriza CLAUDE.md. Usar cuando el usuario pida empezar sesión, retomar el trabajo, ver en qué se quedó, cerrar sesión, hacer commit, o similar, en el repositorio contabilidadcasa.
argument-hint: [inicio|cierre]
disable-model-invocation: false
---

# Flujo de trabajo — contabilidadcasa (repositorio vivo)

Esta skill es específica del repositorio vivo `javierbarriusom-a11y/contabilidadcasa`. Antes
de aplicar nada de lo de abajo, confirma que el directorio de trabajo actual pertenece a
ese repositorio (por ejemplo comprobando que existen `PROJECT_STATE.md`, `BACKLOG_STATUS.md`
y `CLAUDE.md` en la raíz). Si no es así, avisa al usuario en vez de improvisar un flujo
distinto.

Respeta siempre lo indicado en `CLAUDE.md` del repositorio: todo el desarrollo, commits y
push van a este repositorio y a la rama de trabajo en curso — nunca al repositorio congelado
`finanzas-casa-def`, y no se crean nuevas copias/espejos sin petición explícita del usuario
en la conversación.

Decide el modo así:
- Si `$ARGUMENTS` contiene "inicio" o "cierre", usa ese modo directamente.
- Si no hay argumento, infiere el modo por el contexto de la conversación: si el usuario
  acaba de empezar a hablar de la app/proyecto o pide "por dónde íbamos", usa el modo
  **Inicio**. Si pide cerrar, terminar, guardar el progreso, o ya se han hecho cambios de
  código en esta conversación y parece que se quiere concluir, usa el modo **Cierre**.
- Si sigue sin estar claro, pregunta al usuario cuál de los dos modos quiere.

## Modo Inicio

Objetivo: arrancar la sesión con contexto real del proyecto, sin tocar ningún archivo.

1. **Estado del proyecto**: lee `PROJECT_STATE.md`, sobre todo la(s) sección(es) más
   recientes bajo "Cierre de sesión — ..." (están en orden cronológico descendente, las
   últimas entradas arriba). Extrae: qué se hizo en la última sesión, qué pruebas pasaron,
   y si quedó algo publicado o pendiente de publicar (rama, PR).
2. **Backlog**: el repositorio acumula varios documentos `BACKLOG*.md` de distintas
   generaciones — `BACKLOG_INDICE.md` (OPT-20) es el mapa que dice cuál es la fuente viva de
   cada uno. El backlog vigente es el que `BACKLOG_INDICE.md` marca como «🟢 Vigente» — hoy
   `BACKLOG_CONTABILIDADCASA_3_0.md`: para saber qué es lo siguiente, ve directo a su §6 («Plan
   priorizado único») y a la fila de la tarea en §1-§2 o, si es heredada, en
   `BACKLOG_CONTABILIDADCASA_2_0.md` (su §5 dice cuáles). Si el índice ya marca como vigente otro
   documento, manda el índice y esta línea está desfasada: dilo y corrígela. `BACKLOG_STATUS.md`,
   sección 0 («Estado maestro de entregas»), sigue siendo la tabla de estado de las entregas
   E1-E26. Si algo no cuadra entre documentos, `BACKLOG_INDICE.md` tiene la tabla completa de qué
   sustituye a qué.
3. **Git, brevemente** (no exhaustivo, no ejecutivo — solo lectura):
   - `git status` (¿hay cambios sin commitear?)
   - `git branch --show-current` (¿en qué rama estamos?)
   - `git log --oneline -8` (¿qué se commiteó últimamente?)
   - Si hay una rama distinta de `main` con trabajo pendiente de publicar según
     `PROJECT_STATE.md`, señálalo explícitamente.
4. **Revisión mensual de Nielsen (`OPT-21`/`PROC-2`)**: mira la fecha de la entrada más reciente
   de «Registro de revisiones» en `docs/OPT21_CHECKLIST_NIELSEN.md`. Si han pasado 30 días o más
   (o no hay ninguna revisión real), la revisión está **vencida**: dilo en el resumen e inclúyela
   en la propuesta de plan como una tarea más, para que el usuario decida si se hace en esta
   sesión. Si no está vencida, no hace falta mencionarla.
5. **Resumen para el usuario** (4-8 líneas, en español, sin relleno):
   - En qué quedó la última sesión.
   - Qué es lo siguiente según el backlog.
   - Estado de Git (limpio / cambios pendientes / rama y si hay algo sin publicar).
6. **Propuesta de plan**: antes de escribir o modificar ningún archivo de código o
   documentación, propone un plan breve (qué se va a abordar en esta sesión y en qué
   orden) y espera confirmación o ajuste del usuario. No empieces a implementar hasta que
   el usuario apruebe el plan o pida explícitamente saltarse este paso.

No ejecutes comandos que modifiquen el repositorio (nada de `git add`, `commit`, `push`,
ni edición de archivos) durante el modo Inicio.

## Modo Cierre

Objetivo: dejar el repositorio validado, documentado y publicado. Desde el 10 de agosto de 2026 la
publicación no pide permiso en cada turno: `CLAUDE.md` («Publicar sin pedir permiso cada vez») la
autoriza de principio a fin, hasta la fusión a `main`. Si esta skill y `CLAUDE.md` discrepan, manda
`CLAUDE.md`.

1. **Validar**: ejecuta `npm run verify` (incluye pruebas unitarias, accesibilidad,
   rendimiento, build del sitio, privacidad y smoke test). Si por el alcance de los
   cambios basta con una validación más rápida, como mínimo ejecuta `npm test`, y dilo
   explícitamente. Informa el resultado real (pass/fail y cifras, p. ej. "403/403
   pruebas") — nunca lo des por bueno sin haberlo ejecutado.
   - Si algo falla, no continúes con el resto de los pasos: informa del fallo al usuario
     y corrígelo primero.
2. **Actualizar el estado del proyecto** (solo si la validación pasó):
   - Añade una nueva entrada al principio de `PROJECT_STATE.md`, con el mismo formato que
     las entradas existentes: encabezado `## Cierre de sesión — <fecha en español>:
     <resumen corto>`, seguido de una lista con lo que se hizo, decisiones tomadas a
     petición del usuario, resultado de las pruebas (cifras exactas) y la rama/PR.
   - Si la revisión mensual de Nielsen está vencida (mismo criterio que el paso 4 del Modo
     Inicio: 30 días o más desde la última entrada de `docs/OPT21_CHECKLIST_NIELSEN.md`) y no se
     ha hecho en esta sesión, dilo en una línea de la entrada de `PROJECT_STATE.md` («Revisión
     mensual de Nielsen vencida desde <fecha>») para que la siguiente sesión la vea. Si se hizo,
     su registro va en `docs/OPT21_CHECKLIST_NIELSEN.md` y sus hallazgos al backlog vigente.
   - Marca la tarea en el backlog vigente (su fila y el plan priorizado) y, si el estado de alguna
     entrega E1-E26 cambió, actualiza también `BACKLOG_STATUS.md`.
   - No inventes cifras ni resultados: usa exactamente los que arrojó la validación del
     paso 1.
3. **Commit y push**: mensaje coherente con el estilo del historial (prefijos como `feat:`,
   `fix:`, `docs:` vistos en `git log`), a la rama de trabajo en curso con
   `git push -u origin <rama>`. Nunca push directo a `main` y nunca hacia `finanzas-casa-def`.
4. **PR y fusión, sin pedir permiso** (este paso sustituye al antiguo «pedir autorización
   explícita», anulado por `CLAUDE.md` el 10 de agosto de 2026):
   - Abre el PR en borrador contra `main` y espera a su CI.
   - Con el CI en verde, márcalo como listo y fusiónalo; el sitio se despliega solo vía
     `.github/workflows/pages.yml`. Después reinicia la rama de trabajo desde `origin/main`.
   - Frenos que siguen puestos: si la validación local o el CI fallan, no se publica —se
     informa y se corrige—; nunca se fusiona en rojo ni se fuerza una fusión. Un cambio que vaya
     más allá de lo pedido, borre datos del usuario o retire una pantalla en uso se consulta
     antes, por mucho que el CI esté verde.
