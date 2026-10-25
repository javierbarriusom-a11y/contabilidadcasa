# XDA-02 · Buzón de extractos desde la hoja Compartir — diseño, seguridad y despliegue

Paquete de la séptima auditoría (`docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md`, XDA-02). Decisión del hogar del
**25/10/2026**: «adelante con el paso 0 y el PR-1, pero no aparcamos el buzón».

| Pieza | Qué | Estado |
|---|---|---|
| Paso 0 | El hogar exporta octubre desde la app de cada banco en el iPhone, lo importa y dice qué formatos da cada app (Excel, CSV, PDF). Dentro de H-22 | Pendiente del hogar (antes del 31/10) |
| PR-1 | «Importar en un toque»: el botón abre ya el selector de archivos; el medidor guarda los segundos del toque al importado | Hecho (25/10) |
| PR-2 | El buzón: Atajo → Edge Function → bucket privado → la app lo importa y lo borra | **Construido y probado sin desplegar**; el despliegue lo hace el hogar (§6) |

## 1. Por qué así (y qué se descartó)

- **En el iPhone no se puede compartir un fichero a una web instalada.** La API que lo permite (Web Share Target) solo
  existe en Chrome para Android; en Safari es una petición abierta desde 2019. Por eso hace falta un Atajo de iOS.
- **El Atajo no puede abrir la app de la pantalla de inicio con el fichero dentro.** Abre Safari, que guarda sus datos
  aparte (lo mismo que se vio en WP-25). Por eso el fichero va a un buzón en la nube del hogar y la app lo recoge al abrirse.
- **El Atajo no puede cifrar.** El fichero llega en claro a la función y se guarda en un bucket privado (cifrado en reposo
  por Supabase, no de extremo a extremo). Es casi lo mismo que ya sincroniza la app (movimientos con conceptos e
  importes), pero el fichero del banco puede llevar además IBAN y titular: por eso se borra al importarlo y, como tarde,
  a los 7 días.
- **Se descartó** el portapapeles en base64 (Atajo que copia el fichero y la app lo pega): ahorra lo mismo que el PR-1
  sin servidor y exige pegar a mano. Y abrir la app con el fichero en la dirección (`#importar=…`): abre Safari, no la app.

## 2. Recorrido

1. **Una vez:** Importar › «Preparar el Atajo». La app crea una clave de 32 bytes aleatorios, guarda en la nube **solo su
   hash SHA-256** y una caducidad de 89 días, y enseña una vez la dirección y la clave con los pasos para crear el Atajo
   «Enviar a Finanzas Casa» (hoja Compartir, archivos; «Obtener contenido de la URL» con POST, cabeceras `x-inbox-token`
   y `x-file-name` y el archivo como cuerpo).
2. **Cada vez:** en la app del banco, Compartir › «Enviar a Finanzas Casa». La función comprueba la clave, el tamaño
   (≤ 2 MB) y el tipo **por los primeros bytes** (CSV o texto, Excel, PDF), y guarda el fichero en
   `finance-statement-inbox/<usuario>/<id>.<ext>`.
3. **Al abrir la app** (con la sesión iniciada): Movimientos e Importar enseñan «En el buzón · N extractos». «Importar»
   descarga el fichero y lo pasa al asistente de siempre: la misma revisión (cuadre, duplicados, cuenta) y la misma
   confirmación. **Nada entra al libro sin confirmarlo.** Importado, sale del buzón (se marca, se borra el fichero y la
   fila). «Borrar» lo descarta. Un PDF se ve, pero solo se puede borrar hasta que exista XDA-03.

## 3. Piezas

| Fichero | Qué hace |
|---|---|
| `statement-inbox.js` | Toda la lógica del servidor, en CommonJS y sin Supabase: valida, limita, decide el tipo y registra. Probada con `npm test` |
| `supabase/functions/statement-inbox/index.ts` | Cableado Deno: busca el token, cuenta, guarda en el bucket y apunta la fila con la clave de servicio |
| `supabase_schema.sql` (final) | Tablas `finance_statement_inbox_tokens` y `finance_statement_inbox`, RLS, permisos por columna y bucket privado |
| `buzon-extractos.js` | La app: preparar y desactivar el Atajo, enseñar lo que espera, importarlo por el asistente de siempre y borrarlo |
| `views/movimientos-v2.js`, `views/importar-v2.js` | Dónde se ve (solo con el tema v2, como el Repaso semanal) |

## 4. Requisitos de NTC-06 (`docs/NTC06_AMENAZAS.md` §4) y cómo se cumplen

