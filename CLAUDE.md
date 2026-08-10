# Instrucciones del proyecto

## Publicación: este es el repositorio vivo

Decisión del usuario del **10 de agosto de 2026**, que **invierte** la que estaba
vigente hasta ese día:

> «El proyecto vivo es contabilidadcasa. Finanzas-casa-def se queda congelado a
> partir de ahora.»

Todo el desarrollo y despliegue de este dashboard vive **únicamente** en este
repositorio (`javierbarriusom-a11y/contabilidadcasa`), publicado en
**`https://javierbarriusom-a11y.github.io/contabilidadcasa/`** vía
`.github/workflows/pages.yml` (despliegue automático en cada push a `main`).

El repositorio anterior, `javierbarriusom-a11y/finanzas-casa-def`
(`https://javierbarriusom-a11y.github.io/finanzas-casa-def/`), **queda congelado**:
conserva todo el historial hasta E20-5 incluido, pero no recibe más cambios. Su
sitio sigue en pie como estaba el 10 de agosto de 2026.

Historia breve, para que nadie la reconstruya al revés: este repositorio nació el
9 de agosto de 2026 como foto fija de un momento dado (E19 completo + E20-0 días
1-4) y estuvo sin mantenimiento un día. El 10 de agosto se le volcó todo lo que le
faltaba (E20-1 a E20-5) y pasó a ser el repositorio vivo.

**Por defecto, y salvo instrucción explícita en contra en la conversación:**
- Todo cambio de código, commit y push va a este repositorio y a la rama de
  trabajo en curso — nunca a `finanzas-casa-def`.
- No sincronizar, replicar ni desplegar nada hacia `finanzas-casa-def`.
- No crear más copias/espejos en otras URLs de GitHub Pages sin que el
  usuario lo pida de nuevo explícitamente.
- Esta decisión no necesita repetirse en cada sesión: ya quedó tomada aquí.

## Publicar sin pedir permiso cada vez

Decisión del usuario del **10 de agosto de 2026**, que **anula el paso 4 del Modo
Cierre** de la skill `finanzas-casa-workflow` (el que exigía un «sí» explícito en
cada turno antes de `git add`/`commit`/`push`):

> «En adelante hazlos directamente en cada tarea si están listos para publicar.»

Confirmado después, ya explícitamente sobre la fusión: la autorización llega hasta
el final del recorrido, no solo hasta el push.

El ciclo completo, sin preguntar en ningún punto:

1. **Validar** (`npm run verify`, o como mínimo `npm test` diciéndolo).
2. **Actualizar `PROJECT_STATE.md`** —y `BACKLOG_STATUS.md` si cambia el estado de
   una entrega— con las cifras reales de esa validación, nunca inventadas.
3. **Commit y push** a la rama de trabajo en curso.
4. **Abrir el PR** (en borrador) y esperar a su CI.
5. **Fusionar a `main` en cuanto el CI esté en verde**, con lo que el sitio se
   despliega solo vía `.github/workflows/pages.yml`.

Los frenos que siguen puestos, y que no dependen de la prisa:

- **Si la validación local o el CI fallan, no se publica.** Se informa del fallo y
  se corrige antes; nunca se fusiona en rojo ni se fuerza una fusión.
- **Nunca push directo a `main`**: siempre rama + PR, aunque se fusione acto seguido.
- **Nunca hacia `finanzas-casa-def`** (ver la sección anterior).
- Un cambio que vaya más allá de lo pedido, borre datos del usuario o retire una
  pantalla en uso se consulta igualmente, por mucho que el CI esté verde.

Esta autorización tampoco necesita repetirse en cada sesión: ya quedó tomada aquí.
