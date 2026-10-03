# NTC-06 — Modelo de amenazas y requisitos antes de cualquier conexión externa (WP-05)

Fecha: 3 de octubre de 2026 (sesión 299). Paquete WP-05, junto al spike de conexión (`docs/ND13_SPIKE_CONEXION.md`).

Regla del plan: **ninguna conexión externa nueva sin pasar por este documento.** Afecta a:

- PSD2 (`O-6`);
- el Atajo de Apple Pay de nivel 2 (CAP-01);
- los avisos del banco (CAP-03);
- los indicadores oficiales (WP-13);
- cualquier otra.

La prueba `tests/ntc6-conexiones-externas.test.cjs` lo hace cumplir: si el código publicado nombra un servidor que
no está en la tabla de §2, el CI falla.

## 1. Qué se protege y de quién

**Activos**, por orden de daño si se pierden o se filtran:

1. el estado financiero completo: saldos, movimientos, deuda, previsión y planes;
2. las credenciales:
   - la sesión de Supabase, si se usa la sincronización;
   - en el futuro, la clave privada del agregador y el consentimiento bancario;
3. los documentos adjuntos (fotos de tickets, contratos);
4. las copias de seguridad exportadas.

**Contexto que cambia el análisis:**

- un solo usuario y un solo móvil (decisión del hogar del 3/10/2026);
- la app es local primero: los datos viven en el navegador del móvil;
- se publica en GitHub Pages, donde **no se pueden poner cabeceras HTTP propias**;
- el repositorio es público.

**Quién podría atacar, de más a menos probable:**

1. alguien con el móvil en la mano (pérdida, robo o un descuido desbloqueado);
2. código de terceros que se ejecuta dentro de la app (librerías, CDN);
3. un enlace o fichero manipulado que el hogar abre (copia de seguridad, extracto, enlace de captura);
4. un tercero con acceso legítimo que se ve comprometido (Supabase, Enable Banking, Apple);
5. alguien en internet contra las funciones de servidor, si se despliegan.

## 2. Superficie actual: a qué servidores habla la app

Inventario del código publicado el 3/10/2026, sin contar las librerías de `vendor/`, que se copian al repositorio y
se sirven desde el mismo origen.

| Servidor | Tipo | Para qué | Cuándo |
|---|---|---|---|
| `txlpeozcnpfzscotxhzu.supabase.co` | conexión | Sincronización opcional y función `assistant-query` (no desplegada) | Solo si el hogar inicia sesión |
| `cdn.jsdelivr.net` | conexión | Motor de lectura de tickets (Tesseract.js 5.1.1) | Solo al abrir la captura por cámara |
| `www.openstreetmap.org` | enlace | Ver en el mapa dónde se hizo un gasto | Solo si se pulsa |
| `www.boe.es` | enlace | Fuente de una norma fiscal | Solo si se pulsa |
| `sede.agenciatributaria.gob.es` | enlace | Texto de ejemplo en un campo | Nunca se visita sola |

- **Conexión**: la app descarga o envía algo.
- **Enlace**: solo navega si el hogar pulsa.

Todo lo demás es del mismo origen: `version.json`, las vistas en `views/`, `vendor/` y el service worker. **No hay
telemetría, analítica ni envío de errores a terceros**, y ningún código llama hoy a un banco o a un agregador.

## 3. Amenazas y estado actual

Severidad: **A** = alta, **M** = media, **B** = baja. Se mide en daño probable para este hogar, no en abstracto.

