# Cómo pasar el rediseño a Claude Code

## 1. Preparación (una vez, 2 minutos)

1. Descomprime el zip y copia la carpeta `finanzas-casa-rediseno` dentro del repositorio como `docs/rediseno/`:

```
contabilidadcasa/
└── docs/
    └── rediseno/
        ├── HANDOFF.md
        ├── PROMPTS_CLAUDE_CODE.md
        └── referencias/
            ├── INDICE.md
            ├── png/    (27 capturas)
            └── html/   (27 pantallas en HTML estático)
```

2. Haz commit de esa carpeta sola en `main` («docs: referencias del rediseño»), para que todas las ramas la tengan.
3. Abre Claude Code en la raíz del repositorio.
4. Pega los prompts **de uno en uno**, en orden. No pases al siguiente hasta haber revisado y fusionado el PR del anterior.

Regla para ti: si Claude Code propone cambiar un motor `canonical-*.js` dentro de estas fases, dile que no y que lo apunte como tarea aparte.

---

## 2. Prompt 0 · Lectura y plan (no toca código)

```
Lee docs/rediseno/HANDOFF.md completo y docs/rediseno/referencias/INDICE.md. Mira las capturas de docs/rediseno/referencias/png/ (al menos Sistema, Navegacion, Hoy y HoyDesktop) y abre sus HTML en docs/rediseno/referencias/html/ para ver los valores CSS exactos.

Después explora el repositorio: index.html, app.js, el sistema de navegación actual (side-nav, e19-registrar-tabs, rutas por hash), dónde se definen las variables CSS y cómo se formatean los importes hoy.

No cambies ningún fichero todavía. Devuélveme:
1. Un mapa: cada vista actual → su destino en la navegación nueva (tabla de la sección 4 del HANDOFF), con el id o la función que la pinta.
2. Las líneas que le quedan a app.js frente al techo del CI y qué bloques propones sacar a módulos en la fase 0.
3. Cómo vas a implementar los flags del Laboratorio (lab.nav_v2, lab.hoy_v2…) con lo que ya existe.
4. Riesgos o contradicciones que veas entre el HANDOFF y el código.
5. El plan de PRs de las fases 0 a 8 de la sección 6, con el tamaño estimado de cada uno.
```

---

## 3. Prompts por fase

Pega cada uno cuando el anterior esté fusionado. Todos empiezan igual a propósito: así no dependen de la memoria de la sesión anterior.

### Fase 0 · Desalojo de app.js y flags

```
Lee docs/rediseno/HANDOFF.md (secciones 0 y 6). Fase 0: crea una rama rediseno/fase-0.
1. Saca de app.js a módulos nuevos (ui/… o el patrón de módulos que ya use el repo) los bloques que identificaste, sin ningún cambio visible ni de comportamiento. Objetivo: dejar al menos 3.000 líneas de margen bajo el techo del CI.
2. Añade un mecanismo de flags de Laboratorio (lab.nav_v2, lab.hoy_v2, lab.movimientos_v2, lab.plan_v2, lab.patrimonio_v2, lab.deuda_v2, lab.decidir_v2, lab.ajustes_v2), todos apagados por defecto y conmutables desde Ajustes › Laboratorio.
3. Ejecuta toda la batería de pruebas. Todo debe pasar igual que antes.
Abre un PR con: líneas de app.js antes/después, lista de módulos creados y confirmación de que no hay cambios visibles.
```

### Fase 1 · Tokens, formato y componentes

```
Lee docs/rediseno/HANDOFF.md (secciones 1, 2 y 3) y mira docs/rediseno/referencias/png/Sistema.png y referencias/html/Sistema.html. Fase 1, rama rediseno/fase-1:
1. Crea ui/tokens.css con los tokens exactos de la sección 1 (incluido modo oscuro) y carga Geist y Geist Mono. Las pantallas actuales no deben cambiar aún: los tokens nuevos solo se aplican bajo el flag.
2. Crea ui/format.js con fmtEUR, fmtEUR(v,{detalle:true}), fmtPct y las fechas cortas, con pruebas unitarias de todos los casos de la tabla «Formato de cifras» de Sistema.html (8.310 €, −412,30 €, 9,2 %, 17 oct, sept 2029).
3. Crea los componentes de la sección 3 (Cifra, TarjetaPlegada, FilaDecision, BarraRitmo, BarraBanda, Segmentado, HojaInferior, ToastDeshacer, BandaEjemplo, BarraInferior, BarraLateral, ChipFrescura) en ui/components/, en el mismo estilo de código que el resto del repo, y una página de muestra interna (solo con el flag) que los enseñe todos.
Copia colores, tamaños, radios y espaciados de los HTML de referencia, no los redondees. Pruebas Playwright en WebKit 390×844 y Chromium 1440×900 de la página de muestra. PR con capturas.
```

### Fase 2 · Navegación

```
Lee docs/rediseno/HANDOFF.md (secciones 4 y 5b) y mira referencias/png/Navegacion.png, Hoy.png (barra inferior) y HoyDesktop.png (barra lateral). Fase 2, rama rediseno/fase-2, todo bajo lab.nav_v2:
1. Implementa los 5 destinos: barra inferior por debajo de 1024 px y barra lateral desde 1024 px, con buscador ⌘K, selector Hogar/Javi/Tere y Ajustes en el avatar/pie.
2. Monta cada vista actual en su destino nuevo según la tabla de la sección 4 (las pantallas aún con su aspecto viejo; solo cambia dónde viven).
3. Redirecciones de los hash antiguos a la nueva ubicación.
4. Corrige los enlaces de las 3 alertas de Hoy que hoy mandan a «Ajustes › Patrimonio e inversión» para que vayan a Patrimonio › Inversión.
5. «Herramientas avanzadas» desaparece de la barra: todo lo que contenía se alcanza desde el buscador.
Pruebas: cada vista actual alcanzable en ≤ 2 toques desde su destino o en 1 búsqueda. PR con capturas móvil y escritorio.
```

