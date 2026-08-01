# E9-5 — Borradores conversacionales confirmables

## Contrato

- La IA solo puede proponer acciones de un catálogo cerrado.
- Cada propuesta incluye parámetros permitidos, motivo y fuentes internas válidas.
- La aplicación genera una vista previa antes/después y vuelve a comprobar invariantes.
- La confirmación ocurre fuera de la conversación y exige un motivo.
- Confirmar entrega el borrador a un manejador canónico; no ejecuta por sí mismo.
- Cancelar conserva el borrador y la razón para auditoría.

## Catálogo inicial

1. Ajustar la reserva protegida.
2. Preparar un pago de deuda.
3. Preparar un proyecto.
4. Crear una alerta.

Transferencias, pagos bancarios, borrados y cambios de permisos quedan expresamente fuera del catálogo.
El proveedor OpenAI nunca recibirá credenciales ni acceso directo a Supabase.
