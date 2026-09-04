const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// DEX5 (Oleada 2, Bloque 1): guía de primeros pasos para un hogar nuevo. Decisión explícita del
// usuario (3-sep-2026), tras preguntarle: "sin ocultar nada, solo guiar" — ninguna pantalla se
// oculta, esto solo señala Hoy + Registrar como punto de partida durante la primera semana de uso
// real (no una fecha de calendario). No existía ningún mecanismo de "primer uso" en el repositorio
// antes de esta tarea (búsqueda exhaustiva sin resultado).

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function extractConst(name) {
  const start = app.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name}`);
  const end = app.indexOf(";\n", start);
  return app.slice(start, end + 1);
}

function sandbox(extra = {}) {
  const store = { ...(extra.initialStorage || {}) };
  const context = {
    storageKey: (name) => `${name}:test`,
    storageGet: (key, fallback = "") => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : fallback),
    storageSet: (key, value) => { store[key] = value; },
    ...extra,
  };
  vm.createContext(context);
  ["DEX5_FIRST_USE_KEY", "DEX5_DISMISSED_KEY", "DEX5_FIRST_WEEK_MS"].forEach((name) => vm.runInContext(extractConst(name), context));
  ["dex5EnsureFirstUseRecorded", "dex5IsFirstWeek", "renderDex5OnboardingBanner", "handleDex5OnboardingDismiss"].forEach((name) => vm.runInContext(extractFunction(name), context));
  return { ctx: context, store };
}

test("dex5EnsureFirstUseRecorded · sin marca previa, la crea con la hora actual y la persiste", () => {
  const { ctx, store } = sandbox();
  const before = Date.now();
  const recorded = ctx.dex5EnsureFirstUseRecorded();
  assert.ok(new Date(recorded).getTime() >= before);
  assert.equal(store["dex5-first-use-at:test"], recorded);
});

test("dex5EnsureFirstUseRecorded · con marca ya guardada, la devuelve tal cual sin sobrescribirla", () => {
  const { ctx, store } = sandbox({ initialStorage: { "dex5-first-use-at:test": "2026-01-01T00:00:00.000Z" } });
  assert.equal(ctx.dex5EnsureFirstUseRecorded(), "2026-01-01T00:00:00.000Z");
  assert.equal(store["dex5-first-use-at:test"], "2026-01-01T00:00:00.000Z");
});

test("dex5IsFirstWeek · dentro de los 7 días desde el primer uso, es cierto", () => {
  const { ctx } = sandbox();
  const now = new Date("2026-09-10T12:00:00.000Z");
  assert.equal(ctx.dex5IsFirstWeek("2026-09-05T12:00:00.000Z", now), true); // 5 días
});

test("dex5IsFirstWeek · a partir del octavo día, es falso", () => {
  const { ctx } = sandbox();
  const now = new Date("2026-09-13T12:00:01.000Z");
  assert.equal(ctx.dex5IsFirstWeek("2026-09-06T12:00:00.000Z", now), false); // justo pasados 7 días
});

test("dex5IsFirstWeek · sin marca de primer uso, es falso (nunca inventa una fecha)", () => {
  const { ctx } = sandbox();
  assert.equal(ctx.dex5IsFirstWeek(""), false);
  assert.equal(ctx.dex5IsFirstWeek(null), false);
});

function fakeBanner() {
  return { hidden: true, innerHTML: "" };
}

test("renderDex5OnboardingBanner · un hogar nuevo (sin marca previa) ve la guía, apuntando a Registrar y Hoy", () => {
  const banner = fakeBanner();
  const { ctx } = sandbox({ qs: (id) => (id === "dex5OnboardingBanner" ? banner : null) });
  ctx.renderDex5OnboardingBanner();
  assert.equal(banner.hidden, false);
  assert.match(banner.innerHTML, /data-home-nav="registrar"/);
  assert.match(banner.innerHTML, /id="dex5OnboardingDismiss"/);
});

test("renderDex5OnboardingBanner · pasada la primera semana, no se muestra", () => {
  const banner = fakeBanner();
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const { ctx } = sandbox({
    qs: (id) => (id === "dex5OnboardingBanner" ? banner : null),
    initialStorage: { "dex5-first-use-at:test": eightDaysAgo },
  });
  ctx.renderDex5OnboardingBanner();
  assert.equal(banner.hidden, true);
  assert.equal(banner.innerHTML, "");
});

test("renderDex5OnboardingBanner · descartada a mano, no vuelve a mostrarse aunque siga dentro de la primera semana", () => {
  const banner = fakeBanner();
  const { ctx } = sandbox({
    qs: (id) => (id === "dex5OnboardingBanner" ? banner : null),
    initialStorage: { "dex5-first-use-at:test": new Date().toISOString() },
  });
  ctx.handleDex5OnboardingDismiss();
  assert.equal(banner.hidden, true);
});

test("handleDex5OnboardingDismiss · persiste el descarte antes de repintar", () => {
  const banner = fakeBanner();
  const { ctx, store } = sandbox({ qs: (id) => (id === "dex5OnboardingBanner" ? banner : null) });
  ctx.handleDex5OnboardingDismiss();
  assert.equal(store["dex5-onboarding-dismissed:test"], "true");
});

test("index.html declara el contenedor de la guía dentro de Hoy, con .e19-next-step (OPT-19: sin banner nuevo)", () => {
  const homeStart = html.indexOf('id="home"');
  const bannerStart = html.indexOf('id="dex5OnboardingBanner"');
  assert.ok(bannerStart > homeStart && bannerStart - homeStart < 700, "El banner debe vivir justo al principio de #home");
  assert.match(html, /class="dex5-onboarding-banner e19-next-step" id="dex5OnboardingBanner"/);
});

test("el botón «Ya lo tengo claro» está cableado en el mismo click delegado de #home que la navegación", () => {
  assert.match(app, /if \(event\.target\.closest\("#dex5OnboardingDismiss"\)\) \{ handleDex5OnboardingDismiss\(\); return; \}/);
});

test("renderDex5OnboardingBanner se llama en init(), después de cargar el estado local", () => {
  const source = extractFunction("init");
  assert.match(source, /loadLocalState\(\);\s*\n\s*renderDex5OnboardingBanner\(\);/);
});
