#!/usr/bin/env node
// Ensayo de extremo a extremo de los momentos del hogar con los datos de demostración (15/10/2026, sesión 310).
//
// QUÉ ES: un recorrido por la interfaz REAL (clics y tecleo) de lo que se le pide al hogar hasta el 3/11: (1) abrir la app el 15-17/10,
// (2) dar los datos fiscales, (3) cerrar octubre con saldo y valorar la cartera; más la prueba del «ruido» de Cierre cuando salen
// a la vez todos sus avisos. Cuenta pasos (clics, campos tecleados, pantallas) y comprueba lo que debería ocurrir.
//
// QUÉ NO ES: no mide segundos humanos —un guion no teclea ni lee como una persona— ni sustituye a la prueba con personas (WP-54).
// Tampoco forma parte del CI: se lanza a mano contra un sitio ya construido.
//
// USO:   python3 -m http.server 4183 -d dist &
//        PLAYWRIGHT_CHROMIUM_PATH=<chrome> BASE_URL=http://127.0.0.1:4183 OUT=/tmp/ensayo node tools/ensayo-hogar.cjs
//
// SALIDA: un JSON por stdout con cada comprobación (ok / fallo y el dato observado) y capturas en OUT.
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const BASE = process.env.BASE_URL || "http://127.0.0.1:4183";
const OUT = process.env.OUT || path.join(process.cwd(), "ensayo-hogar-capturas");
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const note = (momento, comprobacion, ok, dato) => results.push({ momento, comprobacion, ok, dato });

async function nuevaPagina(browser, fecha, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  page.on("dialog", async (d) => { errores.push(`diálogo nativo: ${d.message()}`); await d.dismiss(); });
  await page.clock.install({ time: fecha });
  page.errores = errores;
  page.pasos = { clics: 0, campos: 0 };
  page.clic = async (selector) => { await page.click(selector); page.pasos.clics += 1; };
  page.teclear = async (selector, texto) => { await page.fill(selector, texto); page.pasos.campos += 1; };
  await page.goto(`${BASE}/index.html`);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
  await page.reload();
  return page;
}
const fotos = (page) => page.evaluate(() => Object.keys((JSON.parse(localStorage.getItem(storageKey("liquidity-backtest")) || "null") || {}).freezes || {}));

// 1) Abrir la app el 15-17/10: la foto de liquidez (WP-12) se congela sola al abrir, sea cual sea la pantalla de entrada.
async function momento1(browser) {
  for (const [nombre, hash] of [["pantalla de inicio (sin #)", ""], ["Hoy (#home)", "#home"], ["Registrar (#registrar)", "#registrar"]]) {
    const page = await nuevaPagina(browser, new Date(2026, 9, 16, 9, 0, 0));
    await page.goto(`${BASE}/index.html${hash}`);
    await page.waitForTimeout(2500);
    const claves = await fotos(page);
    note("1 · abrir la app 15-17/10", `entrando por ${nombre} el 16/10 se guarda la foto del día 15`, claves.includes("2026-10:d15"), claves);
    await page.context().close();
  }
  const page = await nuevaPagina(browser, new Date(2026, 9, 15, 9, 0, 0));
  await page.goto(`${BASE}/index.html`);
  await page.waitForTimeout(2500);
  const primera = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem(storageKey("liquidity-backtest"))).freezes));
  await page.clock.setSystemTime(new Date(2026, 9, 17, 9, 0, 0));
  await page.reload();
  await page.waitForTimeout(2000);
  const segunda = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem(storageKey("liquidity-backtest"))).freezes));
  note("1 · abrir la app 15-17/10", "abrir de nuevo el 17/10 no reescribe la foto del 15", primera === segunda, { primera: primera.slice(0, 160) });
  await page.context().close();
  const tarde = await nuevaPagina(browser, new Date(2026, 9, 18, 9, 0, 0));
  await tarde.goto(`${BASE}/index.html`);
  await tarde.waitForTimeout(2500);
  const clavesTarde = await fotos(tarde);
  note("1 · abrir la app 15-17/10", "abrir por primera vez el 18/10 NO hay foto del día 15 (la ventana es de tres días)", !clavesTarde.includes("2026-10:d15"), clavesTarde);
  await tarde.context().close();
}

