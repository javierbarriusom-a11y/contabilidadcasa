# E9-3 — Importación bancaria programada

## Flujo

1. El backend comprueba conexión, consentimiento y fecha prevista.
2. Recupera movimientos usando una clave de idempotencia diaria.
3. Normaliza y deposita altas o correcciones en una bandeja separada.
4. Pausa nuevas ejecuciones mientras exista un lote pendiente de revisar.
5. La aplicación compara duplicados, candidatos y efecto mensual.
6. El usuario confirma con un motivo.
7. Un manejador canónico independiente incorpora el lote y conserva la opción de deshacer.

Nunca se crean decisiones, clasificaciones definitivas ni cambios presupuestarios automáticamente.
Los fallos usan backoff acotado y la importación manual permanece disponible.
