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

- ~~Implementar tablas y RLS de hogares con una migración independiente.~~ Hecho:
  `migrations/20260801_e9_household.sql`.
- ~~Generar y entregar invitaciones desde el backend privado.~~ Resuelto de otra forma (sesión 140,
  4 de septiembre de 2026, RGX1/RGX2): el "backend privado" (`backend/server.mjs`) nunca se
  desplegó, igual que le pasó a A19-1 con el suyo. En su lugar, `migrations/20260904_
  e9_household_writes.sql` añade funciones `security definer` (mismo patrón que A19-1) que generan y
  validan las invitaciones directamente en la base de datos — sin backend Node.
- Proyectar una copia compartida por áreas, separada de las copias personales. **Sigue pendiente** —
  no se ha construido; A0-9 solo tiene copia personal completa.
- ~~Añadir gestión de miembros y permisos a la interfaz.~~ Hecho (sesión 140): tarjeta «Hogar
  compartido» en Ajustes → Datos y exportación, con invitar/retirar y el simulacro de RGX1.
- Verificar con dos cuentas autenticadas, revocación, conflicto y restauración. **Sigue pendiente**
  — acción manual fuera del alcance de una sesión de Claude Code: exige aplicar la migración a un
  proyecto Supabase real y disponer de una segunda cuenta de prueba.

**No debe desplegarse el modelo compartido en producción hasta completar el punto anterior** — la
migración de escritura (sesión 140) se ha revisado por lectura adversarial y tiene 40 pruebas de
lógica pura y de cableado, pero ninguna prueba end-to-end contra Supabase real: sin aplicar la
migración, `createRgxHousehold()`/`inviteRgxHouseholdMember()` fallarán con un error visible y
contenido, nunca en silencio, así que no hay riesgo de dato corrupto por no aplicarla — el riesgo es
solo de un fallo de RLS no detectado *después* de aplicarla, que el guion de abajo existe para
atrapar antes de invitar a una persona real.

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
