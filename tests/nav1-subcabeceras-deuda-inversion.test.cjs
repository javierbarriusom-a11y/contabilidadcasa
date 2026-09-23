const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

// NAV-1 (BACKLOG_CONTABILIDADCASA_3_0.md §2.3): las 24 pantallas del grupo «Analizar» del menú
// avanzado ya estaban agrupadas conceptualmente por Deuda/Inversión/Seguros/Fiscal/Patrimonio —
// navigation-structure.test.cjs las nombraba por comentario — pero solo Seguros/Fiscal/Patrimonio
// (y Decidir/Analizar/Datos/Legacy) tenían una subcabecera visible (`data-e17-nav-label`, patrón
// OPT-25). Deuda e Inversión vivían sin la suya, agrupadas de facto bajo «Decidir». Esto solo añade
// las dos subcabeceras que faltaban, con el mismo mecanismo ya existente — sin interruptor de
// preferencia nuevo, sin motor nuevo.

test("NAV-1 · las subcabeceras «Deuda» e «Inversión» existen con el mismo patrón que Seguros/Fiscal/Patrimonio", () => {
  assert.match(html, /<p class="advanced-nav-label" data-e17-nav-label="deuda">Deuda<\/p>/);
  assert.match(html, /<p class="advanced-nav-label" data-e17-nav-label="inversion">Inversión<\/p>/);
});

test("NAV-1 · «Deuda» precede a sus cuatro enlaces y «Inversión» a sus cinco, en ese orden", () => {
  // href="#inversion-cartera" también aparece antes, en el enlace principal de la barra lateral
  // (fuera del menú avanzado) — se busca la entrada del propio menú avanzado, con su data-e17-group.
  const deudaLabel = html.indexOf('data-e17-nav-label="deuda"');
  const deudaComparar = html.indexOf('href="#deuda-comparar"');
  const deudaSimulador = html.indexOf('href="#deuda-simulador"');
  const inversionLabel = html.indexOf('data-e17-nav-label="inversion"');
  const inversionCarteraAdvanced = html.indexOf('href="#inversion-cartera" data-e17-group="analysis"');
  const inversionJubilacion = html.indexOf('href="#inversion-jubilacion"');
  assert.ok(deudaLabel > 0 && deudaLabel < deudaComparar, "«Deuda» debe preceder a sus enlaces");
  assert.ok(deudaSimulador < inversionLabel, "los cuatro enlaces de Deuda deben ir antes de «Inversión»");
  assert.ok(inversionCarteraAdvanced > 0 && inversionLabel < inversionCarteraAdvanced, "«Inversión» debe preceder a sus enlaces del menú avanzado");
  assert.ok(inversionJubilacion > 0, "Inversión · Jubilación sigue presente");
});

test("NAV-1 · «Decidir» sigue existiendo y precede a «Deuda», que a su vez precede a «Inversión» y a «Seguros»", () => {
  const decidirLabel = html.indexOf('data-e17-nav-label="decidir"');
  const deudaLabel = html.indexOf('data-e17-nav-label="deuda"');
  const inversionLabel = html.indexOf('data-e17-nav-label="inversion"');
  const segurosLabel = html.indexOf('data-e17-nav-label="seguros"');
  assert.ok(decidirLabel > 0 && decidirLabel < deudaLabel, "«Decidir» debe seguir precediendo a «Deuda»");
  assert.ok(deudaLabel < inversionLabel && inversionLabel < segurosLabel, "orden: Deuda → Inversión → Seguros");
});

test("NAV-1 · las cinco categorías nombradas por el backlog (Deuda/Inversión/Seguros/Fiscal/Patrimonio) tienen subcabecera visible", () => {
  ["deuda", "inversion", "seguros", "fiscal", "patrimonio"].forEach((group) => {
    assert.match(html, new RegExp(`data-e17-nav-label="${group}"`), `falta la subcabecera de ${group}`);
  });
});

test("NAV-1 · sigue habiendo exactamente 24 enlaces en el grupo «analysis» (esto no añade ni quita pantallas)", () => {
  const links = [...html.matchAll(/<a href="#[\w-]+" data-e17-group="analysis">/g)];
  assert.equal(links.length, 24, "NAV-1 solo añade subcabeceras visuales, nunca enlaces");
});
