# Nombres del hogar en el repositorio público

19/11/2026. Petición del hogar: «Haz esta tarea aquí: Quitar nombres del hogar del código público». La regla vigente es «sin
importes ni nombres del hogar en el repo», y el repositorio es público (GitHub Pages). Este documento no escribe ningún
nombre: «persona 1» y «persona 2» son las dos personas del hogar.

## 1. Inventario (19/11/2026, árbol actual, sin `dist/` ni el nombre de usuario de GitHub)

| Qué | Dónde | Cuántas | Riesgo |
|---|---|---|---|
| **Nombres completos y apellidos de cuatro personas (dos de ellas, terceros) y el nombre de una empresa** | `tools/check-public-privacy.mjs`, la propia protección, en claro | 6 frases | **El más alto: arreglado en la fase 1** |
| Los dos nombres de pila como **claves de datos guardados** (`owner`, `titular`, `payer`, `holders`, `incomes`…) | `canonical-household-split.js`, `canonical-portfolio.js`, `canonical-tax-report.js`, `canonical-scenario-schema.js`, `canonical-e15-goals.js`, `p2-domain.js`, `ux-settings.js`, `renta-datos-ui.js`, `local-renta-ui.js`, `informe-renta-ui.js`, `app.js` | cientos | Cambiarlas sin migrar rompe los datos, las copias y la nube |
| Los dos nombres como **texto que se ve** (botones, etiquetas, opciones, frases) | `index.html` (unas 28 líneas), `p2-ui.js`, `partidas-ui.js`, `views/new-life-*.js`, `views/executive-advisor.js`, `app.js` | decenas | Bajo; se puede sustituir por etiquetas configurables |
| **Reconocer partidas por su nombre** («nómina de persona 1», «salario de persona 2», «bonus…») | `canonical-timing.js`, `canonical-payroll-split.js`, `canonical-daily-engine.js`, `partidas-ui.js`, `app.js`, `p2-domain.js`, `ux-settings.js` | unas 15 reglas | La lógica depende de cómo se llaman las partidas en los datos del hogar |
| **La plantilla de financiaciones del Excel del hogar** (filas y tarjetas por persona y entidad) | `app.js` (filas 357-402) | unas 45 líneas | Además del nombre, describe sus productos financieros |
| Pruebas y datos de prueba con los nombres | `tests/` (≈40 ficheros, `tests/fixtures/ntc1-timing-golden.json`) | ≈500 líneas | Cambian con las claves |
| Documentación e historial | `PROJECT_STATE.md`, `docs/historial/`, backlogs, `MANUAL_USUARIO.md`, `docs/OPT22_MODELO_HOGAR.md`, maquetas | ≈150 líneas | Texto; se reescribe sin riesgo |

**Lo que este trabajo no puede quitar: el historial de git.** Cada commit desde el principio sigue en GitHub con todo lo
anterior, y lo mismo pasa con `finanzas-casa-def`, que también es público y está congelado. Limpiar el árbol evita que el
problema siga creciendo, pero quien mire el historial lo verá. Hay tres salidas (§3), y es una decisión del hogar.

## 2. Plan por fases

1. **Fase 1 (hecha, 19/11/2026).** La protección de privacidad deja de escribir las frases prohibidas: guarda su huella
   SHA-256, normalizada (minúsculas, sin acentos y una sola separación entre palabras), y su primera palabra para no calcular
   la huella de cada trío de palabras. Detecta igual una frase escrita con acentos, guiones o espacios dobles, y cuando falla
   enseña la huella, no la frase (el registro del CI también es público). Una huella sin sal no protege frente a quien ya
   sospecha el nombre y lo prueba, pero sí frente a leerlo o encontrarlo buscando.
2. **Fase 2 (hecha, 19/11/2026): lo que se ve (sin tocar datos).** Los nombres que se ven salen de una configuración del hogar («cómo os llamáis»,
   en Ajustes), guardada en sus datos y nunca en el código. Por defecto, «Persona 1» y «Persona 2». Las claves internas no
   cambian todavía.
3. **Fase 3 (hecha, 19/11/2026): las reglas por nombre.** Reconocer «la nómina de la persona 1» con los nombres configurados (o con la persona
   asignada a cada partida en Datos › Familia), no con un nombre escrito en el código. La plantilla de financiaciones sale del
   código: se queda solo en los datos del hogar.
4. **Fase 4: las claves internas.** Pasan a ser neutras («p1»/«p2»), con una migración que convierta los datos guardados, las
   copias de seguridad antiguas al restaurarlas y lo que llega de la nube. Va con su prueba de ida y vuelta: copia antigua →
   restaurar → mismas cifras.
5. **Fase 5: el candado.** Con el código limpio, los dos nombres de pila pasan a la protección (por su huella) y a una prueba
   que recorre todo el repositorio, no solo lo publicado.

### Fase 2, cómo quedó

- `household-members.js` (antes de `app.js`): `memberLabel("p1")`, `memberTemplate("… {p1} …")` y `paintMemberLabels()`, que
  rellena en la página los `data-member` y `data-member-template`. Reconoce también las claves que guardan hoy los datos, para
  no tocarlos hasta la fase 4. `render()` vuelve a pintar los nombres, por si llegan de la nube.
