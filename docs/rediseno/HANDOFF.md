# Handoff · Rediseño de Finanzas Casa (contabilidadcasa)

Instrucciones para Claude Code. Las pantallas de referencia están en `referencias/png/` (imagen) y `referencias/html/` (HTML estático con los valores CSS exactos: colores, tamaños, espaciados). Cada pantalla existe en móvil (`Nombre.png`, 390 px) y escritorio (`NombreDesktop.png`, 1440 px). Ver `referencias/INDICE.md`. Este documento es la especificación; las referencias son la verdad visual. Si discrepan, manda este documento.

Repositorio: `javierbarriusom-a11y/contabilidadcasa` (GitHub Pages). App estática + motores `canonical-*.js` + Supabase opcional.

---

## 0. Reglas para la implementación

1. **No tocar la lógica de los motores.** El rediseño es de capa de presentación, navegación y formato. Si una pantalla necesita un dato que ningún motor da, se pinta plegada («sin dato») y se abre una tarea aparte.
2. **Nada de lógica nueva en `app.js`** (le quedan ~54 líneas de margen). Todo el código nuevo va en módulos: `ui/tokens.css`, `ui/components/*.js`, `ui/screens/*.js`. Si hace falta, el primer PR saca código de `app.js` a módulos sin cambios visibles (XGO-01).
3. **Detrás de bandera.** La navegación nueva y cada pantalla rediseñada se activan con un flag del Laboratorio (`lab.nav_v2`, `lab.hoy_v2`, …). La vista antigua sigue accesible hasta que la nueva se gradúe.
4. **Un PR por pantalla**, con pruebas Playwright en WebKit (iPhone 390×844) y Chromium (1440×900) y captura antes/después.
5. **Accesibilidad:** objetivos ≥ 44 px, `<button>`/`<a>` reales, `aria-current` en navegación, `role="switch"` en interruptores, contraste ≥ 4,5:1, estados distinguibles por forma además de color.
6. **Prohibido en la interfaz:** nombres internos (`canonical-monthly-plan`, «libro canónico», `confianza high`), la puntuación de salud como cifra principal, «Sin datos» como titular de tarjeta, selectores con más de 4 opciones visibles en móvil.

---

## 1. Tokens (A1 · Sistema)

Sustituye las variables CSS actuales. Fuente: Geist + Geist Mono (Google Fonts), con `system-ui` de reserva.

```css
:root {
  --ground:#F4F5F2; --surface:#FFFFFF; --line:#E1E5E1; --line-soft:#EEF1EE;
  --ink:#111814; --ink-2:#56615B; --ink-3:#2E3832;
  --brand:#0E3B32; --brand-soft:#DDEBE4; --link:#0E6B4F;
  --forecast:#2B59C3; --forecast-soft:#E4ECFA;
  --pos:#1B7A4B; --pos-soft:#E1F1E7;
  --warn:#8F5A00; --warn-ink:#5E3C00; --warn-soft:#FBF1DC;
  --neg:#B3361F; --neg-ink:#8A2A18; --neg-soft:#FDF3F1;
  --r-control:12px; --r-card:16px; --r-sheet:24px;
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:20px; --sp-6:24px; --sp-8:32px;
  --font:'Geist',system-ui,sans-serif; --font-mono:'Geist Mono',ui-monospace,Menlo,monospace;
}
@media (prefers-color-scheme: dark) { /* mismo set, invertido; ground #111614, surface #1A201D, ink #E8EDEA, ink-2 #9CA8A1 */ }
```

Escala tipográfica: héroe 48/700 (tnum) · título 32/700 · sección 19/650 · cuerpo 15/400 · meta 12,5/400 · etiqueta Geist Mono 11 mayúsculas +0,07em.

Reglas de color: **azul solo para lo previsto**, tinta para lo real, rojo solo para lo que rompe una regla del hogar (bajo el suelo, patrimonio negativo, regla de política incumplida). Nunca rojo para un gasto normal.

## 2. Formato de cifras

Un único formateador, `ui/format.js`:

