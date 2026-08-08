# A5 — Activación externa segura

## Estado de esta sesión

- A5-2 dispone de un benchmark versionado para casos anonimizados, puntuación de calidad, coste medio,
  p95 de latencia y selección estable. No fija un modelo sin ejecutar una evaluación real.
- A5-1 dispone de un backend privado Node, con `store: false`, salida JSON estructurada, payload mínimo,
  autenticación delegada, auditoría mínima y fallback local.
- A5-3 dispone de invitaciones con token opaco de un solo uso, hash de token, revisión optimista y
  revocación mediante el contrato de hogar existente.
- A5-4 dispone de suscripciones push cifradas en backend, revocación, silencios, deduplicación y mensajes
  genéricos sin cifras, bancos, cuentas ni deudas.

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

El backend se arranca con:

```bash
FINANCE_EXTERNAL_ENABLED=true \
OPENAI_API_KEY='...' \
OPENAI_MODEL='modelo-pinado-tras-evaluacion' \
FINANCE_AUTH_VERIFY_URL='https://backend-privado.example/auth/verify' \
npm run backend:start
```

La variable `FINANCE_AUTH_VERIFY_URL` es obligatoria para autorizar peticiones. Si falta, el backend
rechaza la petición; no se acepta una identidad enviada por el navegador. `OPENAI_API_KEY` solo se lee
en el proceso del backend y nunca forma parte de una respuesta o de un registro.

La aplicación conserva el análisis local cuando el backend está apagado, no hay consentimiento, expira la
sesión, falla OpenAI o la respuesta no supera el contrato de lectura. El endpoint `/health` no revela la
clave y responde sin caché.

## Pendiente de aceptación real

1. Ejecutar A5-2 contra un conjunto anonimizado aprobado y fijar el modelo con su resultado.
2. Conectar un verificador de sesión real y probar revocación, caída y límites.
3. Conectar los handlers persistentes de hogar y push a Supabase privado/RPC, sin conceder escrituras
   directas al navegador.
4. Repetir pruebas autenticadas con dos cuentas y comprobar que el modo local sigue funcionando con el
   backend detenido.

La aceptación de E10-0 debe preceder a la activación real de cualquier servicio.
