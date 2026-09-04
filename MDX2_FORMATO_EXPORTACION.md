# MDX2 — Formato de exportación abierto y documentado

Documento técnico del esquema JSON que produce «Descargar copia completa» (A0-9, Ajustes › Datos y
exportación › «Copia y restauración verificable»), y que también usa la recuperación al arrancar
sesión. El motor que define y valida este esquema es `state-contract.js`
(`window.FinanceStateContract`) — este documento describe su contrato público, no lo sustituye: si
alguna vez discrepan, `state-contract.js` es la fuente real y este documento está desactualizado.

## Por qué existe este documento

El formato ya era abierto de hecho (JSON plano, sin binario ni librería propietaria, legible por
cualquier herramienta) pero no estaba documentado en ningún sitio propio — solo se podía deducir
leyendo `state-contract.js`. MDX2 (`BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md`, Bloque 2) pide
publicarlo como contrato explícito, con una decisión de gobierno de datos por escrito.

## El sobre (envelope)

Un fichero de copia es un único objeto JSON con esta forma:

| Campo | Tipo | Significado |
|---|---|---|
| `format` | string | Siempre `"finanzas-casa-backup"`. Identifica el fichero como una copia de esta app — cualquier otro valor se rechaza. |
| `formatVersion` | número | Versión del **sobre**. Hoy `1`. Un cambio incompatible en la forma del sobre (no del contenido de `payload`) sube este número. |
| `createdAt` | string (ISO 8601) | Momento en que se generó la copia. |
| `appVersion` | string | Etiqueta libre de qué generó la copia (p. ej. `"local"`, `"e3-emergency-backup"`). Informativa, no se valida. |
| `sourceWorkbook` | string | Nombre del Excel de origen, si lo hay. Puede estar vacío. |
| `summary` | objeto | Recuento legible por humanos (proyectos, decisiones de deuda, ingresos/gastos reales, campos del plan de deuda, si incluye el libro y cuántos meses) — informativo, no forma parte del contrato de restauración. |
| `checksum.algorithm` | string | Siempre `"fnv1a32"` hoy. |
| `checksum.value` | string (hex) | FNV-1a de 32 bits sobre `payload` serializado con orden de claves estable (`stableStringify` — mismo objeto, mismas claves en el mismo orden, siempre el mismo hash). Verifica que `payload` no se ha corrompido ni editado a mano de forma incompatible. |
| `payload` | objeto | El estado completo de la app. Ver abajo. |

## El contenido (`payload`)

`payload.version` es la versión interna del payload (hoy `1`, campo `PAYLOAD_VERSION` en
`state-contract.js`) — versiona el **contenido**, independiente de `formatVersion` (que versiona el
**sobre**). Los dos pueden subir en momentos distintos.

Campos que **siempre** están presentes (listas, nunca `null`/`undefined` — una lista vacía es válida,
la ausencia del campo no):

- `projects`
- `debtLiquidations`
- `decisionEvents`
- `customPlanningRows`

Campos que **siempre** están presentes (objetos, nunca `null`/`undefined` — un objeto vacío `{}` es
válido):

- `incomeActuals`
- `expenseActuals`
- `balanceSettings`
- `scenarioSettings`
- `deletedPlanningRows`
- `seriesOverrides`
- `rowLabelOverrides`
- `movementMappings`

Campos **opcionales** (listas — si aparecen, deben ser listas; si no aparecen, se asume lista vacía):

- `monthClosures`
- `importBatches`
- `dataInbox`
- `updateReceipts`

Campos **opcionales** (objetos — si aparecen, deben ser objetos; si no aparecen, no se asume nada):

- `debtRoadmapState`
- `e11b`

Campo especial:

- `workbookData` — `null`, o un objeto con al menos `metadata` y `monthlyPlanning` (el libro Excel
  completo, si la copia decide incluirlo). Sin él, restaurar usa el libro empaquetado con la propia
  app.

**Cualquier otro campo que aparezca en `payload` se conserva tal cual** — el validador
(`validatePayload`) no rechaza campos desconocidos, solo exige que los de arriba tengan la forma
correcta. Una herramienta externa que lea este formato debe hacer lo mismo: conservar los campos que
no reconozca, nunca descartarlos en silencio.

## Decisión de gobierno de datos

1. **`formatVersion` es el contrato estable.** Mientras se mantenga en `1`, cualquier lector que
   entienda esta tabla puede parsear el fichero. Un cambio que rompa esta tabla (renombrar un campo
   obligatorio, cambiar su tipo, quitar el checksum) exige subir `formatVersion` — nunca un cambio
   silencioso con el mismo número.
2. **`payload.version` puede subir sin que suba `formatVersion`.** El contenido interno evoluciona
   con la app; `migratePayload()`/`migrateBackupEnvelope()` son el puente de compatibilidad —
   siempre rellenan los campos que falten con su valor por defecto documentado arriba (listas
   vacías, objetos vacíos) en vez de fallar, salvo que el propio payload no sea un objeto válido.
3. **El checksum es obligatorio para confiar en el contenido.** `validateBackupEnvelope()` recalcula
   el hash de `payload` y lo compara — un fichero con `payload` editado a mano sin regenerar el
   checksum se marca inválido, nunca se acepta "probablemente bien".
4. **Nunca se inventa un dato que falte.** Si un campo obligatorio no es del tipo esperado,
   `validatePayload()` lo lista como error explícito (`errors: [...]`) — no se sustituye por un
   valor adivinado ni se restaura una copia parcialmente inválida.
5. **Este documento se actualiza en el mismo commit que `state-contract.js`** cuando cambie
   cualquiera de las listas de campos de arriba — verificado por
   `tests/mdx2-formato-exportacion-documentado.test.cjs`, que falla si este documento y
   `state-contract.js` dejan de coincidir.

## Cómo se genera y se restaura

- **Generar**: Ajustes › Datos y exportación › «Copia y restauración verificable» › «Descargar copia
  completa» (`downloadStateBackup()`, `app.js`). Descarga
  `finanzas-casa-copia-AAAA-MM-DD.json`.
- **Restaurar**: mismo panel, seleccionar el fichero y confirmar (`applyRecoveryPayload()` y
  funciones relacionadas en `app.js`), o automáticamente al arrancar sesión si hay una copia local
  pendiente de sincronizar (`showStartupRecovery()`).
- **Verificar sin restaurar**: `window.FinanceStateContract.validateBackupEnvelope(json)` desde
  cualquier consola o script — devuelve `{valid, errors, summary}` sin tocar el estado de la app.
