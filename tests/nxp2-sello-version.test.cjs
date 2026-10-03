const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

// WP-01 (NXP-02, BACKLOG_DEFINITIVO.md §5.1 y docs/PLAN_IMPLEMENTACION_2026-10-03.md): sello de
// versión, aviso de «versión nueva» y «Novedades». El Service Worker hace skipWaiting() +
// clients.claim() y sirve primero de caché: la primera apertura tras un despliegue enseña la versión
// anterior sin decir nada. Ahora la página sabe qué versión corre (BUILD_INFO, reescrito en el
// build), la compara con version.json y avisa —sin recargar sola— cuando la nueva ya está descargada.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const shell = require("../ux-shell.js");
const novedades = require("../novedades.js");

const SHA_A = "9d64a55c0ffee0000000000000000000000000aa";
const SHA_B = "1234567890abcdef1234567890abcdef12345678";
const flush = async () => {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

test("el sello distingue una versión publicada de una de desarrollo", () => {
  assert.equal(shell.formatBuildStamp({ version: "dev" }), "Versión de desarrollo");
  assert.equal(shell.formatBuildStamp({ version: "local", builtAt: "2026-10-03T10:00:00Z" }), "Versión de desarrollo");
  assert.equal(shell.formatBuildStamp({ version: SHA_A }), "Versión 9d64a55");
  // Hora de Madrid (UTC+2 en octubre), no la del servidor de CI.
  assert.equal(shell.formatBuildStamp({ version: SHA_A, builtAt: "2026-10-03T22:30:00Z" }), "Versión 9d64a55 · 4/10/2026, 00:30");
  assert.equal(shell.formatBuildStamp({ version: SHA_A, builtAt: "no es fecha" }), "Versión 9d64a55");
  assert.equal(shell.BUILD_INFO.version, "dev", "en el repositorio el sello vale «dev»; solo el build lo reescribe");
});

test("solo avisa cuando las dos versiones son publicadas y distintas", () => {
  assert.equal(shell.compareDeployedVersion({ running: SHA_A, published: SHA_A }), "current");
  assert.equal(shell.compareDeployedVersion({ running: SHA_A, published: SHA_A.toUpperCase() }), "current");
  assert.equal(shell.compareDeployedVersion({ running: SHA_A, published: SHA_B }), "outdated");
  assert.equal(shell.compareDeployedVersion({ running: "dev", published: SHA_B }), "unknown");
  assert.equal(shell.compareDeployedVersion({ running: SHA_A, published: "local" }), "unknown");
  assert.equal(shell.compareDeployedVersion({ running: SHA_A }), "unknown");
});

test("la versión nueva está lista cuando su caché existe y la anterior ya se borró", () => {
  const fresh = `finanzas-casa-shell-${SHA_B.slice(0, 12)}`;
  const old = `finanzas-casa-shell-${SHA_A.slice(0, 12)}`;
  assert.equal(shell.isPublishedVersionCached([old], SHA_B), false, "aún no ha empezado a instalarse");
  assert.equal(shell.isPublishedVersionCached([old, fresh], SHA_B), false, "instalándose: la anterior sigue viva");
  assert.equal(shell.isPublishedVersionCached([fresh, "otra-cache"], SHA_B), true, "activada");
  assert.equal(shell.isPublishedVersionCached([fresh], "local"), false);
});

test("un cambio de controlador solo es actualización si ya había uno al cargar", () => {
  assert.equal(shell.isUpdateControllerChange({ hadController: true }), true);
  assert.equal(shell.isUpdateControllerChange({ hadController: false }), false, "la primera instalación no es una versión nueva");
});

test("«Novedades» cuenta solo lo no visto en este dispositivo", () => {
  const entries = [{ id: "c" }, { id: "b" }, { id: "a" }];
  assert.deepEqual(shell.unseenNovedades(entries, "a").map((entry) => entry.id), ["c", "b"]);
  assert.deepEqual(shell.unseenNovedades(entries, "c"), []);
  assert.deepEqual(shell.unseenNovedades(entries, "").map((entry) => entry.id), ["c"], "primera vez: solo la más reciente, no todo el historial");
  assert.deepEqual(shell.unseenNovedades(entries, "retirada").map((entry) => entry.id), ["c"]);
  assert.deepEqual(shell.unseenNovedades([], "a"), []);
});

test("novedades.js cumple el formato: id único, fecha, ≤ 140 caracteres, #vista y la más reciente primero", () => {
  assert.ok(Array.isArray(novedades) && novedades.length > 0);
  assert.deepEqual(shell.validateNovedades(novedades), []);
  assert.ok(novedades.some((entry) => entry.id === "2026-10-03-wp01"), "WP-01 se anuncia a sí mismo");
  assert.deepEqual(
    shell.validateNovedades([{ id: "x", fecha: "2026-10-01", texto: "a" }, { id: "x", fecha: "2026-10-02", texto: "", href: "javascript:alert(1)" }]),
    ["x: id repetido", "x: sin texto", "x: href debe ser #vista", "x: fuera de orden (la más reciente primero)"],
  );
  assert.equal(shell.formatNovedadDate("2026-10-03"), "3/10/2026");
});

test("el marcado vive fuera de Hoy y fuera de app.js, y novedades.js carga antes que ux-shell.js", () => {
  const html = read("index.html");
  const sidebar = html.slice(html.indexOf('<aside class="sidebar"'), html.indexOf("</aside>", html.indexOf('<aside class="sidebar"')));
  for (const id of ["versionStamp", "versionStampLabel", "novedadesBadge", "novedadesList"]) {
    assert.match(sidebar, new RegExp(`id="${id}"`), `${id} debe estar en el menú lateral`);
  }
  const home = html.slice(html.indexOf('id="home"'), html.indexOf("</section>", html.indexOf('id="home"')));
  assert.doesNotMatch(home, /versionStamp|updateToast/);
  assert.match(html, /<div class="update-toast" id="updateToast" role="status" aria-live="polite" hidden>/);
  assert.ok(html.indexOf('src="novedades.js?v=') > 0 && html.indexOf('src="novedades.js?v=') < html.indexOf('src="ux-shell.js?v='));
  assert.doesNotMatch(read("app.js"), /versionStamp|updateToast|FinanceNovedades/, "WP-01 no ocupa margen de app.js");
  assert.match(read("service-worker.js"), /"\.\/novedades\.js",/);
  assert.doesNotMatch(read("service-worker.js"), /version\.json/, "version.json nunca pasa por la caché del Service Worker");
});

test("el build escribe la misma versión en version.json y en ux-shell.js (también minificado)", () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), "nxp2-dist-"));
  try {
    execFileSync(process.execPath, [path.join(root, "tools/build-public-site.mjs")], {
      cwd: root,
      stdio: "pipe",
      env: { ...process.env, BUILD_PUBLIC_SITE_DEST: distDir, GITHUB_SHA: SHA_B },
    });
    const published = JSON.parse(fs.readFileSync(path.join(distDir, "version.json"), "utf8"));
    assert.equal(published.version, SHA_B);
    const distShell = fs.readFileSync(path.join(distDir, "ux-shell.js"), "utf8");
    assert.ok(distShell.includes(SHA_B), "ux-shell.js publicado lleva el SHA del build");
    assert.ok(distShell.includes(published.builtAt), "y la misma hora que version.json");
    assert.ok(fs.existsSync(path.join(distDir, "novedades.js")));
    assert.match(fs.readFileSync(path.join(distDir, "service-worker.js"), "utf8"), new RegExp(`finanzas-casa-shell-${SHA_B.slice(0, 12)}`));
    assert.equal(shell.BUILD_INFO.version, "dev", "el fuente no se toca");
  } finally {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
});