| Req. | Cómo | Prueba |
|---|---|---|
| RQ-01 Secretos solo en el servidor | La clave de servicio vive en la función (la inyecta Supabase). El token del Atajo se guarda como hash SHA-256; su valor solo lo ve el hogar una vez y no se guarda en el navegador | `xda02-buzon-servidor` (hash), `xda02-buzon-app` (sin almacenamiento local), `ntc6-conexiones-externas` |
| RQ-02 Cerrada por defecto | Sin token válido, 401 igual para «no existe», «revocado» y «caducado»; solo POST; ≤ 2 MB (también por `content-length`); tipo por firma; 20 envíos al día por token; 20 pendientes por usuario; errores sin detalle; sin CORS (no la llama un navegador) | `xda02-buzon-servidor` |
| RQ-03 RLS | El dueño lee lo suyo; **no puede dar de alta en el buzón** (sin `insert`); solo puede marcar `imported_at`, borrar y revocar su token (`grant update (revoked_at)`). Al bucket solo sube la función. **Falta la prueba manual con dos cuentas** (§6, paso 5) | `xda02-buzon-app` (esquema) |
| RQ-04 Registros sin datos personales | El registro lleva petición, usuario, resultado, estado y duración; ni token, ni nombre del fichero, ni contenido | `xda02-buzon-servidor` |
| RQ-05 Consentimiento con caducidad | Equivalente: el token caduca a los 89 días (la base de datos no admite más de 90), se ve «caduca el …» y «último envío …», y se desactiva desde Importar | `xda02-buzon-app`, esquema |
| RQ-06 Datos mínimos | Solo recibe ficheros; no lee al banco ni inicia nada. El fichero se borra al importarlo o a los 7 días | Esquema (`expires_at ≤ received_at + 7 días`), función (`purgeExpired`) |
| RQ-07 Móvil perdido | Añadido a NTC-06 §5: desactivar el Atajo desde la app en otro dispositivo (o borrar la fila del token en el panel de Supabase) | Documento |
| RQ-08 Interruptor | `FINANCE_STATEMENT_INBOX_ENABLED=true`; sin él, 503 y nada se guarda. La app sigue igual con el selector de archivos | `xda02-buzon-servidor` |
| RQ-09 Nada directo al libro | El fichero pasa por el asistente de siempre (revisión y confirmación) | `xda02-buzon-app`, e2e |
| RQ-10 Servidor nuevo = fila en §2 | No hay servidor nuevo: es el mismo proyecto de Supabase. La fila de §2 se amplía | `ntc6-conexiones-externas` |
| RQ-11 Altas cerradas | **Del hogar**, antes de desplegar: comprobar en el panel de Supabase que las altas de usuarios siguen cerradas (§6, paso 1) | Manual |
| RQ-12 CSP | No aplica (no se enlaza un banco) | — |
| RQ-13 Código de terceros con huella | La app no carga nada nuevo; la función usa `npm:@supabase/supabase-js@2.117.2`, la misma versión que `vendor/` | Revisión |

**Riesgos que quedan, dichos:** quien tenga el iPhone desbloqueado puede leer la clave dentro del Atajo y **solo** dejar
ficheros en el buzón (que el hogar verá y podrá borrar; nada se importa sin confirmar). Un fichero malicioso entra al
mismo lector que un fichero elegido a mano (amenaza T7 de NTC-06, ya cubierta por el lector). La función no se ha podido
ejecutar en un Deno real en la sesión en que se escribió (igual que `assistant-query`): de ahí las pruebas con curl de §6.

## 5. Medida y retirada

- **Métrica:** extractos por semana que llegan por el buzón y segundos del toque al importado (el PR-1 da la línea base
  del selector de archivos). La de la auditoría (≥ 2 extractos por semana, M-FRESC ≥ 90 %) se lee con uso real.
- **Se retira si** en seis semanas se importan menos extractos que con el selector de archivos solo.

## 6. Despliegue (lo hace el hogar, ≈ 20 min, con su cuenta de Supabase)

Desde este repositorio en un ordenador con la CLI de Supabase (`supabase login` y `supabase link --project-ref <ref>`):

1. **Altas cerradas (RQ-11):** Supabase › Authentication › Sign In / Providers: «Allow new users to sign up» apagado.
2. **Esquema:** pegar en el editor SQL el bloque final de `supabase_schema.sql` (desde «XDA-02 · PR-2») y ejecutarlo. Es
   idempotente: se puede repetir.
3. **Función:** `supabase functions deploy statement-inbox --no-verify-jwt` y
   `supabase secrets set FINANCE_STATEMENT_INBOX_ENABLED=true`.
4. **Probar con curl** (con una clave creada en la app, Importar › «Preparar el Atajo»):
   ```sh
   URL=https://<ref>.supabase.co/functions/v1/statement-inbox
   printf 'Fecha;Concepto;Importe;Saldo\n01/10/2026;PRUEBA;1,00;1,00\n' > prueba.csv
   curl -s -X POST "$URL" -H "x-inbox-token: <clave>" -H "x-file-name: prueba.csv" --data-binary @prueba.csv   # 201
   curl -s -X POST "$URL" -H "x-inbox-token: $(printf 'A%.0s' $(seq 43))" --data-binary @prueba.csv            # 401
   head -c 3000000 /dev/zero | tr '\0' 'a' | curl -s -X POST "$URL" -H "x-inbox-token: <clave>" --data-binary @-  # 413
   printf 'MZ\x90\x00' | curl -s -X POST "$URL" -H "x-inbox-token: <clave>" --data-binary @-                     # 415
   ```
   La de 201 debe salir en Movimientos como «En el buzón · 1 extracto». Bórrala desde ahí.
5. **Dos cuentas (RQ-03):** con una segunda cuenta de prueba, comprobar que no ve el buzón de la primera (Movimientos sin
   «En el buzón») y que su clave no deja nada en el de la primera.
6. **El Atajo:** crearlo con los pasos que enseña la tarjeta y mandar un extracto real desde la app del banco.

Apagarlo: `supabase secrets set FINANCE_STATEMENT_INBOX_ENABLED=false` (o «Desactivar» en Importar, que revoca la clave).
