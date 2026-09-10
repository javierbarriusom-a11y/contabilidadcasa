# A5 — Activación externa segura

## Estado de esta sesión (actualizado en la sesión 164)

- A5-2 dispone de un benchmark versionado para casos anonimizados, puntuación de calidad, coste medio,
  p95 de latencia y selección estable. No fija un modelo sin ejecutar una evaluación real. Es
  agnóstico de proveedor (candidatos identificados por `id`/`model` opacos) — sirve igual para evaluar
  modelos de Anthropic que los de cualquier otro proveedor; no necesitó cambios en esta sesión.
- A5-1 dispone de un backend privado (`private-backend.js` + `backend/server.mjs`), con salida JSON
  estructurada forzada, payload mínimo, autenticación delegada, auditoría mínima y fallback local.
  **Sesión 164: la llamada al proveedor se movió de la Responses API de OpenAI a la API de Mensajes
  de Anthropic** (`https://api.anthropic.com/v1/messages`, herramienta única `strict:true` +
  `tool_choice` fijo en vez de `text.format.json_schema`) — el hogar ya tiene cuenta y facturación
  con Anthropic (esta misma sesión), evitando abrir un proveedor nuevo solo para esto. Variables:
  `ANTHROPIC_API_KEY` y `ANTHROPIC_MODEL` sustituyen a `OPENAI_API_KEY`/`OPENAI_MODEL`. Probado con
  `npm test` (`tests/private-backend.test.cjs`), incluido el caso de rechazo de los clasificadores de
  seguridad (`stop_reason: "refusal"`), que cae al fallback local igual que cualquier otro fallo.
- A5-3 dispone de invitaciones con token opaco de un solo uso, hash de token, revisión optimista y
  revocación mediante el contrato de hogar existente.
- A5-4 dispone de suscripciones push cifradas en backend, revocación, silencios, deduplicación y mensajes
  genéricos sin cifras, bancos, cuentas ni deudas. Su persistencia real (tabla `finance_push_subscriptions`,
  reservada al `service_role`) sigue sin conectar — no se tocó en la sesión 164: esa sesión priorizó
  A5-1 explícitamente, y expandirlo a A5-4 habría sido ir más allá de lo pedido.

## Activación

### E10-0 — Base de seguridad común

- Cada servicio (`assistant`, `household`, `notifications`, `banking` y `actions`) tiene un interruptor
  independiente. El interruptor global solo puede apagar todos; nunca puede encender un servicio sin
  su interruptor específico.
- La aplicación arranca en local. La falta de consentimiento, la revocación, la caída del verificador,
  un timeout, un proveedor no disponible o una respuesta inválida devuelven el control al fallback local.
- El backend limita el cuerpo de la petición y la longitud de la consulta, aplica timeout remoto y no
  registra payloads financieros, credenciales ni secretos.
- Las migraciones E10 son aditivas e idempotentes; la activación se puede deshacer apagando el servicio
  y restaurando una copia versionada. No se retira la bandeja manual ni se escribe automáticamente en
  el libro canónico.
- La puerta de aceptación exige comprobar cada servicio con la red y los servicios externos apagados,
  y repetir la prueba tras recuperar la red.

Variables opcionales por servicio:

```text
FINANCE_ASSISTANT_ENABLED=true
FINANCE_HOUSEHOLD_ENABLED=true
FINANCE_NOTIFICATIONS_ENABLED=true
FINANCE_BANKING_ENABLED=true
FINANCE_ACTIONS_ENABLED=true
FINANCE_REMOTE_TIMEOUT_MS=10000
```

### Dos formas de desplegar el backend (sesión 164)

**Recomendada: Supabase Edge Function** (`supabase/functions/assistant-query/index.ts`). Mismo patrón
que ya se eligió dos veces en este proyecto para el hogar (E9-1, A19-1): sin hosting nuevo que
contratar, sin servidor Node que mantener, secretos gestionados por el propio Supabase. Se despliega
con `supabase functions deploy assistant-query` y los secretos con `supabase secrets set
ANTHROPIC_API_KEY=... ANTHROPIC_MODEL=...` (no hace falta `SUPABASE_URL`/`SUPABASE_ANON_KEY`: Supabase
los inyecta solos en toda función desplegada). **Aviso**: este fichero no se ha podido ejecutar contra
un runtime Deno real en esta sesión (no había `deno` disponible) — la lógica que importa sí está
probada con `npm test`, pero el cableado Deno en sí solo se revisó a mano. Antes de confiar en él,
compruébalo con `supabase functions serve assistant-query` en local y una consulta real.

**Alternativa: `backend/server.mjs`** (servidor Node aparte, para quien prefiera autoalojarlo):

```bash
FINANCE_EXTERNAL_ENABLED=true \
ANTHROPIC_API_KEY='...' \
ANTHROPIC_MODEL='modelo-pinado-tras-evaluacion' \
SUPABASE_URL='https://txlpeozcnpfzscotxhzu.supabase.co' \
SUPABASE_ANON_KEY='...' \
npm run backend:start
```

**Verificador de sesión (sesión 164, resuelto para ambas formas de desplegar)**: `SUPABASE_URL` +
`SUPABASE_ANON_KEY` bastan — el backend verifica el token contra el propio Supabase Auth del hogar
(`supabase-session-verifier.js`, `GET /auth/v1/user`), sin necesidad de desplegar un tercer servicio.
`FINANCE_AUTH_VERIFY_URL` sigue aceptándose como override explícito si algún día conviniera un
verificador distinto; si no se da ninguna de las dos configuraciones, el backend rechaza toda
petición — nunca acepta una identidad enviada sin verificar por el navegador. `ANTHROPIC_API_KEY`
solo se lee en el proceso del backend/función y nunca forma parte de una respuesta o de un registro.

La aplicación conserva el análisis local cuando el backend está apagado, no hay consentimiento, expira la
sesión, falla el proveedor, los clasificadores de seguridad rechazan la consulta (`stop_reason:
"refusal"`), o la respuesta no supera el contrato de lectura. El endpoint `/health` no revela la
clave y responde sin caché.

## Pendiente de aceptación real

1. Ejecutar A5-2 contra un conjunto anonimizado aprobado (ahora con candidatos de Anthropic) y fijar
   el modelo con su resultado. **Pendiente real** — exige llamadas de verdad a la API con coste real;
   no se puede simular ni adivinar desde una sesión de desarrollo.
2. ~~Conectar un verificador de sesión real~~ — **hecho en la sesión 164** (`supabase-session-verifier.js`,
   contra el Supabase Auth ya en producción del hogar).
3. Conectar los handlers persistentes de hogar y push a Supabase privado/RPC, sin conceder escrituras
   directas al navegador. **El hogar ya está resuelto** desde la migración `20260904_e9_household_writes.sql`
   (sesión ~150): las escrituras van directas del navegador a funciones `security definer` de Postgres,
   sin pasar por ningún backend — `backend/server.mjs` nunca llegó a desplegarse y no hizo falta.
   **El push (A5-4) sigue sin conectar** — tabla `finance_push_subscriptions` reservada al
   `service_role`, fuera del alcance de la sesión 164 (que priorizó A5-1 explícitamente).
4. Repetir pruebas autenticadas con dos cuentas reales y comprobar que el modo local sigue funcionando
   con el backend/función detenidos. **Pendiente real** — exige una función desplegada de verdad
   (`supabase functions deploy`) y dos sesiones de usuario reales; ninguna sesión de desarrollo puede
   sustituir esa prueba.

La aceptación de E10-0 debe preceder a la activación real de cualquier servicio.