// --- Enganche en el navegador, con un DOM mínimo simulado ---------------------------------------

function fakeElement(extra = {}) {
  const listeners = {};
  return {
    hidden: false,
    textContent: "",
    innerHTML: "",
    open: false,
    listeners,
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    fire(type) {
      for (const fn of listeners[type] || []) fn();
    },
    ...extra,
  };
}

function fakeBrowser({ published = SHA_A, cacheKeys = [], controller = true, withServiceWorker = true } = {}) {
  const ids = ["versionStamp", "versionStampLabel", "novedadesBadge", "novedadesList", "updateToast", "updateToastMessage", "updateToastButton"];
  const elements = Object.fromEntries(ids.map((id) => [id, fakeElement()]));
  elements.updateToast.hidden = true;
  elements.updateToastButton.hidden = true;
  const docListeners = {};
  const doc = {
    visibilityState: "visible",
    getElementById: (id) => elements[id] || null,
    addEventListener(type, fn) {
      (docListeners[type] ||= []).push(fn);
    },
  };
  const store = {};
  const sw = fakeElement({ controller: controller ? {} : null, getRegistration: async () => ({ update: async () => {} }) });
  const calls = { fetch: 0, reload: 0 };
  const win = {
    localStorage: { getItem: (key) => store[key] ?? null, setItem: (key, value) => { store[key] = String(value); } },
    navigator: withServiceWorker ? { serviceWorker: sw } : {},
    caches: { keys: async () => cacheKeys },
    fetch: async (url, options) => {
      calls.fetch += 1;
      assert.equal(url, "version.json");
      assert.equal(options.cache, "no-store");
      return { ok: true, json: async () => ({ version: published }) };
    },
    setTimeout: (fn) => fn(),
    location: { reload: () => { calls.reload += 1; } },
  };
  return { elements, doc, win, sw, store, calls };
}

const ENTRIES = [
  { id: "n2", fecha: "2026-10-03", texto: "Segunda <b>", href: "#home" },
  { id: "n1", fecha: "2026-10-02", texto: "Primera" },
];