| # | Amenaza | Hoy | Sev. | Qué se hace |
|---|---|---|---|---|
| T1 | **Móvil perdido o robado, desbloqueado o con la app abierta** | La app no tiene bloqueo propio. Quien tenga el móvil desbloqueado ve todo. Con el móvil bloqueado protege el cifrado de iOS | **A** | Protección del sistema (§5, tareas del hogar). Un bloqueo propio con WebAuthn pasa a catálogo (P3): con un solo usuario en su propio móvil, el bloqueo de iOS da casi toda la protección |
| T2 | **Código de terceros dentro de la app** | El motor de tickets se cargaba desde jsDelivr **sin comprobar su huella**. Si el CDN servía otra cosa, podía leer todos los datos | **A** | **Corregido en este paquete.** Huella SRI `sha384` del fichero publicado en npm, con `crossOrigin` anónimo: si el fichero cambia, el navegador no lo ejecuta y la captura dice «no se pudo cargar el motor». Riesgo residual: el *worker* y los datos de idioma de Tesseract también vienen del CDN, pero corren en un *worker* sin acceso a los datos de la app ni al DOM |
| T3 | **Inyección de HTML o script (XSS)** | Sin CSP (no hay meta CSP ni se pueden poner cabeceras). Hay mucho `innerHTML`, casi siempre con `escapeHtml`. Un punto sin escapar en `debt-roadmap.html` (el título de la tarea, `renderKanban`); el dato sale del propio estado, que una copia de seguridad manipulada podría traer | M | **Requisito previo a PSD2** (RQ-12): CSP por `<meta>` que limite `script-src` y `connect-src` a los servidores de §2. Exige sacar los scripts y atributos `on…` en línea o fijarlos con hash. Escapar el título del kanban va en el mismo paquete |
| T4 | **Copias de seguridad en claro** | La copia completa (`finanzas-casa-copia-<fecha>.json`) y los CSV se exportan en claro. En iCloud Drive quedan protegidos por la cuenta de Apple | M | Tareas del hogar (§5). Cifrar la copia con la frase de los adjuntos (`p2-private-store.js`) pasa a catálogo (P3) |
| T5 | **Adjuntos sin cifrar en el móvil** | Las fotos y documentos están en IndexedDB en claro. **Solo se cifran al subirlos** (AES-GCM, frase de 12 caracteres o más) | B | Los cubre el cifrado de iOS con el móvil bloqueado. Sin acción |
| T6 | **Cerrar sesión no borra los datos del móvil** | `handleSyncLogout` cierra la sesión remota; los datos locales siguen | B | Es lo esperado en una app local primero, pero debe decirse. Borrar del móvil es otra acción: Ajustes › Datos |
| T7 | **Altas abiertas en Supabase** | Cualquiera puede crear una cuenta con el proyecto público. RLS impide ver datos ajenos, pero un extraño podría ocupar almacenamiento o, si se despliega `assistant-query`, **gastar la clave de Anthropic** (la función no limita peticiones) | M (A si se despliega la función) | **RQ-11:** desactivar las altas en el panel de Supabase antes de desplegar cualquier función. Hoy la función no está desplegada |
| T8 | **Funciones de servidor** (`assistant-query`) | Exigen un JWT de usuario (sin él, 403). **Sin CORS, sin límite de peticiones y sin límite de tamaño del cuerpo.** `/health` responde sin autenticación (solo indicadores, sin claves). No desplegada | M | RQ-02 antes de desplegarla o de crear otra |
| T9 | **Enlaces compartidos de solo lectura** | El token es de 256 bits y se compara por hash. La función que lo lee está abierta a anónimos y sin límite de intentos, pero adivinar 256 bits es inviable | B | Sin acción. (Hallazgo funcional, no de seguridad: la base de datos no admite el tipo `kids-summary` que la app puede enviar; va como tarea aparte) |
| T10 | **Invitaciones al hogar** | El correo del invitado se guarda como SHA-256 sin sal: quien lea la tabla podría adivinarlo probando correos | B | Sin acción mientras nadie más use la app (decisión del 3/10). Si se reactiva, usar HMAC con clave del servidor |
| T11 | **Enlace de captura manipulado** (WP-25 / CAP-01) | Aún no existe | M | RQ-09: el enlace **nunca guarda solo**; abre la hoja de confirmación y valida cada campo (WP-25) |
| T12 | **Agregador PSD2 comprometido o que cierra** | Aún no existe | M | RQ-05, RQ-06 y RQ-08: datos mínimos, consentimiento con caducidad, interruptor de apagado y vuelta a lo manual |

## 4. Requisitos para cualquier conexión externa nueva

Una conexión nueva (PSD2, el Atajo de nivel 2, un buzón de avisos, un índice oficial vía servidor) no se construye
hasta que su PR demuestra que cumple **todos** los que le aplican.

