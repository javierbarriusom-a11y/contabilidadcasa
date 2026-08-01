# E9-0 — Fundamentos para servicios externos

## Objetivo

Preparar servicios externos opcionales sin convertirlos en requisito para abrir, consultar o editar la
última copia local. E9-0 no selecciona proveedores ni activa conexiones reales.

## Contrato

- Todos los servicios nacen desactivados y se habilitan por separado.
- Cada consentimiento declara servicio, finalidad, permisos, concesión, caducidad y revocación.
- Revocar desactiva el servicio inmediatamente y conserva un evento de auditoría.
- El navegador no almacena secretos, credenciales de proveedor ni tokens de larga duración.
- Cada servicio recibe una lista cerrada y mínima de datos.
- Una caída, expiración o revocación siempre devuelve la aplicación al funcionamiento local.
- Las respuestas externas nunca sustituyen al estado ni a los motores canónicos.
- Las escrituras futuras necesitarán vista previa, confirmación y una revisión auditable.

## Límite de confianza

El navegador autentica al usuario y prepara solicitudes mínimas. Un backend privado será responsable de
guardar secretos, renovar credenciales, llamar a proveedores, aplicar límites y redactar registros. Las
tablas públicas solo contienen consentimiento y eventos operativos sin credenciales.

## Servicios previstos

1. Hogar compartido: perfil, titularidad y permisos.
2. Asistente: pregunta, modelo de lectura y procedencia.
3. Acciones: borrador, vista previa y procedencia; nunca ejecución directa.
4. Notificaciones: referencia de alerta y texto seguro sin cifras sensibles.
5. Banca: identificadores de conexión, cuentas, movimientos y cursor; solo lectura.

## Criterios de aceptación local

1. Todos los servicios están apagados por defecto.
2. No se habilita un servicio sin finalidad y permisos válidos.
3. Un consentimiento caducado o revocado bloquea el acceso externo.
4. La caída remota mantiene disponible el modo local.
5. Los payloads excluyen campos no autorizados y rechazan secretos.
6. Concesión y revocación generan trazabilidad append-only.
7. El esquema aplica RLS por usuario y no concede actualización o borrado de eventos.

## Pendiente antes de activar un servicio

- Elegir y desplegar el backend privado.
- Definir política de conservación y borrado para el proveedor concreto.
- Establecer presupuesto y límites de uso.
- Realizar evaluación de privacidad y seguridad.
- Completar pruebas autenticadas de revocación, caída y eliminación remota.
