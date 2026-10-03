# ND-13 — Spike de conexión con el banco: PSD2, Apple Pay o avisos (WP-05)

Fecha: 3 de octubre de 2026 (sesión 299). Paquete WP-05 del plan definitivo (`docs/PLAN_DESARROLLO_DEFINITIVO.md`
§4.1 y `docs/PLAN_IMPLEMENTACION_2026-10-03.md` WP-05). La revisión de seguridad que lo acompaña (NTC-06) está en
`docs/NTC06_AMENAZAS.md`. **Sin importes del hogar:** el repositorio es público.

## Pregunta y criterio de salida (del plan)

¿Merece la pena conectar la app con CaixaBank y Banco Mediolanum (PSD2, `O-6`), o hay vías más baratas para
tener los datos al día? La sexta auditoría pidió comparar en la misma matriz **PSD2**, **Apple Pay + Atajos
(CAP-01)** y **avisos del banco (CAP-03)**.

Criterio de salida, el **16/10/2026**: si no hay cobertura de **las dos** entidades, o si mantener el
consentimiento exige más de **«un toque cada 6 meses»**, se cierra `O-6`. Si hay cobertura, se pasa a un
prototipo de lectura con una cuenta, aislado y **sin tocar el libro**.

## Hechos comprobados (fuentes consultadas el 3/10/2026)

| # | Hecho | Fuente | Confianza |
|---|---|---|---|
| H1 | **GoCardless Bank Account Data (antes Nordigen), el candidato de `O-6`, no admite altas nuevas desde julio de 2025.** Las cuentas existentes siguen funcionando. En adelante, solo para clientes empresa | Página oficial `bankaccountdata.gocardless.com/new-signups-disabled`; documentación de Actual Budget | Alta |
| H2 | **Enable Banking** (agregador finlandés, licencia AISP) tiene un **modo restringido gratuito**. Se registra una aplicación de producción y se activa **enlazando tus propias cuentas** en su portal. La aplicación solo puede leer esas cuentas | Documentación de Enable Banking («Linked accounts», FAQ); guías de Firefly III y Securo | Alta |
| H3 | Ese modo se presenta como **evaluación** («antes de firmar un contrato de producción»), no como un producto para particulares con permanencia garantizada | Documentación de Enable Banking | Alta (y es un riesgo, ver R2) |
| H4 | **La lista de bancos de Enable Banking para España incluye CaixaBank y Banco Mediolanum.** Las dos integraciones se corrigieron y mejoraron en agosto de 2023 | Guía de España de Enable Banking (`tilisy.enablebanking.com/guides/ES`); su registro de cambios de agosto de 2023 | Media: está en la lista, pero no se ha probado con las cuentas del hogar |
| H5 | El acceso dura lo que el cliente pide en `valid_until`, **hasta 180 días en la mayoría de bancos**. Después hay que volver a autorizar con la clave del banco. Es el plazo del RTS de PSD2 desde 2023 (antes eran 90) | Documentación de la API de Enable Banking; EBA, reforma del RTS sobre SCA | Alta en general. **Sin confirmar para estos dos bancos** |
| H6 | La API de Enable Banking se autentica con un **JWT firmado con la clave privada de la aplicación** (RS256). Esa clave **no puede estar en el navegador**: hace falta una función de servidor que la guarde | Documentación de la API de Enable Banking | Alta |
| H7 | **La automatización «Transacción» de Atajos (iOS 17+)** se dispara al pagar con una tarjeta de Wallet. Entrega comercio, importe y tarjeta, y puede ejecutarse sin confirmación. **Límites conocidos:** se agota el tiempo si el banco tarda en avisar a Wallet, **también salta con pagos denegados** y no ve la tarjeta física, los recibos ni las transferencias | Ayuda de Apple; foros de desarrolladores de Apple (hilos 765516, 773745) | Alta |
| H8 | **CaixaBank y Banco Mediolanum admiten Apple Pay** | Notas de prensa y prensa especializada | Alta |
| H9 | **CaixaBank envía sus alertas** (nómina, transferencias, cargos, movimientos de tarjeta por encima de un umbral) **por notificación de la app o por correo, no por SMS.** Recomienda la notificación de la app como canal más seguro | Página de alertas de CaixaBank | Alta |
| H10 | **Atajos solo se dispara con mensajes (SMS o iMessage) y correos de la app Mail.** Las notificaciones de otras apps, como CaixaBankNow, no lo activan | Ayuda de Apple, disparadores de comunicación | Alta |
| H11 | Banco Mediolanum (España): su app tiene alertas y bandeja de notificaciones. **No se ha podido confirmar si envía avisos de movimientos por SMS o por correo.** Lo encontrado sobre SMS es de la filial italiana | App Store; documentación de la filial italiana | Baja |