- `fmtEUR(v)` → `8.310 €` (sin decimales, separador de miles siempre, también con 4 cifras; espacio fino sin salto antes de €; signo menos tipográfico `−`).
- `fmtEUR(v, {detalle:true})` → `−412,30 €`, solo en movimientos, extractos y cuadres.
- `fmtPct(v)` → `9,2 %`.
- Fechas: `17 oct`, `sept 2029`, `domingo 23 nov`. Nunca `sept 29` (se confunde con un día).
- Sustituir todas las apariciones de `toFixed(2) + ' €'` y equivalentes. Hoy conviven `8310,00 €` y `12.000,00 €` en la misma pantalla.

## 3. Componentes

| Componente | Props | Notas |
|---|---|---|
| `Cifra` | `valor, estado: real\|estimado\|previsto\|sin_dato, fuente, edad, rango?` | Implementa NXP-03. Punto lleno = real, aro = estimado/previsto, aro discontinuo = sin dato. Tocar la meta abre hoja con procedencia. |
| `TarjetaPlegada` | `titulo, falta, minutos, destino` | Sustituye toda tarjeta «Sin datos». Borde discontinuo, una línea, lleva al sitio exacto. |
| `FilaDecision` | `orden, titulo, porque, impacto: alto\|medio\|bajo, vence?, destino` | Máximo 3 en Hoy. Ordenadas por euros en juego. |
| `BarraRitmo` | `real, esperadoHoy, total` | Marca azul = lo esperado al día de hoy. Sin real → rayado. |
| `BarraBanda` | `valor, objetivo, banda` | Reparto de cartera, cuota/ingresos. |
| `Segmentado` | `opciones (≤4), activa` | Pestañas de 2.º nivel. |
| `HojaInferior` | `titulo, contenido, accionPrimaria` | Radio 24, asa, cierre con gesto y botón. Edición siempre en hoja. |
| `ToastDeshacer` | `texto, onDeshacer, 8 s` | WP-37. Encima de la barra inferior. |
| `BandaEjemplo` | — | XUX-02. Banda rayada fija «EJEMPLO». |
| `BarraInferior` | `activo` | 5 destinos, ver §4. En escritorio (≥ 1024 px) se convierte en rail lateral de 256 px (B2). |
| `ChipFrescura` | `estado, texto, destino` | Cabecera de Hoy: «Saldos estimados · confirmar en 20 s». |

## 4. Navegación (A2 · A3)

Cinco destinos en barra inferior (móvil) / rail (escritorio). Ajustes desde el avatar; todo lo demás desde el buscador ⌘K.

| Destino | Pregunta | Pestañas | Absorbe (vistas actuales) |
|---|---|---|---|
| **Hoy** | ¿Vamos bien? | — | Hoy, Cuadro de mandos, Estado de la semana, Cambios pendientes, Decisiones abiertas |
| **Movimientos** | ¿Qué ha pasado? | (bandeja + lista) · Importar · Cierre | Registrar (Saldo, Reales, Extracto, Lote), Movimientos, Cierre/Conciliación, Importar en 4 pasos, Registrar el mes, Carga de datos |
| **Plan** | ¿Qué viene? | Mes · Previsión · Objetivos | Plan (6 pestañas → 3), Presupuesto, Esta semana, Partidas, Previsión mensual, Proyección, Mapa de calor, Análisis de previsión (→ Previsión › Calidad) |
| **Patrimonio** | ¿Cuánto tenemos y debemos? | Resumen · Inversión · Deuda | Inversión ×5, Deuda ×4, hoja de ruta antigua, Control, Plan de liquidación, vivienda por índice, patrimonio neto |
| **Decidir** | ¿Qué hacemos con el dinero? | Próximo euro · Taller · Escenarios | Escenarios ×4, Asesor/Segunda opinión, Repartir la nómina y Próximo euro (hoy en Deuda › Comparar), Apalancamiento (tras barrera AP4), comparadores de seguros |

Reglas: profundidad máxima destino › pestaña › hoja. Volver arriba a la izquierda. Las rutas antiguas (`#…`) redirigen a la nueva ubicación durante 2 meses. Las 3 alertas de Hoy que hoy mandan a «Ajustes › Patrimonio e inversión» deben apuntar a Patrimonio › Inversión.

