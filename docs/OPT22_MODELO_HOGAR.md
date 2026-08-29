# OPT-22 — El modelo Hogar/Javi/Tere: decisión documentada

Decisión explícita, para que ninguna mejora futura asuma por error algo que este modelo no es.

## La pregunta

«Vista familiar» (E-9) deja elegir entre tres contextos — Hogar, Javi, Tere — y recalcula ingresos,
gastos y neto filtrados por esa elección. ¿Es eso un filtro de lectura sobre un único dueño de
datos, o el principio de un sistema multiusuario real con cuentas y credenciales separadas por
persona?

## La respuesta: es un filtro de lectura sobre un único dueño de datos. A propósito.

Evidencia en el código, revisada para esta decisión (`ux-settings.js`, `aggregateFamilyContext`/
`inferOwner`/`familyWeight`):

- Hay **una sola sesión, una sola cuenta de Supabase, un solo conjunto de datos** para todo el
  hogar — `SUPABASE_SETUP.md` describe un único usuario que entra "con el mismo usuario" desde
  cualquier ordenador; no hay `javi@…`/`tere@…`. `supabase_schema.sql` sí tiene una columna
  `owner text not null default 'household'` (tabla `finance_accounts`) — pero es una **etiqueta
  descriptiva por fila**, no una frontera de acceso: cada política RLS del esquema filtra por
  `user_id = auth.uid()` (la única cuenta compartida), ninguna filtra ni protege por `owner`.
- «Javi» y «Tere» no son identidades con las que se inicia sesión: son una **etiqueta inferida por
  texto** (`inferOwner`) a partir de la etiqueta, el nombre, el concepto o el grupo de cada
  movimiento/partida — coincide "javi"/"javier" o "tere"/"teresa" en el texto, o si no hay
  coincidencia, cuenta como "household" (compartido).
- El contexto elegido (`scenarioSettings.familyContext`) solo decide **cómo se pondera y se suma**
  lo que ya existe (`familyWeight`): en household todo cuenta entero; en javi/tere, lo etiquetado a
  esa persona cuenta entero, lo compartido cuenta la mitad en gastos y nada en ingresos, y lo
  etiquetado a la otra persona no cuenta. Ninguna de las tres vistas **escribe** nada distinto —
  ninguna oculta ni protege datos de la otra: cualquiera con acceso a la sesión ve las tres.

## Qué implica para el futuro

- **No construir** control de acceso, permisos o visibilidad por persona sobre este modelo — no
  hay nada que proteger entre Javi y Tere porque comparten la misma sesión por diseño.
- **No asumir** que "Javi" o "Tere" identifican de forma fiable y exhaustiva cada movimiento: es una
  inferencia de texto con un valor por defecto compartido, no un campo estructurado y obligatorio.
  Una mejora que necesite atribución exacta por persona necesita antes un campo explícito, no
  confiar en `inferOwner`.
- **Si en algún momento se quiere multiusuario real** (cuentas separadas, permisos, un dato oculto
  para el otro titular), es un cambio de arquitectura mayor —autenticación por persona, políticas
  RLS nuevas, un modelo de datos con propietario explícito— que no se construye extendiendo este
  filtro: se diseñaría aparte, desde cero, y esta decisión quedaría revisada explícitamente antes.

## Estado

Decisión tomada el 29 de agosto de 2026 (OPT-22, `BACKLOG_ULTIMATE_SEPTIEMBRE.md` bloque 2): sigue
siendo un filtro de lectura, a propósito. Sin cambio de código — es una decisión de modelo, no un
defecto que corregir.