// 2) Datos fiscales: ¿dónde se teclean? (WP-23 PR-2 «Tus datos fiscales» está en el plan pero no construido).
async function momento2(browser) {
  const page = await nuevaPagina(browser, new Date(2026, 9, 20, 9, 0, 0));
  await page.goto(`${BASE}/index.html#herramientas-fiscal`);
  await page.waitForSelector("#campanaFiscalCard", { timeout: 15000 });
  const r = await page.evaluate(() => {
    const card = document.querySelector("#campanaFiscalCard");
    return { campos: card.querySelectorAll("input, select, textarea").length, ejemplo: card.getAttribute("data-ejemplo") };
  });
  note("2 · datos fiscales (20/10)", "existe en la app un sitio donde teclear los datos fiscales del hogar", r.campos > 0, r);
  await page.screenshot({ path: path.join(OUT, "fiscal-1280.png") });
  await page.context().close();
}

// 3) Cerrar octubre con saldo (1-3/11) y valorar la cartera.
async function momento3(browser) {
  const page = await nuevaPagina(browser, new Date(2026, 10, 2, 9, 0, 0));
  await page.goto(`${BASE}/index.html#registrar`);
  await page.waitForTimeout(1500);
  const antes = await page.evaluate(() => state.balanceMode);
  await page.clic("[data-pulso-manual]");
  await page.waitForTimeout(400);
  const coincide = await page.$$("[data-pulso-coincide]");
  // Cada «Coincide» repinta la tarjeta: se pulsa siempre el primero que quede.
  for (let i = 0; i < coincide.length; i += 1) { await page.clic("[data-pulso-coincide]"); await page.waitForTimeout(300); }
  await page.waitForTimeout(500);
  const despues = await page.evaluate(() => ({ modo: state.balanceMode, fecha: state.balanceDate }));
  note("3 · cerrar octubre con saldo", "declarar los saldos del banco = «Pasar a real manual» + «Coincide» por cuenta", antes === "auto" && despues.modo === "manual" && coincide.length >= 2, { antes, despues, clics: page.pasos.clics, cuentas: coincide.length });
  await page.screenshot({ path: path.join(OUT, "saldos-1280.png") });

  // Valorar la cartera: tres posiciones de ejemplo, un diálogo, un valor por posición.
  await page.goto(`${BASE}/index.html#inversion-cartera`);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const base = { provenance: "manual", asOf: "2026-09-20", acquisitionDate: "2020-01-10", quantity: 100, contributions: [], disposals: [] };
    saveIv1PositionsList([
      { ...base, id: "A", type: "fondo", label: "Fondo A ficticio", costBasis: 8000, currentValue: 9800 },
      { ...base, id: "B", type: "fondo", label: "Fondo B ficticio", costBasis: 5000, currentValue: 5200 },
      { ...base, id: "C", type: "accion", label: "Acción C ficticia", costBasis: 2000, currentValue: 2500 },
    ]);
    renderIv1PositionList();
  });
  page.pasos = { clics: 0, campos: 0 };
  await page.clic("#valoracionAbrir");
  await page.waitForSelector("#valoracionDialog[open]");
  const campos = await page.$$("#valoracionDialog input[data-valoracion-valor]");
  const nuevos = ["10100", "5300", "2400"];
  let escritos = 0;
  for (const campo of campos) {
    if (escritos < nuevos.length) { await campo.fill(nuevos[escritos]); page.pasos.campos += 1; escritos += 1; }
  }
  await page.screenshot({ path: path.join(OUT, "valoracion-dialogo-1280.png") });
  await page.clic("#valoracionGuardar");
  await page.waitForTimeout(600);
  const resumen = await page.evaluate(() => document.querySelector("#valoracionResumen")?.innerText || "");
  note("3 · valorar la cartera", "valorar tres posiciones = abrir, un valor por posición y Guardar", escritos === 3 && /3 de 3/.test(resumen), { pasos: page.pasos, resumen });

  // Cierre: los pasos y por qué no se puede firmar sin sesión (decisión del 4/10: el hogar sí inicia sesión).
  await page.goto(`${BASE}/index.html#cierre`);
  await page.waitForSelector("#cierreSteps li", { timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.click('#cierreSteps li[data-cierre-step="3"]', { force: true });
  const cierre = await page.evaluate(() => ({ boton: document.querySelector("#cierreSignButton")?.innerText, deshabilitado: document.querySelector("#cierreSignButton")?.disabled, comprobaciones: [...document.querySelectorAll(".deuda-ruta-checklist li")].map((l) => `${l.className.includes("is-ok") ? "✓" : "✗"} ${l.innerText}`), cuentas: [...document.querySelectorAll("#cierreStepBody td")].slice(0, 0) }));
  await page.click('#cierreSteps li[data-cierre-step="1"]', { force: true });
  const estados = await page.evaluate(() => [...document.querySelectorAll("#cierreStepBody tbody tr")].map((tr) => tr.innerText.replace(/\s+/g, " ").trim()));
  note("3 · cerrar octubre con saldo", "firmar exige sesión de la nube (decisión del hogar 4/10: sí inicia sesión): sin sesión el botón está desactivado", cierre.deshabilitado === true, cierre);
  const sinConciliar = estados.filter((fila) => /SIN CONCILIAR/i.test(fila)).length;
  const dicenCuadran = cierre.comprobaciones.some((c) => /✓ Las cuentas cuadran/.test(c));
  note("3 · cerrar octubre con saldo", "con cuentas «sin conciliar» la comprobación NO dice «Las cuentas cuadran» (regla: sin conciliar nunca es «cuadra»)", !(sinConciliar > 0 && dicenCuadran), { sinConciliar, dicenCuadran, estados });
  await page.screenshot({ path: path.join(OUT, "cierre-1280.png"), fullPage: true });
  note("3 · cierre", "sin errores de página ni diálogos nativos", page.errores.length === 0, page.errores);
  await page.context().close();
}

// 4) El ruido de Cierre: todos sus avisos a la vez, en ordenador y en móvil.
async function ruido(browser) {
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await nuevaPagina(browser, new Date(2026, 10, 2, 9, 0, 0), vp);
    await page.goto(`${BASE}/index.html#cierre`);
    await page.waitForSelector("#cierreVersions", { state: "attached", timeout: 20000 });
    await page.evaluate(() => {
      const iso = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return isoLocalDate(d); };
      // Plan B firmado y que salta.
      const plan = FinanceCanonicalContingencyPlan;
      let p = plan.normalizePlan({ trigger: { mode: "amount", amount: 99999999, consecutive: 2, horizon: 6 }, actions: [{ kind: "cut-discretionary", pct: 20, months: 3 }, { kind: "credit-line", amount: 1500 }] });
      p = plan.sign(p, { signers: ["Ana", "Luis"], today: "2026-10-13" }).plan;
      storageSet(storageKey("contingency-plan"), JSON.stringify(p));
      // Deuda en la sombra.
      const rows = [];
      let balance = 3000;
      const add = (date, amount, movement) => rows.push({ date, month: date.slice(0, 7), movement, details: "", amount, balance: (balance += 1), accountId: "caixabank" });
      const back = (days) => { const d = new Date(); d.setDate(d.getDate() - days); return isoLocalDate(d); };
      add(back(40), -30, "MOVISTAR CUOTA TERMINAL 2 DE 24");
      add(back(10), -30, "MOVISTAR CUOTA TERMINAL 3 DE 24");
      add(back(8), -49.9, "KLARNA PAGO 2 DE 3");
      baseData.transactions = mergeTransactions([], rows);
      refreshMovementRollups();
      // Puente con un cambio relevante.
      const bridge = FinanceCanonicalForecastBridge;
      const series = JSON.parse(JSON.stringify(canonicalScenarioResults.base.forecast.series));
      const year = Number(series[0].monthKey.slice(0, 4));
      const first = bridge.freezeYearEnd({ monthKey: `${year}-09`, closedAt: `${year}-10-02T10:00:00Z`, series, actuals: null });
      const amount = Math.max(1, Math.round(Math.abs(first.snapshot.yearEndLiquidity) * 30 / 100));
      const worse = JSON.parse(JSON.stringify(series));
      let shift = 0;
      worse.forEach((row) => {
        if (row.monthKey === `${year}-12`) { row.totals.outflowsBeforeSaving += amount; row.components.outflow.project = (row.components.outflow.project || 0) + amount; shift -= amount; }
        if (row.monthKey >= `${year}-12`) row.totals.closingLiquidity += shift;
      });
      const second = bridge.freezeYearEnd({ monthKey: `${year}-10`, closedAt: `${year}-11-02T10:00:00Z`, series: worse, actuals: null });
      puenteSave(bridge.upsert(bridge.upsert([], first.snapshot), second.snapshot));
      // Calma en caídas: tres valoraciones y una caída del 41 %.
      scenarioSettings.portfolioPositions = [{ id: "cal-a", type: "fondo", label: "Fondo de prueba", quantity: 0, costBasis: 1000, currentValue: 700, asOf: iso(-10), acquisitionDate: iso(-400), provenance: "declared", contributions: [] }];
      saveScenarioSettings();
      savePortfolioValuations({ valuations: [
        { date: iso(-100), savedAt: new Date().toISOString(), points: [{ id: "cal-a", value: 1000, cost: 1000 }] },
        { date: iso(-40), savedAt: new Date().toISOString(), points: [{ id: "cal-a", value: 1200, cost: 1000 }] },
        { date: iso(-10), savedAt: new Date().toISOString(), points: [{ id: "cal-a", value: 700, cost: 1000 }] },
      ], timings: [] });
      renderCierre();
    });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const ids = ["cierreValoracionAviso", "planBAviso", "sombraAviso", "puenteAviso", "calmaAviso"];
      const visibles = ids.map((id) => document.getElementById(id)).filter((el) => el && !el.hidden && el.getBoundingClientRect().height > 0);
      const alturas = visibles.map((el) => ({ id: el.id, alto: Math.round(el.getBoundingClientRect().height) }));
      const primeraTarjeta = document.querySelector("#cierreWizard")?.getBoundingClientRect().top + window.scrollY;
      const ultimoAviso = visibles.length ? Math.max(...visibles.map((el) => el.getBoundingClientRect().bottom + window.scrollY)) : 0;
      return { visibles: alturas, suma: alturas.reduce((s, a) => s + a.alto, 0), asistenteEmpiezaEn: Math.round(primeraTarjeta || 0), avisosTerminanEn: Math.round(ultimoAviso), ventana: window.innerHeight, desborda: document.documentElement.scrollWidth > window.innerWidth };
    });
    note("4 · ruido de Cierre", `todos los avisos a la vez a ${vp.width} px: cuántos salen y cuánto ocupan`, m.visibles.length >= 4 && !m.desborda, m);
    await page.screenshot({ path: path.join(OUT, `cierre-avisos-${vp.width}.png`), fullPage: true });
    note("4 · ruido de Cierre", `sin errores de página a ${vp.width} px`, page.errores.length === 0, page.errores);
    await page.context().close();
  }
}

(async () => {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
  for (const paso of [momento1, momento2, momento3, ruido]) {
    try { await paso(browser); } catch (error) { note(paso.name, "el paso se completa", false, String(error).slice(0, 400)); }
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
})();
