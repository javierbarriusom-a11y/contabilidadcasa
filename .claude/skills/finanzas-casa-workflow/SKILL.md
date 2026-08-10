---
name: finanzas-casa-workflow
description: Flujo de trabajo de sesión para el repositorio vivo contabilidadcasa. Al empezar a trabajar lee PROJECT_STATE.md y BACKLOG_STATUS.md, revisa brevemente el estado de Git y propone un plan antes de tocar código. Al cerrar la sesión valida con las pruebas del proyecto, actualiza PROJECT_STATE.md/BACKLOG_STATUS.md y prepara (sin ejecutar) el commit y el push, pidiendo siempre autorización explícita antes de mandarlos. Usar cuando el usuario pida empezar sesión, retomar el trabajo, ver en qué se quedó, cerrar sesión, hacer commit, o similar, en el repositorio contabilidadcasa.
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
2. **Backlog**: lee `BACKLOG_STATUS.md`, en particular la tabla "Estado maestro de
   entregas" (sección 0) y localiza cualquier entrega marcada `Parcial` o `Pendiente`, y el
   apartado narrativo más reciente al final del fichero. Si existe, consulta también
   `BACKLOG_PRODUCT_EVOLUTION.md` para el detalle de entregas E10-E18 si la entrega activa
   cae en ese rango.
3. **Git, brevemente** (no exhaustivo, no ejecutivo — solo lectura):
   - `git status` (¿hay cambios sin commitear?)
   - `git branch --show-current` (¿en qué rama estamos?)
   - `git log --oneline -8` (¿qué se commiteó últimamente?)
   - Si hay una rama distinta de `main` con trabajo pendiente de publicar según
     `PROJECT_STATE.md`, señálalo explícitamente.
4. **Resumen para el usuario** (4-8 líneas, en español, sin relleno):
   - En qué quedó la última sesión.
   - Qué es lo siguiente según el backlog.
   - Estado de Git (limpio / cambios pendientes / rama y si hay algo sin publicar).
5. **Propuesta de plan**: antes de escribir o modificar ningún archivo de código o
   documentación, propone un plan breve (qué se va a abordar en esta sesión y en qué
   orden) y espera confirmación o ajuste del usuario. No empieces a implementar hasta que
   el usuario apruebe el plan o pida explícitamente saltarse este paso.

No ejecutes comandos que modifiquen el repositorio (nada de `git add`, `commit`, `push`,
ni edición de archivos) durante el modo Inicio.

## Modo Cierre

Objetivo: dejar el repositorio en un estado validado y documentado, y preparar el commit
sin enviarlo todavía.

1. **Validar**: ejecuta `npm run verify` (incluye pruebas unitarias, accesibilidad,
   rendimiento, build del sitio, privacidad y smoke test). Si por el alcance de los
   cambios basta con una validación más rápida, como mínimo ejecuta `npm test`, y dilo
   explícitamente. Informa el resultado real (pass/fail y cifras, p. ej. "403/403
   pruebas") — nunca lo des por bueno sin haberlo ejecutado.
   - Si algo falla, no continúes con el resto de los pasos: informa del fallo al usuario
     y ofrece corregirlo primero.
2. **Actualizar el estado del proyecto** (solo si la validación pasó):
   - Añade una nueva entrada al principio de `PROJECT_STATE.md`, con el mismo formato que
     las entradas existentes: encabezado `## Cierre de sesión — <fecha en español>:
     <resumen corto>`, seguido de una lista con lo que se hizo, decisiones tomadas a
     petición del usuario, resultado de las pruebas (cifras exactas) y qué queda
     pendiente de publicar (rama/PR) si aplica.
   - Si el estado de alguna entrega cambió (por ejemplo de `Parcial` a `Verificado`),
     actualiza también la tabla y/o el texto correspondiente en `BACKLOG_STATUS.md`.
   - No inventes cifras ni resultados: usa exactamente los que arrojó la validación del
     paso 1.
3. **Preparar el commit (sin ejecutarlo)**:
   - Muestra un resumen de `git status` y de los cambios relevantes.
   - Redacta un mensaje de commit propuesto, coherente con el estilo del historial del
     repositorio (prefijos como `feat:`, `fix:`, `docs:` vistos en `git log`).
   - Indica explícitamente a qué rama se haría push (la rama de trabajo en curso, nunca
     `main` directamente salvo que el usuario lo pida y sea la práctica habitual del
     repositorio).
4. **Pedir autorización explícita**: pregunta directamente, por ejemplo:
   "¿Confirmas que haga commit y push de estos cambios a `<rama>`?". Solo tras un "sí"
   explícito del usuario en este turno ejecutas `git add`, `git commit` y
   `git push -u origin <rama>`. Una autorización dada en una sesión anterior no cuenta
   para esta; pídela de nuevo cada vez.
   - Si el usuario no confirma, deja los cambios preparados en el árbol de trabajo (o
     comiteados localmente si así lo pidió) sin hacer push, y dilo con claridad.