## 5. Pantallas

### B1/B2 · Hoy
Orden fijo de bloques:
1. Cabecera: fecha, «Hoy», buscar, avatar.
2. `ChipFrescura` si algún saldo es estimado (`canonical-data-age.js`).
3. Héroe «Disponible hasta cobrar»: cifra (`canonical-home-margin.js` / daily engine), frase con suelo y días hasta el próximo ingreso, gráfico de saldo previsto hasta el próximo ingreso con línea de suelo; dos cifras secundarias (fin de mes previsto, reserva protegida).
4. «Decidir esta semana»: top 3 de Decisiones abiertas como `FilaDecision`.
5. «Octubre»: asignado del mes + `BarraRitmo`; sin real → `TarjetaPlegada` a Importar.
6. Patrimonio: deuda viva + patrimonio neto, con nota si la fecha libre de deuda excluye contratos.
7. `TarjetaPlegada` «N funciones esperan datos» → E2.

Se retira de Hoy: Salud financiera (ambas cifras, 58/100 y 56,2/100, son incoherentes entre sí), selector de horizonte (va a Plan › Previsión), «Guía de este flujo», «Modo reunión» (al menú del avatar), «Acciones rápidas», tarjetas «Sin presupuestos» y «Objetivos · Sin datos», el banner «Primeros pasos» una vez descartado, y las líneas «Fuente: canonical-… · confianza high».
Aceptación: en 390×844 la cifra héroe y la primera decisión se ven sin scroll.

### B3 · Movimientos
Bandeja arriba (extracto llegado por Compartir con resumen y cuadre, XDA-02; grupos sin partida → B4; cobros confirmados solos, XDA-08), cobertura de 90 días por cuenta (XDA-04), filtros por cuenta, lista agrupada por día con partida como etiqueta y «¿partida?» discontinua si falta, acceso a Cierre al final.

### B4 · Clasificar por lotes (XDA-05)
Hoja inferior: progreso por grupos, grupo por comercio normalizado con nº de movimientos e importe, propuesta con confianza, 2-3 alternativas, «Saltar» / «Aceptar y siguiente». Al aceptar se crea regla con `ToastDeshacer`. Máximo 5 grupos por sesión.

### B5 · Repaso semanal (XUX-03, sustituye a la prueba H-02)
Pantalla completa, 5 pasos (saldos · extracto · lo que vino · bandeja · listo), cronómetro visible: la duración se registra sola y alimenta M-HOY (UXS-03). Paso de saldos: por cuenta «Coincide» (1 toque) o «Corregir» (campo numérico).

### C1 · Plan › Mes
Selector de mes ‹ octubre 2026 › (sustituye el desplegable de 120 meses). Héroe «Sin asignar» con botón Asignar y barra apilada de destino del ingreso. `BarraRitmo`. Partidas por grupo con importe editable (abre hoja) y barra de real frente a previsto. **Financiaciones plegadas a una fila** («15 contratos · 13 a 0 € · se editan en Deuda»), en vez de 15 filas a 0 €.

### C2 · Plan › Previsión
Horizonte 3 m · 12 m · 24 m · Hasta 2036. Cifra principal: punto más bajo del horizonte y su fecha. Cono (banda azul) con suelo. Tocar un día abre hoja «qué lo mueve» con fechas estimadas marcadas y enlace «¿sabes el día?» (XPR-06). Tarjeta «De verdad libre» (XPR-08). Tarjeta de remedio más barato si el peor caso se acerca al suelo (XPR-07). Insignia de calibración (XPR-03). Conmutador total / por cuenta (XPR-05).

### C3 · Cierre del mes
Tres comprobaciones (saldos, cobertura de movimientos, desviaciones top 3) + confianza + qué guarda la firma + botón «Firmar». Se permite firmar con hueco («cierre con hueco») que se completa solo.

### D1 · Patrimonio › Resumen
Patrimonio neto con barra divergente (deuda frente a activos), desglose, `TarjetaPlegada` de la serie (0 de 3 cierres), proyección a 10 años con aviso si no hay supuestos, accesos a Inversión y Deuda.