| Req. | Requisito | Cómo se comprueba |
|---|---|---|
| **RQ-01** | **Secretos solo en el servidor**: la clave privada del agregador, el JWT del proveedor y la referencia del consentimiento se guardan como secretos de la función o cifrados en la base de datos (`provider_reference_ciphertext`). Nunca en el repositorio, el navegador, el Atajo ni el chat | Prueba: sin `service_role`, claves privadas ni prefijos de clave en los ficheros publicados (`ntc6-…`) |
| **RQ-02** | **Funciones cerradas por defecto**: JWT de usuario obligatorio; el usuario solo opera sobre lo suyo; límite de peticiones por usuario; tamaño máximo del cuerpo; CORS solo para el origen de GitHub Pages; errores sin detalles internos | Pruebas unitarias de la función (patrón de `tests/private-backend.test.cjs`) |
| **RQ-03** | **RLS**: tablas nuevas de solo lectura para su dueño; escrituras solo desde la función. Probado con **dos cuentas** antes de desplegar (`E9_HOUSEHOLD.md`) | Prueba de esquema y prueba manual con dos cuentas |
| **RQ-04** | **Registros sin datos personales**: sin importes, IBAN, conceptos ni contrapartes; solo identificador de petición, usuario, resultado y duración | Revisión del PR y prueba del formato del registro |
| **RQ-05** | **Consentimiento visible y con caducidad**: `consent_expires_at` guardado; ficha «Conexión: caduca en N días» desde 14 días antes; al caducar, vuelta a lo manual **sin bloquear nada**; revocar desde la app y desde el banco o agregador; reconectar es un consentimiento nuevo y explícito (reglas de `E9_BANKING.md`) | Máquina de estados de `canonical-e9-banking.js` y pruebas |
| **RQ-06** | **Datos mínimos**: solo lectura, nunca iniciación de pagos; **primero solo saldos**; `rawStored: false`; IBAN enmascarado | Prueba de contrato del adaptador |
| **RQ-07** | **Procedimiento de móvil perdido** escrito y probado una vez (§5) | Lista de §5 hecha una vez por el hogar |
| **RQ-08** | **Interruptor de apagado**: `FINANCE_EXTERNAL_ENABLED=false` apaga toda conexión y la app sigue funcionando a mano | Prueba de la función con el interruptor apagado |
| **RQ-09** | **Nada entra directo al libro**: todo lo que llega de fuera va a la bandeja pendiente (`writesLedgerImmediately: false`) y se confirma | Pruebas de `canonical-e9-bank-import.js` y de WP-25 |
| **RQ-10** | **Servidor nuevo = fila nueva en §2**, con tipo, motivo y cuándo se usa | `tests/ntc6-conexiones-externas.test.cjs` |
| **RQ-11** | **Altas cerradas en Supabase** antes de desplegar una función con coste o con acceso a un tercero | Comprobación manual en el panel de Supabase, anotada en el PR |
| **RQ-12** | **CSP antes de enlazar un banco**: limitar `script-src` y `connect-src` a §2 (amenaza T3) | Prueba de que la meta CSP existe y coincide con §2 |
| **RQ-13** | **Código de terceros con huella**: todo script de otro origen lleva `integrity` (SRI) y `crossOrigin` | `tests/ntc6-conexiones-externas.test.cjs` |

### Para el Atajo de Apple Pay de nivel 2 (CAP-01) y los avisos por servidor (CAP-03)

Un Atajo no puede guardar secretos con seguridad: lo que lleva dentro se puede leer en el móvil y viaja si se
comparte. Por eso:

- el token del Atajo es **personal, revocable y de alcance mínimo**: solo puede **añadir pendientes** a la bandeja,
  nunca leer;
- el servidor guarda el token como hash y lo puede rotar;
- caduca en 90 días como máximo.

El nivel 1 (abrir el enlace de WP-25 sin servidor) no necesita nada de esto.

## 5. Móvil perdido o robado: qué hacer y qué tener hecho antes

**Antes**, una vez (tareas del hogar):

1. código del iPhone de 6 cifras o más, Face ID y bloqueo automático en 1 minuto o menos;
2. activar **Buscar mi iPhone**;
3. valorar la **Protección de datos avanzada de iCloud**: cifra de extremo a extremo las copias de seguridad que se
   guarden en iCloud Drive;
4. no dejar copias exportadas (`finanzas-casa-copia-*.json`, CSV) sueltas en carpetas compartidas.

**Si pasa:**

1. borrar el iPhone a distancia desde Buscar.
2. Si la sincronización está activa: en el panel de Supabase, **cerrar todas las sesiones** del usuario o cambiar la
   contraseña.
3. Si hay conexión bancaria: **revocar el consentimiento** en la app del banco o en el portal de Enable Banking y
   **rotar la clave** de la aplicación. El servidor deja de poder leer al instante.
4. Si hay Atajo de nivel 2: revocar su token.
5. Restaurar en el móvil nuevo desde la última copia.

**Qué se lleva el atacante hoy:**

- con el móvil **bloqueado**, nada práctico: los datos del navegador están cifrados por iOS;
- **desbloqueado**, todo el estado financiero; no hay credenciales bancarias, porque la app nunca las tiene.

## 6. Hallazgos de esta revisión y su destino

| Hallazgo | Destino |
|---|---|
| Script de terceros sin SRI (T2) | **Corregido en WP-05** (+3 líneas en `app.js`) |
| Sin CSP (T3) y título del kanban sin escapar | Paquete propio antes de enlazar un banco (RQ-12). Encaja en la Ola 2 si el spike dice «seguir» |
| `assistant-query` sin CORS, sin límite de peticiones ni de tamaño (T8) | RQ-02 antes de desplegarla. Hoy no está desplegada: sin urgencia |
| Altas abiertas en Supabase (T7) | Tarea del hogar si usa la sincronización; obligatoria antes de cualquier función (RQ-11) |
| Copias en claro (T4) | Tareas del hogar (§5); cifrado de copias en catálogo (P3) |
| Base de datos de enlaces compartidos sin `kids-summary` | Fallo funcional, no de seguridad: tarea aparte |
