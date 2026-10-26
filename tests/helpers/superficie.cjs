// XGO-01 · «uno entra, uno sale» (GOV-02) comprobado por el CI. Lo comparten la e2e que hace el inventario en el
// navegador (qa1, «XGO-01 · Uno entra, uno sale») y la prueba unitaria del manifiesto (xgo01-uno-entra-uno-sale).
//
// Qué se cuenta: los titulares (h2 y h3) que se ven por defecto en cada destino del menú principal y en cada pestaña
// a la que se llega desde ellos, con el tema v2, a 1280 px, sin datos del hogar y con el reloj en una fecha fija. Un
// titular es la forma más estable de contar «cosas que leer» en las dos generaciones de pantallas (tarjetas de
// siempre y bloques v2), que no comparten clases. No cuenta lo plegado (<details> cerrado), los diálogos, el menú
// «Más» ni lo que solo sale con datos: eso es lo que se ve el primer día, y es lo que más pesa.
const fs = require("node:fs");
const path = require("node:path");

const MANIFIESTO = path.resolve(__dirname, "..", "..", "docs", "gobierno", "superficie.json");
const FECHA_FIJA = [2026, 9, 26, 10, 0, 0]; // 26/10/2026 10:00: las puertas de fecha quedan como ese día

function leerManifiesto() {
  return JSON.parse(fs.readFileSync(MANIFIESTO, "utf8"));
}

function total(rutas) {
  return Object.values(rutas).reduce((s, n) => s + n, 0);
}

// Lo que permite el manifiesto: el techo base (solo baja) más lo que suman las excepciones escritas.
function permitido(m) {
  return m.base + (m.excepciones || []).reduce((s, e) => s + e.mas, 0);
}

// Qué entra y qué sale entre dos inventarios, para que el fallo diga exactamente qué ha cambiado.
function diferencias(antes, ahora) {
  const claves = [...new Set([...Object.keys(antes), ...Object.keys(ahora)])].sort();
  return claves.filter((k) => (antes[k] || 0) !== (ahora[k] || 0)).map((k) => `${k}: ${antes[k] || 0} → ${ahora[k] || 0}`);
}

// ---------- En el navegador (Playwright) ----------

async function contarTitulares(page) {
  return page.evaluate(() => {
    const visible = (e) => e.checkVisibility({ checkVisibilityCSS: true }) && e.getClientRects().length > 0;
    return [...document.querySelectorAll("h2, h3")].filter((e) => visible(e) && !e.closest("nav, header, dialog, details:not([open])")).length;
  });
}

// Un repintado puede llegar un poco después del cambio de ruta: se cuenta hasta que dos lecturas seguidas coinciden.
async function contarEstable(page) {
  let antes = -1;
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(250);
    const ahora = await contarTitulares(page);
    if (ahora === antes) return ahora;
    antes = ahora;
  }
  return antes;
}

async function pestanas(page) {
  return page.evaluate(() => {
    const visible = (e) => e.checkVisibility({ checkVisibilityCSS: true }) && e.getClientRects().length > 0;
    const navs = [...document.querySelectorAll("nav.e19-registrar-tabs")].filter(visible);
    return {
      enlaces: navs.flatMap((n) => [...n.querySelectorAll("a[href^='#']")]).filter(visible).map((a) => a.getAttribute("href")),
      botones: navs.flatMap((n) => [...n.querySelectorAll("button")]).filter(visible).map((b) => b.dataset.registrarTab || b.dataset.planTab || b.dataset.e17Target || b.textContent.replace(/\s+/g, " ").trim()),
    };
  });
}

// El inventario: { "#home": 4, "#registrar": 5, "#registrar › actuals": 3, … }. Las pestañas que son enlaces se visitan
// como rutas; las que son botones se pulsan una vez desde su ruta y se nombran por su data-* (el texto puede llevar
// un contador, como «29 sin real»).
async function inventario(page) {
  await page.clock.install({ time: new Date(...FECHA_FIJA) });
  await page.goto("/index.html#home");
  await page.locator("#home").waitFor({ timeout: 15000 });
  const cola = await page.locator("a.nav-primary-link").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  const vistas = new Set();
  const rutas = {};
  while (cola.length) {
    const ruta = cola.shift();
    if (vistas.has(ruta)) continue;
    vistas.add(ruta);
    await page.evaluate((h) => (location.hash = h), ruta);
    rutas[ruta] = await contarEstable(page);
    const { enlaces, botones } = await pestanas(page);
    enlaces.filter((h) => !vistas.has(h)).forEach((h) => cola.push(h));
    for (const etiqueta of botones) {
      const clave = `${ruta} › ${etiqueta}`;
      if (clave in rutas) continue;
      await page.evaluate((h) => (location.hash = h), ruta);
      const pulsado = await page.evaluate((texto) => {
        const visible = (e) => e.checkVisibility({ checkVisibilityCSS: true }) && e.getClientRects().length > 0;
        const boton = [...document.querySelectorAll("nav.e19-registrar-tabs button")].find((b) => visible(b) && (b.dataset.registrarTab || b.dataset.planTab || b.dataset.e17Target || b.textContent.replace(/\s+/g, " ").trim()) === texto);
        boton?.click();
        return Boolean(boton);
      }, etiqueta);
      if (pulsado) rutas[clave] = await contarEstable(page);
    }
  }
  return rutas;
}

module.exports = { MANIFIESTO, FECHA_FIJA, leerManifiesto, total, permitido, diferencias, inventario };
