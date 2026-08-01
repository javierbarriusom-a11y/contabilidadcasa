# E9-2 — Conexión bancaria PSD2 de solo lectura

## Decisión provisional

El código usa un contrato AISP independiente del proveedor. GoCardless Bank Account Data queda como
candidato para el piloto español por su cobertura declarada en el EEE, acceso a cuentas, saldos y
movimientos, y flujo de consentimiento alojado. La contratación y aceptación real siguen pendientes.

## Reglas

- Solo se solicitan cuentas, saldos y movimientos; nunca iniciación de pagos.
- El navegador no recibe secretos del proveedor ni credenciales bancarias.
- IBAN y referencias se muestran enmascarados.
- Las respuestas crudas no se incorporan al estado financiero.
- Los movimientos entran primero en una bandeja separada.
- Caducidad, revocación o caída devuelven al usuario a importación manual.
- Reconectar crea un ciclo de consentimiento explícito y no rehabilita permisos revocados silenciosamente.

Antes del piloto deben verificarse bancos concretos, precio, soporte, contrato de encargado de
tratamiento, residencia de datos, entorno de pruebas y procedimiento de baja.