**Lo que no se pudo comprobar desde aquí.** El portal y la documentación de Enable Banking están bloqueados
por la red de este entorno, y probarlo exige las credenciales del hogar. Queda sin confirmar:

- si **las dos** entidades se enlazan de verdad;
- cuántos días de acceso da cada una;
- si aparecen las **tarjetas de crédito**;
- qué cuentas de Mediolanum se ven.

Ojo: los fondos y otras inversiones no son cuentas de pago y **PSD2 no los cubre**. Esto se resuelve con la
verificación práctica de abajo.

## Matriz de decisión

| Criterio | **PSD2 (Enable Banking, modo restringido)** | **Apple Pay + Atajos, nivel 1 (CAP-01, vía WP-25)** | **Avisos del banco (CAP-03)** |
|---|---|---|---|
| **Saldos al día** (la métrica de frescura del panel de uso) | **Sí**, todas las cuentas de pago enlazadas, sin teclear | **No** | **No** (el aviso de nómina es un movimiento, no un saldo) |
| Pagos con el móvil o el reloj | Sí, con 1-2 días de retraso | **Sí, al instante** | Solo por encima del umbral de la alerta |
| Tarjeta física, recibos, transferencias, nómina | Sí | **No** | CaixaBank sí, por correo (H9). Mediolanum: sin confirmar (H11) |
| Coste en dinero | 0 € mientras exista el modo restringido | 0 € | 0 € |
| Coste de construcción | ≈ 3 sesiones solo saldos; ≈ 3 más con movimientos (bandeja E9, duplicados CAP-10) | ≈ 1 sesión además de WP-25, ya planificado | ≈ 2-3 sesiones: un analizador por banco con casos de prueba reales |
| Esfuerzo del hogar | Alta en el portal (≈ 20 min, una vez) y **reautorizar cada ≤ 180 días** con la clave del banco | Montar un Atajo una vez y confirmar cada pago con un toque | Activar las alertas por correo, usar Mail con ese buzón y un Atajo por banco. **La app se abre con cada aviso**: molesta |
| Riesgo de seguridad | **El mayor.** Clave privada y sesión en una función de servidor, más un tercero con acceso de lectura a todos los movimientos | El más bajo: sin servidor ni secretos. El enlace nunca guarda solo | Medio: pasa por el móvil el texto de un correo del banco. Mayor si se monta un buzón de entrada en un servidor |
| Riesgo de continuidad | **Alto (R2).** Es modo de evaluación y el sector está cerrando sus planes gratuitos (GoCardless en 2025) | Bajo: si Apple lo cambia, se vuelve a teclear | Medio: el formato del correo cambia sin aviso |
| ¿Cumple el criterio de salida? | **Probablemente sí** (H4 y H5), **pendiente de la verificación práctica** | No aplica: no es PSD2 | No aplica |

## Lectura crítica

1. **La sexta auditoría planteó mal la pregunta.** Proponía cerrar PSD2 «si Apple Pay y los avisos cubren el
   70 % o más de los movimientos». Pero ni Apple Pay ni los avisos dan **saldos**. La métrica que falla, según
   esa misma auditoría (los saldos envejecen), es la **frescura de los saldos** del panel de uso: 90 % o más
   de los días con saldos de 3 días o menos. Captura y saldo son problemas distintos:
   - el **minuto de captura** lo bajan CAP-01 y WP-25, sin servidor;
   - el **saldo al día** solo lo dan PSD2 o la mano del hogar.

   Cerrar PSD2 por cobertura de movimientos sería cerrar la única vía que ataca la métrica que falla.
2. **CAP-03 por SMS no sirve para CaixaBank** (H9 y H10): sus alertas no llegan por SMS. Queda el correo,
   que obliga a usar Mail con ese buzón y abre la app con cada aviso. **Sale perdiendo frente a las otras dos
   vías.** Se queda en catálogo (P3) y solo se reconsidera si PSD2 se cierra.
3. **PSD2 cumple el criterio en papel, pero el criterio es débil.** «Hay cobertura» no basta:
   - el modo gratuito es **de evaluación** y puede desaparecer como desapareció GoCardless;
   - exige una función de servidor con una clave privada, la mayor superficie de ataque que tendría la app.

   Se justifica solo si los saldos a mano **de verdad** no se mantienen. Eso no se opina: lo dice el panel de uso.