- Ajustes › Hogar y cuentas › «Cómo os llamáis» (plegado y sin titular): dos campos de hasta 30 caracteres, sin marcas,
  guardados en `scenarioSettings.householdNames` (copia y nube). Vacíos, «Persona 1» y «Persona 2».
- Con ellos salen: el selector de vista familiar, el titular de escenarios, la renta y el local, el reparto y el saldo de
  gastos compartidos, la separación patrimonial, la familia de Datos, la hucha y el crédito del simulador de proyectos y las
  pantallas de «Versiones anteriores». Los motores puros dicen «la nómina principal» o «el salario del día 25».
- Lo que queda, a propósito: los valores que guarda el simulador de proyectos, cómo se infiere el titular por el nombre de una
  partida y la plantilla de financiaciones (fases 3 y 4). Una prueba (`tests/privacidad-nombres.test.cjs`) falla si vuelve a
  verse un nombre fuera de esas líneas, y no escribe los nombres: los lee de base64.

### Fase 3, cómo quedó

- `household-members.js` añade `huella()` (cyrb53, 53 bits, sobre el texto normalizado), `personasEnTexto()`, `nominaDe()` y
  `contieneHuella()`. Las claves de siempre de cada persona y las formas de su nombre que aparecen en los datos van por su
  huella; `clave()` ya no adivina por la longitud y la primera letra (una palabra cualquiera de cuatro letras ya no es nadie).
- **Las reglas, sin el nombre:** la nómina principal y la del día 25 del motor de fechas, la nómina que llega antes de la
  principal, el salario de la persona 2 que suman Planificación y Partidas, el titular que infiere el simulador de proyectos y
  `inferOwner` de P2 y de la vista familiar. La regla de la nómina es la misma de antes (la prueba de oro de 493 casos no
  cambia): solo la forma corta del nombre, en la misma posición. Ahora también vale el nombre escrito en Ajustes.
- **Palabra a palabra:** antes, `includes("…")` reconocía a la persona 2 dentro de «intereses»; el simulador de proyectos
  atribuía a esa persona un proyecto cuyo nombre lo llevase. Ya no.
- **El titular del crédito del simulador** guarda «p1»/«p2»; los proyectos guardados con la clave de siempre se leen igual
  (`memberKey`). En tres sitios se enseñaba la clave en bruto: ahora, el nombre de Ajustes.
- **La plantilla de financiaciones sale del código.** Las filas de «Financiaciones» son las de los datos del hogar (la plantilla
  las dejaba guardadas en cada carga desde el principio). De ella quedan solo huellas: los seis subgrupos del Excel al
  importarlo, las dos filas que el hogar quitó (siguen fuera aunque vuelvan en una copia antigua) y las ocho filas que no
  cuentan en la fórmula del gasto variable.
- **Una fuga en el sitio público, cerrada de paso:** la plantilla metía en la demo 22 filas a cero con los nombres de las
  personas y de sus tarjetas. La demo trae ahora su propia fila de ejemplo con los 180 € que una de ellas recibía por una
  regla del código, y sus cifras no cambian.
- **Diferencias conocidas, sin efecto en los datos del hogar:** una fila guardada con otra etiqueta conserva la suya (antes la
  plantilla la reescribía en cada carga) y una fila de la plantilla que faltara en los datos ya no se crea a cero.
- **Hallazgo, fuera de este trabajo:** `app.js` sigue llevando un importe del hogar (`CURRENT_REUNIFIED_DEBT_PAYMENT`, la cuota
  de una refinanciación) y una regla por el nombre de su entidad (`adjustedDebtPlannedValue`). No son nombres de personas,
  pero chocan con «sin importes en el repo»; se proponen para la fase 5.

## 3. Decisiones del hogar

**Decididas el 19/11/2026:** D-N24, poner el repositorio en privado (lo hace el hogar en GitHub; GitHub Pages desde un
repositorio privado necesita un plan de pago, o mover el sitio). D-N25, los nombres en Ajustes y, mientras tanto, «Persona 1»
y «Persona 2». D-N26, claves neutras con migración probada (fase 4, en su propio PR).

Lo que se preguntó:

- **D-N24 · El historial.** (a) Poner el repositorio en privado: lo único que lo quita de la vista de verdad, pero GitHub
  Pages desde un repositorio privado necesita un plan de pago, o mover el sitio a otro sitio; (b) reescribir el historial
  (`git filter-repo`) y forzar la subida: lo hace el dueño del repositorio, no esta sesión (las reglas del proyecto prohíben
  forzar la subida a `main`), y las copias que ya existan fuera no se borran; (c) aceptarlo y limpiar solo lo que viene.
- **D-N25 · Lo que se ve por defecto** (fase 2): «Persona 1 / Persona 2» hasta que lo cambiéis en Ajustes, o pedir los nombres
  la primera vez.
- **D-N26 · Las claves internas** (fase 4): sí, con migración, o dejarlas como están y quitar solo lo que se ve y la documentación.