test("pinta el sello y «Novedades» escapando el texto, y marca como vistas al abrirlas", () => {
  const { elements, doc, win, store } = fakeBrowser();
  shell.mountReleaseInfo({ doc, win, entries: ENTRIES, buildInfo: { version: "dev", builtAt: "" } });
  assert.equal(elements.versionStampLabel.textContent, "Versión de desarrollo");
  assert.match(elements.novedadesList.innerHTML, /<a href="#home">Segunda &lt;b&gt;<\/a>/);
  assert.match(elements.novedadesList.innerHTML, /<time datetime="2026-10-02">2\/10\/2026<\/time> Primera/);
  assert.equal(elements.novedadesBadge.hidden, false);
  assert.equal(elements.novedadesBadge.textContent, "1 nueva");
  elements.versionStamp.open = true;
  elements.versionStamp.fire("toggle");
  assert.equal(store["novedades-ultima-vista"], "n2");
  assert.equal(elements.novedadesBadge.hidden, true);
});

test("en desarrollo no pregunta por la versión publicada ni avisa", async () => {
  const { elements, doc, win, calls } = fakeBrowser({ published: SHA_B });
  shell.mountReleaseInfo({ doc, win, entries: ENTRIES, buildInfo: { version: "dev", builtAt: "" } });
  await flush();
  assert.equal(calls.fetch, 0);
  assert.equal(elements.updateToast.hidden, true);
});

test("con la misma versión publicada no avisa", async () => {
  const { elements, doc, win, calls } = fakeBrowser({ published: SHA_A });
  shell.mountReleaseInfo({ doc, win, entries: ENTRIES, buildInfo: { version: SHA_A, builtAt: "" } });
  await flush();
  assert.equal(calls.fetch, 1);
  assert.equal(elements.updateToast.hidden, true);
});

test("con otra versión publicada avisa y ofrece actualizar cuando ya está descargada; nunca recarga sola", async () => {
  const ready = [`finanzas-casa-shell-${SHA_B.slice(0, 12)}`];
  const { elements, doc, win, calls } = fakeBrowser({ published: SHA_B, cacheKeys: ready });
  shell.mountReleaseInfo({ doc, win, entries: ENTRIES, buildInfo: { version: SHA_A, builtAt: "" } });
  await flush();
  assert.equal(elements.updateToast.hidden, false);
  assert.equal(elements.updateToastButton.hidden, false);
  assert.equal(elements.updateToastMessage.textContent, "Hay una versión nueva de la app.");
  assert.equal(calls.reload, 0, "avisar no es recargar");
  elements.updateToastButton.fire("click");
  assert.equal(calls.reload, 1);
});

test("mientras la versión nueva se descarga, el aviso no ofrece recargar (recargaría la vieja)", async () => {
  const installing = [`finanzas-casa-shell-${SHA_A.slice(0, 12)}`, `finanzas-casa-shell-${SHA_B.slice(0, 12)}`];
  const { elements, doc, win } = fakeBrowser({ published: SHA_B, cacheKeys: installing });
  win.setTimeout = () => {}; // el sondeo siguiente no llega dentro de la prueba
  shell.mountReleaseInfo({ doc, win, entries: ENTRIES, buildInfo: { version: SHA_A, builtAt: "" } });
  await flush();
  assert.equal(elements.updateToast.hidden, false);
  assert.equal(elements.updateToastButton.hidden, true);
  assert.equal(elements.updateToastMessage.textContent, "Descargando la versión nueva…");
});

test("controllerchange avisa solo si la página ya tenía controlador al cargar", () => {
  const withController = fakeBrowser({ controller: true });
  shell.mountReleaseInfo({ doc: withController.doc, win: withController.win, entries: ENTRIES, buildInfo: { version: "dev", builtAt: "" } });
  withController.sw.fire("controllerchange");
  assert.equal(withController.elements.updateToast.hidden, false);

  const firstInstall = fakeBrowser({ controller: false });
  shell.mountReleaseInfo({ doc: firstInstall.doc, win: firstInstall.win, entries: ENTRIES, buildInfo: { version: "dev", builtAt: "" } });
  firstInstall.sw.fire("controllerchange");
  assert.equal(firstInstall.elements.updateToast.hidden, true);
});

test("sin red o sin version.json el sello sigue a la vista y no avisa", async () => {
  const { elements, doc, win } = fakeBrowser();
  win.fetch = async () => {
    throw new Error("sin red");
  };
  shell.mountReleaseInfo({ doc, win, entries: ENTRIES, buildInfo: { version: SHA_A, builtAt: "2026-10-03T10:00:00Z" } });
  await flush();
  assert.equal(elements.versionStampLabel.textContent, "Versión 9d64a55 · 3/10/2026, 12:00");
  assert.equal(elements.updateToast.hidden, true);
});
