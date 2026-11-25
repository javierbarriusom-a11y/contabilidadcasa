# Índice de pantallas de referencia

Cada pantalla: `png/` para verla, `html/` para copiar valores exactos (abrir en el navegador o leer el código: todo son estilos en línea).
Las marcadas EJEMPLO usan datos ficticios: reproducir el diseño, nunca las cifras.

| ID | Pantalla | Móvil (390 px) | Escritorio (1440 px) | Backlog |
|---|---|---|---|---|
| A1 | Sistema de diseño (tokens, tipografía, formatos, componentes) | — | `Sistema` | NXP-03, XUX-02 |
| A2 | Mapa de navegación: de 60 vistas a 5 destinos | — | `Navegacion` | XUX-01 |
| B1/B2 | Hoy | `Hoy` | `HoyDesktop` | XUX-07 |
| B3 | Movimientos y bandeja | `Movimientos` (EJEMPLO) | `MovimientosDesktop` (EJEMPLO, incluye Clasificar en panel) | XDA-02, 04, 08 |
| B4 | Clasificar por lotes | `Clasificar` | dentro de `MovimientosDesktop` | XDA-05 |
| B5 | Repaso semanal | `Ritual` | `RitualDesktop` | XUX-03, UXS-03 |
| C1 | Plan › Mes | `PlanMes` | `PlanMesDesktop` | XPR-04 |
| C2 | Plan › Previsión | `Prevision` (EJEMPLO) | `PrevisionDesktop` (EJEMPLO) | XPR-03, 05, 06, 07, 08 |
| C3 | Cierre del mes | `Cierre` (EJEMPLO) | `CierreDesktop` (EJEMPLO) | — |
| D1 | Patrimonio › Resumen | `Patrimonio` | `PatrimonioDesktop` | — |
| D2 | Patrimonio › Inversión | `Inversion` (EJEMPLO) | `InversionDesktop` (EJEMPLO) | XDA-06, XIN-01–04 |
| D3 | Patrimonio › Deuda | `Deuda` | `DeudaDesktop` | XDO-01, 03, 04, 06, WP-19 |
| D3-TRE | Deuda › Plan, Ajustar, Comparar y Contratos (maqueta de la decimotercera auditoría, **navegable y responsive**: un solo `html/DeudaTRE.html` de 320 a 1440 px; abrir con `#comparar`, `#contratos` o `#ajustes`) | `DeudaTRE`, `DeudaTREContratos` (EJEMPLO) | `DeudaTREDesktop`, `DeudaTREAjustesDesktop`, `DeudaTREComparar` (EJEMPLO) | TRE-D0 a D4 (`docs/PROPUESTA_DECIMOTERCERA_AUDITORIA_2026-11-25.md` §2) |
| D4 | Decidir › Taller de deuda nueva | `Taller` (EJEMPLO) | `TallerDesktop` (EJEMPLO) | XDN-03, 06 |
| E1 | Importar extracto | `Importar` (EJEMPLO) | `ImportarDesktop` (EJEMPLO) | XDA-02, 03, 04 |
| E2 | Lo que la app te pide + Laboratorio | `LoQuePide` (EJEMPLO) | `LoQuePideDesktop` (EJEMPLO) | XDA-01, XGO-03, XUX-06 |

La barra inferior (móvil) y la barra lateral (escritorio) aparecen ya montadas dentro de cada pantalla.

`DeudaTRE.html` no es de Claude Design: la hizo Claude Code el 25/11/2026 sobre el lenguaje de `DeudaDesktop` (el diagrama por contrato con lo adelantado rayado, el control −/+ y las tres cifras), que la implementación había ido dejando atrás. Calcula en vivo con los dos contratos FICTICIOS del arranque en caliente y una previsión inventada; la barra oscura de arriba es de la maqueta, no del diseño. Es la referencia de TRE-D1 a D4 mientras el hogar no pida otra.