4. **CAP-01 nivel 1 sigue adelante pase lo que pase.** Va dentro de WP-25 y no necesita servidor, secretos ni
   esta decisión.

## Decisión propuesta para el 16/10 (la confirma el hogar)

**No cerrar `O-6` hoy ni construir todavía.** Se decide el 16/10 con dos datos que hoy no existen.

1. **Verificación práctica del hogar** (≈ 20 min, desde el móvil, antes del 16/10):
   1. crear la cuenta en Enable Banking;
   2. registrar una aplicación de producción con la dirección de la app como URL de vuelta;
   3. en «Activar enlazando cuentas», enlazar **CaixaBank** y **Banco Mediolanum**;
   4. anotar **solo**:
      - si se enlaza cada una (sí/no);
      - qué validez ofrece cada una, en días;
      - si aparecen las tarjetas de crédito;
      - qué tipos de cuenta aparecen;
   5. **no enviar ni guardar la clave privada que descarga el portal**: si se sigue adelante, se genera otra
      para el servidor.
2. **Frescura de los saldos** en el panel de uso (Ajustes › Uso de la app) a 16/10, con al menos 7 días de uso.

| Resultado de la verificación | Frescura < 90 % (los saldos envejecen) | Frescura ≥ 90 % (se mantienen a mano) |
|---|---|---|
| **Las dos entidades enlazan y dan ≥ 180 días** | **Seguir:** prototipo **solo de saldos** en la Ola 2, con una cuenta, aislado, sin tocar el libro y con los requisitos de `docs/NTC06_AMENAZAS.md` | **Aparcar** `O-6` en P3 con disparador: «frescura < 90 % dos semanas seguidas» |
| Falla una entidad o dan < 180 días | **Cerrar `O-6`.** Los saldos se atacan con WP-26 (saldo esperado y «Coincide», Ola 2) | **Cerrar `O-6`** |

Si el hogar no puede hacer la verificación antes del 16/10, **se cierra `O-6`** por falta de dato, como dice
el plan, y se reabre solo si el hogar lo pide. Lo que no hay que hacer es otra espera sin fecha.

### Por qué solo saldos en el primer prototipo

Ataca directamente la métrica que falla, lee lo mínimo (un número por cuenta) y no necesita la bandeja ni
la fusión de duplicados (CAP-10). Los movimientos serían un segundo paso, solo si los saldos funcionan
durante un ciclo de consentimiento completo.

## Riesgos

- **R1, la verificación no se hace:** cierre por defecto el 16/10 (ver arriba).
- **R2, el modo gratuito desaparece:** la conexión ha de poder caer sin romper nada. La caducidad, la
  revocación o una caída devuelven a la actualización manual (regla de `E9_BANKING.md`). Coste hundido
  acotado a ≈ 3 sesiones.
- **R3, un tercero con acceso de lectura:** Enable Banking ve las cuentas enlazadas. Es inherente a PSD2:
  el hogar debe aceptarlo de forma explícita en la verificación.
- **R4, pagos denegados que Atajos registra (CAP-01):** la hoja de confirmación de WP-25 lo frena, porque
  nunca guarda sola.

## Fuentes

- GoCardless, altas cerradas: `https://bankaccountdata.gocardless.com/new-signups-disabled` y
  `https://actualbudget.org/docs/advanced/bank-sync/gocardless/`
- Enable Banking:
  - cuentas enlazadas y modo restringido: `https://enablebanking.com/docs/api/linked-accounts/`
  - preguntas frecuentes: `https://enablebanking.com/docs/faq/`
  - referencia de la API: `https://enablebanking.com/docs/api/reference/`
  - particularidades de España: `https://enablebanking.com/docs/markets/es/`
  - guía de bancos de España: `https://tilisy.enablebanking.com/guides/ES/`
- EBA, reautenticación de 90 a 180 días: `https://www.eba.europa.eu/calendar/consultation-amending-rts-sca-and-csc-under-psd2`
- Apple:
  - disparadores de Atajos: `https://support.apple.com/guide/shortcuts/apdd711f9dff/ios`
  - límites de «Transacción»: `https://developer.apple.com/forums/thread/765516`
- CaixaBank, alertas: `https://www.caixabank.es/particular/caixamovil/alertaparticulares.html`
- Banco Mediolanum: Apple Pay (`https://www.applesfera.com/ios/puedes-anadir-sus-tarjetas-banco-mediolanum-activa-soporte-apple-pay-espana`)
  y app (`https://apps.apple.com/es/app/banco-mediolanum-espa%C3%B1a/id605307311`)
