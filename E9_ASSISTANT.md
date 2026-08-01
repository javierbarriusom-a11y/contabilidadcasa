# E9-4 — Asistente privado y trazable de solo lectura

## Contrato local

- Solo recibe `finance-executive-read-model/v1`, nunca la copia financiera completa.
- La solicitud contiene pregunta, catálogo mínimo de fuentes y procedencia.
- Requiere consentimiento `finance:read` y `assistant:query`.
- Sin consentimiento, proveedor o red continúa con el análisis local basado en reglas.
- Toda respuesta remota debe indicar fecha y referencias internas existentes.
- Se rechazan comandos, mutaciones, parches, borradores y cualquier contenido de escritura.
- La respuesta es informativa y no sustituye una revisión profesional.

## Límite privado

El navegador prepara un payload minimizado. El backend pendiente será responsable de autenticación,
secreto del proveedor, límites, redacción de registros y borrado. No se conservarán conversaciones
completas por defecto; la auditoría guardará únicamente servicio, fecha, revisión, resultado y coste.

## Decisión de proveedor

Decisión registrada el 1 de agosto de 2026:

> OpenAI API, Responses API, almacenamiento desactivado y backend privado.

El modelo concreto se elegirá después mediante pruebas comparables de calidad, coste y latencia. La
suscripción de ChatGPT no se utilizará como credencial y la clave de API no llegará al navegador.

## Pendiente para activación remota

1. Elegir proveedor y ubicación de tratamiento.
2. Desplegar un endpoint privado autenticado.
3. Aplicar límites de tamaño, frecuencia y coste.
4. Validar la respuesta contra el contrato antes de mostrarla.
5. Probar filtración de datos, instrucciones maliciosas, fuentes inventadas, revocación y caída.
6. Habilitarlo solo tras consentimiento explícito; mantener el análisis local como alternativa.
