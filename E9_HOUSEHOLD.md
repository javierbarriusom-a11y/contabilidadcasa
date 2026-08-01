# E9-1 — Hogar compartido y permisos

## Alcance local

El hogar se modela con propietario, administradores, miembros y personas de solo lectura. Cada miembro
recibe acceso explícito a planificación, movimientos, deudas, huchas, documentos o escenarios. No se
comparten credenciales ni se concede acceso por el mero hecho de conocer un enlace.

## Reglas

- Solo propietario y administradores pueden invitar; solo el propietario puede retirar miembros.
- Una invitación tiene identificador opaco, rol, áreas, caducidad y aceptación expresa.
- El propietario no puede quedar eliminado accidentalmente.
- La revocación bloquea el acceso inmediatamente y conserva la trazabilidad.
- Cada cambio incrementa una revisión; una sesión obsoleta debe recargar.
- Los datos personales no autorizados permanecen fuera de la copia compartida.

## Pendiente remoto y de interfaz

- Implementar tablas y RLS de hogares con una migración independiente.
- Generar y entregar invitaciones desde el backend privado.
- Proyectar una copia compartida por áreas, separada de las copias personales.
- Añadir gestión de miembros y permisos a la interfaz.
- Verificar con dos cuentas autenticadas, revocación, conflicto y restauración.

No debe desplegarse el modelo compartido hasta revisar la migración RLS y disponer de dos cuentas de
prueba independientes.

## Guion de aceptación remota

1. Ejecutar `supabase_schema.sql` y después `migrations/20260801_e9_household.sql`.
2. Confirmar que una cuenta ajena no puede leer ningún hogar, miembro, invitación o evento.
3. Crear un hogar y su miembro propietario mediante una operación backend transaccional.
4. Generar una invitación con hashes y caducidad; comprobar que no se persiste el correo ni el token.
5. Aceptarla desde una segunda cuenta y verificar únicamente las áreas concedidas.
6. Publicar cambios simultáneos y comprobar que la revisión obsoleta queda bloqueada.
7. Revocar la segunda cuenta y confirmar que pierde acceso inmediatamente.
8. Verificar que el propietario conserva la copia personal y puede restaurar una revisión anterior.
9. Eliminar todos los datos sintéticos de aceptación y confirmar el registro de eventos.