### Fase 3 · Hoy

```
Lee docs/rediseno/HANDOFF.md (sección 5 «B1/B2 · Hoy» y 5b) y reproduce referencias/png/Hoy.png (móvil) y HoyDesktop.png (escritorio), usando referencias/html/Hoy.html y HoyDesktop.html para los valores exactos. Fase 3, rama rediseno/fase-3, bajo lab.hoy_v2.
Una sola pantalla responsive, no dos. Los datos salen de los motores existentes (canonical-daily-engine, canonical-home-margin, canonical-data-age, decisiones abiertas); no cambies ningún motor. Quita de Hoy lo que la sección 5 manda retirar (puntuación de salud, selector de horizonte, Guía, Modo reunión, Acciones rápidas, tarjetas «Sin datos», líneas «Fuente: canonical-…»).
Aceptación: a 390×844 se ven sin scroll la cifra principal y la primera decisión; a 1440×900, el gráfico completo y las 3 decisiones. PR con capturas lado a lado: referencia y resultado.
```

### Fase 4 · Movimientos, Importar, Clasificar y Repaso

```
Lee docs/rediseno/HANDOFF.md (secciones 5 B3, B4, B5, E1 y 5b) y reproduce referencias/png/Movimientos, MovimientosDesktop, Clasificar, Ritual, RitualDesktop, Importar e ImportarDesktop. Son pantallas EJEMPLO: copia el diseño, nunca las cifras. Fase 4, rama rediseno/fase-4, bajo lab.movimientos_v2.
Reutiliza la importación, los perfiles de extracto, el control de duplicados y las reglas que ya existen. Clasificar es una hoja inferior en móvil y un panel lateral derecho en escritorio, con los atajos del HANDOFF. El Repaso semanal registra solo su duración (UXS-03). El cuadre de un extracto es obligatorio: si no cuadra, no se importa.
Si alguna pieza de la pantalla depende de una función del backlog que aún no existe (buzón por Compartir, PDF pegado, cobertura), pinta su sitio como TarjetaPlegada y dímelo en el PR; no la construyas en esta fase.
```

### Fase 5 · Plan y Cierre

```
Lee docs/rediseno/HANDOFF.md (secciones 5 C1, C2, C3 y 5b) y reproduce referencias/png/PlanMes, PlanMesDesktop, Prevision, PrevisionDesktop, Cierre y CierreDesktop. Fase 5, rama rediseno/fase-5, bajo lab.plan_v2.
Sustituye el desplegable de 120 meses por el selector ‹ mes ›. Pliega las financiaciones a una fila. En Previsión, el horizonte va aquí (3 m · 12 m · 24 m · Hasta 2036) y el detalle de un día abre hoja (móvil) o panel fijado (escritorio). Usa los motores de previsión y cierre existentes sin modificarlos; lo que no tengan, plegado.
```

### Fase 6 · Patrimonio e Inversión

```
Lee docs/rediseno/HANDOFF.md (secciones 5 D1, D2 y 5b) y reproduce referencias/png/Patrimonio, PatrimonioDesktop, Inversion e InversionDesktop. Fase 6, rama rediseno/fase-6, bajo lab.patrimonio_v2.
Con la demo sin cartera, Inversión debe mostrar su estado vacío (sin posiciones, con acceso a añadir), no las cifras del ejemplo. El puente del año se dibuja con el kit de gráficos existente o SVG propio, con la etiqueta del eje truncado.
```

### Fase 7 · Deuda (solo después de NTC-05)

```
Antes de nada, confirma que existe un único motor de deuda (NTC-05). Si conviven varios, para y dime cuáles y qué cifras dan distintas; no sigas.
Si hay uno solo: lee docs/rediseno/HANDOFF.md (secciones 5 D3 y 5b) y reproduce referencias/png/Deuda y DeudaDesktop. Fase 7, rama rediseno/fase-7, bajo lab.deuda_v2.
Corrige las contradicciones listadas en D3 (titular «sin fecha estimable» frente a «septiembre de 2029», cuota 180 € frente a 480 €/mes, coste total frente a intereses 0 €). La fecha libre de deuda dice siempre cuántos contratos incluye. El «extra al mes» se guarda (WP-19).
```

### Fase 8 · Decidir y Ajustes

```
Lee docs/rediseno/HANDOFF.md (secciones 5 D4, E2 y 5b) y reproduce referencias/png/Taller, TallerDesktop, LoQuePide y LoQuePideDesktop. Fase 8, rama rediseno/fase-8, bajo lab.decidir_v2 y lab.ajustes_v2.
El Taller reúne los simuladores de deuda nueva que ya existen en 6 pasos; la política de deuda (XDN-03) y «lo que cambia en vuestros planes» (XDN-06) solo si su motor existe; si no, plegados. «Lo que la app te pide» muestra los minutos como supuestos hasta que haya medición real, y lo dice.
```

---

## 4. Revisión de cada PR (tú, 5 minutos)

- Abre las capturas del PR junto a la PNG de referencia. Si falta algo, pega: `Compara tu captura con docs/rediseno/referencias/png/X.png y corrige las diferencias de espaciado, color y jerarquía.`
- Comprueba que con el flag apagado la app está exactamente como antes.
- Cuando una fase lleve 2 semanas encendida sin problemas, pide: `Gradúa lab.X_v2: hazlo el comportamiento por defecto y elimina la vista antigua y su código.`