### D2 · Patrimonio › Inversión
Cabecera: valor, edad de la valoración, dentro/fuera de bandas, «Valorar todo» (XDA-06). Pestañas Resumen · Reparto · Impuestos · Futuro. Resumen: puente del año en cascada (XIN-03), reparto frente a política con siguiente aportación, fila de impuestos (XIN-01/02), objetivo con probabilidad (XIN-04). Lectura de calma plegada salvo caída > umbral de la política.

### D3 · Patrimonio › Deuda
Cabecera de 4 cifras (deuda viva, cuota/ingresos frente a límite, libre de deuda **con nº de contratos incluidos**, coste medio). Aviso si hay contratos sin cuota/TIN. Pestañas Calendario · Contratos · Mejorar. Calendario: extra al mes **persistido** (WP-19), resultados (fecha, intereses), orden de ataque con nombres llanos («Más cara primero», «Más pequeña primero», «Sin extra»), línea de tiempo por contrato (discontinua si no se puede proyectar), destino de la cuota liberada (XDO-03). Mejorar: amortizar o invertir, carta al banco (XDO-04), ITV anual (XDO-06).
Corrige incoherencias actuales: el titular «Libre de deuda: sin fecha estimable» contradice «septiembre de 2029» de la misma pantalla; «cuota total 180 €» frente a «480 €/mes» en Capacidad; «12.000 € de coste total ejecutado» con «intereses totales 0 €».
Requisito previo: NTC-05 (un solo motor de deuda) antes de implantar D3.

### D4 · Decidir › Taller de deuda nueva
Seis pasos (Para qué · ¿Hace falta? · Cuánto · Ofertas · Prueba · Decisión). Paso 5: política de deuda con reglas cumplidas/incumplidas y el dato concreto (XDN-03), prueba de estrés, «Lo que cambia en vuestros planes» (XDN-06), alternativa propuesta («Probar a 5 años»). La decisión se guarda con motivo y fecha de revisión.

### E1 · Importar
Tres fuentes (Compartir, pegar texto del PDF, CSV/Excel). Vista previa con líneas dudosas resaltadas y duplicados tachados. Cuadre obligatorio: si no cuadra, no se importa. Botón con número exacto de movimientos.

### E2 · Lo que la app te pide + Laboratorio
Minutos semanales frente al presupuesto (XDA-01), lista por valor por minuto con interruptor Pausar, funciones hambrientas plegadas, Laboratorio con estado de cada prueba (XGO-03), pantallas no usadas con «Ocultar» (XUX-06).

## 5b. Escritorio (artboards con sufijo «d»)

Cada pantalla tiene dos referencias: móvil (390 px) y escritorio (1440 px). Son **la misma pantalla responsive**, no dos implementaciones: un solo componente por pantalla con dos puntos de corte.

**Reglas responsive**

| Ancho | Navegación | Contenido |
|---|---|---|
| < 768 px | `BarraInferior` (A3) | 1 columna, margen 16 px, hojas inferiores |
| 768–1023 px | `BarraInferior` | 2 columnas donde el escritorio tiene 2; margen 24 px |
| ≥ 1024 px | `BarraLateral` (A4, 256 px, verde marca) con buscador ⌘K, persona activa y Ajustes abajo | Rejilla principal + columna lateral de 340–400 px; margen 32–36 px; ancho máximo de contenido 1184 px |

En escritorio: las pestañas de 2.º nivel van en la cabecera junto al título (segmentado); las de 3.er nivel (p. ej. Inversión › Resumen/Reparto/Impuestos/Futuro, Deuda › Calendario/Contratos/Mejorar) pasan a pestañas subrayadas a la derecha de la cabecera. Las **hojas inferiores** se convierten en **panel lateral derecho** (Clasificar, detalle de un día) o en **diálogo centrado** (Repaso semanal). Las listas pasan a **tablas** con columnas alineadas y cifras a la derecha. Atajos de teclado en flujos repetitivos (Clasificar: ↵ aceptar, 1-3 alternativas, S saltar, ⌘Z deshacer; Repaso: C coincide, E editar, ↵ seguir).

