# E9-6 — Notificaciones remotas opcionales

## Canal inicial

El único canal remoto inicial será web push. El centro de alertas local continúa siendo la fuente
principal y funciona aunque el servicio remoto esté desactivado o caído.

## Reglas

- Web push nace desactivado y requiere consentimiento separado.
- La suscripción se referencia mediante un identificador opaco; el endpoint se cifra en el backend.
- La pantalla bloqueada muestra únicamente mensajes genéricos predefinidos.
- No se incluyen importes, saldos, bancos, acreedores, cuentas ni nombres de deudas.
- Se respetan frecuencia, silenciamiento y horario de descanso.
- Cada alerta y revisión tiene una clave de deduplicación para evitar reintentos visibles.
- Los enlaces solo abren vistas permitidas de la aplicación y exigen autenticación.
- Los recibos conservan estado técnico y referencias opacas, no contenido financiero.

Email automático, SMS y mensajería quedan fuera del alcance inicial.