**Componente nuevo:** `BarraLateral` (`activo`) — mismo modelo de datos que `BarraInferior`; añade contador de pendientes en Movimientos, selector Hogar/Javi/Tere y estado de sincronización.

**Por pantalla**

| Artboard | Composición de escritorio |
|---|---|
| B2 Hoy | Héroe con gráfico ancho (2/3) + Decidir esta semana en tabla con botón por fila; columna derecha: Octubre, Patrimonio, funciones que esperan datos. Chip de frescura y «Apuntar gasto» en la cabecera. |
| B3d Movimientos | Bandeja como 3 tarjetas en fila; cobertura compacta por cuenta; buscador + filtros; tabla Fecha · Concepto · Cuenta · Partida · Importe. **Clasificar se abre como panel derecho de 400 px** sin salir de la lista. |
| B5d Repaso | Diálogo de 880 × 600: pasos en columna izquierda, cuentas en filas con «Coincide / Corregir» en línea. |
| C1d Plan › Mes | Tabla de partidas (Previsto editable · Real · Queda · Ritmo) a la izquierda; columna derecha: Sin asignar con barra apilada y CTA, Ritmo del mes, ahorro del mes. |
| C2d Previsión | Gráfico de 780 px con eje Y; detalle del día fijado en panel derecho (hover para explorar, clic para fijar, ← → por teclado); debajo, «De verdad libre» y remedio en dos columnas. Horizonte y total/por cuenta en la cabecera. |
| C3d Cierre | Las 3 comprobaciones a la izquierda (desviaciones como tabla Previsto · Real · Desvío); confianza, qué guarda la firma y botón Firmar a la derecha. |
| D1d Patrimonio | Dos columnas: patrimonio neto con barra divergente y desglose / proyección a 10 años, serie plegada y accesos a Inversión y Deuda. |
| D2d Inversión | Cabecera con valor + pestañas + «Valorar todo»; puente del año grande a la izquierda, reparto frente a política a la derecha; fila inferior Impuestos · Futuro · Calma. |
| D3d Deuda | Franja de 4 cifras; aviso de contratos incompletos; diagrama temporal por contrato (Gantt) a la izquierda con leyenda; simulador de extra (botones + deslizador) a la derecha; fila Mejorar con 3 tarjetas. |
| D4d Taller | Pasos en horizontal; política de deuda a la izquierda (la regla incumplida con su alternativa en línea); estrés y planes a la derecha; navegación Atrás / Ver la decisión al pie. |
| E1d Importar | 3 fuentes en fila (el PDF admite arrastrar); vista previa en tabla con columna Estado; cuadre, cobertura resultante e Importar a la derecha. |
| E2d Ajustes | Navegación secundaria de Ajustes a la izquierda; tareas con valor/minuto e interruptor en tabla; Laboratorio y pantallas no usadas en columna derecha. |

Aceptación de escritorio: a 1440 × 900 la cifra principal y la primera acción de cada pantalla se ven sin scroll; a 1024 px nada se corta ni aparece scroll horizontal; foco visible y orden de tabulación coherente en todas las tablas e interruptores.

## 6. Orden de implantación

| Fase | Contenido | Depende de |
|---|---|---|
| 0 | Desalojo de `app.js` a módulos, flags de Laboratorio | — |
| 1 | `tokens.css`, `format.js`, componentes §3 | 0 |
| 2 | Navegación de 5 destinos + redirecciones + buscador | 1 |
| 3 | Hoy (B1/B2) | 2 |
| 4 | Movimientos, Importar, Repaso semanal (B3, E1, B5) | 2 |
| 5 | Plan (C1, C2) y Cierre (C3) | 2 |
| 6 | Patrimonio e Inversión (D1, D2) | 2 |
| 7 | Deuda (D3) | NTC-05 |
| 8 | Clasificar (B4), Taller (D4), E2 | 4, 7 |

Cada fase se gradúa del Laboratorio cuando su métrica mejora (p. ej., Hoy: tiempo hasta la primera acción; Movimientos: extractos importados por semana).

## 7. Fuera de alcance

Conexión bancaria PSD2, precios en tiempo real, gamificación más allá de una racha discreta en el repaso, IA que genere cifras.
